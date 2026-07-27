import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, seedApprovedJob, type Harness } from './harness';

const PDF_MAGIC = '%PDF-';

describe('printable documents', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  it('renders a quotation PDF', async () => {
    const { quotation } = await seedApprovedJob(h);
    const res = await h
      .get(`/documents/quotations/${quotation.id}.pdf`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('quotation-TQ-0001.pdf');
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe(PDF_MAGIC);
    expect((res.body as Buffer).length).toBeGreaterThan(1000);
  });

  it('renders a tax invoice PDF with an advance adjustment', async () => {
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

    const res = await h
      .get(`/documents/invoices/${invoice.body.id}.pdf`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect((res.body as Buffer).subarray(0, 5).toString()).toBe(PDF_MAGIC);
    expect(res.headers['content-disposition']).toContain('invoice-');
  });

  it('renders an advance receipt PDF', async () => {
    const { customerId, job } = await seedApprovedJob(h);
    const advance = await h
      .post('/advances')
      .send({ customerId, jobId: job.id, amount: 1500, method: 'cheque' })
      .expect(201);

    const res = await h
      .get(`/documents/advances/${advance.body.id}.pdf`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect((res.body as Buffer).subarray(0, 5).toString()).toBe(PDF_MAGIC);
  });

  it('names a credit note document distinctly', async () => {
    const { job } = await seedApprovedJob(h);
    const invoice = await h
      .post(`/invoices/jobs/${job.id}/progressive`)
      .send({ percentage: 100 })
      .expect(201);
    const creditNote = await h
      .post('/invoices/credit-notes')
      .send({
        invoiceId: invoice.body.id,
        reason: 'Returned material',
        lines: [{ description: 'Returned slabs', qty: 1, unitPrice: 250 }],
      })
      .expect(201);

    const res = await h
      .get(`/documents/invoices/${creditNote.body.id}.pdf`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      })
      .expect(200);

    expect(res.headers['content-disposition']).toContain('credit-note-');
  });

  it('returns 404 for a document that does not exist', async () => {
    await h.get('/documents/invoices/nope.pdf').expect(404);
  });
});
