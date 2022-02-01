import * as React from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import { useImmer } from 'use-immer';

import type { GetGameByIdQuery } from 'faunadb/generated';
import type { GameState } from 'lib/Game';
import { sdk } from 'lib/fauna';
import Game from 'lib/Game';
import socket from 'lib/websocket';
import useLocalStorage from 'hooks/userLocalStorage';
import isServer from 'utils/isServer';

import Cell from './Cell';


const GameLobby: React.VFC<Props> = (props) => {
  const { getItem } = useLocalStorage();
  const { query } = useRouter();
  const playerIds = props.game!.players.data.map((player) => player!._id);
  const gameRef = React.useRef<Game | null>(null);
  const [loading, setLoading] = React.useState(true);
  const user = getItem('usernames')?.find((val) => val.active);
  const userIsPlayer = !!user && playerIds.includes(user.id);
  const [gameState, setGameState] = useImmer<GameState | null>(null);

  React.useEffect(() => {
    if (isServer) {
      return;
    }

    socket.emit('user-joined-game', {
      userId: user?.id,
      gameId: (query as Queries).gameId,
    });

    socket.on('user-joined-game', (gameState: GameState) => {
      console.info('Connected to game lobby!');

      gameRef.current = new Game(
        socket,
        gameState,
        user,
        userIsPlayer,
      );

      setGameState(gameState);
      setLoading(false);
    });

    socket.on('game-playstate-update', (update: PlaystateTypes) => {
      setGameState((draft) => {
        draft!.playState = update;
      });
    });

    socket.on('player-connect-update', (update: PlayerConnectUpdateData) => {
      setGameState((draft) => {
        draft!.players.state[update.userId].connected = update.connected;
      });
    });

    socket.on('player-select-cell', (data: PlayerSelectCellData) => {
      setGameState((draft) => {
        draft!.selected = data.selected;
      });
    });
  }, [setGameState, setLoading]);

  const plr1 = props.game?.players.data[0];
  const plr2 = props.game?.players.data[1];
  const plr1id = gameState?.players.order[1];
  const plr2id = gameState?.players.order[2];

  return (
    <div className="text-primary-500">
      <div className="grid place-items-center h-screen w-screen">
        <div className="w-[1200px]">
          <div className="flex justify-between text-4xl">
            <span
              className={classNames(
                'flex justify-start items-center flex-1 text-player-1',
              )}
            >
              {plr1?.username} ({gameRef.current?.getPlayer(plr1id)?.mark})
              {plr1 && !gameState?.players.state[plr1id!]?.connected && (
                <span className="text-primary-100 text-base pl-2">(connecting...)</span>
              )}
            </span>
            <span className="flex justify-center flex-1">
              0 - 0
            </span>
            <span
              className={classNames(
                'flex justify-end items-center flex-1 text-player-2',
              )}
            >
              {plr2 && !gameState?.players.state[plr2id!]?.connected && (
                <span className="text-primary-100 text-base pl-2">(connecting...)</span>
              )}
              {plr2?.username} ({gameRef.current?.getPlayer(plr2id)?.mark})
            </span>
          </div>

          <div className="relative grid place-items-center w-full h-[600px]">
            {loading && <p className="text-6xl">Loading game...</p>}

            {gameState?.playState === 'waiting_for_players' && (
              <div className="absolute text-6xl">Waiting for players...</div>
            )}

            {gameState?.playState === 'playing' && gameRef.current?.cells?.map((cellData, i) => (
              <Cell
                key={i}
                x={cellData.x}
                y={cellData.y}
                cellId={cellData.cellId}
                gameState={gameState}
              />
            ))}

            <canvas
              id="game"
              className={classNames(
                'border-primary-900 border-solid border-2',
                {
                  hidden: loading,
                  block: !loading,
                  'blur-sm': gameState?.playState !== 'playing',
                },
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

type PlayerSelectCellData = {
  userId: string;
  selected: string;
};

type PlaystateTypes = 'waiting_for_players' | 'playing' | 'paused' | 'finished';

type PlayerConnectUpdateData = {
  userId: string;
  connected: boolean;
};

export default GameLobby;
