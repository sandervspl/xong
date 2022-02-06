import type * as i from '@xong/types';
import type { Socket } from 'socket.io';
import type { StoreApi } from 'zustand/vanilla';
import create from 'zustand/vanilla';

import { gameMock, mockPlayers } from 'mocks';


const initGames = process.env.NODE_ENV === 'development'
  ? gameMock
  : new Map();

const initPlayers = process.env.NODE_ENV === 'development'
  ? mockPlayers
  : new Map();

const state: State = {
  queue: [],
  games: create<GamesSlice>((set, get) => ({
    records: initGames,
    isUserPlayer(gameId: string, userId: string): boolean {
      const game = get().records.get(gameId);

      if (game) {
        return Object.values(game.players).includes(userId);
      }

      return false;
    },
    delete(gameId: string): void {
      get().records.delete(gameId);
    },
  })),
  players: create<PlayersSlice>((set, get) => ({
    records: initPlayers,
  })),
};

// 5 minutes
export function deleteGame(gameId: string, timer = 5 * 60 * 1000): void {
  setTimeout(() => {
    state.games.getState().delete(gameId);

    for (const plr of state.players.getState().records.values()) {
      if (plr.gameId === gameId) {
        state.players.getState().records.set(plr.id, {
          ...state.players.getState().records.get(plr.id)!,
          gameId: '',
        });
      }
    }

    console.info('Game deleted', gameId);
  }, timer);
}

export const defaultPlrState: Omit<i.PlayerState, 'id' | 'gameId' | 'mark' | 'num'> = {
  y: 0,
  direction: null,
  connected: false,
  socketId: '',
};

export default state;

export type Queue = {
  userId: string;
  socket: Socket;
};

type GamesSlice = {
  records: Map<i.GameId, i.GameState>;
  isUserPlayer(gameId: i.GameId, userId: i.UserId): boolean;
  delete(gameId: i.GameId): void;
};

type PlayersSlice = {
  records: Map<i.UserId, i.PlayerState>;
};

export type State = {
  queue: Queue[];
  games: StoreApi<GamesSlice>;
  players: StoreApi<PlayersSlice>;
};

