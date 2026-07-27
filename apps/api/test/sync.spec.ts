import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createHarness, type Harness } from './harness';

describe('offline sync', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  }, 60_000);

  afterAll(async () => {
    await h.close();
  });

  it('pulls a full snapshot then an empty incremental', async () => {
    await h
      .post('/customers')
      .send({ name: 'Sync Customer' })
      .expect(201);

    const full = await h.get('/sync/pull').expect(200);
    expect(full.body.serverTime).toBeTruthy();
    expect(full.body.entities.customers.length).toBeGreaterThanOrEqual(1);
    expect(full.body.entities.profile.length).toBe(1);

    const incremental = await h
      .get(`/sync/pull?since=${encodeURIComponent(full.body.serverTime)}`)
      .expect(200);
    expect(incremental.body.entities.customers).toEqual([]);
  });

  it('applies offline customer upserts and rejects stale versions', async () => {
    const id = 'client-customer-001';
    const created = await h
      .post('/sync/push')
      .send({
        mutations: [
          {
            clientMutationId: 'm1',
            entity: 'customer',
            op: 'upsert',
            id,
            updatedAt: new Date().toISOString(),
            version: 1,
            data: { name: 'Offline Villa', phone: '+971501111111' },
          },
        ],
      })
      .expect(201);

    expect(created.body.results[0].decision).toBe('applied');

    const stale = await h
      .post('/sync/push')
      .send({
        mutations: [
          {
            clientMutationId: 'm2',
            entity: 'customer',
            op: 'upsert',
            id,
            updatedAt: '2020-01-01T00:00:00.000Z',
            version: 1,
            data: { name: 'Should not win' },
          },
        ],
      })
      .expect(201);

    expect(stale.body.results[0].decision).toBe('reject_stale');

    const got = await h.get(`/customers/${id}`).expect(200);
    expect(got.body.name).toBe('Offline Villa');
  });

  it('rejects overwrites of approved quotations (server wins)', async () => {
    const customer = await h
      .post('/customers')
      .send({ name: 'Approved Sync Cust' })
      .expect(201);

    const quote = await h
      .post('/quotations')
      .send({
        customerId: customer.body.id,
        lines: [
          {
            description: 'Calacatta',
            qty: 5,
            purchasePrice: 200,
            sellPrice: 400,
          },
        ],
      })
      .expect(201);

    await h.post(`/quotations/${quote.body.id}/approve`).expect(201);

    const rejected = await h
      .post('/sync/push')
      .send({
        mutations: [
          {
            clientMutationId: 'm3',
            entity: 'quotation',
            op: 'upsert',
            id: quote.body.id,
            updatedAt: new Date().toISOString(),
            version: 99,
            data: {
              customerId: customer.body.id,
              status: 'draft',
              lines: [
                {
                  description: 'Hacked',
                  qty: 1,
                  purchasePrice: 1,
                  sellPrice: 1,
                },
              ],
            },
          },
        ],
      })
      .expect(201);

    expect(rejected.body.results[0].decision).toBe('reject_server_wins');
  });

  it('requires auth on sync endpoints', async () => {
    await h.anon().get('/sync/pull').expect(401);
    await h.anon().post('/sync/push').send({ mutations: [] }).expect(401);
  });
});
