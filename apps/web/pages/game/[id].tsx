import { getGameById } from 'lib/fauna';
import type { GetServerSideProps } from 'next';


type Props = {
  game: Awaited<ReturnType<typeof getGameById>>;
};

type Queries = {
  id: string;
};

export default function Page(props: Props) {
  return (
    <div className="text-primary-900">Game on!</div>
  );
}

export const getServerSideProps: GetServerSideProps<Props, Queries> = async ({ params }) => {
  const game = await getGameById(params!.id);

  return {
    props: {
      game,
    },
  };
};
