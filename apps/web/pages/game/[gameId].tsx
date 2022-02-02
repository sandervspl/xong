import * as React from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import classNames from 'classnames';
import { useImmer } from 'use-immer';

import type { GameId, PlaystateTypes, UserId } from 'lib/Game';
import { sdk } from 'lib/fauna';
import Game from 'lib/Game';
import socket from 'lib/websocket';
import useLocalStorage from 'hooks/userLocalStorage';
import isServer from 'utils/isServer';

import axios from 'axios';
import Cell from './Cell';


const GameLobby: React.VFC<Props> = (props) => {
  const { getItem } = useLocalStorage();
  const { query } = useRouter();
  const gameRef = React.useRef<Game | null>(null);
  const [loading, setLoading] = React.useState(true);
  const user = getItem('usernames')?.find((val) => val.active);
  const userIsPlayer = !!user && Object.values(props.game.players).includes(user.id);
  const [gameState, setGameState] = useImmer<GameState>(props.game);
  const [playersState, setPlayersState] = useImmer<PlayersState>(
    props.players.reduce((acc, plr) => {
      acc[plr.id] = plr;
      return acc;
    }, {} as PlayersState),
  );
  const [countdown, setCountdown] = React.useState(3);

  // Never use these for changing values
  const p1_STATIC = React.useRef(props.players.find((plr) => plr.id === props.game.players[1]));
  const p2_STATIC = React.useRef(props.players.find((plr) => plr.id === props.game.players[2]));

  React.useEffect(() => {
    if (isServer) {
      return;
    }

    socket.emit('user-joined-game', {
      userId: user?.id,
      gameId: (query as Queries).gameId,
    });

    socket.on('user-joined-game', (data: UserJoinedData) => {
      console.info('Connected to game lobby!');

      gameRef.current = new Game(
        socket,
        data.game,
        data.players,
        user,
        userIsPlayer,
      );

      setGameState(data.game);
      setPlayersState(data.players);
      setLoading(false);
    });

    socket.on('user-left-game', (data: UserLeftData) => {
      if (data.isPlayer) {
        setGameState((draft) => {
          draft.playState = 'finished';
        });
      }
    });

    socket.on('game-playstate-update', (update: PlaystateTypes) => {
      if (update === 'starting') {
        doCountdown();
      }

      setGameState((draft) => {
        draft.playState = update;
      });
    });

    socket.on('player-connect-update', (update: PlayerConnectUpdateData) => {
      setPlayersState((draft) => {
        draft[update.userId].connected = update.connected;
      });
    });

    socket.on('player-select-cell', (data: PlayerSelectCellData) => {
      setGameState((draft) => {
        draft!.selected = data.selected;
      });
    });

    return function cleanup() {
      gameRef.current?.unload();

      socket.emit('user-left-game', {
        userId: user?.id,
        gameId: (query as Queries).gameId,
      });
    };
  }, [setGameState, setLoading]);

  React.useEffect(() => {
    if (gameState?.playState !== 'starting') {
      return;
    }

    if (countdown <= 0) {
      socket.emit('game-playstate-update', {
        gameId: (query as Queries).gameId,
        playState: 'playing',
      });
    }
    else if (countdown < 3) {
      doCountdown();
    }
  }, [countdown, gameState]);

  function doCountdown() {
    setTimeout(() => {
      setCountdown((n) => n - 1);
    }, 1000);
  }

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
              {p1_STATIC.current?.username} ({p1_STATIC.current?.mark})
              {!playersState[p1_STATIC.current!.id]?.connected && (
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
              {!playersState[p2_STATIC.current!.id]?.connected && (
                <span className="text-primary-100 text-base pl-2">(connecting...)</span>
              )}
              {p2_STATIC.current?.username} ({p2_STATIC.current?.mark})
            </span>
          </div>

          <div className="relative grid place-items-center w-full h-[600px]">
            {!loading && gameState?.phase === 'xo' && gameState?.turn === user?.id && (
              <p className="absolute self-start text-5xl mt-2">It{'\''}s your turn to pick!</p>
            )}

            {loading && <p className="text-6xl">Loading game...</p>}

            {gameState?.playState === 'waiting_for_players' && (
              <div className="absolute text-6xl">Waiting for players...</div>
            )}
            {gameState?.playState === 'starting' && (
              <div className="absolute text-6xl">{countdown}</div>
            )}
            {/** @TODO add check */}
            {gameState?.playState === 'finished' && (
              <div className="absolute text-6xl">You won!</div>
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

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  /** @TODO Move this logic */
  const host = process.env.NODE_ENV === 'development'
    ? 'http://localhost:5000'
    : 'https://xong-game-server.herokuapp.com';

  const game = await axios.get<GameStateResponse>(`${host}/game/${ctx.query.gameId}`);
  const gameDB = await sdk.GetGameById({ id: ctx.query.gameId as string });

  if (!game || !gameDB.findGameByID || game.data.players.length === 0) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const players: unknown[] = [];
  for (const plr of gameDB.findGameByID.players.data) {
    const plrState = game.data.players.find((val) => val.id === plr?._id);
    (plrState as any).username = plr?.username;

    players.push(plrState);
  }

  return {
    props: {
      game: game.data.game,
      players: game.data.players,
    },
  };
};

type Props = {
  game: GameStateResponse['game'];
  players: GameStateResponse['players'];
};

type Queries = {
  gameId: string;
};

export type GameState = GameStateResponse['game'];
export type PlayersState = Record<UserId, Omit<GameStateResponse['players'][number], 'username'>>;

type PlayerSelectCellData = {
  userId: string;
  selected: string;
};

type PlayerConnectUpdateData = {
  userId: string;
  connected: boolean;
};

type UserJoinedData = {
  game: GameState;
  players: PlayersState;
};

type UserLeftData = {
  userId: UserId;
  isPlayer: boolean;
  reason: string | null;
};

export type GameStateResponse = {
  game: {
    id: GameId;
    selected: string;
    turn: string;
    playState: string;
    phase: string;
    players:  {
      1: UserId;
      2: UserId;
    };
  };
  players: {
    id: UserId;
    gameId: GameId;
    y: number;
    direction?: any;
    connected: boolean;
    socketId: string;
    mark: string;
    username: string;
  }[];
};

export default GameLobby;
