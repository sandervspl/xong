import * as React from 'react';
import type { GetServerSideProps } from 'next';

import type { GetGameByIdQuery } from 'faunadb/generated';
import { sdk } from 'lib/fauna';
import useSocketIO from 'hooks/useSocketIO';
import useLocalStorage from 'hooks/userLocalStorage';
import { useEventListener } from 'hooks/useEventListener';


const GameLobby: React.VFC<Props> = (props) => {
  const socket = useSocketIO();
  const { getItem } = useLocalStorage();
  const playerIds = props.game!.players.data.map((player) => player!._id);
  const [keysPressed, setKeysPressed] = React.useState<Record<string, boolean>>({});
  const userIsPlayer = getItem('user_id') && playerIds.includes(getItem('user_id')!);

  React.useEffect(() => {
    socket?.emit('user-joined-game', getItem('user_id'));
  }, [socket]);

  useEventListener('keydown', (e) => {
    if (!userIsPlayer || keysPressed[e.key]) {
      return;
    }

    setKeysPressed((draft) => {
      draft[e.key] = true;
      return draft;
    });

    socket?.emit('player-key-down', {
      userId: getItem('user_id'),
      key: e.key,
    });
  });

  useEventListener('keyup', (e) => {
    if (!userIsPlayer) {
      return;
    }

    setKeysPressed((draft) => {
      draft[e.key] = false;
      return draft;
    });

    socket?.emit('player-key-up', {
      userId: getItem('user_id'),
      key: e.key,
    });
  });

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
