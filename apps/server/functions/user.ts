import type { Handler, APIGatewayEvent } from 'aws-lambda';


interface HelloResponse {
  statusCode: number;
  body: string;
}

const handler: Handler<APIGatewayEvent> = (event, context, callback) => {
  const params = event.queryStringParameters;

  const response: HelloResponse = {
    statusCode: 200,
    body: JSON.stringify({
      msg: `Hello world ${Math.floor(Math.random() * 10)}`,
      params,
    }),
  };

  callback(undefined, response);
};

export { handler };
