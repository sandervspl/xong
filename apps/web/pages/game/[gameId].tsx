import * as React from 'react';
import * as c from '@xong/constants';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import classNames from 'classnames';
import { useImmer } from 'use-immer';
import axios from 'axios';

import type {
  BallState, CellId, CellState, FieldCellState, GameId, Mark, PhaseTypes, PlaystateTypes, UserId,
} from 'lib/Game';
import { sdk } from 'lib/fauna';
import Game from 'lib/Game';
import socket from 'lib/websocket';
import useLocalStorage from 'hooks/userLocalStorage';
import useInterval from 'hooks/useInterval';
import isServer from 'utils/isServer';

import Cell from '../../components/GameLobby/Cell';


const PICK_TIMER = Number(process.env.NEXT_PUBLIC_GAME_PICK_TIMER);


const GameLobby: React.VFC<Props> = (props) => {
  const { getItem } = useLocalStorage();
  const { query } = useRouter();
  const gameRef = React.useRef<Game | null>(null);
  const [loading, setLoading] = React.useState(true);
  const user = getItem('usernames')?.find((val) => val.active);
  const userIsPlayer = !!user && Object.values(props.game.players).includes(user.id);
  const [gameState, setGameState] = useImmer<GameStateClientGame>({
    ...props.game,
    xoState: new Map(props.game.xoState),
  });
  const [playersState, setPlayersState] = useImmer<PlayersStateClient>(
    props.players.reduce<PlayersStateClient>((acc, plr) => {
      acc[plr.id] = plr;
      return acc;
    }, {}),
  );
  const [cells, setCells] = React.useState<Map<CellId, FieldCellState>>(new Map());
  const [preGameCountdown, setPreGameCountdown] = React.useState(3);
  const [pickCountdown, setPickCountdown] = React.useState(-1);

  // Never use these for changing values
  const p1_STATIC = React.useRef(props.players.find((plr) => plr.id === props.game.players[1]));
  const p2_STATIC = React.useRef(props.players.find((plr) => plr.id === props.game.players[2]));

  useInterval(() => {
    if (gameState.phase === 'xo' && pickCountdown > 0) {
      setPickCountdown((n) => n - 1);
    }
  }, 1000);

  React.useEffect(() => {
    if (isServer) {
      return;
    }

    socket.emit(c.USER_JOINED_GAME, {
      userId: user?.id,
      gameId: (query as Queries).gameId,
    });

    socket.on(c.USER_JOINED_GAME, (data: UserJoinedData) => {
      console.info('Connected to game lobby!');

      gameRef.current = new Game(
        socket,
        data.players,
        user,
        userIsPlayer,
        data.game,
        setCells,
      );

      const clientGame: GameStateClientGame = {
        ...data.game,
        xoState: new Map(data.game.xoState),
      };

      const nextCells = gameRef.current.drawXOField(clientGame.xoState)!;
      gameRef.current.cells = nextCells;

      setCells(nextCells);
      setGameState(clientGame);
      setPlayersState(data.players);
      setLoading(false);
    });

    socket.on(c.USER_LEFT_GAME, (data: UserLeftData) => {
      if (data.isPlayer) {
        setGameState((draft) => {
          draft.playState = 'finished';
          draft.winner = data.winner;
        });
      }

      gameRef.current!.gameState.playState = 'finished';
    });

    socket.on(c.GAME_PLAYSTATE_UPDATE, (data: PlaystateUpdateData) => {
      if (data === 'starting') {
        doPregameCountdown();
        gameRef.current!.initBall();
      }

      if (data === 'playing') {
        setPickCountdown(PICK_TIMER);
        gameRef.current!.launchBall();
      }

      setGameState((draft) => {
        draft.playState = data;
      });

      gameRef.current!.gameState.playState = data;
    });

    socket.on(c.PLAYER_CONNECT_UPDATE, (update: PlayerConnectUpdateData) => {
      setPlayersState((draft) => {
        draft[update.userId].connected = update.connected;
      });
    });

    socket.on(c.PLAYER_SELECT_CELL, (data: PlayerSelectCellData) => {
      setGameState((draft) => {
        draft.xoState = new Map(data.xoState);
        draft.phase = data.phase;
      });

      gameRef.current!.gameState.phase = data.phase;
    });

    socket.on(c.PLAYER_HIT_CELL, (data: PlayerHitCellData) => {
      setGameState((draft) => {
        draft.xoState = new Map(data.xoState);
        draft.turn = data.turn;
        draft.phase = data.phase;
        draft.winner = data.winner;
        draft.playState = data.playState;
      });

      if (data.winner == null) {
        setPickCountdown(PICK_TIMER);
      }

      gameRef.current!.gameState.playState = data.playState;
      gameRef.current!.gameState.phase = data.phase;
      gameRef.current!.gameState.winner = data.winner;
    });

    return function cleanup() {
      gameRef.current?.unload();

      socket.emit(c.USER_LEFT_GAME, {
        userId: user?.id,
        gameId: (query as Queries).gameId,
      });
    };
  }, [setGameState, setLoading]);

  React.useEffect(() => {
    if (gameState?.playState !== 'starting') {
      return;
    }

    if (preGameCountdown <= 0) {
      socket.emit(c.GAME_PLAYSTATE_UPDATE, {
        gameId: (query as Queries).gameId,
        playState: 'playing',
      });
    }
    else if (preGameCountdown < 3) {
      doPregameCountdown();
    }
  }, [preGameCountdown, gameState]);

  React.useEffect(() => {
    if (gameRef.current) {
      gameRef.current.cells = cells;
    }
  }, [gameRef.current, cells]);

  function doPregameCountdown() {
    setTimeout(() => {
      setPreGameCountdown((n) => n - 1);
    }, 1000);
  }

  React.useEffect(() => {
    if (gameState.phase !== 'xo' || gameState.playState !== 'playing') {
      return;
    }

    if (pickCountdown !== 0) {
      return;
    }

    const freeCells = [...gameState.xoState.values()].filter((cell) => {
      return cell.state == null;
    });
    const rnd = Math.floor(Math.random() * freeCells.length);
    const cell = freeCells[rnd];

    if (cell) {
      socket.emit(c.PLAYER_SELECT_CELL, {
        gameId: query.gameId,
        userId: user?.id,
        cellId: cell.cellId,
      });
    }

    setPickCountdown(-1);
  }, [gameState, pickCountdown]);

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
              {!playersState[p1_STATIC.current!.id]?.connected ? (
                <span className="text-primary-100 text-base pl-2">(connecting...)</span>
              ) : null}
            </span>
            <span className="flex justify-center flex-1 text-4xl">
              {gameState.phase === 'xo' && pickCountdown > 0 ? pickCountdown : null}
            </span>
            <span
              className={classNames(
                'flex justify-end items-center flex-1 text-player-2',
              )}
            >
              {!playersState[p2_STATIC.current!.id]?.connected ? (
                <span className="text-primary-100 text-base pl-2">(connecting...)</span>
              ) : null}
              {p2_STATIC.current?.username} ({p2_STATIC.current?.mark})
            </span>
          </div>

          <div className="relative grid place-items-center w-full h-[600px]">
            {(() => {
              if (loading) {
                return <p className="text-6xl z-10">Loading game...</p>;
              }

              if (gameState?.playState === 'finished') {
                return (
                  <div className="absolute flex flex-col items-center z-10">
                    <div className="text-6xl mb-2">
                      {(() => {
                        if (gameState.winner === 'draw') {
                          return 'Draw!';
                        }
                        else if (gameState.winner != null) {
                          const username = p1_STATIC.current!.id === gameState.winner
                            ? p1_STATIC.current?.username
                            : p2_STATIC.current?.username;

                          return `${username} has won!`;
                        }

                        return null;
                      })()}
                    </div>
                    <Link href="/" passHref>
                      {/* eslint-disable jsx-a11y/anchor-is-valid */}
                      <a className="fancy flex items-center text-secondary text-2xl">
                        Exit Game
                      </a>
                    </Link>
                  </div>
                );
              }

              if (gameState?.playState === 'waiting_for_players') {
                return <div className="absolute text-6xl z-10">Waiting for players...</div>;
              }

              if (gameState?.playState === 'starting') {
                return <div className="absolute text-9xl z-10">{preGameCountdown}</div>;
              }

              if (gameState?.phase === 'xo' && gameState?.turn === user?.id) {
                return (
                  <p className="absolute self-start text-5xl mt-2 z-10">
                    It{'\''}s your turn to pick!
                  </p>
                );
              }

              return null;
            })()}

            {
              gameState?.playState !== 'waiting_for_players' &&
              gameState?.playState !== 'starting' &&
              cells.size > 0
                ? [...cells.values()].map((cellData, i) => (
                  <Cell
                    key={i}
                    x={cellData.x}
                    y={cellData.y}
                    cellId={cellData.cellId}
                    gameState={gameState}
                    userIsPlayer={userIsPlayer}
                  />
                ))
                : null
            }

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
  const host = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  const response = await axios.get<GameStateResponse>(`${host}/game/${ctx.query.gameId}`);
  const gameDB = await sdk.GetGameById({ id: ctx.query.gameId as string });

  if (
    !response?.data ||
    !gameDB.findGameByID ||
    Object.keys(response?.data.players).length < 2 ||
    gameDB.findGameByID.players.data.length < 2
  ) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  // Convert to client state
  const clientPlayers: GameStateClientPlayer[] = [];

  for (const plr of gameDB.findGameByID.players.data) {
    const plrState = response.data.players[plr?._id || ''];

    if (plrState && plr) {
      const clientPlr: GameStateClientPlayer = {
        ...plrState,
        username: plr.username,
      };

      clientPlayers.push(clientPlr);
    }
  }

  return {
    props: {
      game: response.data.game,
      players: clientPlayers,
    },
  };
};

type Props = {
  game: GameStateServerGame;
  players: GameStateClientPlayer[];
};

type Queries = {
  gameId: string;
};

export type PlayersStateClient = Record<UserId, GameStateServerPlayer>;

type SerializedXoState = [CellId, XoState][];

export type PlayerSelectCellData = {
  xoState: SerializedXoState;
  phase: PhaseTypes;
};

export type PlayerHitCellData = {
  xoState: SerializedXoState;
  turn: UserId;
  phase: PhaseTypes;
  playState: PlaystateTypes;
  winner: null | UserId;
};

type PlayerConnectUpdateData = {
  userId: string;
  connected: boolean;
};

type UserJoinedData = {
  game: GameStateServerGame;
  players: Record<UserId, GameStateServerPlayer>;
};

type PlaystateUpdateData = PlaystateTypes;

type UserLeftData = {
  userId: UserId;
  isPlayer: boolean;
  reason: string | null;
  winner: UserId;
};

export type XoState = {
  cellId: CellId;
  mark: Mark;
  state: CellState;
  user: UserId;
};

export type GameStateServerPlayer = {
  id: UserId;
  gameId: GameId;
  y: number;
  direction: null | 'up' | 'down';
  connected: boolean;
  socketId: string;
  mark: Mark;
};

export type GameStateServerGame = {
  id: GameId;
  turn: string;
  playState: PlaystateTypes;
  phase: PhaseTypes;
  players: { 1: UserId; 2: UserId };
  xoState: [CellId, XoState][];
  ball: BallState;
  winner: null | UserId;
};

export type GameStateResponse = {
  game: GameStateServerGame;
  players: Record<UserId, GameStateServerPlayer>;
};

export type GameStateClientGame = Omit<GameStateServerGame, 'xoState'> & {
  xoState: Map<CellId, XoState>;
};

export type GameStateClientPlayer = GameStateServerPlayer & {
  username: string;
};

export default GameLobby;
