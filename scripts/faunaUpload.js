const path = require('path');
const cp = require('child_process');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve('apps/web', '.env.local'),
});

const secret = process.env.FAUNA_CLIENT_SECRET;
if (!secret) {
  throw Error('No secret found');
}

cp.execSync(
  `curl -u ${secret}: https://graphql.fauna.com/import --data-binary "@./apps/web/faunadb/model.graphql"`,
  {
    stdio: 'inherit'
  },
);
