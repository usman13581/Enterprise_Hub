import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createHarness,
  seedCustomer,
  seedProduct,
  type Harness,
} from './harness';

describe('quotation to job lifecycle', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('creates a quotation with computed totals and a company-prefixed number', async () => {
    const customer = await seedCustomer(h, 'Marina Villas');
    const product = await seedProduct(h);

    const res = await h
      .post('/quotations')
      .send({
        customerId: customer.id,
        title: 'Lobby cladding',
        lines: [
          {
            productId: product.id,
            description: 'Calacatta Gold slabs',
            unit: 'sqm',
            qty: 10,
            purchasePrice: 180,
            sellPrice: 250,
          },
          {
            description: 'Installation',
            unit: 'job',
            qty: 1,
            purchasePrice: 400,
            sellPrice: 900,
          },
        ],
      })
      .expect(201);

    expect(res.body.number).toBe('TQ-0001');
    expect(res.body.status).toBe('draft');
    expect(res.body.subtotal).toBe(3400);
    expect(res.body.vatAmount).toBe(170);
    expect(res.body.total).toBe(3570);
    expect(res.body.purchaseTotal).toBe(2200);
    expect(res.body.profit).toBe(1200);
    expect(res.body.lines).toHaveLength(2);
    expect(res.body.lines[0].lineTotal).toBe(2500);
  });

  it('numbers quotations sequentially', async () => {
    const customer = await seedCustomer(h, 'Sequence Co');
    const first = await h
      .post('/quotations')
      .send({
        customerId: customer.id,
        lines: [
          { description: 'A', qty: 1, purchasePrice: 1, sellPrice: 2 },
        ],
      })
      .expect(201);
    const second = await h
      .post('/quotations')
      .send({
        customerId: customer.id,
        lines: [
          { description: 'B', qty: 1, purchasePrice: 1, sellPrice: 2 },
        ],
      })
      .expect(201);

    expect(Number(second.body.number.split('-')[1])).toBe(
      Number(first.body.number.split('-')[1]) + 1,
    );
  });

  it('rejects a line pointing at a product from another company', async () => {
    const customer = await seedCustomer(h, 'Foreign product');
    const other = await h.prisma.company.create({
      data: { name: 'Other', slug: `other-${Date.now()}` },
    });
    const foreignProduct = await h.prisma.product.create({
      data: { companyId: other.id, name: 'Foreign slab' },
    });

    await h
      .post('/quotations')
      .send({
        customerId: customer.id,
        lines: [
          {
            productId: foreignProduct.id,
            description: 'Foreign',
            qty: 1,
            purchasePrice: 1,
            sellPrice: 2,
          },
        ],
      })
      .expect(400);
  });

  describe('editing', () => {
    it('replaces lines and recomputes totals on a draft', async () => {
      const customer = await seedCustomer(h, 'Editable');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Original', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);

      const updated = await h
        .put(`/quotations/${created.body.id}`)
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Revised', qty: 2, purchasePrice: 30, sellPrice: 100 },
            { description: 'Extra', qty: 1, purchasePrice: 5, sellPrice: 50 },
          ],
        })
        .expect(200);

      expect(updated.body.lines).toHaveLength(2);
      expect(updated.body.subtotal).toBe(250);
      expect(updated.body.total).toBe(262.5);
      expect(updated.body.profit).toBe(185);
    });
  });

  describe('approval', () => {
    it('creates a job carrying the quotation prices', async () => {
      const customer = await seedCustomer(h, 'Approver');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          title: 'Kitchen worktops',
          lines: [
            { description: 'Worktop', qty: 4, purchasePrice: 500, sellPrice: 800 },
          ],
        })
        .expect(201);

      const approved = await h
        .post(`/quotations/${created.body.id}/approve`)
        .expect(201);

      expect(approved.body.status).toBe('approved');
      expect(approved.body.approvedAt).toBeTruthy();
      expect(approved.body.job.number).toBe('TJOB-0001');
      expect(approved.body.job.status).toBe('open');
      // 3,200 net, 160 VAT, 3,360 gross; cost 2,000.
      expect(approved.body.job.jobValue).toBe(3360);
      expect(approved.body.job.jobNet).toBe(3200);
      expect(approved.body.job.purchaseTotal).toBe(2000);
      expect(approved.body.job.title).toBe('Kitchen worktops');
    });

    it('locks the quotation against further edits once approved', async () => {
      const customer = await seedCustomer(h, 'Locked');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);
      await h.post(`/quotations/${created.body.id}/approve`).expect(201);

      await h
        .put(`/quotations/${created.body.id}`)
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Sneaky', qty: 1, purchasePrice: 1, sellPrice: 999 },
          ],
        })
        .expect(409);
    });

    it('refuses to approve twice, so a second job cannot appear', async () => {
      const customer = await seedCustomer(h, 'Double approve');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);

      await h.post(`/quotations/${created.body.id}/approve`).expect(201);
      await h.post(`/quotations/${created.body.id}/approve`).expect(409);

      const jobs = await h.prisma.job.count({
        where: { quotationId: created.body.id },
      });
      expect(jobs).toBe(1);
    });

    it('refuses to delete a quotation that already has a job', async () => {
      const customer = await seedCustomer(h, 'Undeletable');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);
      await h.post(`/quotations/${created.body.id}/approve`).expect(201);
      await h.del(`/quotations/${created.body.id}`).expect(409);
    });
  });

  describe('cancellation', () => {
    it('cancels a draft without creating a job', async () => {
      const customer = await seedCustomer(h, 'Canceller');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);

      const cancelled = await h
        .post(`/quotations/${created.body.id}/cancel`)
        .expect(201);

      expect(cancelled.body.status).toBe('cancelled');
      expect(
        await h.prisma.job.count({ where: { quotationId: created.body.id } }),
      ).toBe(0);
    });

    it('cannot cancel an approved quotation', async () => {
      const customer = await seedCustomer(h, 'No cancel');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);
      await h.post(`/quotations/${created.body.id}/approve`).expect(201);
      await h.post(`/quotations/${created.body.id}/cancel`).expect(409);
    });

    it('cannot approve a cancelled quotation', async () => {
      const customer = await seedCustomer(h, 'Cancelled then approve');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);
      await h.post(`/quotations/${created.body.id}/cancel`).expect(201);
      await h.post(`/quotations/${created.body.id}/approve`).expect(409);
    });
  });

  describe('job status transitions', () => {
    it('completes then closes a job', async () => {
      const customer = await seedCustomer(h, 'Transitions');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);
      const approved = await h
        .post(`/quotations/${created.body.id}/approve`)
        .expect(201);
      const jobId = approved.body.job.id;

      const completed = await h.post(`/jobs/${jobId}/complete`).expect(201);
      expect(completed.body.status).toBe('completed');
      expect(completed.body.completedAt).toBeTruthy();

      const closed = await h.post(`/jobs/${jobId}/close`).expect(201);
      expect(closed.body.status).toBe('closed');

      await h.post(`/jobs/${jobId}/close`).expect(409);
      await h.post(`/jobs/${jobId}/complete`).expect(409);
    });

    it('closes an open job directly', async () => {
      const customer = await seedCustomer(h, 'Direct close');
      const created = await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(201);
      const approved = await h
        .post(`/quotations/${created.body.id}/approve`)
        .expect(201);

      const closed = await h
        .post(`/jobs/${approved.body.job.id}/close`)
        .expect(201);
      expect(closed.body.status).toBe('closed');
    });
  });

  describe('listing and filtering', () => {
    it('filters quotations by status', async () => {
      const res = await h.get('/quotations?status=approved').expect(200);
      expect(res.body.length).toBeGreaterThan(0);
      for (const quotation of res.body) {
        expect(quotation.status).toBe('approved');
      }
    });

    it('filters jobs by status', async () => {
      const res = await h.get('/jobs?status=closed').expect(200);
      for (const job of res.body) {
        expect(job.status).toBe('closed');
      }
    });

    it('returns 404 for an unknown quotation', async () => {
      await h.get('/quotations/does-not-exist').expect(404);
    });
  });

  describe('audit trail', () => {
    it('records create, approve, and cancel actions', async () => {
      const res = await h.get('/audit').expect(200);
      const actions = res.body
        .filter((row: { entityType: string }) => row.entityType === 'Quotation')
        .map((row: { action: string }) => row.action);

      expect(actions).toContain('create');
      expect(actions).toContain('approve');
      expect(actions).toContain('cancel');
    });
  });
});
