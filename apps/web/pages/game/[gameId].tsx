import * as React from 'react';
import type { GetServerSideProps } from 'next';

import type { GetGameByIdQuery } from 'faunadb/generated';
import fetcher from 'utils/fetcher';
import redirect from 'utils/redirect';


const GameLobby: React.VFC<Props> = (props) => {
  return (
    <div>
      <h1 className="text-9xl">Game Lobby</h1>
      {props.game && <pre>game: {JSON.stringify(props.game, null, 2)}</pre>}
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const game = await fetcher<Game>(`/api/games/${ctx.params!.gameId}`, ctx);

  if (!game) {
    return redirect(ctx.res);
  }

  return {
    props: {
      game,
    },
  };
};

export type Game = Promise<GetGameByIdQuery['findGameByID'] | null>;

export type Props = {
  game: Game;
};

export type Queries = {
  gameId: string;
};

export default GameLobby;
