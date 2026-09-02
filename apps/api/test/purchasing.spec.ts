import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, type Harness } from './harness';

async function seedSupplier(h: Harness, name = 'Stone Supplier') {
  const res = await h.post('/suppliers').send({ name }).expect(201);
  return res.body as { id: string };
}

describe('purchasing LPO and purchase invoices', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('returns draft purchase invoices on GET /lpos/:id', async () => {
    const supplier = await seedSupplier(h);
    const lpo = await h
      .post('/lpos')
      .send({
        supplierId: supplier.id,
        lines: [{ productName: 'Marble slab', orderedQty: 5, unitCost: 100 }],
      })
      .expect(201);
    await h.post(`/lpos/${lpo.body.id}/approve`).expect(201);

    const pi = await h
      .post('/purchase-invoices')
      .send({
        supplierId: supplier.id,
        lpoId: lpo.body.id,
        issueDate: '2026-09-01',
        lines: [{ productName: 'Marble slab', qty: 2, unitCost: 100 }],
      })
      .expect(201);

    const detail = await h.get(`/lpos/${lpo.body.id}`).expect(200);
    expect(detail.body.purchaseInvoices).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: pi.body.id,
          status: 'draft',
        }),
      ]),
    );
  });

  it('preserves lpoId when PATCH omits it', async () => {
    const supplier = await seedSupplier(h, 'Supplier B');
    const lpo = await h
      .post('/lpos')
      .send({
        supplierId: supplier.id,
        lines: [{ productName: 'Granite tile', orderedQty: 4, unitCost: 50 }],
      })
      .expect(201);
    await h.post(`/lpos/${lpo.body.id}/approve`).expect(201);

    const pi = await h
      .post('/purchase-invoices')
      .send({
        supplierId: supplier.id,
        lpoId: lpo.body.id,
        issueDate: '2026-09-01',
        lines: [{ productName: 'Granite tile', qty: 1, unitCost: 50 }],
      })
      .expect(201);

    const updated = await h
      .patch(`/purchase-invoices/${pi.body.id}`)
      .send({
        issueDate: '2026-09-02',
        lines: [{ productName: 'Granite tile', qty: 2, unitCost: 50 }],
      })
      .expect(200);

    expect(updated.body.lpoId).toBe(lpo.body.id);
  });

  it('filters invoice-eligible LPOs', async () => {
    const supplier = await seedSupplier(h, 'Supplier C');
    const draft = await h
      .post('/lpos')
      .send({
        supplierId: supplier.id,
        lines: [{ productName: 'Draft line', orderedQty: 1, unitCost: 10 }],
      })
      .expect(201);
    const approved = await h
      .post('/lpos')
      .send({
        supplierId: supplier.id,
        lines: [{ productName: 'Approved line', orderedQty: 1, unitCost: 10 }],
      })
      .expect(201);
    await h.post(`/lpos/${approved.body.id}/approve`).expect(201);

    const list = await h
      .get(`/lpos?invoiceEligible=1&supplierId=${supplier.id}`)
      .expect(200);

    const ids = (list.body as Array<{ id: string }>).map((item) => item.id);
    expect(ids).toContain(approved.body.id);
    expect(ids).not.toContain(draft.body.id);
  });
});
