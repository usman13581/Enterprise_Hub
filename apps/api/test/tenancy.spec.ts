import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, seedApprovedJob, type Harness } from './harness';

/**
 * Company isolation has to hold on the new money endpoints too, not just the
 * Phase 1 catalog. Every check here uses a real second company row so the guard
 * cannot be satisfied by an accident of test data.
 */
describe('company isolation', () => {
  let h: Harness;
  let foreign: {
    companyId: string;
    customerId: string;
    quotationId: string;
    jobId: string;
    invoiceId: string;
    advanceId: string;
  };

  beforeAll(async () => {
    h = await createHarness();

    const company = await h.prisma.company.create({
      data: { name: 'Rival Marble', slug: 'rival-marble' },
    });
    const customer = await h.prisma.customer.create({
      data: { companyId: company.id, name: 'Rival Customer' },
    });
    const quotation = await h.prisma.quotation.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        number: 'RV-QT-0001',
        status: 'approved',
        subtotal: 1000,
        vatAmount: 50,
        total: 1050,
        purchaseTotal: 600,
      },
    });
    const job = await h.prisma.job.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        quotationId: quotation.id,
        number: 'RV-JOB-0001',
        status: 'open',
        jobValue: 1050,
        jobNet: 1000,
        purchaseTotal: 600,
      },
    });
    const invoice = await h.prisma.invoice.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        jobId: job.id,
        number: 'RV-INV-0001',
        kind: 'progressive',
        subtotal: 500,
        vatAmount: 25,
        total: 525,
        netPayable: 525,
      },
    });
    const advance = await h.prisma.advancePayment.create({
      data: {
        companyId: company.id,
        customerId: customer.id,
        jobId: job.id,
        number: 'RV-ADV-0001',
        amount: 300,
      },
    });

    foreign = {
      companyId: company.id,
      customerId: customer.id,
      quotationId: quotation.id,
      jobId: job.id,
      invoiceId: invoice.id,
      advanceId: advance.id,
    };
  });

  afterAll(async () => {
    await h.close();
  });

  describe('reads', () => {
    it('hides another company\u2019s quotation, job, invoice, and advance', async () => {
      await h.get(`/quotations/${foreign.quotationId}`).expect(404);
      await h.get(`/jobs/${foreign.jobId}`).expect(404);
      await h.get(`/invoices/${foreign.invoiceId}`).expect(404);
      await h.get(`/advances/${foreign.advanceId}`).expect(404);
    });

    it('hides another company\u2019s hubs', async () => {
      await h.get(`/jobs/${foreign.jobId}/hub`).expect(404);
      await h.get(`/customers/${foreign.customerId}/hub`).expect(404);
    });

    it('omits foreign rows from every list', async () => {
      for (const path of ['/quotations', '/jobs', '/invoices', '/advances']) {
        const res = await h.get(path).expect(200);
        for (const row of res.body) {
          expect(row.companyId).toBe(h.companyId);
        }
      }
    });

    it('returns an empty ledger for a foreign customer rather than theirs', async () => {
      const res = await h
        .get(`/accounts/customers/${foreign.customerId}/ledger`)
        .expect(200);
      expect(res.body).toEqual([]);
    });

    it('excludes foreign activity from the accounts overview', async () => {
      const res = await h.get('/accounts/overview').expect(200);
      const names = res.body.receivableByCustomer.map(
        (row: { customerName: string }) => row.customerName,
      );
      expect(names).not.toContain('Rival Customer');
    });
  });

  describe('writes', () => {
    it('refuses to approve or cancel a foreign quotation', async () => {
      await h.post(`/quotations/${foreign.quotationId}/approve`).expect(404);
      await h.post(`/quotations/${foreign.quotationId}/cancel`).expect(404);
    });

    it('refuses to transition a foreign job', async () => {
      await h.post(`/jobs/${foreign.jobId}/complete`).expect(404);
      await h.post(`/jobs/${foreign.jobId}/close`).expect(404);
    });

    it('refuses to invoice a foreign job', async () => {
      await h
        .post(`/invoices/jobs/${foreign.jobId}/progressive`)
        .send({ percentage: 50 })
        .expect(404);
      await h.post(`/invoices/jobs/${foreign.jobId}/final`).send({}).expect(404);
    });

    it('refuses to cancel or credit a foreign invoice', async () => {
      await h.post(`/invoices/${foreign.invoiceId}/cancel`).expect(404);
      await h
        .post('/invoices/credit-notes')
        .send({
          invoiceId: foreign.invoiceId,
          reason: 'Not mine',
          lines: [{ description: 'X', qty: 1, unitPrice: 10 }],
        })
        .expect(404);
    });

    it('refuses to record an advance for a foreign customer', async () => {
      await h
        .post('/advances')
        .send({ customerId: foreign.customerId, amount: 100 })
        .expect(404);
    });

    it('refuses to edit or delete a foreign advance', async () => {
      await h
        .put(`/advances/${foreign.advanceId}`)
        .send({ customerId: foreign.customerId, amount: 1 })
        .expect(404);
      await h.del(`/advances/${foreign.advanceId}`).expect(404);
    });

    it('refuses to allocate a foreign advance to a local invoice', async () => {
      const { job } = await seedApprovedJob(h);
      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 20,
          allocations: [{ advanceId: foreign.advanceId, amount: 100 }],
        })
        .expect(400);
    });

    it('refuses to quote for a foreign customer', async () => {
      await h
        .post('/quotations')
        .send({
          customerId: foreign.customerId,
          lines: [{ description: 'X', qty: 1, purchasePrice: 1, sellPrice: 2 }],
        })
        .expect(404);
    });

    it('leaves the foreign company\u2019s data untouched', async () => {
      const quotation = await h.prisma.quotation.findUnique({
        where: { id: foreign.quotationId },
      });
      const job = await h.prisma.job.findUnique({ where: { id: foreign.jobId } });
      const advance = await h.prisma.advancePayment.findUnique({
        where: { id: foreign.advanceId },
      });

      expect(quotation?.status).toBe('approved');
      expect(job?.status).toBe('open');
      expect(advance?.allocatedAmount).toBe(0);
    });
  });

  describe('document rendering', () => {
    it('will not render a PDF for another company', async () => {
      await h.get(`/documents/quotations/${foreign.quotationId}.pdf`).expect(404);
      await h.get(`/documents/invoices/${foreign.invoiceId}.pdf`).expect(404);
      await h.get(`/documents/advances/${foreign.advanceId}.pdf`).expect(404);
    });
  });
});
