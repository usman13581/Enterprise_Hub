import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { resolve, sep } from 'path';
import { unlink } from 'fs/promises';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import {
  currencyForCountry,
  DEFAULT_COUNTRY_CODE,
  normalizeCountryCode,
  type DemoRequestInput,
} from '@marble/types';
import { PrismaService } from '../prisma/prisma.service';
import { UPLOADS_DIR } from '../uploads/uploads.constants';
import { MailService } from '../mail/mail.service';

const DEMO_PLAN_CODE = 'demo-trial-7d';
const DEMO_DAYS = 7;
const PASSWORD_ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';

class DemoAlreadyRequestedError extends Error {}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'demo-company';
}

function randomPassword() {
  const bytes = randomBytes(20);
  return Array.from(bytes, (byte) => PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length]).join('');
}

function credentialKey() {
  const configured = process.env.DEMO_CREDENTIALS_KEY;
  if (configured && /^[a-f0-9]{64}$/i.test(configured)) {
    return Buffer.from(configured, 'hex');
  }
  return createHash('sha256')
    .update(process.env.JWT_SECRET || 'marble-local-demo-credentials')
    .digest();
}

function encryptCredential(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', credentialKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

function decryptCredential(value: string) {
  const [ivText, tagText, ciphertextText] = value.split('.');
  if (!ivText || !tagText || !ciphertextText) throw new Error('Invalid credential handoff');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    credentialKey(),
    Buffer.from(ivText, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

@Injectable()
export class DemoProvisioningService {
  private readonly logger = new Logger(DemoProvisioningService.name);
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  private async companyUploadUrls(companyId: string) {
    const [profile, images, deposits, support] = await Promise.all([
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
    ]);
    return [
      profile?.logoUrl,
      profile?.signatureUrl,
      ...images.map((row) => row.url),
      ...deposits.map((row) => row.depositDocumentUrl),
      ...support.map((row) => row.attachmentUrl),
    ].filter((url): url is string => Boolean(url));
  }

  private async removeCompanyFiles(urls: string[]) {
    const root = resolve(UPLOADS_DIR);
    for (const url of urls) {
      const marker = '/static/';
      const markerIndex = url.indexOf(marker);
      if (markerIndex < 0) continue;
      const file = resolve(root, decodeURIComponent(url.slice(markerIndex + marker.length)));
      if (file !== root && !file.startsWith(`${root}${sep}`)) {
        this.logger.warn(`Skipped unsafe demo upload path: ${url}`);
        continue;
      }
      await unlink(file).catch(() => undefined);
    }
  }

  private checkRate(ip: string | null, email: string) {
    const now = Date.now();
    const keys = [`email:${email}`, ...(ip ? [`ip:${ip}`] : [])];
    for (const key of keys) {
      const recent = (this.attempts.get(key) ?? []).filter((time) => now - time < 60 * 60 * 1000);
      if (recent.length >= 5) {
        throw new ConflictException('Please try again later.');
      }
      recent.push(now);
      this.attempts.set(key, recent);
    }
  }

  async requestDemo(input: DemoRequestInput, ip: string | null) {
    const email = input.email.trim().toLowerCase();
    if (input.honeypot) return { ok: true, message: 'Your trial request is being prepared.' };
    this.checkRate(ip, email);

    const temporaryPassword = randomPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);
    const startsAt = new Date();
    const trialEndsAt = new Date(startsAt.getTime() + DEMO_DAYS * 24 * 60 * 60 * 1000);
    const handoff = encryptCredential(temporaryPassword);

    let provisioned: { applicationId: string; companyName: string };
    try {
      provisioned = await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
        const existingUser = await tx.user.findFirst({ where: { email } });
        const existingDemo = await tx.companyApplication.findFirst({
          where: { kind: 'demo', demoEmailKey: email },
        });
        if (existingUser || existingDemo) {
          throw new DemoAlreadyRequestedError();
        }

        const plan = await tx.plan.upsert({
          where: { code: DEMO_PLAN_CODE },
          update: { name: 'Enterprise Hub Demo', trialDays: DEMO_DAYS, active: true, maxUsers: 3 },
          create: {
            name: 'Enterprise Hub Demo',
            code: DEMO_PLAN_CODE,
            interval: 'monthly',
            priceUsd: 0,
            trialDays: DEMO_DAYS,
            maxUsers: 3,
            active: true,
          },
        });

        const baseSlug = slugify(input.companyName);
        let slug = baseSlug;
        if (await tx.company.findUnique({ where: { slug } })) {
          slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;
        }

        const country =
          normalizeCountryCode(input.country) ?? DEFAULT_COUNTRY_CODE;
        const currency = currencyForCountry(country);

        const company = await tx.company.create({
          data: {
            name: input.companyName,
            slug,
            profile: {
              create: {
                legalName: input.companyName,
                tradeName: input.companyName,
                phone: input.phone,
                email,
                address: input.emirate,
                country,
                currency,
              },
            },
            subscription: {
              create: {
                planId: plan.id,
                status: 'trial',
                billingChannel: 'manual',
                startsAt,
                trialEndsAt,
                expiresAt: trialEndsAt,
                seatsIncluded: plan.maxUsers,
                isDemo: true,
                demoCleanupStatus: null,
              },
            },
            users: {
              create: {
                email,
                name: input.contactName || input.companyName,
                passwordHash,
                companyRole: 'admin',
                active: true,
                mustChangePassword: true,
              },
            },
          },
          include: { subscription: true, users: true },
        });

        const application = await tx.companyApplication.create({
          data: {
            status: 'approved',
            lifecycleStatus: 'provisioned',
            kind: 'demo',
            source: 'website',
            companyId: company.id,
            legalName: input.companyName,
            tradeName: input.companyName,
            contactName: input.contactName || input.companyName,
            email,
            phone: input.phone || '',
            country,
            emirate: input.emirate || '',
            approxUsers: input.approxUsers,
            note: input.note,
            provisionedAt: startsAt,
            credentialStatus: 'pending',
            credentialHandoff: handoff,
            credentialExpiresAt: trialEndsAt,
            demoEmailKey: email,
          },
        });
        return { applicationId: application.id, companyName: company.name };
      });
    } catch (error) {
      if (error instanceof DemoAlreadyRequestedError) {
        return {
          ok: true,
          message: 'Your seven-day Enterprise Hub trial is being prepared. Login details will be delivered separately.',
        };
      }
      if (error instanceof ConflictException) throw error;
      this.logger.error('Demo provisioning failed', error);
      throw new BadRequestException('The demo request could not be completed. Please try again.');
    }

    const delivery = await this.mail.sendDemoCredentials({
      to: email,
      companyName: provisioned.companyName,
      temporaryPassword,
      trialEndsAt,
    });
    if (delivery.sent) {
      await this.prisma.companyApplication.update({
        where: { id: provisioned.applicationId },
        data: {
          credentialStatus: 'emailed',
          credentialHandoff: null,
        },
      });
    } else {
      this.logger.warn(`Demo ${provisioned.applicationId} remains pending credential delivery`);
    }

    return {
      ok: true,
      message: 'Your seven-day Enterprise Hub trial is being prepared. Login details will be delivered separately.',
    };
  }

  async revealCredentials(applicationId: string) {
    const application = await this.prisma.companyApplication.findUnique({
      where: { id: applicationId },
      include: { company: { select: { slug: true } } },
    });
    if (!application || application.kind !== 'demo') {
      throw new NotFoundException('Demo request not found');
    }
    if (!application.credentialHandoff || application.credentialRevealedAt) {
      throw new ConflictException('Credentials have already been delivered or are unavailable.');
    }
    if (application.credentialExpiresAt && application.credentialExpiresAt <= new Date()) {
      throw new ConflictException('Credential handoff has expired.');
    }
    const password = decryptCredential(application.credentialHandoff);
    const claimed = await this.prisma.companyApplication.updateMany({
      where: {
        id: application.id,
        credentialHandoff: { not: null },
        credentialRevealedAt: null,
      },
      data: {
        credentialRevealedAt: new Date(),
        credentialStatus: 'delivered',
        credentialHandoff: null,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Credentials have already been delivered or are unavailable.');
    }
    return {
      email: application.email,
      password,
      companySlug: application.company?.slug ?? null,
      loginUrl: process.env.WEB_APP_URL || process.env.PUBLIC_WEB_URL || null,
    };
  }

  async cancelTrial(companyId: string) {
    const subscription = await this.prisma.companySubscription.findUnique({
      where: { companyId },
      include: {
        company: {
          select: {
            name: true,
            applications: {
              where: { kind: 'demo' },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { id: true },
            },
          },
        },
      },
    });
    if (!subscription?.isDemo || subscription.status !== 'trial') {
      throw new BadRequestException('Only an active demo trial can be cancelled.');
    }
    const application = subscription.company.applications[0];
    if (!application) {
      throw new BadRequestException('Demo registration could not be found.');
    }

    const uploadUrls = await this.companyUploadUrls(companyId);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.companySubscription.update({
          where: { id: subscription.id },
          data: { status: 'cancelled', demoCleanupStatus: 'cancelled' },
        });
        await tx.company.delete({ where: { id: companyId } });
        await tx.companyApplication.update({
          where: { id: application.id },
          data: {
            companyId: null,
            status: 'rejected',
            lifecycleStatus: 'demo_cancelled',
            cleanedAt: new Date(),
            cleanupError: null,
            credentialStatus: 'cancelled',
            credentialHandoff: null,
          },
        });
      });
      await this.removeCompanyFiles(uploadUrls);
      return {
        ok: true,
        message: 'Your demo trial was cancelled and its company data was removed.',
      };
    } catch (error) {
      this.logger.error('Demo cancellation failed', error);
      throw new BadRequestException('The demo trial could not be cancelled. Please contact support.');
    }
  }

  async cleanupExpired(options: { dryRun?: boolean } = {}) {
    const now = new Date();
    const candidates = await this.prisma.companySubscription.findMany({
      where: {
        isDemo: true,
        status: 'trial',
        expiresAt: { lte: now },
        OR: [{ demoCleanupStatus: null }, { demoCleanupStatus: 'failed' }],
      },
      select: {
        id: true,
        companyId: true,
        expiresAt: true,
        company: {
          select: {
            name: true,
            applications: { where: { kind: 'demo' }, select: { id: true } },
          },
        },
      },
    });
    if (options.dryRun) {
      return {
        dryRun: true,
        candidates: candidates.map((row) => ({
          companyId: row.companyId,
          companyName: row.company.name,
          expiresAt: row.expiresAt,
        })),
      };
    }

    const cleaned: string[] = [];
    const failed: Array<{ companyId: string; error: string }> = [];
    for (const candidate of candidates) {
      const claimed = await this.prisma.companySubscription.updateMany({
        where: {
          id: candidate.id,
          isDemo: true,
          status: 'trial',
          expiresAt: { lte: now },
          OR: [{ demoCleanupStatus: null }, { demoCleanupStatus: 'failed' }],
        },
        data: { demoCleanupStatus: 'processing' },
      });
      if (claimed.count !== 1) continue;
      try {
        const uploadUrls = await this.companyUploadUrls(candidate.companyId);
        await this.prisma.$transaction(async (tx) => {
          await tx.companySubscription.update({
            where: { id: candidate.id },
            data: { status: 'cancelled', demoCleanupStatus: 'expired' },
          });
          for (const application of candidate.company.applications) {
            await tx.companyApplication.update({
              where: { id: application.id },
              data: {
                companyId: null,
                status: 'rejected',
                lifecycleStatus: 'demo_cleaned',
                cleanedAt: new Date(),
                cleanupError: null,
                credentialStatus: 'expired',
                credentialHandoff: null,
              },
            });
          }
          await tx.company.delete({ where: { id: candidate.companyId } });
        });
        await this.removeCompanyFiles(uploadUrls);
        cleaned.push(candidate.companyId);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown cleanup failure';
        await this.prisma.companySubscription.update({
          where: { id: candidate.id },
          data: { status: 'trial', demoCleanupStatus: 'failed' },
        }).catch(() => undefined);
        failed.push({ companyId: candidate.companyId, error: message });
      }
    }
    return { dryRun: false, cleaned, failed };
  }
}
