import { PLAYER_HIT_CELL } from '@xong/constants';
import type { Server, Socket } from 'socket.io';

import type { CellId, Direction, GameId, GamePhase, GameState, UserId } from './state';
import state, { deleteGame } from './state';


export default async function gameActions(socket: Socket, io: Server) {
  socket.on('user-joined-game', (data: UserJoinedGameData) => {
    // console.info('user joined a game', data);

    // Join game room
    socket.join(data.gameId);

    const gstate = state.games.getState();
    const game = gstate.records.get(data.gameId);

    if (!game) {
      console.error('ERR "user-joined-game": No game found', data, { game, state: [...gstate.records] });
      return;
    }

    const plrRecords = state.players.getState().records;
    const players = {
      [game.players[1]]: plrRecords.get(game.players[1]),
      [game.players[2]]: plrRecords.get(game.players[2]),
    };

    // Send game state to user
    socket.emit('user-joined-game', {
      game: {
        ...game,
        xoState: [...game.xoState], // Serialize map to array
      },
      players,
    });

    if (gstate.isUserPlayer(data.gameId, data.userId)) {
      const pstate = state.players.getState();
      const player = pstate.records.get(data.userId);

      if (!player) {
        console.error('ERR "user-joined-game": No player found for game', data, { player });
        return;
      }

      pstate.records.set(data.userId, {
        ...player,
        connected: true,
        socketId: socket.id,
        gameId: data.gameId,
      });

      io.to(data.gameId).emit('player-connect-update', {
        userId: data.userId,
        connected: true,
      });

      const gameState = state.games.getState().records.get(data.gameId);
      const plrState = state.players.getState().records;

      if (!gameState) {
        console.error('ERR "user-joined-game": No game found', data, { gameState });
        return;
      }

      const [p1Id, p2Id] = Object.values(gameState.players);
      if (!p1Id || !p2Id) {
        console.error('ERR "user-joined-game": No player found', data, { p1Id, p2Id });
        return;
      }

      const allConnected = plrState.get(p1Id)?.connected && plrState.get(p2Id)?.connected;
      if (allConnected && gameState.playState !== 'playing') {
        const next: GameState['playState'] = 'starting';

        state.games.getState().records.set(data.gameId, {
          ...gameState,
          playState: next,
        });

        io.to(data.gameId).emit('game-playstate-update', next);
      }
    }
  });

  socket.on('user-left-game', (data: UserLeftGameData) => {
    socket.leave(data.gameId);

    const gstate = state.games.getState();
    const isPlayer = gstate.isUserPlayer(data.gameId, data.userId);
    let reason: string | null = null;

    if (isPlayer) {
      gstate.records.set(data.gameId, {
        ...gstate.records.get(data.gameId)!,
        playState: 'finished',
      });

      reason = 'Player left';

      deleteGame(data.gameId);
    }

    io.to(data.gameId).emit('user-left-game', {
      userId: data.userId,
      isPlayer,
      reason,
    });
  });

  socket.on('game-playstate-update', (data: GamePlayStateData) => {
    state.games.getState().records.set(data.gameId, {
      ...state.games.getState().records.get(data.gameId)!,
      playState: data.playState,
    });

    io.to(data.gameId).emit('game-playstate-update', data.playState);
  });

  socket.on('player-key-down', (data: KeypressData) => {
    const game = state.games.getState().records.get(data.gameId);
    const player = state.players.getState().records.get(data.userId);

    if (!game || !player || !state.games.getState().isUserPlayer(data.gameId, data.userId)) {
      console.error('ERR "player-key-down": no game or player found', data, { game, player });
      return;
    }

    state.players.getState().records.set(data.userId, {
      ...player,
      direction: data.direction,
    });

    // only seems to work if I emit from server, not socket
    io.to(data.gameId).emit('player-key-down', {
      userId: data.userId,
      direction: data.direction,
    });
  });

  socket.on('player-key-up', (data: KeypressDataUp) => {
    const game = state.games.getState().records.get(data.gameId);
    const player = state.players.getState().records.get(data.userId);

    if (!game || !player || !state.games.getState().isUserPlayer(data.gameId, data.userId)) {
      console.error('ERR "player-key-up": no game or player found', data, { game, player });
      return;
    }

    state.players.getState().records.set(data.userId, {
      ...player,
      direction: data.direction,
      y: data.y,
    });

    // only seems to work if I emit from server, not socket
    io.to(data.gameId).emit('player-key-up', {
      userId: data.userId,
      direction: data.direction,
      y: data.y,
    });
  });

  socket.on('player-select-cell', (data: SelectCellData) => {
    const game = state.games.getState().records.get(data.gameId);
    if (!game || state.games.getState().isUserPlayer(data.userId, data.userId)) {
      console.error('ERR "player-select-cell": no game found', data, { game });
      return;
    }

    const plr = state.players.getState().records.get(game.turn);
    if (!plr) {
      console.error('ERR "player-select-cell": no player found', data);
      return;
    }

    if (game.turn !== data.userId) {
      return;
    }

    if (game.xoState.get(data.cellId)?.state != null) {
      return;
    }

    const nextPhase: GamePhase = 'pong';
    const nextXoState = new Map(game.xoState);
    nextXoState.set(data.cellId, {
      cellId: data.cellId,
      mark: plr.mark,
      state: 'selected',
      user: game.turn,
    });

    state.games.getState().records.set(data.gameId, {
      ...game,
      xoState: nextXoState,
      phase: nextPhase,
    });

    io.to(data.gameId).emit('player-select-cell', {
      xoState: [...nextXoState],
      phase: nextPhase,
    });
  });

  socket.on(PLAYER_HIT_CELL, (data: HitCellData) => {
    const gstate = state.games.getState();
    const pstate = state.players.getState();
    const game = gstate.records.get(data.gameId);

    if (!game) {
      console.error(`ERR "${PLAYER_HIT_CELL}": no game found`, data);
      return;
    }

    if (game.turn !== data.userId) {
      return;
    }

    // Update XO field
    const nextXoState = new Map(game.xoState);
    const curState = game.xoState.get(data.cellId);

    if (!curState || !curState.user) {
      console.error(`ERR ${PLAYER_HIT_CELL}: no curstate found`, data);
      return;
    }

    const plr = pstate.records.get(curState.user)!;

    nextXoState.set(data.cellId, {
      cellId: data.cellId,
      mark: plr.mark,
      state: 'captured',
      user: curState.user,
    });

    // Update user turn
    const nextTurn = game.turn === game.players[1]
      ? game.players[2]
      : game.players[1];

    const nextPhase: GamePhase = 'xo';

    // Check win condition
    const possibilities = [
      [nextXoState.get('00'), nextXoState.get('01'), nextXoState.get('02')], // col 1
      [nextXoState.get('10'), nextXoState.get('11'), nextXoState.get('12')], // col 2
      [nextXoState.get('20'), nextXoState.get('21'), nextXoState.get('22')], // col 3
      [nextXoState.get('00'), nextXoState.get('10'), nextXoState.get('20')], // row 1
      [nextXoState.get('01'), nextXoState.get('11'), nextXoState.get('12')], // row 2
      [nextXoState.get('02'), nextXoState.get('12'), nextXoState.get('22')], // row 3
      [nextXoState.get('00'), nextXoState.get('11'), nextXoState.get('22')], // top left bot right
      [nextXoState.get('20'), nextXoState.get('11'), nextXoState.get('02')], // top right bot left
    ];

    let win = false;
    for (const cells of possibilities) {
      win = win || cells.every((cell) => cell?.state === 'captured' && cell.user === data.userId);
    }

    let draw = false;
    if (!win) {
      draw = [...nextXoState.values()].every((cell) => {
        return cell.state === 'captured';
      });
    }

    const nextGameState: GameState = {
      ...game,
      xoState: nextXoState,
      turn: nextTurn,
      phase: nextPhase,
    };

    if (win || draw) {
      nextGameState.playState = 'finished';
      nextGameState.winner =  win ? data.userId : 'draw';
    }

    // Save to state
    gstate.records.set(data.gameId, nextGameState);

    // Emit to users
    io.to(data.gameId).emit(PLAYER_HIT_CELL, {
      xoState: [...nextXoState],
      turn: nextGameState.turn,
      phase: nextGameState.phase,
      playState: nextGameState.playState,
      winner: nextGameState.winner,
    });
  });

  socket.on('ball-hit-object', (data: BallHitObjectData) => {
    const gstate = state.games.getState();
    const game = gstate.records.get(data.gameId);

    if (!game) {
      // console.error('ERR "ball-hit-object": no game found', data);
      return;
    }

    const nextBall = { ...data.ball };

    gstate.records.set(data.gameId, {
      ...game,
      ball: nextBall,
    });

    io.to(data.gameId).emit('ball-hit-object', {
      ball: nextBall,
    });
  });
}

type KeypressData = {
  gameId: GameId;
  userId: UserId;
  direction: Direction;
};

type KeypressDataUp = KeypressData & {
  y: number;
};

type UserJoinedGameData = {
  userId: UserId;
  gameId: GameId;
};

type UserLeftGameData = {
  userId: UserId;
  gameId: GameId;
};

type SelectCellData = {
  gameId: GameId;
  userId: UserId;
  cellId: CellId;
};

type HitCellData = {
  gameId: GameId;
  userId: UserId;
  cellId: CellId;
};

type GamePlayStateData = {
  gameId: GameId;
  playState: GameState['playState'];
};

type BallHitObjectData = {
  gameId: GameId;
  ball: {
    position: { x: number; y: number };
    speed: { x: number; y: number };
  };
};
