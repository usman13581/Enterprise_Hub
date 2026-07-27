import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, seedCustomer, type Harness } from './harness';

/**
 * Regression cover for the input handling that used to be missing: before the
 * shared Zod contracts, negative prices saved happily, a non-numeric price
 * produced HTTP 500 from deep inside Prisma, and any file type could be
 * uploaded and served back from the API origin.
 */
describe('request validation', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });

  afterAll(async () => {
    await h.close();
  });

  describe('auth', () => {
    it('rejects a request with no token', async () => {
      await h.anon().get('/customers').expect(401);
    });

    it('rejects a request with a wrong token', async () => {
      await h
        .anon()
        .get('/customers')
        .set('x-marble-token', 'nope')
        .expect(401);
    });
  });

  describe('names', () => {
    it('rejects a missing name', async () => {
      await h.post('/suppliers').send({}).expect(400);
    });

    it('rejects a whitespace-only name', async () => {
      await h.post('/suppliers').send({ name: '   ' }).expect(400);
    });

    it('trims a valid name', async () => {
      const res = await h
        .post('/suppliers')
        .send({ name: '  Stone Source  ' })
        .expect(201);
      expect(res.body.name).toBe('Stone Source');
    });
  });

  describe('money', () => {
    it('rejects a negative purchase price', async () => {
      const res = await h
        .post('/products')
        .send({ name: 'Negative', purchasePrice: -500, sellPrice: 10 })
        .expect(400);
      expect(JSON.stringify(res.body)).toContain('zero or greater');
    });

    it('rejects a negative sell price', async () => {
      await h
        .post('/products')
        .send({ name: 'Negative sell', sellPrice: -1 })
        .expect(400);
    });

    it('answers 400, not 500, for a non-numeric price', async () => {
      const res = await h
        .post('/products')
        .send({ name: 'Bad price', sellPrice: 'abc' })
        .expect(400);
      expect(res.body.message).toBe('Validation failed');
    });

    it('rejects NaN and Infinity', async () => {
      await h
        .post('/products')
        .send({ name: 'NaN price', sellPrice: 'NaN' })
        .expect(400);
      await h
        .post('/products')
        .send({ name: 'Inf price', sellPrice: 'Infinity' })
        .expect(400);
    });

    it('still accepts a numeric string, which is what the forms send', async () => {
      const res = await h
        .post('/products')
        .send({ name: 'String price', purchasePrice: '12.5', sellPrice: '20' })
        .expect(201);
      expect(res.body.purchasePrice).toBe(12.5);
      expect(res.body.sellPrice).toBe(20);
    });
  });

  describe('emails', () => {
    it('rejects a malformed email', async () => {
      await h
        .post('/customers')
        .send({ name: 'Bad email', email: 'not-an-email' })
        .expect(400);
    });

    it('accepts a blank email as absent', async () => {
      const res = await h
        .post('/customers')
        .send({ name: 'No email', email: '' })
        .expect(201);
      expect(res.body.email).toBeNull();
    });

    it('accepts a valid email', async () => {
      const res = await h
        .post('/customers')
        .send({ name: 'Good email', email: 'ops@example.ae' })
        .expect(201);
      expect(res.body.email).toBe('ops@example.ae');
    });
  });

  describe('company scoping of the payload', () => {
    it('ignores a companyId supplied by the client', async () => {
      const res = await h
        .post('/customers')
        .send({ name: 'Injected', companyId: 'some-other-company' })
        .expect(201);
      expect(res.body.companyId).toBe(h.companyId);
    });
  });

  describe('quotation payloads', () => {
    it('requires at least one line', async () => {
      const customer = await seedCustomer(h, 'Line check');
      await h
        .post('/quotations')
        .send({ customerId: customer.id, lines: [] })
        .expect(400);
    });

    it('rejects a zero quantity', async () => {
      const customer = await seedCustomer(h, 'Qty check');
      await h
        .post('/quotations')
        .send({
          customerId: customer.id,
          lines: [
            { description: 'Slab', qty: 0, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(400);
    });

    it('rejects an unknown customer with 404', async () => {
      await h
        .post('/quotations')
        .send({
          customerId: 'missing-customer',
          lines: [
            { description: 'Slab', qty: 1, purchasePrice: 10, sellPrice: 20 },
          ],
        })
        .expect(404);
    });
  });

  describe('uploads', () => {
    it('rejects an HTML file that would be served from the API origin', async () => {
      await h
        .post('/uploads')
        .attach('file', Buffer.from('<script>alert(1)</script>'), {
          filename: 'evil.html',
          contentType: 'text/html',
        })
        .expect(400);
    });

    it('rejects SVG, which can carry script', async () => {
      await h
        .post('/uploads')
        .attach('file', Buffer.from('<svg onload="alert(1)"/>'), {
          filename: 'evil.svg',
          contentType: 'image/svg+xml',
        })
        .expect(400);
    });

    it('accepts a PNG and names it from the MIME type, not the filename', async () => {
      const png = Buffer.from(
        '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001',
        'hex',
      );
      const res = await h
        .post('/uploads')
        .attach('file', png, {
          filename: 'photo.php',
          contentType: 'image/png',
        })
        .expect(201);
      expect(res.body.url).toMatch(/^\/static\/[0-9a-f-]+\.png$/);
    });

    it('requires the file part to be present', async () => {
      await h.post('/uploads').expect(400);
    });
  });
});
