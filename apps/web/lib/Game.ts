import type * as i from '@xong/types';
import * as c from '@xong/constants';
import type { Socket } from 'socket.io-client';
import { produce } from 'immer';

import type { StoredUser } from 'hooks/userLocalStorage.js';
import type { ClientPlayersState } from 'components/GameLobby/types';

import { theme } from '../tailwind.config.js';
import gameState from '../components/GameLobby/gameState';
import type { XoFieldStateClient } from './types';


class Game {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #user?: StoredUser;
  #keysPressed: Set<string> = new Set<string>();
  #socket: Socket;
  #ball: i.BallState;
  #playersState: ClientPlayersState;

  constructor(
    socket: Socket,
    playersState: ClientPlayersState,
    user: StoredUser | undefined,
    userIsPlayer: boolean,
  ) {
    this.#canvas = document.getElementById('game') as HTMLCanvasElement;
    this.#ctx = this.#canvas.getContext('2d')!;
    this.#socket = socket;
    this.#user = user;
    this.#playersState = playersState;

    this.#ball = { ...gameState.ball };

    // Only give players of this game keyboard controls
    if (userIsPlayer) {
      document.addEventListener('keydown', this.#onKeyDown);
      document.addEventListener('keyup', this.#onKeyUp);
    }

    socket.on(c.GAME_PLAYSTATE_STARTING, (data: i.PlaystateStartingData) => {
      gameState.playState = data.playState;
      this.#ball = data.ball;
    });

    socket.on(c.GAME_PLAYSTATE_PLAYING, (data: i.PlaystateStartingData) => {
      gameState.playState = data.playState;
      this.#ball = data.ball;
    });

    socket.on(c.PLAYER_KEY_DOWN, (data: i.PlayerKeypressData) => {
      if (data.userId !== this.#user?.id) {
        /** Important to update it with 'produce' to prevent read-only errors */
        this.#playersState = produce(this.#playersState, (draft) => {
          draft[data.userId].direction = data.direction;
          draft[data.userId].speed.y = data.direction === 'down'
            ? c.GAME_PADDLE_SPEED
            : -c.GAME_PADDLE_SPEED;
        });
      }
    });

    socket.on(c.PLAYER_KEY_UP, (data: i.PlayerKeypressUpData) => {
      this.#playersState = produce(this.#playersState, (draft) => {
        draft[data.userId].position.y = data.y;

        if (data.userId !== this.#user?.id) {
          draft[data.userId].direction = data.direction;

          if (data.direction != null) {
            draft[data.userId].speed.y = data.direction === 'down'
              ? c.GAME_PADDLE_SPEED
              : -c.GAME_PADDLE_SPEED;
          }
        }
      });
    });

    socket.on(c.PLAYER_SELECT_CELL, (data: i.PlayerSelectCellData) => {
    });

    socket.on(c.PLAYER_HIT_CELL, (data: i.PlayerHitCellData) => {
    });

    socket.on(c.BALL_TICK, (data: i.BallTickData) => {
      this.#ball = data;
    });

    this.drawXOField();
    this.#tick();
  }

  unload = () => {
    document.removeEventListener('keydown', this.#onKeyDown);
    document.removeEventListener('keyup', this.#onKeyUp);

    this.#socket.off(c.GAME_PLAYSTATE_STARTING);
    this.#socket.off(c.PLAYER_KEY_DOWN);
    this.#socket.off(c.PLAYER_KEY_UP);
    this.#socket.off(c.PLAYER_SELECT_CELL);
    this.#socket.off(c.PLAYER_HIT_CELL);
    this.#socket.off(c.BALL_TICK);
  };

  #updateDirection = () => {
    if (!this.#user) {
      return;
    }

    let direction: i.Direction = null;
    let velocity = 0;
    const keysArr = [...this.#keysPressed];
    const lastInput = keysArr[keysArr.length - 1];

    if (lastInput === 'w' || lastInput === 'arrowup') {
      direction = 'up';
      velocity = -c.GAME_PADDLE_SPEED;
    }
    else if (lastInput === 's' || lastInput === 'arrowdown') {
      direction = 'down';
      velocity = c.GAME_PADDLE_SPEED;
    }

    const id = this.#user.id;
    this.#playersState = produce(this.#playersState, (draft) => {
      draft[id].direction = direction;
      draft[id].speed.y = velocity;
    });

    return direction;
  };

  #onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    if (this.#keysPressed.has(key)) {
      return;
    }

    this.#keysPressed.add(key);

    if (this.#user) {
      const nextDirection = this.#updateDirection();

      this.#socket.emit(c.PLAYER_KEY_DOWN, {
        gameId: gameState.id,
        userId: this.#user.id,
        direction: nextDirection,
      });
    }
  };

  #onKeyUp = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();

    this.#keysPressed.delete(key);

    if (this.#user) {
      const nextDirection = this.#updateDirection();

      this.#socket.emit(c.PLAYER_KEY_UP, {
        gameId: gameState.id,
        userId: this.#user.id,
        y: this.#playersState[this.#user.id].position.y,
        direction: nextDirection,
      });
    }
  };

  #updatePositions = () => {
    if (!(['finished', 'playing'] as i.PlaystateTypes[]).includes(gameState.playState)) {
      return;
    }

    // PLAYERS
    if (gameState.playState === 'playing') {
      for (const playerId of Object.keys(this.#playersState)) {
        const plr = this.#playersState[playerId];
        let next = plr.position.y;

        if (plr.direction != null) {
          next = plr.position.y + plr.speed.y;
        }

        if (next >= 0 && next <= c.GAME_FIELD_HEIGHT - c.GAME_PLR_HEIGHT) {
          this.#playersState = produce(this.#playersState, (draft) => {
            draft[playerId].position.y = next;
          });
        }
      }
    }

    // BALL
    if (this.#ball.speed.x === 0 && this.#ball.speed.y === 0) {
      return;
    }

    const mod = (gameState.phase === 'xo' || gameState.winner != null)
      ? c.GAME_BALL_SPEED_MOD
      : 1;

    this.#ball = produce(this.#ball, (draft) => {
      draft.position.x += draft.speed.x * mod;
      draft.position.y += draft.speed.y * mod;
    });

    const { position } = this.#ball;
    const HALF_BALL_SIZE = c.GAME_BALL_SIZE / 2;
    const topX = position.x - HALF_BALL_SIZE;
    const topY = position.y - HALF_BALL_SIZE;
    const bottomX = position.x + HALF_BALL_SIZE;
    const bottomY = position.y + HALF_BALL_SIZE;

    // Left / right boundaries
    if (position.x - HALF_BALL_SIZE < 0) {
      this.#ball = produce(this.#ball, (draft) => {
        draft.position.x = HALF_BALL_SIZE;
        draft.speed.x = -draft.speed.x;
      });
    } else if (position.x + HALF_BALL_SIZE > c.GAME_FIELD_WIDTH) {
      this.#ball = produce(this.#ball, (draft) => {
        draft.position.x = c.GAME_FIELD_WIDTH - HALF_BALL_SIZE;
        draft.speed.x = -draft.speed.x;
      });
    }

    // Top / bottom boundaries
    if (position.y - HALF_BALL_SIZE < 0) {
      this.#ball = produce(this.#ball, (draft) => {
        draft.position.y = HALF_BALL_SIZE;
        draft.speed.y = -draft.speed.y;
      });
    } else if (position.y + HALF_BALL_SIZE > c.GAME_FIELD_HEIGHT) {
      this.#ball = produce(this.#ball, (draft) => {
        draft.position.y = c.GAME_FIELD_HEIGHT - HALF_BALL_SIZE;
        draft.speed.y = -draft.speed.y;
      });
    }

    // Reset code???
    // if (position.y < 0 || position.y > c.GAME_FIELD_WIDTH) {
    //   this.#ball.speed.x = c.GAME_BALL_SPEED;
    //   this.#ball.speed.y = 0;
    //   this.#ball.position.x = c.GAME_FIELD_WIDTH / 2;
    //   this.#ball.position.y = c.GAME_FIELD_HEIGHT / 2;
    // }

    const paddle1 = this.#playersState[gameState.players[1]];
    const paddle2 = this.#playersState[gameState.players[2]];

    if (bottomX < c.GAME_PLR_HEIGHT * 2) {
      // Check for hit player 1
      const paddleBottom = paddle1.position.y + c.GAME_PLR_HEIGHT;
      const paddleTop = paddle1.position.y;
      const paddleRight = paddle1.position.x + c.GAME_PLR_WIDTH;
      const paddleLeft = paddle1.position.x;
      const yCheck1 = topY < paddleBottom;
      const yCheck2 = bottomY > paddleTop;
      const xCheck1 = topX < paddleRight;
      const xCheck2 = bottomX > paddleLeft;

      if (yCheck1 && yCheck2 && xCheck1 && xCheck2) {
        this.#ball = produce(this.#ball, (draft) => {
          draft.speed.x = c.GAME_BALL_SPEED;
          draft.speed.y = (paddle1.speed.y / 2);
          draft.position.x += draft.speed.x;
        });
      }
      // else {
      //   if (xCheck1 && xCheck2) {
      //     // bottom hit
      //     if (topY < paddleBottom && paddleTop < topY) {
      //       this.#ball.speed.y = -this.#ball.speed.y;
      //       this.#ball.position.y += Math.abs(this.#ball.speed.y);
      //       console.log('bot hit');
      //     }
      //     // top hit
      //     else if (bottomY > paddleTop && paddleBottom > topY) {
      //       this.#ball.speed.y = -this.#ball.speed.y;
      //       this.#ball.position.y -= Math.abs(this.#ball.speed.y);
      //       console.log('top hit');
      //     }
      //   }
      // }
    } else if (bottomX > c.GAME_FIELD_WIDTH - c.GAME_PLR_HEIGHT * 2) {
      const paddleBottom = paddle2.position.y + c.GAME_PLR_HEIGHT;
      const paddleTop = paddle2.position.y;
      const paddleRight = paddle2.position.x + c.GAME_PLR_WIDTH;
      const paddleLeft = paddle2.position.x;
      const yCheck1 = topY < paddleBottom;
      const yCheck2 = bottomY > paddleTop;
      const xCheck1 = topX < paddleRight;
      const xCheck2 = bottomX > paddleLeft;

      if (yCheck1 && yCheck2 && xCheck1 && xCheck2) {
        this.#ball = produce(this.#ball, (draft) => {
          draft.speed.x = -c.GAME_BALL_SPEED;
          draft.speed.y = (paddle2.speed.y / 2);
          draft.position.x += draft.speed.x;
        });
      }
      // else {
      //   if (xCheck1 && xCheck2) {
      //     // bottom hit
      //     if (topY < paddleBottom && paddleTop < topY) {
      //       this.#ball.speed.y = -this.#ball.speed.y;
      //       this.#ball.position.y += Math.abs(this.#ball.speed.y);
      //       console.log('bot hit 2');
      //     }
      //     // top hit
      //     else if (bottomY > paddleTop && paddleBottom > topY) {
      //       this.#ball.speed.y = -this.#ball.speed.y;
      //       this.#ball.position.y -= Math.abs(this.#ball.speed.y);
      //       console.log('top hit 2');
      //     }
      //   }
      // }
    }
  };

  getCellBorderPositions() {
    const CELL_SIZE = c.GAME_XO_SQUARE_SIZE;
    const Mx = this.#canvas.width / 2;
    const My = this.#canvas.height / 2;
    const L1x = Mx - (CELL_SIZE / 2);
    const L1y = My - ((CELL_SIZE / 2) * 3);
    const L2x = Mx + (CELL_SIZE / 2);
    const L2y = L1y;
    const L3x = Mx - ((CELL_SIZE / 2) * 3);
    const L3y = My - (CELL_SIZE / 2);
    const L4x = L3x;
    const L4y = My + (CELL_SIZE / 2);

    return { L1x, L1y, L2x, L2y, L3x, L3y, L4x, L4y };
  }

  getCellsState(fieldState: i.XoFieldState) {
    const { L3x, L1y } = this.getCellBorderPositions();
    const cellsCopy = { ...fieldState } as XoFieldStateClient;

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const cellX = L3x + (c.GAME_XO_SQUARE_SIZE * x);
        const cellY = L1y + (c.GAME_XO_SQUARE_SIZE * y);
        const cellId = '' + x + y;

        const cell = cellsCopy[cellId];
        if (!cell) {
          console.error('ERR "getCellsForState": no cells', fieldState, cellsCopy);
          return cellsCopy;
        }

        cellsCopy[cellId] = {
          ...cell,
          x: cellX,
          y: cellY,
        };
      }
    }

    return cellsCopy;
  }

  drawXOField = () => {
    const { L1x, L1y, L2x, L2y, L3x, L3y, L4x, L4y } = this.getCellBorderPositions();

    for (const [d, x, y] of [
      [0, L1x, L1y],
      [0, L2x, L2y],
      [1, L3x, L3y],
      [1, L4x, L4y],
    ]) {
      this.#ctx.beginPath();
      this.#ctx.lineWidth = 2;
      this.#ctx.strokeStyle = theme.extend.colors.primary[900];
      this.#ctx.moveTo(x, y);
      if (d) {
        this.#ctx.lineTo(x + (c.GAME_XO_SQUARE_SIZE * 3), y);
      } else {
        this.#ctx.lineTo(x, y + (c.GAME_XO_SQUARE_SIZE * 3));
      }
      this.#ctx.stroke();
    }
  };

  #drawPlayers = () => {
    let i = 1;
    for (const playerId of Object.keys(this.#playersState)) {
      this.#ctx.fillStyle = theme.extend.colors.player[i++];
      this.#ctx.fillRect(
        this.#playersState[playerId].position.x,
        this.#playersState[playerId].position.y,
        c.GAME_PLR_WIDTH,
        c.GAME_PLR_HEIGHT,
      );
    }
  };

  #drawBall = () => {
    this.#ctx.beginPath();
    this.#ctx.fillStyle = theme.extend.colors.primary[100];
    this.#ctx.arc(
      this.#ball.position.x,
      this.#ball.position.y,
      c.GAME_BALL_SIZE,
      0,
      2 * Math.PI,
      false,
    );
    this.#ctx.fill();
  };

  #draw = () => {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    this.drawXOField();
    this.#drawPlayers();
    this.#drawBall();
  };

  #tick = () => {
    this.#updatePositions();
    this.#draw();
    // this.#checkCellsCollision();
    requestAnimationFrame(this.#tick);
    // setTimeout(this.#tick, 100);
  };
}

export default Game;
