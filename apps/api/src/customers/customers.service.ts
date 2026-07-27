import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionContext } from '../auth/session.types';

export type CustomerInput = {
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
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(companyId: string) {
    return this.prisma.customer.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async get(companyId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, companyId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async create(session: SessionContext, input: CustomerInput) {
    const customer = await this.prisma.customer.create({
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
      entityType: 'Customer',
      entityId: customer.id,
      action: 'create',
      after: customer,
    });

    return customer;
  }

  async update(session: SessionContext, id: string, input: CustomerInput) {
    const before = await this.prisma.customer.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Customer not found');

    const customer = await this.prisma.customer.update({
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
      entityType: 'Customer',
      entityId: id,
      action: 'update',
      before,
      after: customer,
    });

    return customer;
  }

  async remove(session: SessionContext, id: string) {
    const before = await this.prisma.customer.findFirst({
      where: { id, companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Customer not found');

    await this.prisma.customer.delete({ where: { id } });

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'Customer',
      entityId: id,
      action: 'delete',
      before,
    });

    return { ok: true };
  }
}
