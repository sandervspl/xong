import type * as i from '@xong/types';
import { proxy } from 'valtio';
import { devtools } from 'valtio/utils';

// Keep this in a different file so it does not reset due to HMR
const gameState = proxy({} as i.GameState);
export default gameState;

devtools(gameState, 'game state');
