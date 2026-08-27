import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import {
  companyProfileSchema,
  type CompanyProfileInput,
} from '@marble/types';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import {
  SessionContext,
  requireCompanySession,
} from '../auth/session.types';
import { zodBody } from '../common/zod-validation.pipe';
import { CompanyService } from './company.service';

@Controller('company')
@UseGuards(BootstrapAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('me')
  me(@CurrentSession() session: SessionContext) {
    const s = requireCompanySession(session);
    return this.companyService.getCompany(s.companyId);
  }

  @Get('subscription')
  subscription(@CurrentSession() session: SessionContext) {
    const s = requireCompanySession(session);
    return this.companyService.getSubscription(s.companyId);
  }

  @Put('profile')
  updateProfile(
    @CurrentSession() session: SessionContext,
    @Body(zodBody(companyProfileSchema)) body: CompanyProfileInput,
  ) {
    return this.companyService.updateProfile(session, body);
  }
}
