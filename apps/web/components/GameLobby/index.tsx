import type * as i from '@xong/types';
import * as c from '@xong/constants';
import * as React from 'react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import Link from 'next/link';
import classNames from 'classnames';
import { useImmer } from 'use-immer';
import axios from 'axios';
import { useSnapshot } from 'valtio';

import type { XoFieldStateClient } from 'lib/types';
import { sdk } from 'lib/fauna';
import Game from 'lib/Game';
import socket from 'lib/websocket';
import useLocalStorage from 'hooks/userLocalStorage';
import isServer from 'utils/isServer';


import type { ClientPlayersState, CombinedPlayerState } from './types';
import Cell from './Cell';
import gameState from './gameState';


const GameLobby: React.VFC<Props> = (props) => {
  const gameStateSnap = useSnapshot(gameState);
  const { getItem } = useLocalStorage();
  const { query } = useRouter();
  const gameRef = React.useRef<Game | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [playersState, setPlayersState] = useImmer<ClientPlayersState>(
    props.players.reduce<ClientPlayersState>((acc, plr) => {
      acc[plr.id] = plr;
      return acc;
    }, {}),
  );
  const [xoFieldState, setXoFieldState] = React.useState<XoFieldStateClient>({});
  const [preGameCountdown, setPreGameCountdown] = React.useState(-1);
  const [pickCountdown, setPickCountdown] = React.useState(-1);

  // User checks
  const user = getItem('usernames')?.find((val) => val.active);
  const userIsPlayer = !!user && Object.values(props.game.players).includes(user.id);

  // Never use these for changing values
  const p1_STATIC = React.useRef(props.players.find((plr) => plr.id === props.game.players[1]));
  const p2_STATIC = React.useRef(props.players.find((plr) => plr.id === props.game.players[2]));

  React.useEffect(() => {
    if (isServer) {
      return;
    }

    socket.emit(c.USER_JOINED_GAME, {
      userId: user?.id,
      gameId: (query as Queries).gameId,
    });

    socket.on(c.USER_JOINED_GAME, (data: i.UserJoinedData) => {
      console.info('Connected to game lobby!');
      setLoading(false);
    });

    socket.on(c.USER_LEFT_GAME, (data: i.UserLeftData) => {
      if (data.isPlayer) {
        gameState.playState = 'finished';
        gameState.winner = data.winner;
      }
    });

    return function cleanup() {
      gameRef.current?.unload();

      socket.emit(c.USER_LEFT_GAME, {
        userId: user?.id,
        gameId: (query as Queries).gameId,
      });
    };
  }, [setLoading]);

  React.useEffect(() => {
    if (loading || gameRef.current != null) {
      return;
    }

    // Create game instance
    gameRef.current = new Game(
      socket,
      playersState,
      user,
      userIsPlayer,
    );

    // Calculate cell positions with current XO state
    setXoFieldState(gameRef.current.getCellsState(gameStateSnap.xoState));
  }, [loading, gameStateSnap, gameRef.current]);

  React.useEffect(() => {
    // Set local game state from response
    for (const key in props.game) {
      gameState[key] = props.game[key];
    }

    socket.on(c.GAME_PLAYSTATE_UPDATE, (data: i.PlaystateUpdateData) => {
      gameState.playState = data;

      if (gameStateSnap.winner != null) {
        return;
      }

      if (data === 'starting') {
        setPreGameCountdown(c.GAME_PREGAME_TIMER);
        gameRef.current!.initBall();
      }

      if (data === 'playing') {
        setPickCountdown(c.GAME_XO_CELL_PICK_TIMER);
        gameRef.current!.launchBall();
      }
    });

    socket.on(c.PLAYER_CONNECT_UPDATE, (data: i.PlayerConnectUpdateData) => {
      setPlayersState((draft) => {
        draft[data.userId].connected = data.connected;
      });
    });

    socket.on(c.PLAYER_SELECT_CELL, (data: i.PlayerSelectCellData) => {
      gameState.phase = data.phase;
      gameState.xoState = data.xoState;
    });

    socket.on(c.PLAYER_HIT_CELL, (data: i.PlayerHitCellData) => {
      for (const key in data) {
        gameState[key] = data[key];
      }

      if (data.winner == null) {
        setPickCountdown(c.GAME_XO_CELL_PICK_TIMER);
      }
    });

    return function cleanup() {
      socket.off(c.GAME_PLAYSTATE_UPDATE);
      socket.off(c.PLAYER_CONNECT_UPDATE);
      socket.off(c.PLAYER_SELECT_CELL);
      socket.off(c.PLAYER_HIT_CELL);
    };
  }, []);

  React.useEffect(() => {
    if (preGameCountdown > 0) {
      setTimeout(() => {
        setPreGameCountdown((n) => n - 1);
      }, 1000);
    }
  }, [preGameCountdown]);

  React.useEffect(() => {
    if (pickCountdown > 0) {
      setTimeout(() => {
        setPickCountdown((n) => n - 1);
      }, 1000);
    }
  }, [pickCountdown]);

  React.useEffect(() => {
    if (gameStateSnap.winner != null) {
      return;
    }

    if (gameStateSnap.phase !== 'xo' || gameStateSnap.playState !== 'playing') {
      return;
    }

    if (pickCountdown !== 0) {
      return;
    }

    const cells = Object.values(gameStateSnap.xoState) || [];
    const freeCells = cells.filter((cell) => {
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
  }, [gameStateSnap, pickCountdown]);

  return (
    <div className="text-primary-500">
      <div className="grid place-items-center h-screen w-screen">
        <div className="w-field">
          <div className="flex justify-between text-4xl">
            <span className="flex justify-start items-center flex-1 text-player-1">
              {p1_STATIC.current?.username} ({p1_STATIC.current?.mark})
              {!playersState[p1_STATIC.current!.id]?.connected ? (
                <span className="text-primary-100 text-base pl-2">(connecting...)</span>
              ) : null}
            </span>
            <span className="flex justify-center flex-1 text-4xl">
              {gameStateSnap.phase === 'xo' && pickCountdown > 0
                ? pickCountdown
                : null}
            </span>
            <span className="flex justify-end items-center flex-1 text-player-2">
              {!playersState[p2_STATIC.current!.id]?.connected ? (
                <span className="text-primary-100 text-base pl-2">(connecting...)</span>
              ) : null}
              {p2_STATIC.current?.username} ({p2_STATIC.current?.mark})
            </span>
          </div>

          <div className="relative grid place-items-center w-full h-field">
            {(() => {
              if (loading) {
                return <p className="text-6xl z-10">Loading game...</p>;
              }

              if (gameStateSnap?.winner != null) {
                return (
                  <div className="absolute flex flex-col items-center z-10">
                    <div className="text-6xl mb-2">
                      {(() => {
                        if (gameStateSnap.winner === 'draw') {
                          return 'Draw!';
                        }
                        else if (gameStateSnap.winner != null) {
                          const username = p1_STATIC.current!.id === gameStateSnap.winner
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

              if (gameStateSnap?.playState === 'waiting_for_players') {
                return <div className="absolute text-6xl z-10">Waiting for players...</div>;
              }

              if (gameStateSnap?.playState === 'starting') {
                return <div className="absolute text-9xl z-10">{preGameCountdown}</div>;
              }

              if (gameStateSnap?.phase === 'xo' && gameStateSnap?.turn === user?.id) {
                return (
                  <p className="absolute self-start text-5xl mt-2 z-10">
                    It{'\''}s your turn to pick!
                  </p>
                );
              }

              return null;
            })()}

            {
              gameStateSnap?.playState !== 'waiting_for_players' &&
              gameStateSnap?.playState !== 'starting' &&
              Object.keys(xoFieldState).length > 0
                ? Object.values(xoFieldState).map((cellData, i) => (
                  <Cell
                    key={i}
                    x={cellData.x}
                    y={cellData.y}
                    cellId={cellData.cellId}
                    gameState={gameStateSnap}
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
                  'blur-sm': gameStateSnap?.playState !== 'playing',
                },
              )}
              width={`${c.GAME_FIELD_WIDTH}px`}
              height={`${c.GAME_FIELD_HEIGHT}px`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};


export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const host = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  const response = await axios.get<i.GetGameResult>(`${host}/game/${ctx.query.gameId}`);
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
  const clientPlayers: CombinedPlayerState[] = [];

  for (const plr of gameDB.findGameByID.players.data) {
    const plrState = response.data.players[plr?._id || ''];

    if (plrState && plr) {
      const clientPlr: CombinedPlayerState = {
        ...plrState,
        username: plr.username,
      };

      clientPlayers.push(clientPlr);
    }
  }

  return {
    props: {
      ...response.data,
      players: clientPlayers,
    },
  };
};

type Props = Omit<i.GetGameResult, 'players'> & {
  players: CombinedPlayerState[];
};

type Queries = {
  gameId: string;
};

export default GameLobby;
