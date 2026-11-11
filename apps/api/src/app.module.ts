import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ScheduleModule } from '@nestjs/schedule'
import { AuthModule } from './modules/auth/infrastructure/auth.module'
import { PropertyModule } from './modules/property/infrastructure/property.module'
import { TenantModule } from './modules/tenant/infrastructure/tenant.module'
import { PaymentModule } from './modules/payment/infrastructure/payment.module'
import { UtilityModule } from './modules/utility/infrastructure/utility.module'
import { ReportModule } from './modules/report/infrastructure/report.module'
import { AiModule } from './modules/ai/infrastructure/ai.module'
import { PrismaModule } from './shared/infrastructure/prisma.module'
import { CloudinaryModule } from './shared/infrastructure/cloudinary/cloudinary.module'

import { NotificationModule } from './modules/notification/infrastructure/notification.module'
import { OrganizationModule } from './modules/organization/infrastructure/organization.module'
import { AdminModule } from './modules/admin/admin.module'
import { BillingModule } from './modules/billing/infrastructure/billing.module'
import { ExpenseCategoryModule } from './modules/expense-category/infrastructure/expense-category.module'
import { IndicatorModule } from './modules/indicator/infrastructure/indicator.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env' }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    OrganizationModule,
    AdminModule,
    PropertyModule,
    TenantModule,
    PaymentModule,
    UtilityModule,
    ReportModule,
    AiModule,
    CloudinaryModule,
    NotificationModule,
    BillingModule,
    ExpenseCategoryModule,
    IndicatorModule,
  ],
})
export class AppModule {}
