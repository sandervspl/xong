import http from 'http';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';

import type { PlayerState, UserId } from './state';
import state from './state';
import queueActions from './queue';
import gameActions from './game';


const CORS_DOMAIN_LIST = [
  'http://localhost:3000',
  'https://develop--xong.netlify.app',
  'https://xong.netlify.app',
  'https://xong-git-develop-sandervspl.vercel.app',
  'https://xong-sandervspl.vercel.app',
];


const app = express();
app.use(cors({
  origin: CORS_DOMAIN_LIST,
}));

app.get('/game/:id', (req, res) => {
  const game = state.games.getState().records.get(req.params.id);

  const players: Record<UserId, PlayerState> = {};
  for (const plr of state.players.getState().records.values()) {
    if (plr.gameId === req.params.id) {
      players[plr.id] = state.players.getState().records.get(plr.id)!;
    }
  }

  if (game) {
    return res.status(200).json({
      game: {
        ...game,
        xoState: [...game.xoState],
      },
      players,
    });
  }

  console.error(
    'ERR /game/:id No game found for id',
    { id: req.params.id, games: [...state.games.getState().records] }
  );

  return res.status(404).send();
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: CORS_DOMAIN_LIST,
    credentials: true,
  },
});

io.on('connect', (socket) => {
  // console.info('a user connected', socket.id);

  socket.on('disconnect', () => {
    // console.info(socket.id, 'disconnected');
    state.queue = state.queue.filter((val) => val.socket.id !== socket.id);

    for (const plr of state.players.getState().records.values()) {
      if (plr.socketId === socket.id) {
        const pstate = state.players.getState();

        pstate.records.set(plr.id, {
          ...plr,
          connected: false,
          socketId: '',
        });

        socket.leave(plr.gameId);
        socket.to(plr.gameId).emit('player-connect-update', {
          userId: plr.id,
          connected: false,
        });
      }
    }
  });

  queueActions(socket);
  gameActions(socket, io);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.info(`listening on ${PORT}`);
});
