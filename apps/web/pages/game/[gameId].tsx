import * as React from 'react';
import type { GetServerSideProps } from 'next';

import type { GetGameByIdQuery } from 'faunadb/generated';
import { sdk } from 'lib/fauna';


const GameLobby: React.VFC<Props> = (props) => {
  return (
    <div className="text-primary-500">
      <h1 className="text-9xl">Game Lobby</h1>
      <p className="text-3xl">
        {props.game?.players.data[0]?.username} vs {props.game?.players.data[1]?.username}
      </p>
    </div>
  );
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const game = await sdk.GetGameById({ id: ctx.query!.gameId as string });

  if (!game.findGameByID) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  return {
    props: {
      game: game.findGameByID,
    },
  };
};

export type Game = GetGameByIdQuery['findGameByID'] | null;

export type Props = {
  game: Game;
};

export type Queries = {
  gameId: string;
};

export default GameLobby;
