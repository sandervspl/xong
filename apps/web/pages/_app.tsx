import * as React from 'react';
import type { AppProps } from 'next/app';
import type { DehydratedState } from 'react-query';
import { QueryClient, QueryClientProvider, Hydrate } from 'react-query';

import useSocketIO from 'hooks/useSocketIO';
import { SocketIOContext } from 'lib/SocketIOContext';

import '../styles/tailwind.scss';
import '../styles/globals.scss';


function MyApp({ Component, pageProps: { state, ...pageProps } }: Props) {
  const socketIOClient = useSocketIO();
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        cacheTime: 1000 * 6 * 10, // 10 minutes
        retry: false,
        notifyOnChangeProps: 'tracked',
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <Hydrate state={state}>
        <SocketIOContext.Provider value={socketIOClient}>
          <Component {...pageProps} />
        </SocketIOContext.Provider>
      </Hydrate>
    </QueryClientProvider>
  );
}

type Props = Omit<AppProps, 'pageProps'> & {
  pageProps: Record<string, unknown> & {
    state: DehydratedState;
  };
};

export default MyApp;
