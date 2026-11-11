import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma.service';
import { IPropertyRepository } from '../domain/property.repository.port';
import { Property } from '../domain/property.entity';

@Injectable()
export class PrismaPropertyRepository implements IPropertyRepository {
  constructor(public prisma: PrismaService) {}

  async findAllByOrganizationId(organizationId: string): Promise<Property[]> {
    const properties = await this.prisma.property.findMany({
      where: { organizationId },
      include: {
        meters: true,
        photos: {
          orderBy: { order: 'asc' },
        },
        tenants: {
          include: { tenant: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return properties.map(p => this.mapToEntity(p));
  }

  async findById(id: string): Promise<Property | null> {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        meters: true,
        photos: {
          orderBy: { order: 'asc' },
        },
        tenants: {
          where: {
            OR: [
              { isActive: true },
              { 
                isActive: false, 
                securityDeposit: { gt: 0 }, 
                isSecurityDepositReturned: false 
              }
            ]
          },
          include: { tenant: true },
        },
      },
    });
    if (!property) return null;
    return this.mapToEntity(property);
  }

  async findActiveTenancyByPropertyId(propertyId: string): Promise<any | null> {
    const tenancy = await this.prisma.propertyTenant.findFirst({
      where: {
        propertyId,
        isActive: true,
      },
      include: {
        tenant: true,
      },
    });
    return tenancy;
  }

  async create(data: any): Promise<Property> {
    const property = await this.prisma.property.create({
      data,
    });
    return this.mapToEntity(property);
  }

  async update(id: string, data: any): Promise<Property> {
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.property.update({
        where: { id },
        data,
      });

      if (data.contractEndDate !== undefined) {
        await tx.propertyTenant.updateMany({
          where: { propertyId: id, isActive: true },
          data: { endDate: data.contractEndDate },
        });
      }

      return this.mapToEntity(property);
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.property.delete({
      where: { id },
    });
  }

  async assignTenant(propertyId: string, data: any, userId: string): Promise<any> {
    return this.prisma.$transaction(async (tx) => {
      // First, deactivate any previous active tenancy for this property (if any)
      await tx.propertyTenant.updateMany({
        where: { propertyId, isActive: true },
        data: { isActive: false, endDate: new Date() },
      });

      const endDate = data.endDate ? new Date(data.endDate) : null;

      // Update the property's contractEndDate to match the new assignment
      await tx.property.update({
        where: { id: propertyId },
        data: { contractEndDate: endDate },
      });

      // Create the new tenancy
      const tenancy = await tx.propertyTenant.create({
        data: {
          propertyId,
          tenantId: data.tenantId,
          startDate: new Date(data.startDate),
          endDate,
          monthlyRent: data.monthlyRent,
          securityDeposit: data.securityDeposit,
          contractUrl: data.contractUrl,
          isActive: true,
        },
        include: {
          tenant: true,
        },
      });

      // Registrar los pagos iniciales
      const paymentDate = new Date(data.startDate);
      
      // 1. Pago de Arriendo
      if (data.monthlyRent > 0) {
        await tx.payment.create({
          data: {
            propertyTenantId: tenancy.id,
            recordedById: userId,
            amount: data.monthlyRent,
            paymentDate,
            paymentMethod: 'TRANSFER', // Método por defecto
            notes: 'Pago inicial: Arriendo del primer mes',
          }
        });
      }

      // 2. Pago de Garantía
      if (data.securityDeposit > 0) {
        await tx.payment.create({
          data: {
            propertyTenantId: tenancy.id,
            recordedById: userId,
            amount: data.securityDeposit,
            paymentDate,
            paymentMethod: 'TRANSFER',
            notes: 'Pago inicial: Mes de garantía',
          }
        });
      }

      return tenancy;
    });
  }

  async addPhoto(propertyId: string, data: { url: string; publicId: string }): Promise<any> {
    const maxOrderPhoto = await this.prisma.propertyPhoto.findFirst({
      where: { propertyId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });
    const nextOrder = maxOrderPhoto ? maxOrderPhoto.order + 1 : 0;

    return this.prisma.propertyPhoto.create({
      data: {
        propertyId,
        url: data.url,
        publicId: data.publicId,
        order: nextOrder,
      },
    });
  }

  async deletePhoto(photoId: string): Promise<any> {
    // Return the deleted photo so we can access its publicId if needed
    return this.prisma.propertyPhoto.delete({
      where: { id: photoId },
    });
  }

  async getPhoto(photoId: string): Promise<any> {
    return this.prisma.propertyPhoto.findUnique({
      where: { id: photoId },
    });
  }

  async updatePhotosOrder(propertyId: string, photoOrders: Array<{ id: string, order: number }>): Promise<void> {
    await this.prisma.$transaction(
      photoOrders.map(po => 
        this.prisma.propertyPhoto.updateMany({
          where: { id: po.id, propertyId },
          data: { order: po.order },
        })
      )
    );
  }

  async returnSecurityDeposit(tenancyId: string, organizationId: string, userId: string, data: any): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // 1. Marcar como devuelta
      const tenancy = await tx.propertyTenant.update({
        where: { id: tenancyId },
        data: { isSecurityDepositReturned: true },
      });

      // 2. Crear egreso
      if (data.returnAmount && data.returnAmount > 0) {
        await tx.expense.create({
          data: {
            organizationId,
            propertyId: tenancy.propertyId,
            amount: data.returnAmount,
            date: new Date(data.returnDate),
            category: 'Devolución Garantía',
            description: `Devolución de garantía de arrendamiento. Inquilino ID: ${tenancy.tenantId}`,
            recordedById: userId,
          }
        });
      }
    });
  }

  async updateSecurityDeposit(tenancyId: string, amount: number): Promise<void> {
    await this.prisma.propertyTenant.update({
      where: { id: tenancyId },
      data: { securityDeposit: amount },
    });
  }

  async updateMonthlyRent(tenancyId: string, amount: number, isIpcAdjustment?: boolean): Promise<void> {
    const data: any = { monthlyRent: amount };
    if (isIpcAdjustment !== false) {
      data.lastIpcAdjustmentDate = new Date();
    }
    await this.prisma.propertyTenant.update({
      where: { id: tenancyId },
      data,
    });
  }

  async updateTenancyTenant(tenancyId: string, tenantId: string): Promise<void> {
    await this.prisma.propertyTenant.update({
      where: { id: tenancyId },
      data: { tenantId },
    });
  }

  async updateTenancyStartDate(tenancyId: string, startDate: Date): Promise<void> {
    await this.prisma.propertyTenant.update({
      where: { id: tenancyId },
      data: { startDate },
    });
  }

  async updateTenancyEndDate(tenancyId: string, endDate: Date | null): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const tenancy = await tx.propertyTenant.update({
        where: { id: tenancyId },
        data: { endDate },
      });
      if (tenancy.propertyId) {
        await tx.property.update({
          where: { id: tenancy.propertyId },
          data: { contractEndDate: endDate },
        });
      }
    });
  }

  async terminateTenancy(tenancyId: string, data: any): Promise<void> {
    await this.prisma.propertyTenant.update({
      where: { id: tenancyId },
      data: { 
        isActive: false, 
        endDate: data.endDate ? new Date(data.endDate) : new Date() 
      },
    });
  }

  async updateTenancyContract(tenancyId: string, contractUrl: string | null): Promise<void> {
    await this.prisma.propertyTenant.update({
      where: { id: tenancyId },
      data: { contractUrl },
    });
  }

  private mapToEntity(p: any): Property {
    return new Property(
      p.id,
      p.userId,
      p.organizationId,
      p.category,
      p.customCategory,
      p.name,
      p.address,
      p.city,
      p.bedrooms,
      p.bathrooms,
      p.m2Total,
      p.m2Built,
      p.hasParking,
      p.hasStorage,
      p.paymentDueDay,
      p.contractEndDate,
      p.rol,
      p.notes,
      p.expectedRent,
      p.createdAt,
      p.updatedAt,
      p.meters ? p.meters.map((m: any) => ({
        id: m.id,
        label: m.label,
        number: m.number,
        createdAt: m.createdAt,
      })) : [],
      p.tenants && p.tenants.find((t: any) => t.isActive) ? {
        ...(p.tenants.find((t: any) => t.isActive)),
        securityDeposit: p.tenants.find((t: any) => t.isActive).securityDeposit ? Number(p.tenants.find((t: any) => t.isActive).securityDeposit) : null,
      } : null,
      p.tenants ? p.tenants
        .filter((t: any) => !t.isActive && t.securityDeposit > 0 && !t.isSecurityDepositReturned)
        .map((t: any) => ({
          ...t,
          securityDeposit: Number(t.securityDeposit)
        })) : [],
      p.photos ? p.photos.map((ph: any) => ({
        id: ph.id,
        url: ph.url,
        publicId: ph.publicId,
        order: ph.order,
        uploadedAt: ph.uploadedAt,
      })) : [],
    );
  }
}
