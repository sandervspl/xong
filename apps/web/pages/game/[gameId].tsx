import * as React from 'react';
import type { GetServerSideProps } from 'next';
import classNames from 'classnames';
import { useRouter } from 'next/router';

import type { GetGameByIdQuery } from 'faunadb/generated';
import { sdk } from 'lib/fauna';
import Game from 'lib/Game';
import useSocketIO from 'hooks/useSocketIO';
import useLocalStorage from 'hooks/userLocalStorage';


const GameLobby: React.VFC<Props> = (props) => {
  const socket = useSocketIO();
  const { getItem } = useLocalStorage();
  const { query } = useRouter();
  const playerIds = props.game!.players.data.map((player) => player!._id);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const gameRef = React.useRef<Game | null>(null);
  const user = getItem('usernames')?.find((val) => val.active);
  const userIsPlayer = !!user && playerIds.includes(user.id);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (socket) {
      socket.emit('user-joined-game', {
        userId: user?.id,
        gameId: (query as Queries).gameId,
      });

      socket.on('user-joined-game', (gameState) => {
        console.info('Connected to game lobby!');

        gameRef.current = new Game(
          canvasRef.current!,
          socket,
          gameState,
          user,
          userIsPlayer,
        );

        setLoading(false);
      });
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

          <div className="relative grid place-items-center w-full h-[600px]">
            {loading && <p className="text-6xl">Loading game...</p>}
            {gameRef.current?.cells?.map(([x1, y1, cb], i) => (
              <button
                key={i}
                className="absolute bg-primary-200 border-2 border-solid border-secondary opacity-0 hover:opacity-50"
                style={{
                  top: y1 + 4 + 'px',
                  left: x1 + 4 + 'px',
                  width: Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE) - 4 + 'px',
                  height: Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE) - 4 + 'px',
                }}
                onClick={cb}
              />
            ))}
            <canvas
              id="game"
              ref={canvasRef}
              className={classNames(
                'border-primary-900 border-solid border-2',
                { hidden: loading },
                { block: !loading },
              )}
              width={`${process.env.NEXT_PUBLIC_GAME_FIELD_WIDTH}px`}
              height={`${process.env.NEXT_PUBLIC_GAME_FIELD_HEIGHT}px`}
            />
          </div>
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
