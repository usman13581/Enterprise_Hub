/**
 * Offline sync conflict policy for V1.
 *
 * - Catalog / CRM rows and draft quotations: last-write-wins by updatedAt.
 * - Once a document is approved, issued, cancelled, completed, or closed,
 *   the server copy always wins — the client must pull and discard its edit.
 */

export const SYNC_ENTITIES = [
  'profile',
  'supplier',
  'product',
  'productImage',
  'customer',
  'quotation',
  'job',
  'invoice',
  'advance',
  'ledger',
  'audit',
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];

export type SyncDecision = 'apply' | 'reject_server_wins' | 'reject_stale';

/** Statuses that freeze a row against silent client overwrites. */
export function isServerProtected(
  entity: SyncEntity,
  status: string | null | undefined,
): boolean {
  const value = status ?? '';
  switch (entity) {
    case 'quotation':
      return value === 'approved' || value === 'cancelled';
    case 'invoice':
      return value === 'issued' || value === 'cancelled';
    case 'job':
      return value === 'completed' || value === 'closed';
    default:
      return false;
  }
}

/**
 * Decide whether a client mutation may replace the current server row.
 * `server` null means the row does not exist yet (create).
 */
export function resolveSyncWrite(input: {
  entity: SyncEntity;
  clientUpdatedAt: Date | string;
  clientVersion: number;
  server: {
    updatedAt: Date | string;
    version: number;
    status?: string | null;
  } | null;
}): SyncDecision {
  if (!input.server) return 'apply';

  if (isServerProtected(input.entity, input.server.status)) {
    return 'reject_server_wins';
  }

  const clientMs = toMs(input.clientUpdatedAt);
  const serverMs = toMs(input.server.updatedAt);

  if (
    input.clientVersion < input.server.version ||
    (input.clientVersion === input.server.version && clientMs < serverMs)
  ) {
    return 'reject_stale';
  }

  return 'apply';
}

function toMs(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}
