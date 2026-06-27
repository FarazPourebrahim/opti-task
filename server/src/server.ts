import { createApp } from './app.js';
import { env } from '@shared/config';
import { logger } from '@shared/logger';
import { disconnectPrisma } from '@shared/db';

async function bootstrap(): Promise<void> {
  const app = await createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, env: env.NODE_ENV },
      `OptiTask server ready at http://localhost:${env.PORT}/graphql`,
    );
  });

  const shutdown = (signal: string): void => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectPrisma().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error: unknown) => {
  logger.error({ error }, 'Failed to start server');
  process.exit(1);
});
