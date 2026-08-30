import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  resolveSyncWrite,
  type SyncEntity,
} from '@marble/domain';
import type { SyncMutation, SyncPushInput } from '@marble/types';
import { AuditService } from '../audit/audit.service';
import { SessionContext } from '../auth/session.types';
import { NumberingService } from '../common/numbering.service';
import { PrismaService } from '../prisma/prisma.service';

type PushResult = {
  clientMutationId: string;
  entity: string;
  id: string;
  decision: 'applied' | 'reject_server_wins' | 'reject_stale' | 'error';
  message?: string;
  record?: unknown;
};

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly numbering: NumberingService,
  ) {}

  async pull(companyId: string, sinceRaw?: string) {
    const since = parseSince(sinceRaw);
    const serverTime = new Date();

    const [
      company,
      profile,
      suppliers,
      products,
      productImages,
      customers,
      quotations,
      quotationLookups,
      jobs,
      invoices,
      advances,
      ledger,
      audit,
    ] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { dataEpoch: true },
      }),
      this.prisma.companyProfile.findFirst({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
      }),
      this.prisma.supplier.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.product.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.productImage.findMany({
        where: {
          product: { companyId },
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.customer.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.quotation.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          sections: {
            orderBy: { sortOrder: 'asc' },
            include: { items: { orderBy: { sortOrder: 'asc' } } },
          },
          lookupLinks: { include: { lookup: true } },
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.quotationLookup.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.job.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.invoice.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          allocations: true,
        },
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.advancePayment.findMany({
        where: {
          companyId,
          ...(since ? { updatedAt: { gt: since } } : {}),
        },
        orderBy: { updatedAt: 'asc' },
      }),
      // Ledger + audit are pull-only; filter by createdAt (no updatedAt).
      this.prisma.ledgerEntry.findMany({
        where: {
          companyId,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: 2000,
      }),
      this.prisma.auditLog.findMany({
        where: {
          companyId,
          ...(since ? { createdAt: { gt: since } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: 1000,
      }),
    ]);

    return {
      serverTime: serverTime.toISOString(),
      dataEpoch: company?.dataEpoch ?? 0,
      since: since ? since.toISOString() : null,
      entities: {
        profile: profile ? [profile] : [],
        suppliers,
        products,
        productImages,
        customers,
        quotations,
        quotationLookups,
        jobs,
        invoices,
        advances,
        ledger,
        audit,
      },
    };
  }

  async push(session: SessionContext, body: SyncPushInput) {
    const results: PushResult[] = [];
    for (const mutation of body.mutations) {
      try {
        results.push(await this.applyMutation(session, mutation));
      } catch (error) {
        results.push({
          clientMutationId: mutation.clientMutationId,
          entity: mutation.entity,
          id: mutation.id,
          decision: 'error',
          message:
            error instanceof Error ? error.message : 'Failed to apply mutation',
        });
      }
    }
    return { results };
  }

  private async applyMutation(
    session: SessionContext,
    mutation: SyncMutation,
  ): Promise<PushResult> {
    const entity = mutation.entity as SyncEntity;
    const base = {
      clientMutationId: mutation.clientMutationId,
      entity: mutation.entity,
      id: mutation.id,
    };

    if (mutation.op === 'delete') {
      return this.applyDelete(session, mutation, base);
    }

    const data = mutation.data ?? {};
    switch (mutation.entity) {
      case 'profile':
        return this.upsertProfile(session, mutation, data, base);
      case 'supplier':
        return this.upsertSupplier(session, mutation, data, base);
      case 'product':
        return this.upsertProduct(session, mutation, data, base);
      case 'productImage':
        return this.upsertProductImage(session, mutation, data, base);
      case 'customer':
        return this.upsertCustomer(session, mutation, data, base);
      case 'quotation':
        return this.upsertQuotation(session, mutation, data, base);
      case 'job':
        return this.upsertJob(session, mutation, data, base);
      case 'invoice':
        return this.upsertInvoice(session, mutation, data, base);
      case 'advance':
        return this.upsertAdvance(session, mutation, data, base);
      default:
        throw new BadRequestException(`Unsupported sync entity: ${entity}`);
    }
  }

  private async applyDelete(
    session: SessionContext,
    mutation: SyncMutation,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const companyId = session.companyId;
    switch (mutation.entity) {
      case 'supplier': {
        const existing = await this.prisma.supplier.findFirst({
          where: { id: mutation.id, companyId },
        });
        if (!existing) return { ...base, decision: 'applied' };
        const after = await this.prisma.supplier.update({
          where: { id: existing.id },
          data: { active: false },
        });
        await this.audit.write({
          companyId,
          actorId: session.userId,
          entityType: 'supplier',
          entityId: existing.id,
          action: 'sync_deactivate',
          before: existing,
          after,
        });
        return { ...base, decision: 'applied' };
      }
      case 'customer': {
        const existing = await this.prisma.customer.findFirst({
          where: { id: mutation.id, companyId },
        });
        if (!existing) return { ...base, decision: 'applied' };
        const after = await this.prisma.customer.update({
          where: { id: existing.id },
          data: { active: false },
        });
        await this.audit.write({
          companyId,
          actorId: session.userId,
          entityType: 'customer',
          entityId: existing.id,
          action: 'sync_deactivate',
          before: existing,
          after,
        });
        return { ...base, decision: 'applied' };
      }
      case 'product': {
        const existing = await this.prisma.product.findFirst({
          where: { id: mutation.id, companyId },
        });
        if (!existing) return { ...base, decision: 'applied' };
        const after = await this.prisma.product.update({
          where: { id: existing.id },
          data: { active: false },
        });
        await this.audit.write({
          companyId,
          actorId: session.userId,
          entityType: 'product',
          entityId: existing.id,
          action: 'sync_deactivate',
          before: existing,
          after,
        });
        return { ...base, decision: 'applied' };
      }
      case 'productImage': {
        const existing = await this.prisma.productImage.findFirst({
          where: { id: mutation.id },
          include: { product: { select: { companyId: true } } },
        });
        if (!existing || existing.product.companyId !== companyId) {
          return { ...base, decision: 'applied' };
        }
        const wasDefault = existing.isDefault;
        const productId = existing.productId;
        await this.prisma.productImage.delete({ where: { id: existing.id } });
        if (wasDefault) {
          const next = await this.prisma.productImage.findFirst({
            where: { productId },
            orderBy: { createdAt: 'asc' },
          });
          if (next) {
            await this.prisma.productImage.update({
              where: { id: next.id },
              data: { isDefault: true },
            });
          }
        }
        await this.audit.write({
          companyId,
          actorId: session.userId,
          entityType: 'productImage',
          entityId: existing.id,
          action: 'sync_delete',
          before: existing,
        });
        return { ...base, decision: 'applied' };
      }
      case 'quotation': {
        const existing = await this.prisma.quotation.findFirst({
          where: { id: mutation.id, companyId },
        });
        if (!existing) return { ...base, decision: 'applied' };
        if (existing.status !== 'draft') {
          return {
            ...base,
            decision: 'reject_server_wins',
            message: 'Only draft quotations can be cancelled offline',
            record: existing,
          };
        }
        await this.prisma.quotation.update({
          where: { id: existing.id },
          data: { status: 'cancelled', cancelledAt: new Date() },
        });
        return { ...base, decision: 'applied' };
      }
      default:
        return {
          ...base,
          decision: 'error',
          message: `Delete is not supported for ${mutation.entity}`,
        };
    }
  }

  private async upsertProfile(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const existing = await this.prisma.companyProfile.findUnique({
      where: { companyId: session.companyId },
    });
    const decision = resolveSyncWrite({
      entity: 'profile',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    const fields = {
      legalName: String(data.legalName ?? existing?.legalName ?? 'Company'),
      tradeName: optionalString(data.tradeName),
      address: optionalString(data.address),
      phone: optionalString(data.phone),
      email: optionalString(data.email),
      trn: optionalString(data.trn),
      bankDetails: optionalString(data.bankDetails),
      logoUrl: optionalString(data.logoUrl),
      signatureUrl: optionalString(data.signatureUrl),
      quotationPrefix: String(
        data.quotationPrefix ?? existing?.quotationPrefix ?? 'QT',
      ),
      invoicePrefix: String(
        data.invoicePrefix ?? existing?.invoicePrefix ?? 'INV',
      ),
      jobPrefix: String(data.jobPrefix ?? existing?.jobPrefix ?? 'JOB'),
      advancePrefix: String(
        data.advancePrefix ?? existing?.advancePrefix ?? 'ADV',
      ),
      creditNotePrefix: String(
        data.creditNotePrefix ?? existing?.creditNotePrefix ?? 'CN',
      ),
      currency: String(data.currency ?? existing?.currency ?? 'AED'),
      vatRate: Number(data.vatRate ?? existing?.vatRate ?? 0.05),
      version: mutation.version,
    };

    const record = existing
      ? await this.prisma.companyProfile.update({
          where: { companyId: session.companyId },
          data: fields,
        })
      : await this.prisma.companyProfile.create({
          data: {
            id: mutation.id,
            companyId: session.companyId,
            ...fields,
          },
        });

    return { ...base, decision: 'applied', record };
  }

  private async upsertSupplier(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const existing = await this.prisma.supplier.findFirst({
      where: { id: mutation.id, companyId: session.companyId },
    });
    const decision = resolveSyncWrite({
      entity: 'supplier',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    const fields = {
      name: requiredString(data.name, 'Supplier name'),
      contact: optionalString(data.contact),
      phone: optionalString(data.phone),
      email: optionalString(data.email),
      address: optionalString(data.address),
      trn: optionalString(data.trn),
      notes: optionalString(data.notes),
      active: data.active === undefined ? true : Boolean(data.active),
      version: mutation.version,
    };

    const record = existing
      ? await this.prisma.supplier.update({
          where: { id: existing.id },
          data: fields,
        })
      : await this.prisma.supplier.create({
          data: {
            id: mutation.id,
            companyId: session.companyId,
            ...fields,
          },
        });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'supplier',
      entityId: record.id,
      action: existing ? 'sync_update' : 'sync_create',
      before: existing,
      after: record,
    });

    return { ...base, decision: 'applied', record };
  }

  private async upsertProduct(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const existing = await this.prisma.product.findFirst({
      where: { id: mutation.id, companyId: session.companyId },
    });
    const decision = resolveSyncWrite({
      entity: 'product',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    const fields = {
      supplierId: optionalString(data.supplierId),
      name: requiredString(data.name, 'Product name'),
      sku: optionalString(data.sku),
      unit: String(data.unit ?? 'sqm'),
      purchasePrice: Number(data.purchasePrice ?? 0),
      sellPrice: Number(data.sellPrice ?? 0),
      description: optionalString(data.description),
      active: data.active === undefined ? true : Boolean(data.active),
      version: mutation.version,
    };

    const record = existing
      ? await this.prisma.product.update({
          where: { id: existing.id },
          data: fields,
        })
      : await this.prisma.product.create({
          data: {
            id: mutation.id,
            companyId: session.companyId,
            ...fields,
          },
        });

    return { ...base, decision: 'applied', record };
  }

  private async upsertProductImage(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const productId = requiredString(data.productId, 'productId');
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId: session.companyId },
    });
    if (!product) throw new NotFoundException('Product not found for image');

    const existing = await this.prisma.productImage.findFirst({
      where: { id: mutation.id, productId },
    });
    const decision = resolveSyncWrite({
      entity: 'productImage',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    const url = requiredString(data.url, 'image url');
    // Reject file:// or content:// — those must go through the upload queue first.
    if (!url.startsWith('/') && !url.startsWith('http')) {
      throw new BadRequestException(
        'Image URL must be an uploaded /static path or http URL',
      );
    }

    const isDefault = Boolean(data.isDefault);
    const record = await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.productImage.updateMany({
          where: { productId },
          data: { isDefault: false },
        });
      }
      if (existing) {
        return tx.productImage.update({
          where: { id: existing.id },
          data: { url, isDefault, version: mutation.version },
        });
      }
      return tx.productImage.create({
        data: {
          id: mutation.id,
          productId,
          url,
          isDefault,
          version: mutation.version,
        },
      });
    });

    return { ...base, decision: 'applied', record };
  }

  private async upsertCustomer(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const existing = await this.prisma.customer.findFirst({
      where: { id: mutation.id, companyId: session.companyId },
    });
    const decision = resolveSyncWrite({
      entity: 'customer',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    const fields = {
      name: requiredString(data.name, 'Customer name'),
      contact: optionalString(data.contact),
      phone: optionalString(data.phone),
      email: optionalString(data.email),
      address: optionalString(data.address),
      trn: optionalString(data.trn),
      notes: optionalString(data.notes),
      active: data.active === undefined ? true : Boolean(data.active),
      version: mutation.version,
    };

    const record = existing
      ? await this.prisma.customer.update({
          where: { id: existing.id },
          data: fields,
        })
      : await this.prisma.customer.create({
          data: {
            id: mutation.id,
            companyId: session.companyId,
            ...fields,
          },
        });

    return { ...base, decision: 'applied', record };
  }

  private async upsertQuotation(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const existing = await this.prisma.quotation.findFirst({
      where: { id: mutation.id, companyId: session.companyId },
      include: { lines: true },
    });
    const decision = resolveSyncWrite({
      entity: 'quotation',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
            status: existing.status,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    // Offline create/update only for drafts. Approvals go through REST so the
    // server can mint the job and ledger entries in one transaction.
    const status = String(data.status ?? existing?.status ?? 'draft');
    if (status !== 'draft') {
      return {
        ...base,
        decision: 'reject_server_wins',
        message: 'Use the quotations API to approve or cancel',
        record: existing,
      };
    }

    const customerId = requiredString(data.customerId, 'customerId');
    await this.assertCustomer(session.companyId, customerId);

    const lines = Array.isArray(data.lines) ? data.lines : [];
    if (lines.length === 0) {
      throw new BadRequestException('Quotation requires at least one line');
    }

    const totals = summariseQuoteLines(lines);

    const record = await this.prisma.$transaction(async (tx) => {
      const number =
        existing?.number ??
        (typeof data.number === 'string' && data.number.length > 0
          ? data.number
          : await this.numbering.next(tx, session.companyId, 'quotation'));

      if (existing) {
        await tx.quotationLine.deleteMany({
          where: { quotationId: existing.id },
        });
        return tx.quotation.update({
          where: { id: existing.id },
          data: {
            customerId,
            title: optionalString(data.title),
            notes: optionalString(data.notes),
            status: 'draft',
            ...totals,
            version: mutation.version,
            lines: {
              create: lines.map((line, index) =>
                mapQuoteLine(line as Record<string, unknown>, index),
              ),
            },
          },
          include: { lines: { orderBy: { sortOrder: 'asc' } } },
        });
      }

      return tx.quotation.create({
        data: {
          id: mutation.id,
          companyId: session.companyId,
          customerId,
          number,
          title: optionalString(data.title),
          notes: optionalString(data.notes),
          status: 'draft',
          ...totals,
          version: mutation.version,
          lines: {
            create: lines.map((line, index) =>
              mapQuoteLine(line as Record<string, unknown>, index),
            ),
          },
        },
        include: { lines: { orderBy: { sortOrder: 'asc' } } },
      });
    });

    return { ...base, decision: 'applied', record };
  }

  private async upsertJob(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const existing = await this.prisma.job.findFirst({
      where: { id: mutation.id, companyId: session.companyId },
    });
    const decision = resolveSyncWrite({
      entity: 'job',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
            status: existing.status,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    // Jobs are created by quotation approve on the server. Offline may only
    // nudge status while the job is still open.
    if (!existing) {
      return {
        ...base,
        decision: 'error',
        message: 'Jobs must be created by approving a quotation online',
      };
    }

    const nextStatus = String(data.status ?? existing.status);
    if (!['open', 'completed', 'closed'].includes(nextStatus)) {
      throw new BadRequestException('Invalid job status');
    }

    const record = await this.prisma.job.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        title: optionalString(data.title) ?? existing.title,
        completedAt:
          nextStatus === 'completed'
            ? (existing.completedAt ?? new Date())
            : existing.completedAt,
        closedAt:
          nextStatus === 'closed'
            ? (existing.closedAt ?? new Date())
            : existing.closedAt,
        version: mutation.version,
      },
    });

    return { ...base, decision: 'applied', record };
  }

  private async upsertInvoice(
    _session: SessionContext,
    _mutation: SyncMutation,
    _data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    // Invoices mint numbers, VAT, allocations, and ledger rows — always online.
    return {
      ...base,
      decision: 'error',
      message:
        'Invoices cannot be created offline; queue clears when connectivity returns via the invoices API',
    };
  }

  private async upsertAdvance(
    session: SessionContext,
    mutation: SyncMutation,
    data: Record<string, unknown>,
    base: Omit<PushResult, 'decision'>,
  ): Promise<PushResult> {
    const existing = await this.prisma.advancePayment.findFirst({
      where: { id: mutation.id, companyId: session.companyId },
    });
    const decision = resolveSyncWrite({
      entity: 'advance',
      clientUpdatedAt: mutation.updatedAt,
      clientVersion: mutation.version,
      server: existing
        ? {
            updatedAt: existing.updatedAt,
            version: existing.version,
          }
        : null,
    });
    if (decision !== 'apply') {
      return { ...base, decision, record: existing };
    }

    // Allocated advances are effectively frozen for amount edits.
    if (existing && existing.allocatedAmount > 0) {
      return {
        ...base,
        decision: 'reject_server_wins',
        message: 'Advances with allocations cannot be overwritten offline',
        record: existing,
      };
    }

    // Creating advances still needs ledger credit — defer to REST for creates.
    if (!existing) {
      return {
        ...base,
        decision: 'error',
        message:
          'New advances must sync via the advances API so the ledger stays consistent',
      };
    }

    const amount = Number(data.amount ?? existing.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('Advance amount must be greater than zero');
    }

    const record = await this.prisma.advancePayment.update({
      where: { id: existing.id },
      data: {
        amount,
        method: String(data.method ?? existing.method),
        reference: optionalString(data.reference),
        notes: optionalString(data.notes),
        version: mutation.version,
      },
    });

    return { ...base, decision: 'applied', record };
  }

  private async assertCustomer(companyId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, companyId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
  }
}

function parseSince(sinceRaw?: string): Date | null {
  if (!sinceRaw || sinceRaw.trim().length === 0) return null;
  const parsed = new Date(sinceRaw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('since must be a valid ISO timestamp');
  }
  return parsed;
}

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text.length === 0 ? null : text;
}

function requiredString(value: unknown, label: string): string {
  const text = optionalString(value);
  if (!text) throw new BadRequestException(`${label} is required`);
  return text;
}

function mapQuoteLine(line: Record<string, unknown>, index: number) {
  const qty = Number(line.qty);
  const purchasePrice = Number(line.purchasePrice);
  const sellPrice = Number(line.sellPrice);
  if (!(qty > 0) || !(sellPrice >= 0) || !(purchasePrice >= 0)) {
    throw new BadRequestException('Invalid quotation line amounts');
  }
  return {
    id: typeof line.id === 'string' ? line.id : undefined,
    productId: optionalString(line.productId),
    description: requiredString(line.description, 'line description'),
    unit: String(line.unit ?? 'sqm'),
    qty,
    purchasePrice,
    sellPrice,
    lineTotal: Number((qty * sellPrice).toFixed(2)),
    sortOrder: Number(line.sortOrder ?? index),
  };
}

function summariseQuoteLines(lines: unknown[]) {
  let subtotal = 0;
  let purchaseTotal = 0;
  for (const raw of lines) {
    const line = raw as Record<string, unknown>;
    const qty = Number(line.qty);
    const sellPrice = Number(line.sellPrice);
    const purchasePrice = Number(line.purchasePrice);
    subtotal += qty * sellPrice;
    purchaseTotal += qty * purchasePrice;
  }
  subtotal = Number(subtotal.toFixed(2));
  purchaseTotal = Number(purchaseTotal.toFixed(2));
  const vatAmount = Number((subtotal * 0.05).toFixed(2));
  return {
    subtotal,
    vatAmount,
    total: Number((subtotal + vatAmount).toFixed(2)),
    purchaseTotal,
  };
}
