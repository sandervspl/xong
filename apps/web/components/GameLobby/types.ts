import type * as i from '@xong/types';


export type CombinedPlayerState = {
  username: string;
  id: string;
  gameId: string;
  y: number;
  direction: i.Direction;
  connected: boolean;
  socketId: string;
  mark: i.Mark;
};

export type ClientGameState = Omit<i.GetGameResult['game'], 'xoState'> & {
  xoState: Map<i.CellId, i.XoState>;
};

export type ClientPlayersState = Record<i.UserId, CombinedPlayerState>;
