import axios from 'axios';
import absoluteUrl from 'next-absolute-url';


async function fetcher<T>(uri: string, ctx, method: 'get' | 'post' = 'get') {
  const { origin } = absoluteUrl(ctx.req);
  const { data } = await axios.get<T>(`${origin}${uri}`);

  return data;
};

export default fetcher;
