import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createHarness,
  seedApprovedJob,
  seedCustomer,
  type Harness,
} from './harness';

/** Sums the ledger the way a statement does: debits owed minus credits paid. */
async function balance(h: Harness, customerId: string) {
  const res = await h.get(`/accounts/customers/${customerId}/ledger`);
  const rows = res.body as Array<{ runningBalance: number }>;
  return rows.length ? rows[rows.length - 1].runningBalance : 0;
}

describe('invoicing and money movement', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  describe('advances', () => {
    it('records an advance and credits the customer ledger', async () => {
      const { customerId, job } = await seedApprovedJob(h);

      const advance = await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 4000, method: 'bank_transfer' })
        .expect(201);

      expect(advance.body.number).toBe('TADV-0001');
      expect(advance.body.unallocatedAmount).toBe(4000);
      expect(await balance(h, customerId)).toBe(-4000);
    });

    it('rejects a zero or negative advance', async () => {
      const customer = await seedCustomer(h, 'Bad advance');
      await h
        .post('/advances')
        .send({ customerId: customer.id, amount: 0 })
        .expect(400);
      await h
        .post('/advances')
        .send({ customerId: customer.id, amount: -100 })
        .expect(400);
    });

    it('refuses an advance against another customer\u2019s job', async () => {
      const { job } = await seedApprovedJob(h);
      const stranger = await seedCustomer(h, 'Stranger');
      await h
        .post('/advances')
        .send({ customerId: stranger.id, jobId: job.id, amount: 100 })
        .expect(409);
    });

    it('refuses an advance on a closed job', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      await h.post(`/jobs/${job.id}/close`).expect(201);
      await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 100 })
        .expect(409);
    });

    it('cancels an unallocated advance and reverses its ledger credit', async () => {
      const customer = await seedCustomer(h, 'Cancellable advance');
      const advance = await h
        .post('/advances')
        .send({ customerId: customer.id, amount: 750 })
        .expect(201);

      expect(await balance(h, customer.id)).toBe(-750);
      await h.del(`/advances/${advance.body.id}`).expect(200);
      expect(await balance(h, customer.id)).toBe(0);
      const row = await h.prisma.advancePayment.findUnique({
        where: { id: advance.body.id },
      });
      expect(row?.cancelledAt).toBeTruthy();
    });
  });

  describe('progressive invoicing', () => {
    it('bills a percentage of job value and grosses back exactly', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      expect(job.jobValue).toBe(10500);

      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 30 })
        .expect(201);

      expect(invoice.body.kind).toBe('progressive');
      expect(invoice.body.subtotal).toBe(3000);
      expect(invoice.body.vatAmount).toBe(150);
      expect(invoice.body.total).toBe(3150);
      expect(invoice.body.netPayable).toBe(3150);
      expect(await balance(h, customerId)).toBe(3150);
    });

    it('bills an explicit gross amount', async () => {
      const { job } = await seedApprovedJob(h);
      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ amount: 2100 })
        .expect(201);

      expect(invoice.body.subtotal).toBe(2000);
      expect(invoice.body.total).toBe(2100);
    });

    it('requires either a percentage or an amount', async () => {
      const { job } = await seedApprovedJob(h);
      await h.post(`/invoices/jobs/${job.id}/progressive`).send({}).expect(400);
    });

    it('rejects a percentage above 100', async () => {
      const { job } = await seedApprovedJob(h);
      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 120 })
        .expect(400);
    });

    it('refuses to invoice a closed job', async () => {
      const { job } = await seedApprovedJob(h);
      await h.post(`/jobs/${job.id}/close`).expect(201);
      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 10 })
        .expect(409);
    });

    it('still allows a final invoice after the job is completed', async () => {
      const { job } = await seedApprovedJob(h);
      await h.post(`/jobs/${job.id}/complete`).expect(201);
      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 50 })
        .expect(201);
    });
  });

  describe('advance allocation', () => {
    it('reduces net payable without changing the overall balance', async () => {
      const { customerId, job } = await seedApprovedJob(h);

      await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 3000 })
        .expect(201);
      const available = await h
        .get(`/invoices/available-advances?customerId=${customerId}&jobId=${job.id}`)
        .expect(200);
      expect(available.body).toHaveLength(1);

      const balanceBefore = await balance(h, customerId);
      expect(balanceBefore).toBe(-3000);

      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 50,
          allocations: [{ advanceId: available.body[0].id, amount: 3000 }],
        })
        .expect(201);

      expect(invoice.body.total).toBe(5250);
      expect(invoice.body.advanceApplied).toBe(3000);
      expect(invoice.body.netPayable).toBe(2250);

      // The advance was already credited when received, so allocating it must
      // not credit the customer a second time.
      expect(await balance(h, customerId)).toBe(2250);
    });

    it('marks the advance as consumed', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      const advance = await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 1000 })
        .expect(201);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 20,
          allocations: [{ advanceId: advance.body.id, amount: 600 }],
        })
        .expect(201);

      const after = await h.get(`/advances/${advance.body.id}`).expect(200);
      expect(after.body.allocatedAmount).toBe(600);
      expect(after.body.unallocatedAmount).toBe(400);
    });

    it('refuses to allocate more than the advance holds', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      const advance = await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 500 })
        .expect(201);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 50,
          allocations: [{ advanceId: advance.body.id, amount: 900 }],
        })
        .expect(400);
    });

    it('refuses to spend the same advance twice across invoices', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      const advance = await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 1000 })
        .expect(201);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 20,
          allocations: [{ advanceId: advance.body.id, amount: 1000 }],
        })
        .expect(201);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 20,
          allocations: [{ advanceId: advance.body.id, amount: 1000 }],
        })
        .expect(400);
    });

    it('refuses to allocate another customer\u2019s advance', async () => {
      const { job } = await seedApprovedJob(h);
      const stranger = await seedCustomer(h, 'Other payer');
      const foreignAdvance = await h
        .post('/advances')
        .send({ customerId: stranger.id, amount: 500 })
        .expect(201);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 20,
          allocations: [{ advanceId: foreignAdvance.body.id, amount: 500 }],
        })
        .expect(400);
    });

    it('refuses to allocate more than the invoice total', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      const advance = await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 9000 })
        .expect(201);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 10,
          allocations: [{ advanceId: advance.body.id, amount: 9000 }],
        })
        .expect(400);
    });

    it('blocks editing an advance once it is applied', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      const advance = await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 1000 })
        .expect(201);
      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 20,
          allocations: [{ advanceId: advance.body.id, amount: 500 }],
        })
        .expect(201);

      await h
        .put(`/advances/${advance.body.id}`)
        .send({ customerId, jobId: job.id, amount: 50 })
        .expect(409);
      await h.del(`/advances/${advance.body.id}`).expect(409);
    });
  });

  describe('final invoicing', () => {
    it('bills exactly the un-invoiced remainder', async () => {
      const { customerId, job } = await seedApprovedJob(h);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 40 })
        .expect(201);
      await h.post(`/jobs/${job.id}/complete`).expect(201);

      const final = await h
        .post(`/invoices/jobs/${job.id}/final`)
        .send({})
        .expect(201);

      expect(final.body.kind).toBe('final');
      expect(final.body.total).toBe(6300);

      const hub = await h.get(`/jobs/${job.id}/hub`).expect(200);
      expect(hub.body.financials.invoicedToDate).toBe(10500);
      expect(hub.body.financials.balanceRemaining).toBe(0);
      expect(await balance(h, customerId)).toBe(10500);
    });

    it('refuses a final invoice when nothing remains', async () => {
      const { job } = await seedApprovedJob(h);
      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 100 })
        .expect(201);
      await h.post(`/invoices/jobs/${job.id}/final`).send({}).expect(409);
    });
  });

  describe('custom invoices with explicit lines', () => {
    it('creates an invoice from the customer entry point', async () => {
      const { customerId, job } = await seedApprovedJob(h);

      const invoice = await h
        .post('/invoices')
        .send({
          kind: 'custom',
          customerId,
          jobId: job.id,
          lines: [
            {
              description: 'Extra polishing',
              unit: 'sqm',
              qty: 12.5,
              unitPrice: 40,
              purchasePrice: 22,
            },
          ],
        })
        .expect(201);

      expect(invoice.body.subtotal).toBe(500);
      expect(invoice.body.vatAmount).toBe(25);
      expect(invoice.body.total).toBe(525);
      expect(invoice.body.purchaseTotal).toBe(275);
      expect(invoice.body.lines[0].lineTotal).toBe(500);
    });

    it('refuses to bill a job belonging to another customer', async () => {
      const { job } = await seedApprovedJob(h);
      const stranger = await seedCustomer(h, 'Wrong owner');

      await h
        .post('/invoices')
        .send({
          kind: 'custom',
          customerId: stranger.id,
          jobId: job.id,
          lines: [{ description: 'X', qty: 1, unitPrice: 100 }],
        })
        .expect(409);
    });

    it('rejects a credit_note kind on the ordinary invoice route', async () => {
      const customer = await seedCustomer(h, 'Kind check');
      await h
        .post('/invoices')
        .send({
          kind: 'credit_note',
          customerId: customer.id,
          lines: [{ description: 'X', qty: 1, unitPrice: 100 }],
        })
        .expect(400);
    });

    it('allows a standalone invoice with no job', async () => {
      const customer = await seedCustomer(h, 'No job');
      const invoice = await h
        .post('/invoices')
        .send({
          kind: 'custom',
          customerId: customer.id,
          lines: [{ description: 'Consultancy', qty: 1, unitPrice: 1000 }],
        })
        .expect(201);
      expect(invoice.body.jobId).toBeNull();
      expect(invoice.body.total).toBe(1050);
    });
  });

  describe('credit notes', () => {
    it('credits the customer and reduces billed value', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 100 })
        .expect(201);

      expect(await balance(h, customerId)).toBe(10500);

      const creditNote = await h
        .post('/invoices/credit-notes')
        .send({
          invoiceId: invoice.body.id,
          reason: 'Two slabs returned',
          lines: [{ description: 'Returned slabs', qty: 2, unitPrice: 250 }],
        })
        .expect(201);

      expect(creditNote.body.kind).toBe('credit_note');
      expect(creditNote.body.number).toBe('TCN-0001');
      expect(creditNote.body.total).toBe(525);
      expect(await balance(h, customerId)).toBe(9975);
    });

    it('refuses a credit note larger than the invoice', async () => {
      const { job } = await seedApprovedJob(h);
      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 10 })
        .expect(201);

      await h
        .post('/invoices/credit-notes')
        .send({
          invoiceId: invoice.body.id,
          reason: 'Too much',
          lines: [{ description: 'Everything', qty: 1, unitPrice: 99999 }],
        })
        .expect(400);
    });

    it('refuses to credit a credit note', async () => {
      const { job } = await seedApprovedJob(h);
      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 50 })
        .expect(201);
      const creditNote = await h
        .post('/invoices/credit-notes')
        .send({
          invoiceId: invoice.body.id,
          reason: 'Adjust',
          lines: [{ description: 'Adjust', qty: 1, unitPrice: 100 }],
        })
        .expect(201);

      await h
        .post('/invoices/credit-notes')
        .send({
          invoiceId: creditNote.body.id,
          reason: 'Nope',
          lines: [{ description: 'Nope', qty: 1, unitPrice: 10 }],
        })
        .expect(409);
    });
  });

  describe('cancelling an invoice', () => {
    it('reverses the ledger and releases the advances it claimed', async () => {
      const { customerId, job } = await seedApprovedJob(h);
      const advance = await h
        .post('/advances')
        .send({ customerId, jobId: job.id, amount: 2000 })
        .expect(201);

      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 50,
          allocations: [{ advanceId: advance.body.id, amount: 2000 }],
        })
        .expect(201);

      expect(await balance(h, customerId)).toBe(3250);

      const cancelled = await h
        .post(`/invoices/${invoice.body.id}/cancel`)
        .expect(201);
      expect(cancelled.body.status).toBe('cancelled');

      // Back to just the advance sitting as a credit.
      expect(await balance(h, customerId)).toBe(-2000);

      const releasedAdvance = await h
        .get(`/advances/${advance.body.id}`)
        .expect(200);
      expect(releasedAdvance.body.allocatedAmount).toBe(0);
      expect(releasedAdvance.body.unallocatedAmount).toBe(2000);
    });

    it('excludes a cancelled invoice from job billing progress', async () => {
      const { job } = await seedApprovedJob(h);
      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 60 })
        .expect(201);
      await h.post(`/invoices/${invoice.body.id}/cancel`).expect(201);

      const hub = await h.get(`/jobs/${job.id}/hub`).expect(200);
      expect(hub.body.financials.invoicedToDate).toBe(0);
      expect(hub.body.financials.balanceRemaining).toBe(job.jobValue);
    });

    it('cannot cancel twice', async () => {
      const { job } = await seedApprovedJob(h);
      const invoice = await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 10 })
        .expect(201);
      await h.post(`/invoices/${invoice.body.id}/cancel`).expect(201);
      await h.post(`/invoices/${invoice.body.id}/cancel`).expect(409);
    });
  });

  describe('a full job settled end to end', () => {
    it('leaves a zero balance and the expected margin', async () => {
      const customer = await seedCustomer(h, 'Full cycle');
      const { job } = await seedApprovedJob(h, { customerId: customer.id });

      // 10,500 gross job. Advance 5,000, bill 40%, then settle the rest.
      const advance = await h
        .post('/advances')
        .send({ customerId: customer.id, jobId: job.id, amount: 5000 })
        .expect(201);

      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({
          percentage: 40,
          allocations: [{ advanceId: advance.body.id, amount: 4200 }],
        })
        .expect(201);

      await h.post(`/jobs/${job.id}/complete`).expect(201);
      await h.post(`/invoices/jobs/${job.id}/final`).send({}).expect(201);

      const hub = await h.get(`/jobs/${job.id}/hub`).expect(200);
      expect(hub.body.financials.invoicedToDate).toBe(10500);
      expect(hub.body.financials.balanceRemaining).toBe(0);
      // 40 sqm at 250 sell, 175 cost: 10,000 net revenue, 7,000 cost.
      expect(hub.body.financials.profit).toBe(3000);

      const customerHub = await h.get(`/customers/${customer.id}/hub`).expect(200);
      expect(customerHub.body.summary.billed).toBe(10500);
      expect(customerHub.body.summary.advancesReceived).toBe(5000);
      expect(customerHub.body.summary.balanceDue).toBe(5500);
      expect(customerHub.body.summary.unallocatedAdvances).toBe(800);

      // Settle the remaining 5,500 as a further receipt, then the account clears.
      await h
        .post('/advances')
        .send({ customerId: customer.id, jobId: job.id, amount: 5500 })
        .expect(201);
      expect(await balance(h, customer.id)).toBe(0);

      await h.post(`/jobs/${job.id}/close`).expect(201);
      await h
        .post(`/invoices/jobs/${job.id}/progressive`)
        .send({ percentage: 10 })
        .expect(409);
    });
  });

  describe('company accounts overview', () => {
    it('reports receivables, advances, and per-job margin', async () => {
      const res = await h.get('/accounts/overview').expect(200);

      expect(res.body.summary.billed).toBeGreaterThan(0);
      expect(Array.isArray(res.body.receivableByCustomer)).toBe(true);
      expect(Array.isArray(res.body.profitByJob)).toBe(true);
      expect(res.body.profitByJob[0]).toHaveProperty('profit');
      expect(res.body).toHaveProperty('totalProfit');
      expect(res.body).toHaveProperty('openJobs');
    });

    it('keeps the company balance equal to the sum of customer balances', async () => {
      const overview = await h.get('/accounts/overview').expect(200);
      const summed = overview.body.receivableByCustomer.reduce(
        (total: number, row: { balance: number }) => total + row.balance,
        0,
      );
      expect(Math.round(summed * 100) / 100).toBe(
        overview.body.summary.balanceDue,
      );
    });
  });
});
