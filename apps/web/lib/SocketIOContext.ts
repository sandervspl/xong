import { createContext } from 'react';
import type { Socket } from 'socket.io-client';


export const SocketIOContext = createContext<null | Socket>(null);
