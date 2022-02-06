export type GameId = string;
export type UserId = string;
export type CellId = string;
export type Mark = 'x' | 'o';
export type Direction = null | 'up' | 'down';
export type GamePhase = 'xo' | 'pong';
export type GamePlayState = 'waiting_for_players' | 'starting' | 'playing' | 'paused' | 'finished';

export type BallState = {
  position: { x: number; y: number };
  speed: { x: number; y: number };
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

export type XoState = {
  cellId: CellId;
  mark: null | Mark;
  state: null | 'selected' | 'captured';
  user: null | UserId;
};
