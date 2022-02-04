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

export const defaultPlrState: Omit<PlayerState, 'id' | 'gameId' | 'mark' | 'num'> = {
  y: 0,
  direction: null,
  connected: false,
  socketId: '',
};


export type Queue = {
  userId: string;
  socket: Socket;
};

export type State = {
  queue: Queue[];
  games: StoreApi<GamesSlice>;
  players: StoreApi<PlayersSlice>;
};

export type GameId = string;
export type UserId = string;
export type CellId = string;
export type Mark = 'x' | 'o';
export type Direction = null | 'up' | 'down';
export type GamePhase = 'xo' | 'pong';
export type GamePlayState = 'waiting_for_players' | 'starting' | 'playing' | 'paused' | 'finished';

export type XoState = {
  cellId: CellId;
  mark: null | Mark;
  state: null | 'selected' | 'captured';
  user: null | UserId;
};

export type BallState = {
  position: { x: number; y: number };
  speed: { x: number; y: number };
};

export type GameState = {
  id: GameId;
  turn: string;
  playState: GamePlayState;
  phase: GamePhase;
  players: { 1: UserId; 2: UserId; };
  xoState: Map<CellId, XoState>;
  ball: BallState;
  winner: null | UserId;
};

type GamesSlice = {
  records: Map<GameId, GameState>;
  isUserPlayer(gameId: GameId, userId: UserId): boolean;
  delete(gameId: GameId): void;
};

type PlayersSlice = {
  records: Map<UserId, PlayerState>;
};

export type PlayerState = {
  id: UserId;
  gameId: GameId;
  y: number;
  direction: Direction;
  connected: boolean;
  socketId: string;
  mark: Mark;
};

export default state;
