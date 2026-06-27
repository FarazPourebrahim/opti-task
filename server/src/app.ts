import express, { type Express } from 'express';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { resolvers, typeDefs } from '@shared/graphql/schema';
import { isProduction } from '@shared/config';

export type AppContext = {
  requestId: string;
};

/**
 * Builds and wires the Express app with Apollo at /graphql. Kept separate from
 * server bootstrap so tests can mount the app without binding a port.
 */
export async function createApp(): Promise<Express> {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const apollo = new ApolloServer<AppContext>({
    typeDefs,
    resolvers,
    introspection: !isProduction,
  });

  await apollo.start();

  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(apollo, {
      context: async () => ({ requestId: crypto.randomUUID() }),
    }),
  );

  return app;
}
