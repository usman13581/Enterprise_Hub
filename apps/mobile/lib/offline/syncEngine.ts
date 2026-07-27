import {
  countPendingImages,
  countPendingMutations,
  deleteEntity,
  enqueueImage,
  enqueueMutation,
  getMeta,
  listPendingImages,
  listPendingMutations,
  markImage,
  markMutation,
  setMeta,
  upsertEntity,
} from './db';
import { isOnline } from './net';

const PORT = 3001;
const TOKEN = process.env.EXPO_PUBLIC_BOOTSTRAP_TOKEN || 'binhaj-dev-token';

function apiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  return `http://localhost:${PORT}`;
}

async function syncFetch<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(`${apiBase()}${path}`, {
    ...rest,
    headers: {
      'x-marble-token': TOKEN,
      ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  if (!res.ok) {
    throw new Error((await res.text().catch(() => '')) || `API ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export type SyncStatus = {
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  pendingMutations: number;
  pendingImages: number;
  lastError: string | null;
};

type PullResponse = {
  serverTime: string;
  entities: Record<string, Array<Record<string, unknown> & { id?: string }>>;
};

const COLLECTION_MAP: Record<string, string> = {
  profile: 'profile',
  suppliers: 'suppliers',
  products: 'products',
  productImages: 'productImages',
  customers: 'customers',
  quotations: 'quotations',
  jobs: 'jobs',
  invoices: 'invoices',
  advances: 'advances',
  ledger: 'ledger',
  audit: 'audit',
};

/** Maps REST list paths to SQLite collection names for offline reads. */
export const PATH_COLLECTION: Record<string, string> = {
  '/suppliers': 'suppliers',
  '/products': 'products',
  '/customers': 'customers',
  '/quotations': 'quotations',
  '/jobs': 'jobs',
  '/invoices': 'invoices',
  '/advances': 'advances',
  '/company/profile': 'profile',
  '/audit': 'audit',
};

let syncing = false;
let lastError: string | null = null;
const listeners = new Set<(status: SyncStatus) => void>();

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function snapshotStatus(): Promise<SyncStatus> {
  return {
    online: await isOnline(),
    syncing,
    lastSyncAt: await getMeta('lastSyncAt'),
    pendingMutations: await countPendingMutations(),
    pendingImages: await countPendingImages(),
    lastError,
  };
}

async function emit() {
  const status = await snapshotStatus();
  for (const listener of listeners) listener(status);
}

export function subscribeSyncStatus(listener: (status: SyncStatus) => void) {
  listeners.add(listener);
  void snapshotStatus().then(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function getSyncStatus() {
  return snapshotStatus();
}

/**
 * Pull server changes into SQLite, flush image + mutation queues, then push
 * any remaining sync-shaped mutations.
 */
export async function runSync(): Promise<SyncStatus> {
  if (syncing) return snapshotStatus();
  syncing = true;
  lastError = null;
  await emit();

  try {
    if (!(await isOnline())) {
      lastError = 'Offline — changes stay queued on this device';
      return snapshotStatus();
    }

    await flushImageQueue();
    await flushRestMutationQueue();
    await pullAndStore();
    await flushSyncMutationQueue();

    await setMeta('lastSyncAt', new Date().toISOString());
  } catch (error) {
    lastError = error instanceof Error ? error.message : 'Sync failed';
  } finally {
    syncing = false;
    await emit();
  }

  return snapshotStatus();
}

async function pullAndStore() {
  const since = await getMeta('pullCursor');
  const path = since
    ? `/sync/pull?since=${encodeURIComponent(since)}`
    : '/sync/pull';
  const payload = await syncFetch<PullResponse>(path);

  for (const [key, collection] of Object.entries(COLLECTION_MAP)) {
    const rows = payload.entities[key] ?? [];
    for (const row of rows) {
      const id =
        typeof row.id === 'string'
          ? row.id
          : key === 'profile'
            ? 'profile'
            : null;
      if (!id) continue;
      const updatedAt =
        typeof row.updatedAt === 'string'
          ? row.updatedAt
          : typeof row.createdAt === 'string'
            ? row.createdAt
            : payload.serverTime;
      await upsertEntity(collection, id, updatedAt, row);
    }
  }

  await setMeta('pullCursor', payload.serverTime);
}

async function flushImageQueue() {
  for (const item of await listPendingImages()) {
    try {
      const name = item.local_uri.split('/').pop() || `photo-${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(name);
      const type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      const form = new FormData();
      form.append('file', {
        uri: item.local_uri,
        name,
        type,
      } as unknown as Blob);
      const res = await fetch(`${apiBase()}/uploads`, {
        method: 'POST',
        headers: { 'x-marble-token': TOKEN },
        body: form,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const uploaded = (await res.json()) as { url: string };

      if (item.purpose === 'product' && item.product_id) {
        await syncFetch(`/products/${item.product_id}/images`, {
          method: 'POST',
          json: { url: uploaded.url },
        });
      }
      await markImage(item.id, 'done', uploaded.url);
    } catch (error) {
      await markImage(
        item.id,
        'pending',
        undefined,
        error instanceof Error ? error.message : 'Upload failed',
      );
      throw error;
    }
  }
}

async function flushRestMutationQueue() {
  for (const item of await listPendingMutations()) {
    if (item.sync_payload_json) continue;
    try {
      const body = item.body_json ? JSON.parse(item.body_json) : undefined;
      await syncFetch(item.path, {
        method: item.method,
        json: body,
      });
      await markMutation(item.id, 'done');
    } catch (error) {
      await markMutation(
        item.id,
        'pending',
        error instanceof Error ? error.message : 'Flush failed',
      );
      throw error;
    }
  }
}

async function flushSyncMutationQueue() {
  const pending = (await listPendingMutations()).filter(
    (item) => item.sync_payload_json,
  );
  if (pending.length === 0) return;

  const mutations = pending.map((item) => JSON.parse(item.sync_payload_json!));
  const result = await syncFetch<{
    results: Array<{ clientMutationId: string; decision: string }>;
  }>('/sync/push', { method: 'POST', json: { mutations } });

  for (const item of pending) {
    const decision = result.results.find(
      (row) => row.clientMutationId === item.id,
    )?.decision;
    if (
      decision === 'applied' ||
      decision === 'reject_server_wins' ||
      decision === 'reject_stale'
    ) {
      await markMutation(item.id, 'done');
      if (
        (decision === 'reject_server_wins' || decision === 'reject_stale') &&
        item.entity &&
        item.entity_id
      ) {
        await deleteEntity(item.entity, item.entity_id);
      }
    } else {
      await markMutation(item.id, 'pending', decision ?? 'error');
    }
  }
}

/** Queue a REST write while offline (invoices, advances, approvals, etc.). */
export async function queueRestMutation(input: {
  method: string;
  path: string;
  body?: unknown;
}) {
  await enqueueMutation({
    id: newId('mut'),
    method: input.method,
    path: input.path,
    body: input.body,
  });
  await emit();
}

/** Queue a sync upsert for catalog/CRM/draft quotation rows. */
export async function queueSyncUpsert(input: {
  entity: string;
  collection: string;
  id: string;
  version: number;
  data: Record<string, unknown>;
}) {
  const updatedAt = new Date().toISOString();
  const mutationId = newId('sync');
  await upsertEntity(input.collection, input.id, updatedAt, {
    id: input.id,
    ...input.data,
    version: input.version,
    updatedAt,
  });
  await enqueueMutation({
    id: mutationId,
    method: 'POST',
    path: '/sync/push',
    entity: input.collection,
    entityId: input.id,
    syncPayload: {
      clientMutationId: mutationId,
      entity: input.entity,
      op: 'upsert',
      id: input.id,
      updatedAt,
      version: input.version,
      data: input.data,
    },
  });
  await emit();
}

export async function queueProductImage(localUri: string, productId: string) {
  await enqueueImage({
    id: newId('img'),
    localUri,
    productId,
    purpose: 'product',
  });
  await emit();
}
