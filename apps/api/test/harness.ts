import { execFileSync } from 'child_process';
import { join } from 'path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaExceptionFilter } from '../src/common/prisma-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

export const TOKEN = 'test-token';
const COMPANY_SLUG = 'test-co';

export type Harness = {
  app: INestApplication;
  prisma: PrismaService;
  companyId: string;
  get: (path: string) => request.Test;
  post: (path: string) => request.Test;
  put: (path: string) => request.Test;
  del: (path: string) => request.Test;
  /** Requests without the bootstrap token, for auth assertions. */
  anon: () => request.Agent;
  close: () => Promise<void>;
};

const ADMIN_URL =
  process.env.TEST_DATABASE_ADMIN_URL ??
  'postgresql://marble:marble@localhost:5432/postgres';

function randomDbName() {
  return `marble_test_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function createTestDatabase(): Promise<{
  url: string;
  cleanup: () => Promise<void>;
}> {
  const dbName = randomDbName();
  const admin = new PrismaClient({
    datasources: { db: { url: ADMIN_URL } },
  });
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  const url = ADMIN_URL.replace(/\/[^/]+$/, `/${dbName}`);
  return {
    url,
    cleanup: async () => {
      const drop = new PrismaClient({
        datasources: { db: { url: ADMIN_URL } },
      });
      try {
        await drop.$executeRawUnsafe(
          `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`,
        );
      } finally {
        await drop.$disconnect();
      }
    },
  };
}

function applySchema(databaseUrl: string) {
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'push', '--skip-generate'], {
    cwd: join(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}

/**
 * Boots the real Nest application against a throwaway Postgres database so
 * tests exercise the same guards, pipes, filters, and transactions as production.
 */
export async function createHarness(): Promise<Harness> {
  const { url, cleanup } = await createTestDatabase();

  process.env.DATABASE_URL = url;
  process.env.BOOTSTRAP_TOKEN = TOKEN;
  process.env.BOOTSTRAP_COMPANY_SLUG = COMPANY_SLUG;

  applySchema(url);

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new PrismaExceptionFilter());
  await app.init();

  const prisma = app.get(PrismaService);

  const company = await prisma.company.create({
    data: {
      name: 'Test Marble',
      slug: COMPANY_SLUG,
      profile: {
        create: {
          legalName: 'Test Marble LLC',
          tradeName: 'Test Marble',
          trn: '100000000000003',
          quotationPrefix: 'TQ',
          invoicePrefix: 'TINV',
          jobPrefix: 'TJOB',
          advancePrefix: 'TADV',
          creditNotePrefix: 'TCN',
        },
      },
      users: {
        create: { email: 'owner@test.ae', name: 'Owner' },
      },
    },
  });

  const server = app.getHttpServer();
  const authed = (method: 'get' | 'post' | 'put' | 'delete', path: string) =>
    request(server)[method](path).set('x-marble-token', TOKEN);

  return {
    app,
    prisma,
    companyId: company.id,
    get: (path) => authed('get', path),
    post: (path) => authed('post', path),
    put: (path) => authed('put', path),
    del: (path) => authed('delete', path),
    anon: () => request(server),
    close: async () => {
      await app.close();
      await cleanup();
    },
  };
}

export async function seedCustomer(h: Harness, name = 'Acme Interiors') {
  const res = await h.post('/customers').send({ name }).expect(201);
  return res.body as { id: string; name: string };
}

export async function seedProduct(
  h: Harness,
  overrides: Record<string, unknown> = {},
) {
  const res = await h
    .post('/products')
    .send({
      name: 'Calacatta',
      unit: 'sqm',
      purchasePrice: 100,
      sellPrice: 180,
      ...overrides,
    })
    .expect(201);
  return res.body as { id: string; name: string; sellPrice: number };
}

export async function seedApprovedJob(h: Harness) {
  const customer = await seedCustomer(h, 'Job Customer');
  const product = await seedProduct(h);
  const quotation = await h
    .post('/quotations')
    .send({
      customerId: customer.id,
      lines: [
        {
          productId: product.id,
          description: product.name,
          qty: 10,
          unit: 'sqm',
          purchasePrice: 100,
          sellPrice: 180,
        },
      ],
    })
    .expect(201);
  const approved = await h
    .post(`/quotations/${quotation.body.id}/approve`)
    .expect(201);
  return {
    customerId: customer.id,
    job: approved.body.job as {
      id: string;
      number: string;
      jobValue: number;
    },
  };
}

export async function balance(h: Harness, customerId: string) {
  const res = await h.get(`/customers/${customerId}/hub`).expect(200);
  return res.body.summary.balanceDue as number;
}
