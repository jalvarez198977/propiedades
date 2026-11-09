// ============================================================
// ENUMS
// ============================================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER',
}

export enum OrganizationRole {
  ADMIN = 'ADMIN',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export const OrganizationRoleLabels: Record<OrganizationRole, string> = {
  [OrganizationRole.ADMIN]: 'Administrador',
  [OrganizationRole.EDITOR]: 'Editor',
  [OrganizationRole.VIEWER]: 'Lector',
};

export enum PropertyCategory {
  HOUSE = 'HOUSE',
  APARTMENT = 'APARTMENT',
  OFFICE = 'OFFICE',
  LAND = 'LAND',
  OTHER = 'OTHER',
}

export enum UtilityType {
  ELECTRICITY = 'ELECTRICITY',
  WATER = 'WATER',
  GAS = 'GAS',
  INTERNET = 'INTERNET',
  TAX = 'TAX',
  COMMON_EXPENSES = 'COMMON_EXPENSES',
  INSURANCE = 'INSURANCE',
  GARBAGE = 'GARBAGE',
  WITHDRAWAL = 'WITHDRAWAL',
  PERSONAL = 'PERSONAL',
  OTHER = 'OTHER',
}

export enum PaymentMethod {
  CASH = 'CASH',
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  CHECK = 'CHECK',
  OTHER = 'OTHER',
}

export enum MessageRole {
  USER = 'USER',
  ASSISTANT = 'ASSISTANT',
}

export enum NotificationType {
  EXPIRATION = 'EXPIRATION',
  PAYMENT_DUE = 'PAYMENT_DUE',
  EXPENSE_DUE = 'EXPENSE_DUE',
  IPC_ADJUSTMENT = 'IPC_ADJUSTMENT',
  SYSTEM = 'SYSTEM',
}

export enum ExpenseFrequency {
  MONTHLY = 'MONTHLY',
  BIMONTHLY = 'BIMONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMIANNUAL = 'SEMIANNUAL',
  ANNUAL = 'ANNUAL',
}

// Labels en español para mostrar en UI
export const PropertyCategoryLabels: Record<PropertyCategory, string> = {
  [PropertyCategory.HOUSE]: 'Casa',
  [PropertyCategory.APARTMENT]: 'Departamento',
  [PropertyCategory.OFFICE]: 'Local/Oficina',
  [PropertyCategory.LAND]: 'Terreno',
  [PropertyCategory.OTHER]: 'Otro',
}

export const UtilityTypeLabels: Record<UtilityType, string> = {
  [UtilityType.ELECTRICITY]: 'Electricidad',
  [UtilityType.WATER]: 'Agua',
  [UtilityType.GAS]: 'Gas',
  [UtilityType.INTERNET]: 'Internet',
  [UtilityType.TAX]: 'Contribuciones (Rol)',
  [UtilityType.COMMON_EXPENSES]: 'Gastos Comunes',
  [UtilityType.INSURANCE]: 'Seguro',
  [UtilityType.GARBAGE]: 'Retiro de Basura',
  [UtilityType.WITHDRAWAL]: 'Retiro de Dinero',
  [UtilityType.PERSONAL]: 'Gastos Personales',
  [UtilityType.OTHER]: 'Otro',
}

export const PaymentMethodLabels: Record<PaymentMethod, string> = {
  [PaymentMethod.CASH]: 'Efectivo',
  [PaymentMethod.TRANSFER]: 'Transferencia',
  [PaymentMethod.DEPOSIT]: 'Depósito',
  [PaymentMethod.CHECK]: 'Cheque',
  [PaymentMethod.OTHER]: 'Otro',
}

export const ExpenseFrequencyLabels: Record<ExpenseFrequency, string> = {
  [ExpenseFrequency.MONTHLY]: 'Mensual',
  [ExpenseFrequency.BIMONTHLY]: 'Bimestral',
  [ExpenseFrequency.QUARTERLY]: 'Trimestral',
  [ExpenseFrequency.SEMIANNUAL]: 'Semestral',
  [ExpenseFrequency.ANNUAL]: 'Anual',
}
