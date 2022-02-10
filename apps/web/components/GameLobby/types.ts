import type * as i from '@xong/types';


export type CombinedPlayerState = i.PlayerState & {
  username: string;
};

export type ClientGameState = Omit<i.GetGameResult['game'], 'xoState'> & {
  xoState: Map<i.CellId, i.XoState>;
};

export type ClientPlayersState = Record<i.UserId, CombinedPlayerState>;
