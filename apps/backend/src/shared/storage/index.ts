import { randomUUID } from 'node:crypto';

/**
 * Attachment storage abstraction. The backend stores only file METADATA + an
 * opaque `storageKey`; the actual bytes live behind whichever adapter is wired.
 * Swapping to S3/GCS/signed URLs means implementing this interface — no caller
 * changes (docs: "no hard cloud lock-in").
 */
export type StorageAdapter = {
  /** Allocates an opaque storage key for a new object within a logical scope. */
  generateKey(input: { scope: string; filename: string }): string;
  /** Resolves a (possibly signed) URL a client can use to fetch the object. */
  getUrl(storageKey: string): string;
};

const FILE_BASE_PATH = '/files';

/**
 * Dev/local adapter: keys are `scope/uuid-filename`, URLs are a relative path
 * under a static mount. No real upload happens here — it is the interface seam
 * that a production object-store adapter replaces.
 */
export const localStorageAdapter: StorageAdapter = {
  generateKey({ scope, filename }) {
    const safeName = filename.replace(/[^\w.-]+/g, '_').slice(0, 120);
    return `${scope}/${randomUUID()}-${safeName}`;
  },
  getUrl(storageKey) {
    return `${FILE_BASE_PATH}/${storageKey}`;
  },
};

let adapter: StorageAdapter = localStorageAdapter;

export function getStorageAdapter(): StorageAdapter {
  return adapter;
}

/** Swap the active adapter (e.g. an S3 impl in production wiring or a test). */
export function setStorageAdapter(next: StorageAdapter): void {
  adapter = next;
}
