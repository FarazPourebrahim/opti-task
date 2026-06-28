import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/use/ws';
import type { Context as GraphQLWsContext } from 'graphql-ws';
import { createApp } from './app.js';
import { buildSchema } from '@shared/graphql/schema';
import { createSubscriptionContext } from '@shared/graphql/context';
import { env } from '@shared/config';
import { logger } from '@shared/logger';
import { disconnectPrisma } from '@shared/db';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const httpServer = createServer(app);

  // GraphQL subscriptions over WebSocket (graphql-ws). The socket authenticates
  // via connectionParams; each subscription authorizes + scopes its own stream.
  const wsServer = new WebSocketServer({ server: httpServer, path: '/graphql' });
  const schema = buildSchema();
  const wsCleanup = useServer(
    {
      schema,
      context: (graphqlWsCtx: GraphQLWsContext) =>
        createSubscriptionContext(graphqlWsCtx.connectionParams),
    },
    wsServer,
  );

  httpServer.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `OptiTask server ready at http://localhost:${env.PORT}/graphql (ws: subscriptions)`,
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');
    void Promise.resolve(wsCleanup.dispose()).finally(() => {
      httpServer.close(() => {
        void disconnectPrisma().finally(() => process.exit(0));
      });
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});
