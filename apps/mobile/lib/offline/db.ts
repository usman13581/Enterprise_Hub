import * as SQLite from 'expo-sqlite';

const DB_NAME = 'marble-offline.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS meta (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS entities (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          json TEXT NOT NULL,
          PRIMARY KEY (collection, id)
        );
        CREATE INDEX IF NOT EXISTS entities_collection_updated
          ON entities(collection, updated_at);
        CREATE TABLE IF NOT EXISTS mutation_queue (
          id TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL,
          method TEXT NOT NULL,
          path TEXT NOT NULL,
          body_json TEXT,
          entity TEXT,
          entity_id TEXT,
          sync_payload_json TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          last_error TEXT
        );
        CREATE TABLE IF NOT EXISTS image_queue (
          id TEXT PRIMARY KEY NOT NULL,
          created_at TEXT NOT NULL,
          local_uri TEXT NOT NULL,
          product_id TEXT,
          purpose TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          remote_url TEXT,
          last_error TEXT
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

export async function getMeta(key: string): Promise<string | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string) {
  const db = await getOfflineDb();
  await db.runAsync(
    `INSERT INTO meta(key, value) VALUES(?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function upsertEntity(
  collection: string,
  id: string,
  updatedAt: string,
  record: unknown,
) {
  const db = await getOfflineDb();
  await db.runAsync(
    `INSERT INTO entities(collection, id, updated_at, json)
     VALUES(?, ?, ?, ?)
     ON CONFLICT(collection, id) DO UPDATE SET
       updated_at = excluded.updated_at,
       json = excluded.json`,
    [collection, id, updatedAt, JSON.stringify(record)],
  );
}

export async function listEntities<T>(collection: string): Promise<T[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<{ json: string }>(
    'SELECT json FROM entities WHERE collection = ? ORDER BY updated_at DESC',
    [collection],
  );
  return rows.map((row) => JSON.parse(row.json) as T);
}

export async function getEntity<T>(
  collection: string,
  id: string,
): Promise<T | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ json: string }>(
    'SELECT json FROM entities WHERE collection = ? AND id = ?',
    [collection, id],
  );
  return row ? (JSON.parse(row.json) as T) : null;
}

export async function deleteEntity(collection: string, id: string) {
  const db = await getOfflineDb();
  await db.runAsync('DELETE FROM entities WHERE collection = ? AND id = ?', [
    collection,
    id,
  ]);
}

export type QueuedMutation = {
  id: string;
  created_at: string;
  method: string;
  path: string;
  body_json: string | null;
  entity: string | null;
  entity_id: string | null;
  sync_payload_json: string | null;
  status: string;
  last_error: string | null;
};

export async function enqueueMutation(input: {
  id: string;
  method: string;
  path: string;
  body?: unknown;
  entity?: string;
  entityId?: string;
  syncPayload?: unknown;
}) {
  const db = await getOfflineDb();
  await db.runAsync(
    `INSERT INTO mutation_queue
      (id, created_at, method, path, body_json, entity, entity_id, sync_payload_json, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      input.id,
      new Date().toISOString(),
      input.method,
      input.path,
      input.body === undefined ? null : JSON.stringify(input.body),
      input.entity ?? null,
      input.entityId ?? null,
      input.syncPayload === undefined
        ? null
        : JSON.stringify(input.syncPayload),
    ],
  );
}

export async function listPendingMutations(): Promise<QueuedMutation[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueuedMutation>(
    `SELECT * FROM mutation_queue
     WHERE status = 'pending'
     ORDER BY created_at ASC`,
  );
}

export async function markMutation(
  id: string,
  status: 'done' | 'pending' | 'error',
  lastError?: string,
) {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE mutation_queue SET status = ?, last_error = ? WHERE id = ?`,
    [status, lastError ?? null, id],
  );
}

export async function countPendingMutations() {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM mutation_queue WHERE status = 'pending'`,
  );
  return row?.c ?? 0;
}

export type QueuedImage = {
  id: string;
  created_at: string;
  local_uri: string;
  product_id: string | null;
  purpose: string;
  status: string;
  remote_url: string | null;
  last_error: string | null;
};

export async function enqueueImage(input: {
  id: string;
  localUri: string;
  productId?: string;
  purpose: 'product' | 'logo' | 'signature';
}) {
  const db = await getOfflineDb();
  await db.runAsync(
    `INSERT INTO image_queue
      (id, created_at, local_uri, product_id, purpose, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [
      input.id,
      new Date().toISOString(),
      input.localUri,
      input.productId ?? null,
      input.purpose,
    ],
  );
}

export async function listPendingImages(): Promise<QueuedImage[]> {
  const db = await getOfflineDb();
  return db.getAllAsync<QueuedImage>(
    `SELECT * FROM image_queue WHERE status = 'pending' ORDER BY created_at ASC`,
  );
}

export async function markImage(
  id: string,
  status: 'done' | 'pending' | 'error',
  remoteUrl?: string,
  lastError?: string,
) {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE image_queue
     SET status = ?, remote_url = COALESCE(?, remote_url), last_error = ?
     WHERE id = ?`,
    [status, remoteUrl ?? null, lastError ?? null, id],
  );
}

export async function countPendingImages() {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM image_queue WHERE status = 'pending'`,
  );
  return row?.c ?? 0;
}

export async function clearOfflineStore() {
  const db = await getOfflineDb();
  await db.execAsync('DELETE FROM entities; DELETE FROM mutation_queue; DELETE FROM image_queue; DELETE FROM meta;');
}
