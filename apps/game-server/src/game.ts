import type * as i from '@xong/types';
import * as c from '@xong/constants';
import type { Server, Socket } from 'socket.io';

import { state, getGame, getPlayer } from './state';


export default async function gameActions(socket: Socket, io: Server) {
  socket.on(c.USER_JOINED_GAME, (data: UserJoinedGameData) => {
    // console.info('user joined a game', data);

    // Join game room
    socket.join(data.gameId);

    const game = getGame(data.gameId);
    const gstate = game.getState();

    if (!gstate) {
      console.error(`ERR "${c.USER_JOINED_GAME}": No game found`, data, { gstate });
      return;
    }

    const players = game.getPlayers().reduce((acc, plr) => {
      if (!plr) return acc;
      acc[plr.id] = plr;
      return acc;
    }, {} as Record<i.UserId, i.PlayerState>);

    // Send game state to user
    socket.emit(c.USER_JOINED_GAME, {
      game: {
        ...game.getState(),
        xoState: [...gstate.xoState], // Serialize map to array
      },
      players,
    });

    if (game.isUserPlayer(data.userId)) {
      const player = getPlayer(data.userId);

      if (!player.getState()) {
        console.error(`ERR "${c.USER_JOINED_GAME}": No player found for game`, data, game.getPlayers());
        return;
      }

      player.setState((draft) => {
        draft.connected = true;
        draft.socketId = socket.id;
        draft.gameId = data.gameId;
      });

      io.to(data.gameId).emit(c.PLAYER_CONNECT_UPDATE, {
        userId: data.userId,
        connected: true,
      });

      const gstate = game.getState();

      if (!gstate) {
        console.error(`ERR "${c.USER_JOINED_GAME}": No game found`, data, { gameState: gstate });
        return;
      }

      const [p1Id, p2Id] = Object.values(gstate.players);
      if (!p1Id || !p2Id) {
        console.error(`ERR "${c.USER_JOINED_GAME}": No player found`, data, { p1Id, p2Id });
        return;
      }

      const allConnected = game.getPlayers().every((plr) => plr?.connected);
      if (allConnected && gstate.playState !== 'playing') {
        const next: i.GameState['playState'] = 'starting';

        game.setState((draft) => {
          draft.playState = next;
        });

        io.to(data.gameId).emit(c.GAME_PLAYSTATE_UPDATE, next);
      }
    }
  });

  socket.on(c.USER_LEFT_GAME, (data: UserLeftGameData) => {
    socket.leave(data.gameId);

    const game = getGame(data.gameId);
    const isPlayer = game.isUserPlayer(data.userId);
    let reason: string | null = null;

    const winner = game.getPlayers().filter((plr) => plr?.id !== data.userId)[0];

    if (isPlayer) {
      game.setState((draft) => {
        draft.playState = 'finished';
        if (winner) {
          draft.winner = winner.id;
        }
      });

      reason = 'Player left';

      game.remove();
    }

    io.to(data.gameId).emit(c.USER_LEFT_GAME, {
      userId: data.userId,
      isPlayer,
      reason,
      winner: winner?.id,
    });
  });

  socket.on(c.GAME_PLAYSTATE_UPDATE, (data: GamePlayStateData) => {
    getGame(data.gameId).setState((draft) => {
      draft.playState = data.playState;
    });

    io.to(data.gameId).emit(c.GAME_PLAYSTATE_UPDATE, data.playState);
  });

  socket.on(c.PLAYER_KEY_DOWN, (data: KeypressData) => {
    const game = getGame(data.gameId);
    const player = getPlayer(data.userId);

    if (!game.getState() || !player.getState() || !game.isUserPlayer(data.userId)) {
      // console.error(`ERR "${c.PLAYER_KEY_DOWN}": no game or player found`, data, { game, player });
      return;
    }

    player.setState((draft) => {
      draft.direction = data.direction;
    });

    // only seems to work if I emit from server, not socket
    io.to(data.gameId).emit(c.PLAYER_KEY_DOWN, {
      userId: data.userId,
      direction: data.direction,
    });
  });

  socket.on(c.PLAYER_KEY_UP, (data: KeypressDataUp) => {
    const game = getGame(data.gameId);
    const player = getPlayer(data.userId);

    if (!game.getState()) {
      console.error(`ERR ${c.PLAYER_KEY_UP}: no game found`, data, state.games);
      return;
    }
    if (!player.getState()) {
      console.error(`ERR ${c.PLAYER_KEY_UP}: no plr found`, data, state.players);
      return;
    }
    if (!game.isUserPlayer(data.userId)) {
      console.error(`ERR ${c.PLAYER_KEY_UP}: user is not player`, data, state.games);
      return;
    }

    player.setState((draft) => {
      draft.direction = data.direction;
      draft.y = data.y;
    });

    // only seems to work if I emit from server, not socket
    io.to(data.gameId).emit(c.PLAYER_KEY_UP, {
      userId: data.userId,
      direction: data.direction,
      y: data.y,
    });
  });

  socket.on(c.PLAYER_SELECT_CELL, (data: SelectCellData) => {
    const game = getGame(data.gameId);
    const gstate = game.getState();
    if (!gstate) {
      console.error(`ERR "${c.PLAYER_SELECT_CELL}": no game found`, data, state.games);
      return;
    }

    if (!game.isUserPlayer(data.userId)) {
      console.error(`ERR "${c.PLAYER_SELECT_CELL}": user is not player`, data, gstate);
      return;
    }

    const pstate = getPlayer(gstate.turn).getState();
    if (!pstate) {
      console.error(`ERR "${c.PLAYER_SELECT_CELL}": no player found`, data, state.players);
      return;
    }

    if (gstate.turn !== data.userId) {
      return;
    }

    if (gstate.xoState.get(data.cellId)?.state != null) {
      return;
    }

    const nextPhase: i.GamePhase = 'pong';
    const nextXoState = new Map(gstate.xoState);
    nextXoState.set(data.cellId, {
      cellId: data.cellId,
      mark: pstate.mark,
      state: 'selected',
      user: gstate.turn,
    });

    game.setState((draft) => {
      draft.xoState = nextXoState;
      draft.phase = nextPhase;
    });

    io.to(data.gameId).emit(c.PLAYER_SELECT_CELL, {
      xoState: [...nextXoState],
      phase: nextPhase,
    });
  });

  socket.on(c.PLAYER_HIT_CELL, (data: HitCellData) => {
    const game = getGame(data.gameId);
    const gstate = game.getState();

    if (!gstate) {
      console.error(`ERR "${c.PLAYER_HIT_CELL}": no game found`, data, state.games);
      return;
    }

    if (gstate.turn !== data.userId) {
      console.error(`ERR "${c.PLAYER_HIT_CELL}": not user's turn`, data, gstate);
      return;
    }

    // Update XO field
    const nextXoState = new Map(gstate.xoState);
    const curState = gstate.xoState.get(data.cellId);

    if (!curState || !curState.user) {
      console.error(`ERR ${c.PLAYER_HIT_CELL}: no curstate found`, data, gstate);
      return;
    }

    const pstate = getPlayer(curState.user).getState();
    if (!pstate) {
      console.error(`ERR ${c.PLAYER_HIT_CELL}: no pstate found`, data, state.players);
      return;
    }

    nextXoState.set(data.cellId, {
      cellId: data.cellId,
      mark: pstate.mark,
      state: 'captured',
      user: curState.user,
    });

    // Update user turn
    const nextTurn = gstate.turn === gstate.players[1]
      ? gstate.players[2]
      : gstate.players[1];

    const nextPhase: i.GamePhase = 'xo';

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
      const isWin = cells.every((cell) => cell?.state === 'captured' && cell.user === data.userId);

      if (!win && isWin) {
        console.info('win found!', cells);
        win = isWin;
      }
    }

    let draw = false;
    if (!win) {
      draw = [...nextXoState.values()].every((cell) => {
        return cell.state === 'captured';
      });
    }

    // Save to state
    game.setState((draft) => {
      draft.xoState = nextXoState;
      draft.turn = nextTurn;
      draft.phase = nextPhase;

      if (win || draw) {
        draft.playState = 'finished';
        draft.winner =  win ? data.userId : 'draw';
      }
    });

    const nextGameState = getGame(data.gameId).getState();

    if (!nextGameState) {
      console.error(`ERR ${c.PLAYER_HIT_CELL}: no nextGameState found`, data, state.games);
      return;
    }

    // Emit to users
    io.to(data.gameId).emit(c.PLAYER_HIT_CELL, {
      xoState: [...nextXoState],
      turn: nextGameState.turn,
      phase: nextGameState.phase,
      playState: nextGameState.playState,
      winner: nextGameState.winner,
    });
  });

  // socket.on(c.BALL_HIT_OBJECT, (data: BallHitObjectData) => {
  //   const game = getGame(data.gameId);
  //   const gstate = game.getState();

  //   if (!gstate) {
  //     console.error(`ERR ${c.BALL_HIT_OBJECT}: no game found`, data, state.games);
  //     return;
  //   }

  //   const nextBall = { ...data.ball };

  //   game.setState((draft) => {
  //     draft.ball = nextBall;
  //   });

  //   io.to(data.gameId).emit(c.BALL_HIT_OBJECT, {
  //     ball: nextBall,
  //   });
  // });
}

type KeypressData = {
  gameId: i.GameId;
  userId: i.UserId;
  direction: i.Direction;
};

type KeypressDataUp = KeypressData & {
  y: number;
};

type UserJoinedGameData = {
  userId: i.UserId;
  gameId: i.GameId;
};

type UserLeftGameData = {
  userId: i.UserId;
  gameId: i.GameId;
};

type SelectCellData = {
  gameId: i.GameId;
  userId: i.UserId;
  cellId: i.CellId;
};

type HitCellData = {
  gameId: i.GameId;
  userId: i.UserId;
  cellId: i.CellId;
};

type GamePlayStateData = {
  gameId: i.GameId;
  playState: i.GameState['playState'];
};

type BallHitObjectData = {
  gameId: i.GameId;
  ball: {
    position: { x: number; y: number };
    speed: { x: number; y: number };
  };
};
