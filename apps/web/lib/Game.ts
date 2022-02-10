import type * as i from '@xong/types';
import * as c from '@xong/constants';
import type { Socket } from 'socket.io-client';
import type * as React from 'react';

import type { StoredUser } from 'hooks/userLocalStorage.js';
import type { ClientGameState, ClientPlayersState } from 'components/GameLobby/types';

import { theme } from '../tailwind.config.js';
import type { ClientPlayerState, FieldCellState } from './types';


class Game {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #players: Record<string, ClientPlayerState>;
  #user?: StoredUser;
  #keysPressed: Set<string> = new Set<string>();
  #socket: Socket;
  #ball: i.BallState;

  constructor(
    socket: Socket,
    public gameState: ClientGameState,
    public playersState: ClientPlayersState,
    user: StoredUser | undefined,
    userIsPlayer: boolean,
    public setCells: React.Dispatch<React.SetStateAction<Map<string, FieldCellState>>>,
  ) {
    this.#canvas = document.getElementById('game') as HTMLCanvasElement;
    this.#ctx = this.#canvas.getContext('2d')!;
    this.#socket = socket;
    this.#user = user;

    this.#ball = gameState.playState !== 'playing'
      ? { ...gameState.ball }
      : {
        position: { x: -100, y: -100 },
        speed: { x: 0, y: 0 },
      };

    this.#players = Object.entries(playersState).reduce((acc, [plrId, plrState], i) => {
      let x: number;
      if (i === 0) {
        x = c.GAME_FIELD_MARGIN;
      } else {
        x = c.GAME_FIELD_WIDTH - c.GAME_PLR_WIDTH - c.GAME_FIELD_MARGIN;
      }

      const state: ClientPlayerState = {
        id: plrId,
        x,
        y: plrState.y,
        direction: plrState.direction,
        width: c.GAME_PLR_WIDTH,
        height: c.GAME_PLR_HEIGHT,
        mark: plrState.mark,
        speed: { x: 0, y: 0 },
      };

      acc[plrId] = state;

      return acc;
    }, {});

    // Only give players of this game keyboard controls
    if (userIsPlayer) {
      document.addEventListener('keydown', this.#onKeyDown);
      document.addEventListener('keyup', this.#onKeyUp);
    }

    socket.on(c.PLAYER_KEY_DOWN, (data: i.PlayerKeypressData) => {
      if (data.userId !== this.#user?.id) {
        this.#players[data.userId].direction = data.direction;
        this.#players[data.userId].speed.y = data.direction === 'down'
          ? c.GAME_PADDLE_SPEED
          : -c.GAME_PADDLE_SPEED;
      }
    });

    socket.on(c.PLAYER_KEY_UP, (data: i.PlayerKeypressUpData) => {
      this.#players[data.userId].y = data.y;

      if (data.userId !== this.#user?.id) {
        this.#players[data.userId].direction = data.direction;

        if (data.direction != null) {
          this.#players[data.userId].speed.y = data.direction === 'down'
            ? c.GAME_PADDLE_SPEED
            : -c.GAME_PADDLE_SPEED;
        }
      }
    });

    // socket.on(c.PLAYER_SELECT_CELL, (data: i.PlayerSelectCellData) => {
    //   // if (!this.cells) {
    //   //   console.error(`ERR "${c.PLAYER_SELECT_CELL}": no cells`);
    //   //   return;
    //   // }

    //   this.gameState.phase = data.phase;

    //   for (const [cellId, nextCellState] of data.xoState) {
    //     const curCellState = this.cells.get(cellId);

    //     if (!curCellState) {
    //       throw Error('no cell');
    //     }

    //     this.#updateCells(cellId, {
    //       ...curCellState,
    //       ...nextCellState,
    //     });
    //   }
    // });

    // socket.on(c.PLAYER_HIT_CELL, (data: PlayerHitCellData) => {
    //   if (!this.cells) {
    //     console.error(`ERR "${c.PLAYER_HIT_CELL}": no cells`);
    //     return;
    //   }

    //   for (const [cellId, nextCellState] of data.xoState) {
    //     const curCellState = this.cells.get(cellId);

    //     if (!curCellState) {
    //       console.error(`ERR "${c.PLAYER_HIT_CELL}": no cell`);
    //       return;
    //     }

    //     this.#updateCells(cellId, {
    //       ...curCellState,
    //       ...nextCellState,
    //     });
    //   }
    //   this.gameState.turn = data.turn;
    //   this.gameState.phase = data.phase;
    // });

    socket.on(c.BALL_TICK, (data: i.BallTickData) => {
      this.#ball = data;
    });

    this.drawXOField();
    this.#tick();
  }

  unload = () => {
    document.removeEventListener('keydown', this.#onKeyDown);
    document.removeEventListener('keyup', this.#onKeyUp);
  };

  start = () => {
    // this.#tick();
  };

  getPlayer = (userId?: string) => {
    if (userId == null) {
      return;
    }

    return this.#players[userId];
  };

  initBall = () => {
    if (this.#ball.position.x > 0) {
      return;
    }

    this.#ball.position = {
      x: c.GAME_FIELD_WIDTH / 2 - c.GAME_BALL_SIZE / 2,
      y: c.GAME_FIELD_HEIGHT / 2 - c.GAME_BALL_SIZE / 2,
    };
  };

  launchBall = () => {
    if (this.#ball.speed.x > 0) {
      return;
    }

    this.#ball.speed = {
      x: c.GAME_BALL_SPEED,
      y: 0,
    };
  };

  // #updateCells = (key: i.CellId, value: FieldCellState) => {
  //   if (this.cells) {
  //     this.cells.set(key, value);
  //     this.setCells(this.cells);
  //   } else {
  //     console.error('ERR "updateCells": no cells');
  //   }
  // };

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

    this.#players[this.#user.id].direction = direction;
    this.#players[this.#user.id].speed.y = velocity;

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
        gameId: this.gameState.id,
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
        gameId: this.gameState.id,
        userId: this.#user.id,
        y: this.#players[this.#user.id].y,
        direction: nextDirection,
      });
    }
  };

  #updatePositions = () => {
    if (!(['finished', 'playing'] as i.PlaystateTypes[]).includes(this.gameState.playState)) {
      return;
    }

    // PLAYERS
    if (this.gameState.playState === 'playing') {
      for (const playerId of Object.keys(this.#players)) {
        let next = this.#players[playerId].y;

        if (this.#players[playerId].direction != null) {
          next = this.#players[playerId].y + this.#players[playerId].speed.y;
        }

        if (next >= 0 && next <= c.GAME_FIELD_HEIGHT - c.GAME_PLR_HEIGHT) {
          this.#players[playerId].y = next;
        }
      }
    }

    // BALL
    if (this.#ball.speed.x === 0 && this.#ball.speed.y === 0) {
      return;
    }

    const mod = (this.gameState.phase === 'xo' || this.gameState.playState === 'finished')
      ? c.GAME_BALL_SPEED_MOD
      : 1;

    // let changed = false;
    this.#ball.position.x += mod * this.#ball.speed.x;
    this.#ball.position.y += mod * this.#ball.speed.y;

    const { position, speed } = this.#ball;
    const HALF_BALL_SIZE = c.GAME_BALL_SIZE / 2;
    const topX = position.x - HALF_BALL_SIZE;
    const topY = this.#ball.position.y - HALF_BALL_SIZE;
    const bottomX = position.x + HALF_BALL_SIZE;
    const bottomY = this.#ball.position.y + HALF_BALL_SIZE;

    // Left / right boundaries
    if (position.x - HALF_BALL_SIZE < 0) {
      this.#ball.position.x = HALF_BALL_SIZE;
      this.#ball.speed.x = -speed.x;
      // changed = true;
    } else if (position.x + HALF_BALL_SIZE > c.GAME_FIELD_WIDTH) {
      this.#ball.position.x = c.GAME_FIELD_WIDTH - HALF_BALL_SIZE;
      this.#ball.speed.x = -speed.x;
      // changed = true;
    }

    // Top / bottom boundaries
    if (position.y - HALF_BALL_SIZE < 0) {
      this.#ball.position.y = HALF_BALL_SIZE;
      this.#ball.speed.y = -speed.y;
      // changed = true;
    } else if (position.y + HALF_BALL_SIZE > c.GAME_FIELD_HEIGHT) {
      this.#ball.position.y = c.GAME_FIELD_HEIGHT - HALF_BALL_SIZE;
      this.#ball.speed.y = -speed.y;
      // changed = true;
    }

    // Reset code???
    // if (this.#ball.position.y < 0 || this.#ball.position.y > c.GAME_FIELD_WIDTH) {
    //   this.#ball.speed.x = c.GAME_BALL_SPEED;
    //   this.#ball.speed.y = 0;
    //   this.#ball.position.x = c.GAME_FIELD_WIDTH / 2;
    //   this.#ball.position.y = c.GAME_FIELD_HEIGHT / 2;
    // }

    const paddle1 = this.#players[this.gameState.players[1]];
    const paddle2 = this.#players[this.gameState.players[2]];

    if (bottomX < c.GAME_PLR_HEIGHT * 2) {
      // Check for hit player 1
      const paddleBottom = paddle1.y + paddle1.height;
      const paddleTop = paddle1.y;
      const paddleRight = paddle1.x + paddle1.width;
      const paddleLeft = paddle1.x;
      const yCheck1 = topY < paddleBottom;
      const yCheck2 = bottomY > paddleTop;
      const xCheck1 = topX < paddleRight;
      const xCheck2 = bottomX > paddleLeft;

      if (yCheck1 && yCheck2 && xCheck1 && xCheck2) {
        this.#ball.speed.x = c.GAME_BALL_SPEED;
        this.#ball.speed.y += (paddle1.speed.y / 2);
        this.#ball.position.x += this.#ball.speed.x;
        // changed = true;
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
      const paddleBottom = paddle2.y + paddle2.height;
      const paddleTop = paddle2.y;
      const paddleRight = paddle2.x + paddle2.width;
      const paddleLeft = paddle2.x;
      const yCheck1 = topY < paddleBottom;
      const yCheck2 = bottomY > paddleTop;
      const xCheck1 = topX < paddleRight;
      const xCheck2 = bottomX > paddleLeft;

      if (yCheck1 && yCheck2 && xCheck1 && xCheck2) {
        this.#ball.speed.x = -c.GAME_BALL_SPEED;
        this.#ball.speed.y += (paddle2.speed.y / 2);
        this.#ball.position.x += this.#ball.speed.x;
        // changed = true;
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

    // if (changed) {
    //   this.#socket.emit(c.BALL_HIT_OBJECT, {
    //     gameId: this.gameState.id,
    //     ball: this.#ball,
    //   });
    // }
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

  getCellsState(cellsMap: Map<i.CellId, i.XoState>) {
    const { L3x, L1y } = this.getCellBorderPositions();
    const cellsCopy = new Map(cellsMap) as Map<i.CellId, FieldCellState>;

    for (let x = 0; x < 3; x++) {
      for (let y = 0; y < 3; y++) {
        const cellX = L3x + (c.GAME_XO_SQUARE_SIZE * x);
        const cellY = L1y + (c.GAME_XO_SQUARE_SIZE * y);
        const cellId = '' + x + y;

        const cell = cellsMap.get(cellId);
        if (!cell) {
          console.error('ERR "getCellsForState": no cells');
          return cellsCopy;
        }

        cellsCopy.set(cellId, {
          ...cell,
          x: cellX,
          y: cellY,
        });
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
    for (const playerId of Object.keys(this.#players)) {
      this.#ctx.fillStyle = theme.extend.colors.player[i++];
      this.#ctx.fillRect(
        this.#players[playerId].x,
        this.#players[playerId].y,
        this.#players[playerId].width,
        this.#players[playerId].height,
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
