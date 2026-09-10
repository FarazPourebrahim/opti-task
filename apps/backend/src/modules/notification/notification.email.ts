import { logger } from '@/shared/logger';

/**
 * Email delivery abstraction. Notifications are delivered in-app (DB row) and,
 * for channels that warrant it, via email. The dev adapter is a no-op that logs;
 * a production SMTP/provider adapter implements the same interface — no caller
 * changes (mirrors the storage adapter seam).
 */
export type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

export type EmailAdapter = {
  send(message: EmailMessage): Promise<void>;
};

/** Dev/no-op adapter: records intent in logs, never sends real mail. */
export const noopEmailAdapter: EmailAdapter = {
  async send(message) {
    logger.info({ to: message.to, subject: message.subject }, 'email (noop) queued');
  },
};

let adapter: EmailAdapter = noopEmailAdapter;

export function getEmailAdapter(): EmailAdapter {
  return adapter;
}

export function setEmailAdapter(next: EmailAdapter): void {
  adapter = next;
}
