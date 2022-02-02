import type { Socket } from 'socket.io-client';

import type { StoredUser } from 'hooks/userLocalStorage.js';
import type {
  GameStateServerGame, GameStateServerPlayer, PlayerHitCellData, PlayerSelectCellData, XoState,
} from 'pages/game/[gameId]';

import { theme } from '../tailwind.config.js';


const PLR_WIDTH = Number(process.env.NEXT_PUBLIC_GAME_PLR_WIDTH);
const PLR_HEIGHT = Number(process.env.NEXT_PUBLIC_GAME_PLR_HEIGHT);
const FIELD_MARGIN = Number(process.env.NEXT_PUBLIC_GAME_FIELD_MARGIN);
const FIELD_WIDTH = Number(process.env.NEXT_PUBLIC_GAME_FIELD_WIDTH);
const FIELD_HEIGHT = Number(process.env.NEXT_PUBLIC_GAME_FIELD_HEIGHT);
const XO_SQUARE_SIZE = Number(process.env.NEXT_PUBLIC_GAME_XO_SQUARE_SIZE);
const PADDLE_SPEED = Number(process.env.NEXT_PUBLIC_GAME_PADDLE_SPEED);
const BALL_SIZE = Number(process.env.NEXT_PUBLIC_GAME_BALL_SIZE);
const BALL_SPEED = Number(process.env.NEXT_PUBLIC_GAME_BALL_SPEED);

class Game {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #players: Record<string, ClientPlayerState>;
  #user?: StoredUser;
  #keysPressed: Set<string> = new Set<string>();
  #socket: Socket;
  #ball: BallState;
  gameState: GameStateServerGame;
  #cells: Map<CellId, FieldCellState> = new Map();

  constructor(
    socket: Socket,
    gameState: GameStateServerGame,
    playersState: Record<UserId, GameStateServerPlayer>,
    user: StoredUser | undefined,
    userIsPlayer: boolean,
  ) {
    this.gameState = gameState;
    this.#canvas = document.getElementById('game') as HTMLCanvasElement;
    this.#ctx = this.#canvas.getContext('2d')!;
    this.#socket = socket;
    this.#user = user;

    for (const [cellId, cellState] of gameState.xoState) {
      this.#cells.set(cellId, {
        ...cellState,
        x: 0,
        y: 0,
      });
    }

    this.#ball = gameState.playState !== 'playing'
      ? { ...gameState.ball }
      : {
        position: { x: -100, y: -100 },
        speed: { x: 0, y: 0 },
      };

    this.#players = Object.entries(playersState).reduce((acc, [plrId, plrState], i) => {
      let x: number;
      if (i === 0) {
        x = FIELD_MARGIN;
      } else {
        x = FIELD_WIDTH - PLR_WIDTH - FIELD_MARGIN;
      }

      const state: ClientPlayerState = {
        id: plrId,
        x,
        y: plrState.y,
        direction: plrState.direction,
        width: PLR_WIDTH,
        height: PLR_HEIGHT,
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

    socket.on('player-key-down', (data: PlayerKeypressData) => {
      if (data.userId !== this.#user?.id) {
        this.#players[data.userId].direction = data.direction;
        this.#players[data.userId].speed.y = data.direction === 'down'
          ? PADDLE_SPEED
          : -PADDLE_SPEED;
      }
    });

    socket.on('player-key-up', (data: PlayerKeypressUpData) => {
      this.#players[data.userId].y = data.y;

      if (data.userId !== this.#user?.id) {
        this.#players[data.userId].direction = data.direction;

        if (data.direction != null) {
          this.#players[data.userId].speed.y = data.direction === 'down'
            ? PADDLE_SPEED
            : -PADDLE_SPEED;
        }
      }
    });

    socket.on('ball-hit-object', (data: BallHitObjectData) => {
      this.#ball = data.ball;
    });

    socket.on('player-select-cell', (data: PlayerSelectCellData) => {
      for (const [cellId, nextCellState] of data.xoState) {
        const curCellState = this.#cells.get(cellId);

        if (!curCellState) {
          console.log(this.#cells);
          throw Error('no cell');
        }

        this.#cells.set(cellId, {
          ...curCellState,
          ...nextCellState,
        });
      }
    });

    socket.on('player-hit-cell', (data: PlayerHitCellData) => {
      for (const [cellId, nextCellState] of data.xoState) {
        const curCellState = this.#cells.get(cellId);

        if (!curCellState) {
          console.log(this.#cells);
          throw Error('no cell');
        }

        this.#cells.set(cellId, {
          ...curCellState,
          ...nextCellState,
        });
      }
    });

    // this.drawXOField();
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
      x: FIELD_WIDTH / 2 - BALL_SIZE / 2,
      y: FIELD_HEIGHT / 2 - BALL_SIZE / 2,
    };
  };

  launchBall = () => {
    if (this.#ball.speed.x > 0) {
      return;
    }

    this.#ball.speed = {
      x: BALL_SPEED,
      y: 0,
    };
  };

  #updateDirection = () => {
    if (!this.#user) {
      return;
    }

    let direction: Direction = null;
    let velocity = 0;
    const keysArr = [...this.#keysPressed];
    const lastInput = keysArr[keysArr.length - 1];

    if (lastInput === 'w' || lastInput === 'arrowup') {
      direction = 'up';
      velocity = -PADDLE_SPEED;
    }
    else if (lastInput === 's' || lastInput === 'arrowdown') {
      direction = 'down';
      velocity = PADDLE_SPEED;
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

      this.#socket.emit('player-key-down', {
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

      this.#socket.emit('player-key-up', {
        gameId: this.gameState.id,
        userId: this.#user.id,
        y: this.#players[this.#user.id].y,
        direction: nextDirection,
      });
    }
  };

  #updatePositions = () => {
    if (this.gameState.playState !== 'playing') {
      return;
    }

    // PLAYERS
    for (const playerId of Object.keys(this.#players)) {
      let next = this.#players[playerId].y;

      if (this.#players[playerId].direction != null) {
        next = this.#players[playerId].y + this.#players[playerId].speed.y;
      }

      if (next >= 0 && next <= FIELD_HEIGHT - PLR_HEIGHT) {
        this.#players[playerId].y = next;
      }
    }

    // BALL
    if (this.#ball.speed.x === 0 && this.#ball.speed.y === 0) {
      return;
    }

    let changed = false;
    this.#ball.position.x += this.#ball.speed.x;
    this.#ball.position.y += this.#ball.speed.y;

    const { position, speed } = this.#ball;
    const HALF_BALL_SIZE = BALL_SIZE / 2;
    const topX = position.x - HALF_BALL_SIZE;
    const topY = this.#ball.position.y - HALF_BALL_SIZE;
    const bottomX = position.x + HALF_BALL_SIZE;
    const bottomY = this.#ball.position.y + HALF_BALL_SIZE;

    // Left / right boundaries
    if (position.x - HALF_BALL_SIZE < 0) {
      this.#ball.position.x = HALF_BALL_SIZE;
      this.#ball.speed.x = -speed.x;
      changed = true;
    } else if (position.x + HALF_BALL_SIZE > FIELD_WIDTH) {
      this.#ball.position.x = FIELD_WIDTH - HALF_BALL_SIZE;
      this.#ball.speed.x = -speed.x;
      changed = true;
    }

    // Top / bottom boundaries
    if (position.y - HALF_BALL_SIZE < 0) {
      this.#ball.position.y = HALF_BALL_SIZE;
      this.#ball.speed.y = -speed.y;
      changed = true;
    } else if (position.y + HALF_BALL_SIZE > FIELD_HEIGHT) {
      this.#ball.position.y = FIELD_HEIGHT - HALF_BALL_SIZE;
      this.#ball.speed.y = -speed.y;
      changed = true;
    }

    // Reset code???
    // if (this.#ball.position.y < 0 || this.#ball.position.y > FIELD_WIDTH) {
    //   this.#ball.speed.x = BALL_SPEED;
    //   this.#ball.speed.y = 0;
    //   this.#ball.position.x = FIELD_WIDTH / 2;
    //   this.#ball.position.y = FIELD_HEIGHT / 2;
    // }

    const paddle1 = this.#players[this.gameState.players[1]];
    const paddle2 = this.#players[this.gameState.players[2]];

    if (bottomX < PLR_WIDTH * 2) {
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
        this.#ball.speed.x = BALL_SPEED;
        this.#ball.speed.y += (paddle1.speed.y / 2);
        this.#ball.position.x += this.#ball.speed.x;
        changed = true;
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
    } else if (bottomX > FIELD_WIDTH - PLR_WIDTH * 2) {
      const paddleBottom = paddle2.y + paddle2.height;
      const paddleTop = paddle2.y;
      const paddleRight = paddle2.x + paddle2.width;
      const paddleLeft = paddle2.x;
      const yCheck1 = topY < paddleBottom;
      const yCheck2 = bottomY > paddleTop;
      const xCheck1 = topX < paddleRight;
      const xCheck2 = bottomX > paddleLeft;

      if (yCheck1 && yCheck2 && xCheck1 && xCheck2) {
        this.#ball.speed.x = -BALL_SPEED;
        this.#ball.speed.y += (paddle2.speed.y / 2);
        this.#ball.position.x += this.#ball.speed.x;
        changed = true;
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

    if (changed) {
      this.#socket.emit('ball-hit-object', {
        gameId: this.gameState.id,
        ball: this.#ball,
      });
    }
  };

  #checkCellsCollision = () => {
    const { position } = this.#ball;
    let hitCell: FieldCellState | null = null;

    for (const cell of this.#cells.values()) {
      const x2 = cell.x + XO_SQUARE_SIZE;
      const y2 = cell.y + XO_SQUARE_SIZE;

      if (
        cell.state === 'selected' &&
        position.x > cell.x && position.x < x2 && position.y > cell.y && position.y < y2
      ) {
        hitCell = cell;
      }
    }

    if (hitCell) {
      this.#cells.set(hitCell.cellId, {
        ...hitCell,
        state: 'captured',
      });

      this.#socket.emit('player-hit-cell', {
        gameId: this.gameState.id,
        userId: this.gameState.turn,
        cellId: hitCell,
      });
    }
  };

  drawXOField = () => {
    const CELL_SIZE = XO_SQUARE_SIZE;
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

    // Check if cells have not been placed yet
    const [, cellState] = [...this.#cells][0];
    if (cellState.x === 0) {
      for (let x = 0; x < 3; x++) {
        for (let y = 0; y < 3; y++) {
          const cellX = L3x + (CELL_SIZE * x);
          const cellY = L1y + (CELL_SIZE * y);
          const cellId = '' + x + y;

          const cell = this.#cells.get(cellId);

          if (!cell) {
            console.log(this.#cells);
            throw Error('no cell');
          }

          this.#cells.set(cellId, {
            ...cell,
            x: cellX,
            y: cellY,
          });
        }
      }
    }

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
        this.#ctx.lineTo(x + (CELL_SIZE * 3), y);
      } else {
        this.#ctx.lineTo(x, y + (CELL_SIZE * 3));
      }
      this.#ctx.stroke();
    }

    return this.#cells;
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
      BALL_SIZE,
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
    this.#checkCellsCollision();
    // requestAnimationFrame(this.#tick);
    setTimeout(this.#tick, 100);
  };
}

export type GameId = string;
export type UserId = string;
export type CellId = string;
export type PlaystateTypes = 'waiting_for_players' | 'starting' | 'playing' | 'paused' | 'finished';
export type PhaseTypes = 'pong' | 'xo';
export type Direction = 'up' | 'down' | null;
export type Mark = 'x' | 'o';
export type CellState = null | 'selected' | 'captured';

export type FieldCellState = XoState & {
  x: number;
  y: number;
};

export type ServerPlayerState = {
  id: UserId;
  y: number;
  direction: Direction;
  mark: Mark;
  connected: boolean;
  socketId: string;
};

type ClientPlayerState = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  direction: Direction;
  mark: Mark;
  speed: { x: number; y: number };
};

type PlayerKeypressData = {
  userId: string;
  direction: Direction;
};

type PlayerKeypressUpData = PlayerKeypressData & {
  y: number;
};

type BallHitObjectData = {
  ball: BallState;
};

export type BallState = {
  position: { x: number; y: number };
  speed: { x: number; y: number };
};

export default Game;
