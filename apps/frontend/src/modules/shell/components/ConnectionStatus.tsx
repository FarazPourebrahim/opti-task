import { Badge } from '@averoui/react';
import { useTranslation } from 'react-i18next';
import { useRealtimeStatus } from '@/shared/hooks/useRealtime';
import type { RealtimeStatus } from '@/shared/services/realtime.client';

type Presentation = {
  labelKey:
    | 'shell.connection.live'
    | 'shell.connection.reconnecting'
    | 'shell.connection.offline';
  hintKey:
    | 'shell.connection.liveHint'
    | 'shell.connection.reconnectingHint'
    | 'shell.connection.offlineHint';
  tone: 'success' | 'neutral' | 'dark';
};

/* The first attempt and a retry look the same to a person: not live yet. */
const PRESENTATION: Record<Exclude<RealtimeStatus, 'idle'>, Presentation> = {
  live: {
    labelKey: 'shell.connection.live',
    hintKey: 'shell.connection.liveHint',
    tone: 'success',
  },
  connecting: {
    labelKey: 'shell.connection.reconnecting',
    hintKey: 'shell.connection.reconnectingHint',
    tone: 'neutral',
  },
  reconnecting: {
    labelKey: 'shell.connection.reconnecting',
    hintKey: 'shell.connection.reconnectingHint',
    tone: 'neutral',
  },
  offline: {
    labelKey: 'shell.connection.offline',
    hintKey: 'shell.connection.offlineHint',
    tone: 'dark',
  },
};

/**
 * Whether other people's changes are arriving on their own.
 *
 * The app works the same either way — every screen reads and writes without
 * the live connection — so this never blocks anything. It only tells the truth
 * about whether what is on screen updates by itself, in words as well as color.
 */
export function ConnectionStatus() {
  const { t } = useTranslation();
  const status = useRealtimeStatus();

  // No live connection is wanted (nothing is subscribed): nothing to report.
  if (status === 'idle') return null;

  const { labelKey, hintKey, tone } = PRESENTATION[status];

  return (
    <span role="status" title={t(hintKey)} className="inline-flex shrink-0">
      <Badge tone={tone}>
        <span className="sr-only">{t('shell.connection.label')} </span>
        {t(labelKey)}
      </Badge>
    </span>
  );
}
