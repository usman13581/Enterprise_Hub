import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SessionContext } from '../auth/session.types';

export type CompanyProfileInput = {
  legalName?: string;
  tradeName?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  trn?: string | null;
  bankDetails?: string | null;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  quotationPrefix?: string;
  invoicePrefix?: string;
  currency?: string;
};

@Injectable()
export class CompanyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCompany(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { profile: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  async updateProfile(session: SessionContext, input: CompanyProfileInput) {
    const before = await this.prisma.companyProfile.findUnique({
      where: { companyId: session.companyId },
    });
    if (!before) throw new NotFoundException('Company profile not found');

    const profile = await this.prisma.companyProfile.update({
      where: { companyId: session.companyId },
      data: {
        legalName: input.legalName?.trim() || before.legalName,
        tradeName: input.tradeName ?? null,
        address: input.address ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        trn: input.trn ?? null,
        bankDetails: input.bankDetails ?? null,
        logoUrl: input.logoUrl ?? null,
        signatureUrl: input.signatureUrl ?? null,
        quotationPrefix:
          input.quotationPrefix?.trim() || before.quotationPrefix,
        invoicePrefix: input.invoicePrefix?.trim() || before.invoicePrefix,
        currency: input.currency?.trim() || before.currency,
      },
    });

    if (input.tradeName?.trim()) {
      await this.prisma.company.update({
        where: { id: session.companyId },
        data: { name: input.tradeName.trim() },
      });
    }

    await this.audit.write({
      companyId: session.companyId,
      actorId: session.userId,
      entityType: 'CompanyProfile',
      entityId: profile.id,
      action: 'update',
      before,
      after: profile,
    });

    return this.getCompany(session.companyId);
  }
}
