import express, { type Express } from 'express';
import cookieParser from 'cookie-parser';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { buildSchema } from '@/shared/graphql/schema';
import { createContext, type GraphQLContext } from '@/shared/graphql/context';
import { formatError } from '@/shared/graphql/formatError';
import { depthLimit } from '@/shared/graphql/depthLimit';
import { corsMiddleware } from '@/shared/middleware/cors';
import { csrfGuard } from '@/shared/middleware/csrf';
import { rateLimitMiddleware } from '@/shared/middleware/rateLimit';
import { requestLogger } from '@/shared/middleware/requestLogger';
import { isProduction } from '@/shared/config';
import { prisma } from '@/shared/db';
import { registerNotificationHandlers } from '@/modules/notification/notification.events';

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
  // Structured per-request logging. First in the chain so every later line
  // carries the same request id.
  app.use(requestLogger);
  // Explicit origin allowlist. A credentialed response may not use `*`, so a
  // wildcard here would make the browser reject every authenticated request.
  app.use(corsMiddleware);
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
    // Runs after cookieParser (it inspects the session cookie) and before the
    // body is parsed, so a forged request is refused as cheaply as possible.
    csrfGuard,
    express.json({ limit: '1mb' }),
    expressMiddleware(apollo, {
      context: async ({ req, res }) => createContext({ req, res }),
    }),
  );

  return app;
}
