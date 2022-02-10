import type * as i from '@xong/types';
import type { Express } from 'express';

import { state, getGame } from './state';


export default async function createAPI(app: Express) {
  app.get('/game/:id', (req, res) => {
    const game = getGame(req.params.id);
    const gstate = game.getState();

    const players: Record<i.UserId, i.PlayerState> = {};
    for (const plr of game.getPlayers()) {
      if (plr?.gameId === req.params.id) {
        players[plr.id] = plr;
      }
    }

    if (gstate) {
      const data: i.GetGameResult = {
        players,
        game: {
          ...gstate,
          xoState: [...gstate.xoState], // Serialize map to array
        },
      };

      return res.status(200).json(data);
    }

    console.error(
      'ERR /game/:id No game found for id',
      { id: req.params.id, games: state.games }
    );

    return res.status(404).send();
  });
}
