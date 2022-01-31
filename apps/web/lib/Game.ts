import type { Socket } from 'socket.io-client';

import type { GetGameByIdQuery } from 'faunadb/generated.js';

import { theme } from '../tailwind.config.js';


class Game {
  #canvas: HTMLCanvasElement;
  #ctx: CanvasRenderingContext2D;
  #players = [] as unknown as [Player, Player]; // This gives #players a fixed array length
  #keysPressed: Record<string, boolean> = {};
  #gameData: GetGameByIdQuery['findGameByID'];

  constructor(
    canvas: HTMLCanvasElement,
    socket: Socket,
    game: GetGameByIdQuery['findGameByID'],
    userIsPlayer: boolean,
  ) {
    this.#canvas = canvas;
    this.#ctx = this.#canvas.getContext('2d')!;
    this.#gameData = game;

    const PLR_HEIGHT = 20;
    const PLR_WIDTH = 2;
    this.#players = [0, 1].map((_, i) => {
      return {
        x: 0 + (canvas.width - PLR_WIDTH) * i,
        y: (canvas.height / 2) - (PLR_HEIGHT / 2),
        width: PLR_WIDTH,
        height: PLR_HEIGHT,
      };
    }) as [Player, Player]; // Typescript does not know this returns an array of 2

    // Only give players of this game keyboard controls
    if (userIsPlayer) {
      document.addEventListener('keydown', this.#onKeyDown);
      document.addEventListener('keyup', this.#onKeyUp);
    }

    this.#draw();
  }

  unload = () => {
    document.removeEventListener('keydown', this.#onKeyDown);
    document.removeEventListener('keyup', this.#onKeyUp);
  };

  start = () => {
    this.#draw();
  };

  #onKeyDown = (e: KeyboardEvent) => {
    if (this.#keysPressed[e.key]) {
      return;
    }

    console.log('key down', e.key);

    this.#keysPressed[e.key] = true;

    // socket?.emit('player-key-down', {
    //   userId: getItem('user_id'),
    //   key: e.key,
    // });
  };

  #onKeyUp = (e: KeyboardEvent) => {
    console.log('key up', e.key);

    this.#keysPressed[e.key] = false;

    // socket?.emit('player-key-up', {
    //   userId: getItem('user_id'),
    //   key: e.key,
    // });
  };

  #draw() {
    this.#ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);

    for (const player of this.#players)  {
      this.#ctx.beginPath();
      this.#ctx.lineWidth = 2;
      this.#ctx.strokeStyle = theme.extend.colors.primary[600];
      this.#ctx.rect(
        player.x,
        player.y,
        player.width,
        player.height,
      );
      this.#ctx.stroke();
    }
  }
}

type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export default Game;
