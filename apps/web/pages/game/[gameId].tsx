import * as React from 'react';
import type { GetServerSideProps } from 'next';

import type { GetGameByIdQuery } from 'faunadb/generated';
import { sdk } from 'lib/fauna';
import Game from 'lib/Game';
import useSocketIO from 'hooks/useSocketIO';
import useLocalStorage from 'hooks/userLocalStorage';


const GameLobby: React.VFC<Props> = (props) => {
  const socket = useSocketIO();
  const { getItem } = useLocalStorage();
  const playerIds = props.game!.players.data.map((player) => player!._id);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gameRef = React.useRef<Game | null>(null);
  const user = getItem('usernames')?.find((val) => val.active && playerIds.includes(val.id));
  const userIsPlayer = !!user && playerIds.includes(user.id);

  React.useEffect(() => {
    if (socket) {
      socket.emit('user-joined-game', user?.id);

      socket.on('game-start', () => {
        gameRef.current!.start();
      });

      gameRef.current = new Game(canvasRef.current!, socket, props.game, userIsPlayer);
    }
  }, [socket]);

  return (
    <div className="text-primary-500">
      <div className="grid place-items-center h-screen w-screen">
        <div className="w-[1200px]">
          <div className="text-4xl flex justify-between">
            <span>{props.game?.players.data[0]?.username}</span>
            <span>0 - 0</span>
            <span>{props.game?.players.data[1]?.username}</span>
          </div>
          <canvas
            id="game"
            ref={canvasRef}
            className="border-primary-900 border-solid border-2 w-full h-[600px]"
          />
        </div>
      </div>
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

export type Props = {
  game: GetGameByIdQuery['findGameByID'] | null;
};

export type Queries = {
  gameId: string;
};

export default GameLobby;
