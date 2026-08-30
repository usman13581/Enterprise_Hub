import { Body, Controller, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { demoRequestSchema, type DemoRequestInput } from '@marble/types';
import { zodBody } from '../common/zod-validation.pipe';
import { DemoProvisioningService } from './demo-provisioning.service';
import { PublicService } from './public.service';

@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly demoProvisioning: DemoProvisioningService,
  ) {}

  @Post('demo-requests')
  createDemoRequest(
    @Body(zodBody(demoRequestSchema)) body: DemoRequestInput,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    return this.demoProvisioning.requestDemo(body, ip);
  }

  @Post('applications')
  createApplication(
    @Body()
    body: {
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
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
      req.ip ||
      null;
    return this.publicService.createApplication(body, ip);
  }
}
