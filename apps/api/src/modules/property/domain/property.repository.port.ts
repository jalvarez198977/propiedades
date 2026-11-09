import { Property } from './property.entity';

export interface IPropertyRepository {
  findAllByOrganizationId(organizationId: string): Promise<Property[]>;
  findById(id: string): Promise<Property | null>;
  findActiveTenancyByPropertyId(propertyId: string): Promise<any | null>;
  create(data: any): Promise<Property>;
  update(id: string, data: any): Promise<Property>;
  delete(id: string): Promise<void>;
  assignTenant(propertyId: string, data: any, userId: string): Promise<any>;
  returnSecurityDeposit(tenancyId: string, organizationId: string, userId: string, data: any): Promise<void>;
  updateSecurityDeposit(tenancyId: string, amount: number): Promise<void>;
  updateMonthlyRent(tenancyId: string, amount: number, isIpcAdjustment?: boolean): Promise<void>;
  updateTenancyTenant(tenancyId: string, tenantId: string): Promise<void>;
  updateTenancyStartDate(tenancyId: string, startDate: Date): Promise<void>;
  terminateTenancy(tenancyId: string, data: any): Promise<void>;
  updateTenancyContract(tenancyId: string, contractUrl: string | null): Promise<void>;
}

export const PROPERTY_REPOSITORY = Symbol('IPropertyRepository');
