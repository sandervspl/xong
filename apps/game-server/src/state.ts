import type * as i from '@xong/types';
import type { Socket } from 'socket.io';
import { produce } from 'immer';

// import { gameMock, mockPlayers } from 'mocks';

// const initGames = process.env.NODE_ENV === 'development'
//   ? gameMock
//   : new Map();

// const initPlayers = process.env.NODE_ENV === 'development'
//   ? mockPlayers
//   : new Map();

type PlayerStateUpdater = (plr: i.PlayerState) => void;
type GameStateUpdater = (gameState: i.GameState) => void;

export const state: State = {
  queue: [],
  games: {},
  players: {},
};

export function getPlayer(id?: i.UserId) {
  function getState(): i.PlayerState | undefined {
    return state.players[id || ''];
  }

  function setState(cb: PlayerStateUpdater) {
    if (!id) {
      return;
    }
    state.players[id] = produce(state.players[id], cb)!;
  }

  return {
    getState,
    setState,
  };
}

export function getGame(id: i.GameId) {
  function getState() {
    return state.games[id];
  }

  function setState(cb: GameStateUpdater) {
    state.games[id] = produce(state.games[id], cb)!;
  }

  function isUserPlayer(userId: i.UserId) {
    return Object.values(state.games[id]?.players || {}).includes(userId);
  }

  function getPlayers() {
    const game = state.games[id];

    if (!game) {
      return [];
    }

    const plrs = [];
    for (const id of Object.values(game.players)) {
      plrs.push(getPlayer(id).getState());
    }

    return plrs;
  }

  function remove() {
    setTimeout(() => {
      for (const plrId of Object.values(state.games[id]?.players || {})) {
        const plr = getPlayer(plrId);
        const pstate = plr.getState();
        if (!pstate?.connected) {
          delete state.players[plrId];
        }
        else if (pstate?.gameId === id) {
          plr.setState((draft) => {
            draft.gameId = '';
          });
        }
      }

      delete state.games[id];
    }, 5 * 60 * 1000);
  }

  return {
    getState,
    setState,
    getPlayer,
    isUserPlayer,
    getPlayers,
    remove,
  };
}

type PlrStateOmit = 'id' | 'gameId' | 'mark' | 'num' | 'position';
export const defaultPlrState: Omit<i.PlayerState, PlrStateOmit > = {
  direction: null,
  connected: false,
  socketId: '',
  speed: { x: 0, y: 0 },
};

export default state;

export type Queue = {
  userId: string;
  socket: Socket;
};

type GamesSlice = Record<i.GameId, i.GameState>;
type PlayersSlice = Record<i.UserId, i.PlayerState>;

export type State = {
  queue: Queue[];
  games: GamesSlice;
  players: PlayersSlice;
};

