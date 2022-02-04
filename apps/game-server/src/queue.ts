import type { Socket } from 'socket.io';
import axios from 'axios';

import state, { defaultPlrState } from './state';
import { xoStateInit } from './mocks';


const INTERVAL_TIME = 3 * 1000; // 3 seconds per cycle
let timeout: NodeJS.Timeout | null = null;
let processing = false;

export default async function queueActions(socket: Socket) {
  socket.on('queue', async (data: string) => {
    state.queue.push({ userId: data, socket });
    logQueue();

    // Start queue cycle
    if (!processing && timeout == null) {
      timeout = setTimeout(processQueue, INTERVAL_TIME);
    }
  });
}

async function processQueue() {
  // Nothing to process, wait for new user to queue
  if (state.queue.length < 2) {
    timeout = null;
    return;
  }

  // Start processing players into games
  processing = true;
  console.info(state.queue.length, 'users have queued.', 'Processing...');

  // Save game create requests in a promise array to resolve all
  const createGameRequests = [];
  // Create a copy of the queue
  const pool = [...state.queue];

  while (pool.length >= 2) {
    // Remove from pool
    const p1 = pool.shift();
    const p2 = pool.shift();

    if (p1 == null || p2 == null) {
      console.error('p1 or p2 is null', p1, p2);
      break;
    }

    // Remove also from queue (I think this is safe?)
    state.queue.shift();
    state.queue.shift();

    // Let users know their game is being created
    p1?.socket.emit('game-ready');
    p2?.socket.emit('game-ready');

    // Add game create request to array to resolve later
    createGameRequests.push(
      new Promise(async (resolve) => {
        // Grabbing origin from socket header, should be fine?...
        const { origin } = p1.socket.handshake.headers;
        // Create game
        const game = await axios.post(`${origin}/api/games`, [p1?.userId, p2?.userId]);

        if (!game) {
          for (const plr of [p1, p2]) {
            return plr.socket.emit('game-create-fail');
          }
        }

        // Create game in state
        state.games.setState((state) => {
          const clone = new Map(state.records);

          clone.set(game.data._id, {
            id: game.data._id,
            turn: p1.userId,
            playState: 'waiting_for_players',
            phase: 'xo',
            players: {
              1: p1.userId,
              2: p2.userId,
            },
            xoState: xoStateInit,
            ball: {
              position: { x: -100, y: -100 },
              speed: { x: 0, y: 0 },
            },
            winner: null,
          });

          return {
            ...state,
            records: clone,
          };
        });

        // Upsert users in state
        state.players.setState((state) => {
          const clone = new Map(state.records);

          clone.set(p1.userId, {
            ...defaultPlrState,
            id: p1.userId,
            gameId: game.data._id,
            mark: 'x',
          });
          clone.set(p2.userId, {
            ...defaultPlrState,
            gameId: game.data._id,
            id: p2.userId,
            mark: 'o',
          });

          return {
            ...state,
            records: clone,
          };
        });

        // Emit Game Ready to users
        setTimeout(() => {
          p1?.socket.emit('game-created', game.data._id);
          p2?.socket.emit('game-created', game.data._id);

          // console.info('New game created', {
          //   p1: p1?.userId,
          //   p2: p2?.userId,
          //   game: game.data._id,
          // });
        }, 1000);

        resolve(true);
      }),
    );
  }

  // Process all requests
  if (createGameRequests.length > 0) {
    Promise.all(createGameRequests)
      .then(() => {
        console.info('Done processing queue!');
      })
      .catch((err) => {
        console.error('Something went wrong processing queue!');
        console.error(err);
      })
      .finally(() => {
        timeout = setTimeout(processQueue, INTERVAL_TIME);
        processing = false;
      });
  }
}

function logQueue() {
  console.info({
    state: state.queue.map((val) => val.userId),
  });
}
