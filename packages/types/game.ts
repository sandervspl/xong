export type GameId = string;
export type UserId = string;
export type CellId = string;
export type Mark = 'x' | 'o';
export type Direction = null | 'up' | 'down';
export type PhaseTypes = 'pong' | 'xo';
export type PlaystateTypes = 'waiting_for_players' | 'starting' | 'playing' | 'paused' | 'finished';
export type XY = { x: number; y: number };
export type CellState = null | 'selected' | 'captured';

export type BallState = {
  position: XY;
  speed: XY;
};

export type PlayerState = {
  id: UserId;
  gameId: GameId;
  position: XY;
  speed: XY;
  direction: Direction;
  connected: boolean;
  socketId: string;
  mark: Mark;
};

export type GameState = {
  id: GameId;
  turn: string;
  playState: PlaystateTypes;
  phase: PhaseTypes;
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
