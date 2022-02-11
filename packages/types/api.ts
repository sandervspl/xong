import type * as gi from './game';
import type * as si from './socket';


export type GetGameResult = {
  players: Record<gi.UserId, gi.PlayerState>;
  game: gi.GameState;
}
