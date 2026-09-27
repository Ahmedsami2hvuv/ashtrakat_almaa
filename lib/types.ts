// أنواع البيانات الأساسية للمشروع

export interface Branch {
  id: string
  name: string
}

export interface Area {
  id: string
  name: string
  branches: Branch[]
}

export interface PaymentRow {
  period: number        // رقم الفترة (1-6 لكل سنة)
  year: number          // السنة
  periodLabel: string   // تسمية الفترة مثل "1/2025"
  old: number           // الدين القديم
  paid: number          // المدفوع
  remaining: number     // المتبقي
  isManual?: boolean    // هل تم إدخاله يدوياً
}

export interface Location {
  lat: number
  lng: number
  link: string
}

export interface Subscriber {
  id: number
  name: string
  areaId: string
  branchId: string
  phone: string
  propertyType: 'سكني' | 'تجاري'
  meterType: string
  detailedAddress: string
  location?: Location
  doorImage?: string
  payments: PaymentRow[]
  remainingPrev?: number
  fee?: number
}

// نوع البيانات كما تُخزَّن في سوبا بيس
export interface SubscriberDB {
  id: number
  name: string
  area_id: string
  branch_id: string
  phone: string | null
  property_type: string
  meter_type: string
  detailed_address: string | null
  location_lat: number | null
  location_lng: number | null
  location_link: string | null
  door_image: string | null
  remaining_prev: number
  fee: number
  created_at: string
}

export interface PaymentDB {
  id: number
  subscriber_id: number
  period: number
  year: number
  period_label: string
  old_debt: number
  paid: number
  remaining: number
  is_manual: boolean
  updated_at: string
}

export interface AreaDB {
  id: string
  name: string
  sort_order: number
}

export interface BranchDB {
  id: string
  area_id: string
  name: string
  sort_order: number
}

export interface PricingDB {
  id: string
  property_type: string
  meter_type: string
  amount: number
}

export interface CollectorDB {
  id: string
  name: string
  phone: string
  range_from: number
  range_to: number
}
