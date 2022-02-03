module.exports = {
  schemaPath: './schema.graphql',
  documents: ['./apps/web/faunadb/queries/*.graphql'],
  extensions: {
    endpoints: {
      default: {
        url: 'https://graphql.fauna.com/graphql',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.FAUNA_CLIENT_SECRET}`,
        },
      },
    },
  },
};
