import type * as i from '@xong/types';


export type FieldCellState = i.XoState & {
  x: number;
  y: number;
};

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
  x: number;
  y: number;
  width: number;
  height: number;
  direction: i.Direction;
  mark: i.Mark;
  speed: { x: number; y: number };
};
