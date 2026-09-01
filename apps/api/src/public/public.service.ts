import { Injectable } from '@nestjs/common';
import {
  COUNTRIES,
  currencyForCountry,
  DEFAULT_COUNTRY_CODE,
  normalizeCountryCode,
  type CompanyApplicationInput,
} from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  listCountries() {
    return {
      countries: COUNTRIES.map((country) => ({
        code: country.code,
        name: country.name,
        currency: country.currency,
      })),
    };
  }

  async createApplication(
    input: CompanyApplicationInput,
    ip: string | null,
  ) {
    if (input.honeypot?.trim()) {
      return { ok: true };
    }
    const country =
      normalizeCountryCode(input.country) ?? DEFAULT_COUNTRY_CODE;
    const currency = currencyForCountry(country);

    const application = await this.prisma.companyApplication.create({
      data: {
        status: 'pending',
        legalName: input.legalName.trim(),
        tradeName: input.tradeName?.trim() || null,
        contactName: input.contactName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        country,
        emirate: input.emirate?.trim() || '',
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

    return { ok: true, id: application.id, country, currency };
  }
}
