import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSchema } from '@shared/graphql/schema';
import { createContext, type GraphQLContext } from '@shared/graphql/context';
import { formatError } from '@shared/graphql/format-error';
import { rateLimitMiddleware } from '@shared/middleware/rate-limit';
import { isProduction } from '@shared/config';

/**
 * Builds and wires the Express app with Apollo at /graphql. Kept separate from
 * server bootstrap so tests can mount the app without binding a port.
 */
export async function createApp(): Promise<Express> {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ credentials: true }));
  app.use(cookieParser());

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const apollo = new ApolloServer<GraphQLContext>({
    schema: buildSchema(),
    introspection: !isProduction,
    formatError,
  });

  await apollo.start();

  app.use(
    '/graphql',
    rateLimitMiddleware,
    express.json({ limit: '1mb' }),
    expressMiddleware(apollo, {
      context: async ({ req, res }) => createContext({ req, res }),
    }),
  );

  return app;
}
