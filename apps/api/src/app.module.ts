import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { AuditModule } from './audit/audit.module';
import { CommonModule } from './common/common.module';
import { LedgerModule } from './ledger/ledger.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { QuotationsModule } from './quotations/quotations.module';
import { JobsModule } from './jobs/jobs.module';
import { InvoicesModule } from './invoices/invoices.module';
import { AdvancesModule } from './advances/advances.module';
import { AccountsModule } from './accounts/accounts.module';
import { DocumentsModule } from './documents/documents.module';
import { UploadsModule } from './uploads/uploads.module';
import { SyncModule } from './sync/sync.module';
import { AdminModule } from './admin/admin.module';
import { PublicModule } from './public/public.module';
import { ReportsModule } from './reports/reports.module';
import { MailModule } from './mail/mail.module';
import { SampleDataModule } from './sample-data/sample-data.module';
import { UPLOADS_DIR } from './uploads/uploads.constants';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: UPLOADS_DIR,
      serveRoot: '/static',
      // Uploads are user-supplied bytes served from the API origin, so stop the
      // browser from sniffing them into something executable.
      serveStaticOptions: {
        setHeaders: (res) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader('Content-Security-Policy', "default-src 'none'");
        },
      },
    }),
    PrismaModule,
    CommonModule,
    AuthModule,
    CompanyModule,
    AuditModule,
    LedgerModule,
    SuppliersModule,
    ProductsModule,
    CustomersModule,
    QuotationsModule,
    JobsModule,
    InvoicesModule,
    AdvancesModule,
    AccountsModule,
    DocumentsModule,
    UploadsModule,
    SyncModule,
    AdminModule,
    PublicModule,
    ReportsModule,
    MailModule,
    SampleDataModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
