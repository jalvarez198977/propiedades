import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { NotificationRepository } from '../infrastructure/notification.repository';
import { NotificationType } from '@propiedades/types';
import { ResendEmailService } from '../../../shared/infrastructure/email/resend-email.service';

@Injectable()
export class CheckExpirationsCron {
  private readonly logger = new Logger(CheckExpirationsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepo: NotificationRepository,
    private readonly emailService: ResendEmailService,
  ) {}

  // Se ejecuta vía Vercel Cron Jobs (ver vercel.json)
  async handleCron() {
    this.logger.log('Running daily notification checks...');
    await this.checkContractExpirations();
    await this.checkPaymentDueDays();
    await this.checkExpenseReminders();
    await this.checkSecurityDepositDeadlines();
    await this.checkIpcAdjustments();
  }

  private async checkContractExpirations() {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const expiringSoon = await this.prisma.property.findMany({
      where: {
        contractEndDate: {
          lte: thirtyDaysFromNow,
          gte: new Date(),
        },
      },
      include: { user: true }
    });

    for (const property of expiringSoon) {
      const message = `El contrato de la propiedad en ${property.address} vence el ${property.contractEndDate?.toLocaleDateString('es-CL')}.`;
      
      await this.notificationRepo.create({
        userId: property.userId,
        type: NotificationType.EXPIRATION,
        title: 'Contrato Próximo a Vencer',
        message,
      });

      if (property.user.email) {
        await this.emailService.send({
          to: property.user.email,
          subject: `📄 Vencimiento de Contrato: ${property.address}`,
          html: this.wrapHtml('Aviso de Vencimiento', message, property.address),
        });
      }
    }
    
    if (expiringSoon.length > 0) {
      this.logger.log(`Generated ${expiringSoon.length} expiration notifications.`);
    }
  }

  private async checkPaymentDueDays() {
    const today = new Date();
    const currentDay = today.getDate();

    const propertiesDueToday = await this.prisma.property.findMany({
      where: {
        paymentDueDay: currentDay,
        isActive: true,
      },
      include: { 
        user: true,
        organization: true,
        tenants: {
          where: { isActive: true },
          include: { tenant: true }
        }
      }
    });

    for (const property of propertiesDueToday) {
      const ownerMessage = `Hoy es el día de pago acordado para la propiedad en ${property.address}.`;
      
      // Notificación para el dueño
      await this.notificationRepo.create({
        userId: property.userId,
        type: NotificationType.PAYMENT_DUE,
        title: 'Día de Pago en Propiedad',
        message: ownerMessage,
      });

      if (property.user.email) {
        await this.emailService.send({
          to: property.user.email,
          subject: `💰 Cobro de Arriendo: ${property.address}`,
          html: this.wrapHtml('Cobro de Arriendo', ownerMessage, property.address),
        });
      }

      // Notificación automática para el arrendatario (solo si está activada)
      if (property.notifyTenantOnPaymentDay) {
        const activeTenancy = property.tenants[0];
        if (activeTenancy && activeTenancy.tenant.email) {
          const currentMonth = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(new Date());
          const amount = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(activeTenancy.monthlyRent));
          
          await this.emailService.send({
            to: activeTenancy.tenant.email,
            subject: `📅 Recordatorio de Pago: Arriendo ${currentMonth}`,
            html: this.wrapTenantHtml({
              tenantName: activeTenancy.tenant.name,
              month: currentMonth,
              amount,
              address: property.address,
              organization: property.organization
            }),
          });
          
          this.logger.log(`Sent automatic payment reminder to tenant ${activeTenancy.tenant.email} for property ${property.address}`);
        }
      }
    }

    if (propertiesDueToday.length > 0) {
      this.logger.log(`Generated ${propertiesDueToday.length} payment due notifications.`);
    }
  }

  private async checkExpenseReminders() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    // Incluir desde ayer para no perder recordatorios si el cron corre tarde
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const reminders = await this.prisma.expenseReminder.findMany({
      where: {
        isActive: true,
        nextDueDate: {
          lte: today,
          gte: yesterday,
        },
      },
      include: {
        property: {
          include: {
            user: true
          }
        }
      }
    });

    for (const reminder of reminders) {
      const message = `Recordatorio: El pago de "${reminder.title}" para la propiedad ${reminder.property.address} vence el ${reminder.nextDueDate.toLocaleDateString('es-CL')}.`;
      
      await this.notificationRepo.create({
        userId: reminder.property.userId,
        type: NotificationType.EXPENSE_DUE,
        title: 'Vencimiento de Servicio',
        message,
      });

      if (reminder.property.user.email) {
        await this.emailService.send({
          to: reminder.property.user.email,
          subject: `🔔 Aviso de Pago: ${reminder.title}`,
          html: this.wrapHtml('Recordatorio de Pago', message, reminder.property.address),
        });
      }
    }
  }

  private async checkSecurityDepositDeadlines() {
    // Alert at 40 days after contract end (5 days before the 45-day legal limit)
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

    const pendingDeposits = await this.prisma.propertyTenant.findMany({
      where: {
        isActive: false,
        isSecurityDepositReturned: false,
        endDate: {
          lte: fortyDaysAgo,
        }
      },
      include: {
        property: {
          include: {
            user: true
          }
        },
        tenant: true
      }
    });

    for (const tenancy of pendingDeposits) {
      const daysSinceEnd = Math.floor((new Date().getTime() - new Date(tenancy.endDate!).getTime()) / (1000 * 60 * 60 * 24));
      const daysRemaining = 45 - daysSinceEnd;
      
      let message = '';
      let title = '';

      if (daysRemaining > 0) {
        title = 'Plazo Garantía Próximo a Vencer';
        message = `Atención: Han pasado ${daysSinceEnd} días desde el término del contrato de ${tenancy.tenant.name} en ${tenancy.property.address}. Le quedan ${daysRemaining} días para cumplir el plazo legal de devolución de garantía.`;
      } else {
        title = 'Plazo Devolución Garantía VENCIDO';
        message = `Atención: El plazo legal de 45 días para la devolución de la garantía de ${tenancy.tenant.name} en ${tenancy.property.address} ha EXSPIRADO.`;
      }
      
      await this.notificationRepo.create({
        userId: tenancy.property.userId,
        type: NotificationType.SYSTEM,
        title,
        message,
      });

      if (tenancy.property.user.email) {
        await this.emailService.send({
          to: tenancy.property.user.email,
          subject: `⚠️ ${title}: ${tenancy.tenant.name}`,
          html: this.wrapHtml(title, message, tenancy.property.address),
        });
      }
    }
  }

  private async checkIpcAdjustments() {
    const activeTenancies = await this.prisma.propertyTenant.findMany({
      where: {
        isActive: true,
        ipcAdjustmentMonths: { not: null, gt: 0 },
      },
      include: {
        property: {
          include: {
            user: true,
            organization: true,
          }
        },
        tenant: true,
      }
    });

    const now = new Date();

    for (const tenancy of activeTenancies) {
      const intervalMonths = tenancy.ipcAdjustmentMonths || 6;
      let nextAdjDate = tenancy.lastIpcAdjustmentDate 
        ? new Date(tenancy.lastIpcAdjustmentDate) 
        : new Date(tenancy.startDate);
      
      nextAdjDate.setMonth(nextAdjDate.getMonth() + intervalMonths);

      if (!tenancy.lastIpcAdjustmentDate) {
        while (nextAdjDate.getTime() + intervalMonths * 30 * 24 * 60 * 60 * 1000 < now.getTime()) {
          nextAdjDate.setMonth(nextAdjDate.getMonth() + intervalMonths);
        }
      }

      const diffTime = nextAdjDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Trigger if due within 15 days or overdue
      if (diffDays <= 15) {
        // Prevent daily duplicate notifications: check if an IPC notification for this property was sent in the last 15 days
        const recentNotif = await this.prisma.notification.findFirst({
          where: {
            userId: tenancy.property.userId,
            type: NotificationType.IPC_ADJUSTMENT,
            message: { contains: tenancy.property.address },
            createdAt: {
              gte: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000),
            }
          }
        });

        if (recentNotif) continue;

        const isOverdue = diffDays < 0;
        const currentRentFormatted = Number(tenancy.monthlyRent).toLocaleString('es-CL');
        const title = isOverdue ? 'Reajuste IPC de Arriendo Vencido' : 'Próximo Reajuste IPC de Arriendo';
        const message = isOverdue 
          ? `Atención: El canon de arriendo de la propiedad en ${tenancy.property.address} (${tenancy.tenant.name}) cumplió ${intervalMonths} meses sin reajuste (Vencido hace ${Math.abs(diffDays)} días). Canon actual: $${currentRentFormatted}.`
          : `Recordatorio: En ${diffDays} días corresponde aplicar el reajuste semestral de IPC a la propiedad en ${tenancy.property.address} (${tenancy.tenant.name}). Canon actual: $${currentRentFormatted}.`;

        await this.notificationRepo.create({
          userId: tenancy.property.userId,
          type: NotificationType.IPC_ADJUSTMENT,
          title,
          message,
        });

        if (tenancy.property.user?.email) {
          await this.emailService.send({
            to: tenancy.property.user.email,
            subject: `📈 ${title}: ${tenancy.property.address}`,
            html: this.wrapHtml(title, message, tenancy.property.address),
          });
        }
      }
    }
  }

  private wrapHtml(title: string, message: string, address: string) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .card { background: #ffffff; border-radius: 12px; padding: 30px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .title { color: #4f46e5; font-size: 20px; font-weight: 700; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px; }
          .message { font-size: 16px; color: #374151; margin-bottom: 25px; }
          .footer { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 20px; }
          .property { font-weight: 600; color: #111827; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="color: #4f46e5; margin: 0;">Yagnam Propiedades</h2>
        </div>
        <div class="card">
          <div class="title">${title}</div>
          <div class="message">${message}</div>
          <div style="font-size: 14px; color: #6b7280;">
            Propiedad: <span class="property">${address}</span>
          </div>
        </div>
        <div class="footer">
          Este es un correo automático generado por tu sistema de gestión de propiedades.
        </div>
      </body>
      </html>
    `;
  }

  private wrapTenantHtml(data: { tenantName: string, month: string, amount: string, address: string, organization: any }) {
    const { tenantName, month, amount, address, organization } = data;
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .card { background: #f9fafb; border-radius: 12px; padding: 30px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
          .amount-label { color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 5px; }
          .amount-value { font-size: 32px; font-weight: 800; color: #4f46e5; }
          .bank-info { background: #ffffff; border-radius: 8px; padding: 15px; border: 1px solid #d1d5db; margin-top: 20px; }
          .bank-info h3 { margin-top: 0; font-size: 16px; color: #374151; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px; }
          .bank-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
          .bank-row span:first-child { color: #6b7280; }
          .bank-row span:last-child { font-weight: 600; color: #1f2937; }
          .footer { font-size: 12px; color: #9ca3af; text-align: center; margin-top: 30px; border-top: 1px solid #f3f4f6; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2 style="color: #4f46e5; margin: 0;">Yagnam Propiedades</h2>
        </div>
        <div class="card">
          <div class="amount-label">Monto de Arriendo</div>
          <div class="amount-value">${amount}</div>
          
          <p style="margin-top: 20px;">Estimado/a <strong>${tenantName}</strong>,</p>
          <p>Le recordamos que hoy vence el plazo de pago del arriendo correspondiente al mes de <strong>${month}</strong> para la propiedad en ${address}.</p>
          
          ${organization && organization.bankName ? `
          <div class="bank-info">
            <h3>Datos para Transferencia</h3>
            <div class="bank-row"><span>Banco:</span> <span>${organization.bankName}</span></div>
            <div class="bank-row"><span>Cuenta:</span> <span>${organization.bankAccountType}</span></div>
            <div class="bank-row"><span>N°:</span> <span>${organization.bankAccountNumber}</span></div>
            <div class="bank-row"><span>RUT:</span> <span>${organization.bankAccountRut}</span></div>
            ${organization.bankAccountEmail ? `<div class="bank-row"><span>Email Comprobante:</span> <span>${organization.bankAccountEmail}</span></div>` : ''}
          </div>
          ` : ''}
        </div>
        <div class="footer">
          Este es un recordatorio automático. Si ya realizó el pago, por favor ignore este mensaje.
        </div>
      </body>
      </html>
    `;
  }
}
