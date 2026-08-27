import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  async createApplication(
    input: {
      legalName: string;
      contactName: string;
      email: string;
      phone: string;
      emirate: string;
      tradeName?: string;
      trn?: string;
      approxUsers?: string;
      planInterest?: string;
      needs?: string;
      heardFrom?: string;
      note?: string;
      honeypot?: string;
    },
    ip: string | null,
  ) {
    if (input.honeypot?.trim()) {
      return { ok: true };
    }
    if (
      !input.legalName?.trim() ||
      !input.contactName?.trim() ||
      !input.email?.trim() ||
      !input.phone?.trim() ||
      !input.emirate?.trim()
    ) {
      throw new BadRequestException(
        'legalName, contactName, email, phone, and emirate are required',
      );
    }

    const application = await this.prisma.companyApplication.create({
      data: {
        status: 'pending',
        legalName: input.legalName.trim(),
        tradeName: input.tradeName?.trim() || null,
        contactName: input.contactName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        emirate: input.emirate.trim(),
        trn: input.trn?.trim() || null,
        approxUsers: input.approxUsers?.trim() || null,
        planInterest: input.planInterest?.trim() || null,
        needs: input.needs?.trim() || null,
        heardFrom: input.heardFrom?.trim() || null,
        note: input.note?.trim() || null,
        honeypot: null,
        ip,
      },
    });

    return { ok: true, id: application.id };
  }
}
