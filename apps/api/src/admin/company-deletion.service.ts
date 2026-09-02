import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { basename, resolve, sep } from 'path';
import { unlink } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import {
  PRIVATE_UPLOADS_DIR,
  UPLOADS_DIR,
} from '../uploads/uploads.constants';
import type { PlatformSessionContext } from '../auth/session.types';

@Injectable()
export class CompanyDeletionService {
  private readonly logger = new Logger(CompanyDeletionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private confirmationPhrase(name: string) {
    return `DELETE ${name}`;
  }

  async preview(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        _count: {
          select: {
            users: true,
            customers: true,
            suppliers: true,
            jobs: true,
            invoices: true,
            quotations: true,
            lpos: true,
            purchaseInvoices: true,
            auditLogs: true,
          },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      company: {
        id: company.id,
        name: company.name,
        slug: company.slug,
      },
      confirmationPhrase: this.confirmationPhrase(company.name),
      counts: company._count,
    };
  }

  private async collectStaticUploadUrls(companyId: string) {
    const [
      profile,
      images,
      deposits,
      support,
      employees,
      employeeDocs,
      training,
      expenses,
    ] = await Promise.all([
      this.prisma.companyProfile.findUnique({
        where: { companyId },
        select: { logoUrl: true, signatureUrl: true },
      }),
      this.prisma.productImage.findMany({
        where: { product: { companyId } },
        select: { url: true },
      }),
      this.prisma.subscriptionRenewalRequest.findMany({
        where: { companyId },
        select: { depositDocumentUrl: true },
      }),
      this.prisma.supportRequest.findMany({
        where: { companyId },
        select: { attachmentUrl: true },
      }),
      this.prisma.hREmployee.findMany({
        where: { companyId },
        select: { photoUrl: true },
      }),
      this.prisma.hREmployeeDocument.findMany({
        where: { companyId },
        select: { fileUrl: true },
      }),
      this.prisma.hRTrainingRecord.findMany({
        where: { companyId },
        select: { certificateUrl: true },
      }),
      this.prisma.hRExpenseClaim.findMany({
        where: { companyId },
        select: { receiptUrl: true },
      }),
    ]);

    return [
      profile?.logoUrl,
      profile?.signatureUrl,
      ...images.map((row) => row.url),
      ...deposits.map((row) => row.depositDocumentUrl),
      ...support.map((row) => row.attachmentUrl),
      ...employees.map((row) => row.photoUrl),
      ...employeeDocs.map((row) => row.fileUrl),
      ...training.map((row) => row.certificateUrl),
      ...expenses.map((row) => row.receiptUrl),
    ].filter((url): url is string => Boolean(url));
  }

  private async collectPrivateAttachmentPaths(companyId: string) {
    const invoices = await this.prisma.purchaseInvoice.findMany({
      where: { companyId, attachmentUrl: { not: null } },
      select: { attachmentUrl: true },
    });
    return invoices
      .map((row) => row.attachmentUrl)
      .filter((url): url is string => Boolean(url?.startsWith('private/')));
  }

  private async removeStaticFiles(urls: string[]) {
    const root = resolve(UPLOADS_DIR);
    for (const url of urls) {
      const marker = '/static/';
      const markerIndex = url.indexOf(marker);
      if (markerIndex < 0) continue;
      const file = resolve(
        root,
        decodeURIComponent(url.slice(markerIndex + marker.length)),
      );
      if (file !== root && !file.startsWith(`${root}${sep}`)) {
        this.logger.warn(`Skipped unsafe upload path: ${url}`);
        continue;
      }
      await unlink(file).catch(() => undefined);
    }
  }

  private async removePrivateFiles(paths: string[]) {
    const root = resolve(PRIVATE_UPLOADS_DIR);
    for (const stored of paths) {
      const file = resolve(root, basename(stored));
      if (file !== root && !file.startsWith(`${root}${sep}`)) {
        this.logger.warn(`Skipped unsafe private upload path: ${stored}`);
        continue;
      }
      await unlink(file).catch(() => undefined);
    }
  }

  async deleteCompletely(
    companyId: string,
    confirmation: string,
    admin: PlatformSessionContext,
  ) {
    const preview = await this.preview(companyId);
    if (confirmation !== preview.confirmationPhrase) {
      throw new BadRequestException(
        `Type "${preview.confirmationPhrase}" to confirm deletion.`,
      );
    }

    const staticUrls = await this.collectStaticUploadUrls(companyId);
    const privatePaths = await this.collectPrivateAttachmentPaths(companyId);

    await this.prisma.$transaction(async (tx) => {
      await tx.companyApplication.updateMany({
        where: { companyId },
        data: {
          lifecycleStatus: 'company_deleted',
          cleanedAt: new Date(),
          cleanupError: null,
        },
      });
      await tx.company.delete({ where: { id: companyId } });
    });

    await this.removeStaticFiles(staticUrls);
    await this.removePrivateFiles(privatePaths);

    this.logger.warn(
      `Company ${companyId} (${preview.company.name}) deleted by platform admin ${admin.adminId}`,
    );

    return {
      ok: true,
      companyId,
      name: preview.company.name,
      deletedByAdminId: admin.adminId,
    };
  }
}
