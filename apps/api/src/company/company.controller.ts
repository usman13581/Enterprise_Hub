import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { BootstrapAuthGuard } from '../auth/bootstrap-auth.guard';
import { CurrentSession } from '../auth/current-session.decorator';
import { SessionContext } from '../auth/session.types';
import { CompanyProfileInput, CompanyService } from './company.service';

@Controller('company')
@UseGuards(BootstrapAuthGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Get('me')
  me(@CurrentSession() session: SessionContext) {
    return this.companyService.getCompany(session.companyId);
  }

  @Put('profile')
  updateProfile(
    @CurrentSession() session: SessionContext,
    @Body() body: CompanyProfileInput,
  ) {
    return this.companyService.updateProfile(session, body);
  }
}
