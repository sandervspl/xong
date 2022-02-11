import type * as gi from './game';


export type PlayerConnectUpdateData = {
  userId: string;
  connected: boolean;
};

export type PlayerKeypressData = {
  userId: string;
  direction: gi.Direction;
};

export type PlayerKeypressUpData = PlayerKeypressData & {
  y: number;
};

export type BallTickData = gi.BallState;

export type PlayerSelectCellData = {
  xoState: gi.XoFieldState;
  phase: gi.PhaseTypes;
};

export type PlayerHitCellData = {
  xoState: gi.XoFieldState;
  turn: gi.UserId;
  phase: gi.PhaseTypes;
  playState: gi.PlaystateTypes;
  winner: null | gi.UserId;
};

export type PlaystateUpdateData = gi.PlaystateTypes;

export type PlaystateStartingData = {
  playState: 'starting';
  ball: gi.BallState;
}

export type PlaystatePlayingData = {
  playState: 'playing';
  ball: gi.BallState;
};

export type UserJoinedData = void;

export type UserLeftData = {
  userId: gi.UserId;
  isPlayer: boolean;
  reason: string | null;
  winner: gi.UserId;
};
