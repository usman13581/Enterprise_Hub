import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { CompanyModule } from './company/company.module';
import { AuditModule } from './audit/audit.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { ProductsModule } from './products/products.module';
import { CustomersModule } from './customers/customers.module';
import { UploadsModule } from './uploads/uploads.module';
import { UPLOADS_DIR } from './uploads/uploads.constants';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: UPLOADS_DIR,
      serveRoot: '/static',
    }),
    PrismaModule,
    AuthModule,
    CompanyModule,
    AuditModule,
    SuppliersModule,
    ProductsModule,
    CustomersModule,
    UploadsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
