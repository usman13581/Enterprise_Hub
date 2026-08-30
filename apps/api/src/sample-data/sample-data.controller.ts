import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { zodBody } from '../common/zod-validation.pipe';
import { CompanyAdminGuard } from '../auth/company-admin.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import {
  SessionContext,
  requireCompanySession,
} from '../auth/session.types';
import { SampleDataService } from './sample-data.service';

const eraseSchema = z.object({
  confirmation: z.string().trim().min(1).max(300),
});

@Controller('company/sample-data')
@UseGuards(CompanyAdminGuard)
export class SampleDataController {
  constructor(private readonly samples: SampleDataService) {}

  @Get()
  status(@CurrentSession() session: SessionContext) {
    return this.samples.status(requireCompanySession(session).companyId);
  }

  @Get('preview-erase')
  previewErase(@CurrentSession() session: SessionContext) {
    return this.samples.previewErase(requireCompanySession(session).companyId);
  }

  @Post('load')
  load(@CurrentSession() session: SessionContext) {
    return this.samples.load(requireCompanySession(session).companyId);
  }

  @Post('erase')
  erase(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(eraseSchema)) body: z.infer<typeof eraseSchema>,
  ) {
    return this.samples.erase(
      requireCompanySession(session).companyId,
      body.confirmation,
    );
  }
}
