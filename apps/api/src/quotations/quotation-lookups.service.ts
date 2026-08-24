import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  QuotationLookupCategory,
  QuotationLookupInput,
} from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionContext } from '../auth/session.types';

@Injectable()
export class QuotationLookupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(
    companyId: string,
    opts?: {
      category?: QuotationLookupCategory;
      appliesTo?: string;
      activeOnly?: boolean;
    },
  ) {
    return this.prisma.quotationLookup.findMany({
      where: {
        companyId,
        ...(opts?.category ? { category: opts.category } : {}),
        ...(opts?.activeOnly ? { active: true } : {}),
        ...(opts?.appliesTo
          ? {
              OR: [
                { appliesTo: 'both' },
                { appliesTo: opts.appliesTo },
              ],
            }
          : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
  }

  async create(session: SessionContext, input: QuotationLookupInput) {
    const row = await this.prisma.quotationLookup.create({
      data: {
        companyId: session.companyId,
        category: input.category,
        appliesTo: input.appliesTo,
        title: input.title,
        body: input.body,
        active: input.active,
        sortOrder: input.sortOrder,
      },
    });
    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'QuotationLookup',
      entityId: row.id,
      action: 'create',
      after: row,
    });
    return row;
  }

  async update(
    session: SessionContext,
    id: string,
    input: QuotationLookupInput,
  ) {
    const before = await this.prisma.quotationLookup.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Lookup not found');

    const row = await this.prisma.quotationLookup.update({
      where: { id },
      data: {
        category: input.category,
        appliesTo: input.appliesTo,
        title: input.title,
        body: input.body,
        active: input.active,
        sortOrder: input.sortOrder,
      },
    });
    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'QuotationLookup',
      entityId: id,
      action: 'update',
      before,
      after: row,
    });
    return row;
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.quotationLookup.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Lookup not found');
    const row = await this.prisma.quotationLookup.update({
      where: { id },
      data: { active: false },
    });
    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'QuotationLookup',
      entityId: id,
      action: 'deactivate',
      before,
      after: row,
    });
    return { ok: true };
  }

  /**
   * Saves Counter Top spec row labels (and last-used values as hints) so the
   * next quotation can pick them from the lookup list.
   */
  async ensureSpecLabels(
    companyId: string,
    items: Array<{ label: string; value: string }>,
  ) {
    const existing = await this.prisma.quotationLookup.findMany({
      where: { companyId, category: 'spec' },
    });
    const byTitle = new Map(
      existing.map((row) => [row.title.trim().toLowerCase(), row]),
    );

    for (const item of items) {
      const title = item.label.trim();
      if (!title) continue;
      const hint = item.value.trim() || '—';
      const key = title.toLowerCase();
      const row = byTitle.get(key);
      if (row) {
        if (hint !== '—' && row.body !== hint) {
          await this.prisma.quotationLookup.update({
            where: { id: row.id },
            data: { body: hint, active: true },
          });
          row.body = hint;
        }
        continue;
      }
      const created = await this.prisma.quotationLookup.create({
        data: {
          companyId,
          category: 'spec',
          appliesTo: 'counter_top',
          title,
          body: hint,
          active: true,
          sortOrder: existing.length + byTitle.size,
        },
      });
      byTitle.set(key, created);
    }
  }
}
