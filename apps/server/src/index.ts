import express from 'express';

const app = express();

app.listen(import.meta.env.VITE_SERVER_PORT, (() => {
  console.info('Server started!');
}));

export const viteNodeApp = app;
