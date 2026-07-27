import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  list(companyId: string, take = 50) {
    return this.prisma.auditLog.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 200),
    });
  }

  write(input: {
    companyId: string;
    actorId?: string;
    entityType: string;
    entityId: string;
    action: string;
    before?: unknown;
    after?: unknown;
  }) {
    return this.prisma.auditLog.create({
      data: {
        companyId: input.companyId,
        actorId: input.actorId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        beforeJson: input.before ? JSON.stringify(input.before) : null,
        afterJson: input.after ? JSON.stringify(input.after) : null,
      },
    });
  }
}
