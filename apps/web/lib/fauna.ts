import { GraphQLClient } from 'graphql-request';

import type { CreateGameMutation, GetGameByIdQuery, GetUsersQuery, UserInput } from '../faunadb/generated';
import { getSdk } from '../faunadb/generated';


const CLIENT_SECRET = process.env.FAUNA_ADMIN_KEY || process.env.FAUNA_CLIENT_SECRET;
const FAUNA_GRAPHQL_BASE_URL = 'https://graphql.fauna.com/graphql';

const graphQLClient = new GraphQLClient(FAUNA_GRAPHQL_BASE_URL, {
  headers: {
    authorization: `Bearer ${CLIENT_SECRET}`,
  },
});

const sdk = getSdk(graphQLClient);

export async function listUsers(): Promise<GetUsersQuery['users']['data']> {
  const res = await sdk.GetUsers();
  return res.users.data;
};

export async function createUser(newUser: UserInput) {
  // return sdk.CreateUser({ input: newUser });

  // const mutation = gql`
  //   mutation createUser($input: GuestbookEntryInput!) {
  //     createGuestbookEntry(data: $input) {
  //       _id
  //       _ts
  //       name
  //       message
  //       createdAt
  //     }
  //   }
  // `;

  // return graphQLClient.request(mutation, { input: newUser });
};

export async function getGameById(id: string): Promise<GetGameByIdQuery['findGameByID']> {
  const res = await sdk.GetGameById({ id });
  return res.findGameByID;
}

export async function createGame(playerIds: string[]): Promise<CreateGameMutation['createGame']> {
  const res = await sdk.CreateGame({
    data: {
      result: 'pending',
      players: {
        connect: playerIds,
      },
    },
  });

  return res.createGame;
}
