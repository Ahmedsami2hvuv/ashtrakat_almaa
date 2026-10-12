import { Area, Subscriber, BillingRecords, Pricing } from '@/components/MainApp'

export interface BranchManager {
  id: string
  name: string // الاسم الثلاثي
  phone: string
  token: string // رابط الدخول المباشر
  createdAt: string
}

export interface BranchCollector {
  id: string
  name: string // الاسم الثلاثي
  phone: string
  token: string // رابط الدخول المباشر
  assignedAreaIds: string[]
  assignedSubscriberIds?: number[]
  canEdit: boolean // هل يملك صلاحية التعديل على المشتركين والديون
  createdAt: string
}

export interface WriterActivityEvent {
  id: string
  writerId: string
  writerName: string
  branchId: string
  actionType: 'login' | 'edit_subscriber' | 'update_debt' | 'add_payment'
  subscriberId?: number
  subscriberName?: string
  details?: string
  amount?: number
  timestamp: string // ISO string
  date: string // "YYYY-MM-DD"
  time: string // "02:30 مساءً"
  year: number
  month: number
}

export interface BranchWriter {
  id: string
  name: string // الاسم الثلاثي
  phone: string
  token: string // رابط الدخول المباشر
  assignedAreaIds: string[]
  assignedSubscriberIds?: number[]
  workHoursEnabled?: boolean // هل تم تفعيل تقييد ساعات العمل
  workHourStart?: string // وقت بدء العمل (مثال: 08:00) بالتوقيت العراقي
  workHourEnd?: string // وقت انتهاء العمل (مثال: 14:00) بالتوقيت العراقي
  createdAt: string
  lastLoginAt?: string // تاريخ وتوقيت آخر فتح للنظام
  loginCountToday?: number // عدد مرات فتح النظام اليوم
  activityLogs?: WriterActivityEvent[] // سجل العمليات المباشرة
}

export interface TreasuryManager {
  id: string
  name: string
  phone: string
  token: string
  createdAt: string
}

export interface ConsignmentItem {
  id?: string
  subscriberId: number
  subscriberName: string
  areaName?: string
  amount: number
  waterAmount?: number
  municipalityAmount?: number
  receiptNumber: string
  paymentDate: string
}

export interface Consignment {
  id: string
  serialNumber?: string // رقم الورقة التسلسلي (مثال: 02951)
  paperRefNumber?: string // الرقم
  branchId: string
  collectorId?: string
  collectorName: string
  date: string
  receiptNumberPrefix?: string
  items: ConsignmentItem[]
  totalAmount: number
  totalWaterAmount?: number
  totalMunicipalityAmount?: number
  createdAt: string
  printedAt?: string
}

export interface DirectorateBranch {
  id: string
  name: string
  createdAt: string
  managers: BranchManager[]
  collectors: BranchCollector[]
  writers: BranchWriter[]
  treasuryManagers: TreasuryManager[]
  areas: Area[]
  subscribers: Subscriber[]
  billing: BillingRecords
  consignments: Consignment[]
  pricing?: Pricing
  aiApiKeys?: string[]
  subscribersCount?: number
}

export interface DirectorateData {
  directorateName: string // 'مديرية ماء محافظة البصرة'
  updatedAt: string
  branches: DirectorateBranch[]
}
