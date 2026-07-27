import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionContext } from '../auth/session.types';

export type SupplierInput = {
  name: string;
  contact?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  trn?: string | null;
  notes?: string | null;
  active?: boolean;
};

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.supplier.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async get(companyId: string, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, companyId },
      include: {
        products: {
          orderBy: { name: 'asc' },
          include: { images: true },
        },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async create(session: SessionContext, input: SupplierInput) {
    const supplier = await this.prisma.supplier.create({
      data: {
        companyId: session.companyId,
        name: input.name,
        contact: input.contact ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        trn: input.trn ?? null,
        notes: input.notes ?? null,
        active: input.active ?? true,
      },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Supplier',
      entityId: supplier.id,
      action: 'create',
      after: supplier,
    });

    return supplier;
  }

  async update(session: SessionContext, id: string, input: SupplierInput) {
    const before = await this.prisma.supplier.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Supplier not found');

    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        name: input.name,
        contact: input.contact ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        address: input.address ?? null,
        trn: input.trn ?? null,
        notes: input.notes ?? null,
        active: input.active ?? before.active,
      },
    });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Supplier',
      entityId: id,
      action: 'update',
      before,
      after: supplier,
    });

    return supplier;
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.supplier.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Supplier not found');

    await this.prisma.supplier.delete({ where: { id } });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Supplier',
      entityId: id,
      action: 'delete',
      before,
    });

    return { ok: true };
  }
}
