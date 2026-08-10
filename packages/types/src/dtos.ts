import { PropertyCategory, UtilityType, PaymentMethod, UserRole, OrganizationRole, ExpenseFrequency } from './enums'

// ============================================================
// PAGINATION
// ============================================================

export interface PaginationMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface PaginationQuery {
  page?: number
  limit?: number
  search?: string
}

// ============================================================
// AUTH
// ============================================================

export interface RegisterDto {
  email: string
  password: string
  fullName: string
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthTokensDto {
  accessToken: string
  refreshToken: string
}

export interface UserProfileDto {
  id: string
  email: string
  fullName: string
  role: UserRole
  organizations: OrganizationMemberDto[]
  createdAt: string
}

export interface UpdateProfileDto {
  fullName?: string
  email?: string
  password?: string
}

// ============================================================
// ORGANIZATION & TEAM
// ============================================================

export interface OrganizationDto {
  id: string
  name: string
  slug: string
  bankName?: string
  bankAccountType?: string
  bankAccountNumber?: string
  bankAccountRut?: string
  bankAccountEmail?: string
  role?: OrganizationRole
  createdAt: string
}

export interface CreateOrganizationDto {
  name: string
}

export interface OrganizationMemberDto {
  id: string
  organizationId: string
  organization: OrganizationDto
  userId: string
  role: OrganizationRole
  user?: {
    fullName: string
    email: string
  }
  createdAt: string
}

export interface InviteMemberDto {
  email: string
  role: OrganizationRole
}

export interface UpdateMemberRoleDto {
  role: OrganizationRole
}

// ============================================================
// PROPERTY
// ============================================================

export interface CreatePropertyDto {
  category: PropertyCategory
  customCategory?: string    // Libre cuando category = 'OTHER'
  name?: string
  address: string
  city?: string
  bedrooms?: number
  bathrooms?: number
  m2Total?: number
  m2Built?: number
  hasParking?: boolean
  hasStorage?: boolean
  rol?: string               // ROL de Avalúo SII
  contractEndDate?: string   // ISO date
  paymentDueDay: number      // 1–31
  notes?: string
  expectedRent?: number      // Precio promocional público
  notifyTenantOnPaymentDay?: boolean
}

export interface UpdatePropertyDto extends Partial<CreatePropertyDto> {}

export interface PropertyPhotoDto {
  id: string
  url: string
  order: number
  uploadedAt: string
}

export interface ReorderPhotosDto {
  photoOrders: Array<{
    id: string;
    order: number;
  }>;
}


export interface PropertyNoteDto {
  id: string
  propertyId: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface CreatePropertyNoteDto {
  content: string
}

export interface UpdatePropertyNoteDto {
  content?: string
}

export interface PropertyMeterDto {
  id: string
  label: string
  number: string
  createdAt: string
}

export interface CreatePropertyMeterDto {
  label: string
  number: string
}

export interface PropertyDto {
  id: string
  category: PropertyCategory
  customCategory?: string | null
  name?: string | null
  address: string
  city?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  m2Total?: number | null
  m2Built?: number | null
  hasParking: boolean
  hasStorage: boolean
  rol?: string
  contractEndDate?: string
  paymentDueDay: number
  notes?: string
  expectedRent?: number | null
  notifyTenantOnPaymentDay?: boolean
  meters: PropertyMeterDto[]
  createdAt: string
  updatedAt: string
  photos: PropertyPhotoDto[]
  activeTenant?: PropertyTenantDto | null
  pendingSecurityDeposits?: PropertyTenantDto[]
}

export interface PropertySummaryDto {
  id: string
  address: string
  category: PropertyCategory
  isOccupied: boolean
  monthlyRent?: number
  pendingAmount?: number   // deuda del mes actual
  paymentStatus: 'paid' | 'pending' | 'overdue'
  contractEndDate?: string
}

// ============================================================
// UTILITY (Servicios)
// ============================================================

export interface CreateUtilityDto {
  propertyId: string
  type: UtilityType
  amount: number
  isIncludedInRent: boolean
  billingMonth?: string    // ISO date, opcional
  notes?: string
  title?: string           // Fallback for notes
}

export interface UpdateUtilityDto extends Partial<CreateUtilityDto> {}

export interface UtilityDto {
  id: string
  type: UtilityType
  amount: number
  isIncludedInRent: boolean
  billingMonth?: string
  notes?: string | null
  recordedBy?: string
  createdAt: string
}

export interface MonthlyCostDto {
  rent: number
  utilities: number
  total: number
  breakdown: UtilityDto[]
}

export interface ExpenseCategoryDto {
  id: string
  organizationId: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateExpenseCategoryDto {
  name: string
}

export interface UpdateExpenseCategoryDto {
  name?: string
  isActive?: boolean
}

// ============================================================
// TENANT (Arrendatario)
// ============================================================

export interface CreateTenantDto {
  name: string
  email?: string
  phone?: string
  documentId?: string
}

export interface UpdateTenantDto extends Partial<CreateTenantDto> {}

export interface NotificationDto {
  id: string
  type: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export interface CreateExpenseReminderDto {
  propertyId: string
  title: string
  amount: number
  frequency: ExpenseFrequency
  nextDueDate: string // ISO Date
}

export interface ExpenseReminderDto {
  id: string
  propertyId: string
  title: string
  amount: number
  frequency: ExpenseFrequency
  nextDueDate: string // ISO Date
  isActive: boolean
  createdAt: string
}

export interface TenantDto {
  id: string
  name: string
  email?: string
  phone?: string
  documentId?: string
  isActive: boolean
  createdAt: string
  currentProperty?: { id: string; address: string } | null
}

// ============================================================
// PROPERTY TENANT (Ocupación)
// ============================================================

export interface AssignTenantDto {
  tenantId: string
  startDate?: string        // ISO date
  endDate?: string         // ISO date
  monthlyRent: number
  securityDeposit?: number
  contractUrl?: string | null
}

export interface TerminateTenancyDto {
  endDate: string; // ISO date
}

export interface ReturnDepositDto {
  returnAmount: number;
  returnDate: string; // ISO date
}

export interface PropertyTenantDto {
  id: string
  tenantId: string
  tenant: TenantDto
  startDate: string
  endDate?: string
  monthlyRent: number
  securityDeposit?: number
  isSecurityDepositReturned?: boolean
  isActive: boolean
  contractUrl?: string | null
}

// ============================================================
// PAYMENT (Pagos)
// ============================================================

export interface CreatePaymentDto {
  propertyTenantId: string
  amount: number
  paymentDate: string       // ISO date
  paymentMethod: PaymentMethod
  receiptUrl?: string
  notes?: string
}

export interface PaymentDto {
  id: string
  amount: number
  paymentDate: string
  paymentMethod: PaymentMethod
  receiptUrl?: string
  notes?: string
  createdAt: string
  propertyTenant: {
    id: string
    monthlyRent: number
    property: { id: string; address: string }
    tenant: { id: string; name: string }
  }
}

export interface PendingPaymentDto {
  propertyId: string
  address: string
  tenantName: string
  monthlyRent: number
  amountPaid: number
  pendingAmount: number
  dueDay: number
  daysPastDue: number
}

// ============================================================
// REPORTS
// ============================================================

export interface FinancialStatementDto {
  period: {
    startDate: string
    endDate: string
  }
  summary: {
    totalIncome: number
    totalExpenses: number
    totalCosts: number
    netResult: number
  }
  income: {
    items: IncomeDetailDto[]
    total: number
  }
  expenses: {
    items: ExpenseDetailDto[]
    total: number
  }
  costs: {
    items: ExpenseDetailDto[]
    total: number
  }
}

export interface IncomeDetailDto {
  id: string
  date: string
  propertyAddress: string
  tenantName: string
  amount: number
  method: PaymentMethod
  notes?: string
  recordedBy: string
}

export interface ExpenseDetailDto {
  id: string
  date: string
  propertyAddress: string
  type: UtilityType
  amount: number
  description?: string
  recordedBy?: string
}

export interface ReportSummaryDto {
  period: string
  totalIncome: number
  totalExpenses: number
  netIncome: number
  occupancyRate: number    // 0–100
  propertiesCount: number
  occupiedCount: number
  byProperty: PropertyReportDto[]
}

export interface PropertyReportDto {
  propertyId: string
  address: string
  income: number
  expenses: number
  netIncome: number
  paymentsCount: number
  isOccupied: boolean
}

// ============================================================
// AI AGENT
// ============================================================

export interface AiQueryDto {
  message: string
  conversationId?: string
}

export interface AiResponseDto {
  reply: string
  conversationId: string
}

export interface AiMessageDto {
  id: string
  role: 'USER' | 'ASSISTANT'
  content: string
  createdAt: string
}
