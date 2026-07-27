import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
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

let cachedDdl: string | null = null;

/**
 * Builds the tables in a brand-new SQLite file from the Prisma schema.
 *
 * `prisma migrate diff` only prints SQL, so it is safe to run unattended;
 * `prisma db push --force-reset` is not, because it is capable of dropping a
 * real database and is therefore blocked for automated callers.
 */
async function applySchema(dbPath: string): Promise<void> {
  cachedDdl ??= execFileSync(
    'node',
    [
      require.resolve('prisma/build/index.js'),
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema-datamodel',
      join(__dirname, '..', 'prisma', 'schema.prisma'),
      '--script',
    ],
    { cwd: join(__dirname, '..'), encoding: 'utf8', stdio: 'pipe' },
  );

  const client = new PrismaClient({
    datasources: { db: { url: `file:${dbPath}` } },
  });
  try {
    const statements = cachedDdl
      .split(';')
      .map((chunk) =>
        chunk
          .split('\n')
          .filter((line) => !line.trim().startsWith('--'))
          .join('\n')
          .trim(),
      )
      .filter((statement) => statement.length > 0);

    if (statements.length === 0) {
      throw new Error('Prisma produced no DDL for the test database');
    }
    for (const statement of statements) {
      await client.$executeRawUnsafe(statement);
    }
  } finally {
    await client.$disconnect();
  }
}

/**
 * Boots the real Nest application against a throwaway SQLite file so tests
 * exercise the same guards, pipes, filters, and transactions as production
 * rather than mocked services.
 */
export async function createHarness(): Promise<Harness> {
  const dir = mkdtempSync(join(tmpdir(), 'marble-api-test-'));
  const dbPath = join(dir, 'test.db');

  process.env.DATABASE_URL = `file:${dbPath}`;
  process.env.BOOTSTRAP_TOKEN = TOKEN;
  process.env.BOOTSTRAP_COMPANY_SLUG = COMPANY_SLUG;

  await applySchema(dbPath);

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
      rmSync(dir, { recursive: true, force: true });
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
      name: 'Calacatta Gold',
      unit: 'sqm',
      purchasePrice: 180,
      sellPrice: 250,
      ...overrides,
    })
    .expect(201);
  return res.body as { id: string };
}

/**
 * Approved quotation plus its job, which most invoicing tests need as a
 * starting point. Default totals: 10,000 net, 500 VAT, 10,500 gross.
 */
export async function seedApprovedJob(
  h: Harness,
  options: { customerId?: string; sellPrice?: number; purchasePrice?: number } = {},
) {
  const customerId = options.customerId ?? (await seedCustomer(h)).id;
  const quotationRes = await h
    .post('/quotations')
    .send({
      customerId,
      title: 'Villa flooring',
      lines: [
        {
          description: 'Calacatta Gold slabs',
          unit: 'sqm',
          qty: 40,
          purchasePrice: options.purchasePrice ?? 175,
          sellPrice: options.sellPrice ?? 250,
        },
      ],
    })
    .expect(201);

  const approved = await h
    .post(`/quotations/${quotationRes.body.id}/approve`)
    .expect(201);

  return {
    customerId,
    quotation: approved.body,
    job: approved.body.job as { id: string; number: string; jobValue: number },
  };
}
