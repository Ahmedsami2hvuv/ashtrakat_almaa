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

export interface BranchWriter {
  id: string
  name: string // الاسم الثلاثي
  phone: string
  token: string // رابط الدخول المباشر
  assignedAreaIds: string[]
  assignedSubscriberIds?: number[]
  createdAt: string
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
  amount: number
  receiptNumber: string
  paymentDate: string
}

export interface Consignment {
  id: string
  branchId: string
  collectorId?: string
  collectorName: string
  date: string
  receiptNumberPrefix?: string
  items: ConsignmentItem[]
  totalAmount: number
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
}

export interface DirectorateData {
  directorateName: string // 'مديرية ماء محافظة البصرة'
  updatedAt: string
  branches: DirectorateBranch[]
}
