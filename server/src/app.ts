import express, { type Express } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSchema } from '@shared/graphql/schema';
import { createContext, type GraphQLContext } from '@shared/graphql/context';
import { formatError } from '@shared/graphql/format-error';
import { depthLimit } from '@shared/graphql/depth-limit';
import { rateLimitMiddleware } from '@shared/middleware/rate-limit';
import { isProduction, isTest } from '@shared/config';
import { logger } from '@shared/logger';
import { prisma } from '@shared/db';
import { registerNotificationHandlers } from '@modules/notification/notification.events';

/** Maximum GraphQL query nesting depth accepted (DoS guard). */
const MAX_QUERY_DEPTH = 12;

/**
 * Builds and wires the Express app with Apollo at /graphql. Kept separate from
 * server bootstrap so tests can mount the app without binding a port.
 */
export async function createApp(): Promise<Express> {
  // Wire domain-event subscribers (notification fan-out). Idempotent.
  registerNotificationHandlers();

  const app = express();

  app.disable('x-powered-by');
  // Structured per-request logging (autoLogging off under tests to keep output
  // clean). The shared logger redacts authorization/cookie headers.
  app.use(pinoHttp({ logger, autoLogging: !isTest }));
  app.use(cors({ credentials: true }));
  app.use(cookieParser());

  // Liveness: the process is up. Readiness: the process can reach its DB.
  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.get('/readyz', (_req, res) => {
    prisma
      .$queryRaw`SELECT 1`
      .then(() => res.json({ status: 'ready' }))
      .catch(() => res.status(503).json({ status: 'unavailable' }));
  });

  const apollo = new ApolloServer<GraphQLContext>({
    schema: buildSchema(),
    introspection: !isProduction,
    formatError,
    validationRules: [depthLimit(MAX_QUERY_DEPTH)],
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
