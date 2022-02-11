import type * as i from '@xong/types';


export type CombinedPlayerState = i.PlayerState & {
  username: string;
};

export type ClientPlayersState = Record<i.UserId, CombinedPlayerState>;
