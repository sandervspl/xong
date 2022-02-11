import type * as i from '@xong/types';


export type XoCellStateClient = i.XoCellState & {
  x: number;
  y: number;
};

export type XoFieldStateClient = Record<i.CellId, XoCellStateClient>;

export type ServerPlayerState = {
  id: i.UserId;
  y: number;
  direction: i.Direction;
  mark: i.Mark;
  connected: boolean;
  socketId: string;
};

export type ClientPlayerState = {
  id: string;
  width: number;
  height: number;
  direction: i.Direction;
  mark: i.Mark;
  speed: i.XY;
  position: i.XY;
};
