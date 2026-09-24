'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// أنواع البيانات
export type PropertyType = 'سكني' | 'تجاري'
export type MeterType = string

export interface Branch {
  id: string
  name: string
}

export interface Area {
  id: string
  name: string
  branches: Branch[]
}

export interface Subscriber {
  id: number
  name: string
  phone: string
  areaId: string
  branchId: string
  propertyType: PropertyType
  meterType: MeterType
  detailedAddress: string
  doorImage?: string
  location?: { lat: number; lng: number; link: string }
  order: number
  statuses?: string[]
}

export type Pricing = Record<PropertyType, Record<MeterType, number>>
export type BillingPeriodRecord = { oldDebtManual: number | null; paid: number }
export type BillingRecords = Record<number, Record<number, BillingPeriodRecord[]>>
export type ParsedImportItem = { id: number; name: string; raw: string; statuses: string[]; note?: string }

const STORAGE_KEY = 'ashtrakat_almaa_v1_data'
const AUTH_STORAGE_KEY = 'ashtrakat_almaa_auth_token'

// ===== مزامنة سوبابيس السحابية =====
const SB_URL = 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const SYNC_ROW_KEY = 'main_data'

async function loadFromCloud(): Promise<Record<string, unknown> | null> {
  if (!SB_URL || !SB_KEY || SB_URL.includes('placeholder')) return null
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${SYNC_ROW_KEY}&select=value`,
      { headers: { 'apikey': SB_KEY, 'Authorization': `Bearer ${SB_KEY}` } }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows[0]?.value || null
  } catch { return null }
}

async function saveToCloud(data: Record<string, unknown>): Promise<void> {
  if (!SB_URL || !SB_KEY || SB_URL.includes('placeholder')) return
  try {
    await fetch(`${SB_URL}/rest/v1/app_sync`, {
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ key: SYNC_ROW_KEY, value: data, updated_at: new Date().toISOString() })
    })
  } catch {}
}

// السنوات المطلوبة حصراً
const YEARS = [2026, 2027, 2028]
const PERIODS = ['1 و 2', '3 و 4', '5 و 6', '7 و 8', '9 و 10', '11 و 12']
const RESIDENTIAL_METERS: MeterType[] = ['3 متر', '4 متر']
const COMMERCIAL_METERS: MeterType[] = Array.from({ length: 70 }, (_, index) => `${index + 1} متر`)

function metersForProperty(propertyType: PropertyType): MeterType[] {
  return propertyType === 'تجاري' ? COMMERCIAL_METERS : RESIDENTIAL_METERS
}

// حالات المشترك
const STATUS_OPTIONS = [
  'ممتنع',
  'مؤجر',
  'مؤجر لا يعلم بالتفاصيل',
  'يدفع بالدائرة',
  'يجب فحص حسابه',
  'يدفع باستمرار',
  'مفلش'
] as const

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'ممتنع': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  'مؤجر': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'مؤجر لا يعلم بالتفاصيل': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-800' },
  'يدفع بالدائرة': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'يجب فحص حسابه': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  'يدفع باستمرار': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'مفلش': { bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-300', dot: 'bg-zinc-500' }
}

const DEFAULT_AREAS: Area[] = [
  { id: 'area_1', name: 'شارع الكهرباء', branches: [{ id: 'b_1', name: 'فرع المولدة' }, { id: 'b_2', name: 'فرع الفيترجي' }, { id: 'b_3', name: 'الرئيسي' }] },
  { id: 'area_2', name: 'حي الجامعة', branches: [{ id: 'b_4', name: 'الفرع الاول' }, { id: 'b_5', name: 'الفرع الثاني' }] },
  { id: 'area_3', name: 'حي العسكري', branches: [{ id: 'b_6', name: 'الرئيسي' }] },
  { id: 'area_4', name: 'حي النفط', branches: [{ id: 'b_7', name: 'الرئيسي' }] }
]

const DEFAULT_PRICING: Pricing = {
  سكني: { '3 متر': 16200, '4 متر': 24600 },
  تجاري: {}
}

function formatNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined || isNaN(Number(n))) return '0'
  return Number(n).toLocaleString('en-US')
}

// حساب الديون لفترات سنة معينة
function calculateBilling(
  subId: number,
  year: number,
  billingRecords: BillingRecords,
  subscribers: Subscriber[],
  pricing: Pricing
) {
  const sub = subscribers.find((s) => s.id === subId)
  const emptyRes = {
    rows: [] as Array<{
      periodLabel: string
      old: number
      due: number
      paid: number
      remaining: number
      isManual: boolean
    }>,
    remainingPrev: 0,
    fee: 0,
    totalCarried: 0,
    due: 24600,
    totalRemaining: 0
  }
  if (!sub) return emptyRes

  const meterAmount = Number.parseInt(sub.meterType, 10)
  const due =
    sub.propertyType === 'تجاري'
      ? (Number.isFinite(meterAmount) && meterAmount > 0 ? meterAmount * 60 * 200 : 0)
      : pricing[sub.propertyType]?.[sub.meterType] ?? 24600

  // الدين السابق من السنة السابقة (فقط لـ 2027 و 2028)
  let prevRemaining = 0
  if (year > 2026) {
    const prevBilling = calculateBilling(subId, year - 1, billingRecords, subscribers, pricing)
    if (prevBilling.rows.length > 0) {
      prevRemaining = prevBilling.rows[prevBilling.rows.length - 1].remaining
    }
  }

  // بداية السنة بسيطة: القديم + الفائدة = الناتج
  const fee = prevRemaining >= due * 4 && due > 0 ? Math.round(prevRemaining * 0.1) : 0
  const totalCarried = prevRemaining + fee

  const rows: Array<{
    periodLabel: string
    old: number
    due: number
    paid: number
    remaining: number
    isManual: boolean
  }> = []

  for (let p = 0; p < 6; p++) {
    const rec = billingRecords[subId]?.[year]?.[p]
    const paid = rec?.paid ?? 0
    const manualOld = rec?.oldDebtManual
    const isManual = manualOld !== null && manualOld !== undefined
    const oldDebt: number = isManual ? (manualOld as number) : (p === 0 ? totalCarried : rows[p - 1].remaining)

    // معادلة الدين: المتبقي = الدين القديم + المستحق - المدفوع
    const remaining = oldDebt + due - paid

    rows.push({
      periodLabel: PERIODS[p],
      old: oldDebt,
      due,
      paid,
      remaining,
      isManual
    })
  }

  const totalRemaining = rows.length > 0 ? rows[rows.length - 1].remaining : 0

  return {
    rows,
    remainingPrev: prevRemaining,
    fee,
    totalCarried,
    due,
    totalRemaining
  }
}

// دالة ترتيب البحث حسب الاسم الأول ثم الثاني ثم الثالث
function searchRank(name: string, query: string): number {
  const words = name.trim().split(/\s+/)
  const q = query.trim()
  if (!q) return 999
  for (let i = 0; i < words.length; i++) {
    if (words[i].startsWith(q)) return i
  }
  if (name.includes(q)) return 10 + name.indexOf(q)
  return 1000
}

export default function MainApp() {
  // رمز الدخول المطلوب
  const REQUIRED_PIN = process.env.NEXT_PUBLIC_APP_PIN || 'AHMEDHLAWAADAHAM'

  // حالة تسجيل الدخول
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [pinInput, setPinInput] = useState<string>('')
  const [pinError, setPinError] = useState<string>('')

  // البيانات الأساسية
  const [areas, setAreas] = useState<Area[]>(DEFAULT_AREAS)
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING)
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [billing, setBilling] = useState<BillingRecords>({})
  const [collectorName, setCollectorName] = useState<string>('احمد المحصل')
  const [collectorPhone, setCollectorPhone] = useState<string>('07801234567')
  const [rangeFrom, setRangeFrom] = useState<number>(5203)
  const [rangeTo, setRangeTo] = useState<number>(6202)

  // البحث والفلترة
  const [searchOpen, setSearchOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false)
  const [filterTypes, setFilterTypes] = useState<{ سكني: boolean; تجاري: boolean }>({ سكني: true, تجاري: true })
  const [filterAreas, setFilterAreas] = useState<string[]>([])
  const [filterBranches, setFilterBranches] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterAreaSearch, setFilterAreaSearch] = useState<string>('')
  const [filterBranchSearch, setFilterBranchSearch] = useState<string>('')
  const [openFilterAreaId, setOpenFilterAreaId] = useState<string | null>(null)
  const [filterPanel, setFilterPanel] = useState<'type' | 'areas' | 'statuses' | null>(null)

  // الاختيار الحالي
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [branchDrawerAreaId, setBranchDrawerAreaId] = useState<string | null>(null)
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(2026) // السنة الحالية 2026 افتراضياً

  // النوافذ المنبثقة
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [showEditModal, setShowEditModal] = useState<boolean>(false)
  const [showContactModal, setShowContactModal] = useState<boolean>(false)
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false)
  const [settingsTab, setSettingsTab] = useState<'collector' | 'pricing' | 'areas' | 'import'>('collector')
  const [isLocating, setIsLocating] = useState<boolean>(false)

  // فورم المشترك
  const [newSub, setNewSub] = useState({
    idStr: '',
    name: '',
    areaId: '',
    branchId: '',
    phone: '',
    propertyType: 'سكني' as PropertyType,
    meterType: '4 متر' as MeterType,
    statuses: [] as string[]
  })
  const [editSub, setEditSub] = useState<Partial<Subscriber>>({})
  const [formError, setFormError] = useState<string>('')

  // إدارة المناطق والتسعير
  const [newAreaName, setNewAreaName] = useState<string>('')
  const [newBranchName, setNewBranchName] = useState<string>('')
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editingAreaName, setEditingAreaName] = useState<string>('')
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editingBranchName, setEditingBranchName] = useState<string>('')
  const [editingPricingKey, setEditingPricingKey] = useState<string | null>(null)
  const [editingPricingVal, setEditingPricingVal] = useState<string>('')

  // الاستيراد
  const [importText, setImportText] = useState<string>('')
  const [parsedImport, setParsedImport] = useState<ParsedImportItem[]>([])
  const [importDefaultArea, setImportDefaultArea] = useState<string>('')
  const [importError, setImportError] = useState<string>('')
  const [importDuplicates, setImportDuplicates] = useState<number>(0)
  const [importOverwrite, setImportOverwrite] = useState<boolean>(false)

  // تعديل الدفعات اللحظي
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({})

  // مراجع السحب
  const swipeStartX = useRef<number>(0)
  const swipeStartY = useRef<number>(0)
  const swipeSubId = useRef<number | null>(null)

  // حالة المزامنة السحابية
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(true)
  const [dataLoaded, setDataLoaded] = useState<boolean>(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // الشهر الحالي 0-5
  const currentPeriodIndex = useMemo(() => {
    const month = new Date().getMonth() // 0-11
    return Math.floor(month / 2) // 0-5
  }, [])

  // فحص تسجيل الدخول عند البدء
  useEffect(() => {
    const auth = localStorage.getItem(AUTH_STORAGE_KEY)
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [])

  // تحميل البيانات: سوبابيس أولاً ثم localStorage كاحتياط
  useEffect(() => {
    const applyData = (data: Record<string, unknown>) => {
      if (data.areas) setAreas(data.areas as Area[])
      if (data.pricing) setPricing(data.pricing as Pricing)
      if (data.subscribers) setSubscribers(data.subscribers as Subscriber[])
      if (data.billing) setBilling(data.billing as BillingRecords)
      if (data.collectorName) setCollectorName(data.collectorName as string)
      if (data.collectorPhone) setCollectorPhone(data.collectorPhone as string)
      if (data.rangeFrom !== undefined) setRangeFrom(data.rangeFrom as number)
      if (data.rangeTo !== undefined) setRangeTo(data.rangeTo as number)
    }

    const init = async () => {
      setIsLoadingCloud(true)
      // محاولة الجلب من السحابة
      const cloudData = await loadFromCloud()
      if (cloudData) {
        applyData(cloudData)
        // حفظ نسخة محلية كاحتياط
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData)) } catch {}
      } else {
        // الاحتياط: من localStorage
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) applyData(JSON.parse(saved))
        } catch {}
      }
      setIsLoadingCloud(false)
      setDataLoaded(true)
    }
    init()
  }, [])

  // المزامنة اللحظية الحية الفورية (Realtime Broadcast + Database Changes)
  const isIncomingSyncRef = useRef<boolean>(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!dataLoaded) return

    const applyIncomingData = (data: Record<string, unknown>) => {
      isIncomingSyncRef.current = true
      if (data.areas) setAreas(data.areas as Area[])
      if (data.pricing) setPricing(data.pricing as Pricing)
      if (data.subscribers) setSubscribers(data.subscribers as Subscriber[])
      if (data.billing) setBilling(data.billing as BillingRecords)
      if (data.collectorName) setCollectorName(data.collectorName as string)
      if (data.collectorPhone) setCollectorPhone(data.collectorPhone as string)
      if (data.rangeFrom !== undefined) setRangeFrom(data.rangeFrom as number)
      if (data.rangeTo !== undefined) setRangeTo(data.rangeTo as number)
      setTimeout(() => { isIncomingSyncRef.current = false }, 100)
    }

    const channel = supabase.channel('app_sync_realtime_broadcast', {
      config: { broadcast: { self: false } }
    })

    channel
      .on('broadcast', { event: 'instant_sync' }, ({ payload }) => {
        if (payload) applyIncomingData(payload as Record<string, unknown>)
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_sync', filter: `key=eq.${SYNC_ROW_KEY}` },
        (payload) => {
          if (payload.new && (payload.new as { value?: Record<string, unknown> }).value) {
            applyIncomingData((payload.new as { value: Record<string, unknown> }).value)
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [dataLoaded])

  // الحفظ التلقائي المحلي + البث اللحظي السريع + الحفظ السحابي
  useEffect(() => {
    if (!dataLoaded) return
    if (isIncomingSyncRef.current) return

    const data = { areas, pricing, subscribers, billing, collectorName, collectorPhone, rangeFrom, rangeTo }

    // 1. حفظ محلي فوري
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}

    // 2. بث مباشر فوري لحظي للأجهزة الأخرى كدام العين (أقل من 50 ميلي ثانية)
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'instant_sync',
        payload: data
      })
    }

    // 3. حفظ سحابي دائم بدليل سوبابيس (خلال 500 ميلي ثانية)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setIsSyncing(true)
    saveTimerRef.current = setTimeout(async () => {
      await saveToCloud(data as Record<string, unknown>)
      setIsSyncing(false)
    }, 500)
  }, [areas, pricing, subscribers, billing, collectorName, collectorPhone, rangeFrom, rangeTo, dataLoaded])

  // تسجيل الدخول
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (pinInput.trim() === REQUIRED_PIN) {
      setIsAuthenticated(true)
      localStorage.setItem(AUTH_STORAGE_KEY, 'true')
      setPinError('')
    } else {
      setPinError('رمز الدخول غير صحيح، يرجى المحاولة مجدداً')
    }
  }

  const handleLogout = () => {
    setIsAuthenticated(false)
    localStorage.removeItem(AUTH_STORAGE_KEY)
    setPinInput('')
  }

  // حساب دين المشترك للفترة الحالية في 2026
  const getSubscriberCurrentDue = useCallback(
    (subId: number) => {
      try {
        const b = calculateBilling(subId, 2026, billing, subscribers, pricing)
        if (b.rows.length > currentPeriodIndex) {
          return b.rows[currentPeriodIndex].remaining
        }
        return b.totalRemaining
      } catch {
        return 0
      }
    },
    [billing, subscribers, pricing, currentPeriodIndex]
  )

  // المشتركون ضمن نطاق المحصل
  const subscribersInRange = useMemo(() => {
    return subscribers.filter((s) => s.id >= rangeFrom && s.id <= rangeTo)
  }, [subscribers, rangeFrom, rangeTo])

  // فلترة المشتركين حسب النوع
  const typeFiltered = useMemo(() => {
    const both = filterTypes.سكني && filterTypes.تجاري
    const none = !filterTypes.سكني && !filterTypes.تجاري
    if (both || none) return subscribersInRange
    if (filterTypes.سكني) return subscribersInRange.filter((s) => s.propertyType === 'سكني')
    return subscribersInRange.filter((s) => s.propertyType === 'تجاري')
  }, [subscribersInRange, filterTypes])

  // عدد المشتركين لكل منطقة بناءً على نوع العقار المختار
  const areaCounts = useMemo(() => {
    const map = new Map<string, number>()
    areas.forEach((a) => map.set(a.id, 0))
    typeFiltered.forEach((s) => {
      map.set(s.areaId, (map.get(s.areaId) || 0) + 1)
    })
    return map
  }, [typeFiltered, areas])

  // فلترة حسب المناطق المختارة
  const areaFiltered = useMemo(() => {
    if (filterAreas.length === 0) return typeFiltered
    return typeFiltered.filter((s) => filterAreas.includes(s.areaId))
  }, [typeFiltered, filterAreas])

  // عدد المشتركين لكل فرع بناءً على المناطق المختارة
  const branchCounts = useMemo(() => {
    const map = new Map<string, number>()
    areas.forEach((a) => a.branches.forEach((b) => map.set(b.id, 0)))
    areaFiltered.forEach((s) => {
      map.set(s.branchId, (map.get(s.branchId) || 0) + 1)
    })
    return map
  }, [areaFiltered, areas])

  // فلترة حسب الأفرع المختارة
  const branchFiltered = useMemo(() => {
    if (filterBranches.length === 0) return areaFiltered
    return areaFiltered.filter((s) => filterBranches.includes(s.branchId))
  }, [areaFiltered, filterBranches])

  // عدد المشتركين لكل حالة
  const statusCounts = useMemo(() => {
    const map = new Map<string, number>()
    STATUS_OPTIONS.forEach((st) => map.set(st, 0))
    branchFiltered.forEach((s) => {
      ;(s.statuses || []).forEach((st) => {
        if (map.has(st)) map.set(st, (map.get(st) || 0) + 1)
      })
    })
    return map
  }, [branchFiltered])

  // عدد المتطابقين في الفلتر التفاعلي
  const matchingFilterCount = useMemo(() => {
    let list = branchFiltered
    if (filterStatuses.length > 0) {
      const showVacant = filterStatuses.includes('__vacant__')
      const realStatuses = filterStatuses.filter((s) => s !== '__vacant__')
      list = list.filter((s) => {
        if (showVacant && s.name === 'رقم شاغر') return true
        if (realStatuses.length > 0 && (s.statuses || []).some((st) => realStatuses.includes(st))) return true
        return false
      })
    }
    return list.length
  }, [branchFiltered, filterStatuses])

  // عدد الفلاتر النشطة
  const activeFiltersBadge = useMemo(() => {
    let count = 0
    if (filterTypes.سكني !== filterTypes.تجاري) count++
    if (filterAreas.length > 0) count++
    if (filterBranches.length > 0) count++
    if (filterStatuses.length > 0) count++
    return count
  }, [filterTypes, filterAreas, filterBranches, filterStatuses])

  // القائمة المعروضة في الصفحة الرئيسية
  const displayedSubscribers = useMemo(() => {
    let list = subscribersInRange

    // البحث مع الترتيب حسب الاسم الأول فالثاني فالثالث
    const q = searchQuery.trim()
    if (q) {
      list = list.filter(
        (s) =>
          String(s.id).includes(q) ||
          s.name.includes(q) ||
          s.phone.includes(q)
      )
      list = [...list].sort((a, b) => {
        const rankA = searchRank(a.name, q)
        const rankB = searchRank(b.name, q)
        if (rankA !== rankB) return rankA - rankB
        return a.id - b.id
      })
    }

    // فلتر النوع
    if (filterTypes.سكني !== filterTypes.تجاري) {
      if (filterTypes.سكني) list = list.filter((s) => s.propertyType === 'سكني')
      else list = list.filter((s) => s.propertyType === 'تجاري')
    }

    // المنطقة المحددة من التبويبات العلوية أو الفلتر
    if (selectedAreaId) {
      list = list.filter((s) => s.areaId === selectedAreaId)
      if (activeBranchId) {
        list = list.filter((s) => s.branchId === activeBranchId)
      } else if (filterBranches.length > 0) {
        list = list.filter((s) => filterBranches.includes(s.branchId))
      }
    } else {
      if (filterAreas.length > 0) list = list.filter((s) => filterAreas.includes(s.areaId))
      if (filterBranches.length > 0) list = list.filter((s) => filterBranches.includes(s.branchId))
    }

    // فلتر الحالات (يدعم __vacant__ للأرقام الشاغرة)
    if (filterStatuses.length > 0) {
      const showVacant = filterStatuses.includes('__vacant__')
      const realStatuses = filterStatuses.filter((s) => s !== '__vacant__')
      list = list.filter((s) => {
        if (showVacant && s.name === 'رقم شاغر') return true
        if (realStatuses.length > 0 && (s.statuses || []).some((st) => realStatuses.includes(st))) return true
        return false
      })
    }

    return list
  }, [
    subscribersInRange,
    searchQuery,
    filterTypes,
    selectedAreaId,
    activeBranchId,
    filterAreas,
    filterBranches,
    filterStatuses
  ])

  // مسح الفلاتر
  const clearAllFilters = () => {
    setFilterTypes({ سكني: true, تجاري: true })
    setFilterAreas([])
    setFilterBranches([])
    setFilterStatuses([])
    setOpenFilterAreaId(null)
    setFilterPanel(null)
    setFilterAreaSearch('')
    setFilterBranchSearch('')
  }

  // حفظ تعديل في جدول الديون
  const handlePaymentEdit = (subId: number, year: number, periodIdx: number, field: 'old' | 'paid' | 'rem', value: string) => {
    const cleanVal = value.replace(/[^0-9\-]/g, '')
    const num = cleanVal === '' || cleanVal === '-' ? 0 : Number(cleanVal)

    setBilling((prev) => {
      const copy = { ...prev }
      if (!copy[subId]) copy[subId] = {}
      if (!copy[subId][year]) {
        copy[subId][year] = PERIODS.map(() => ({ oldDebtManual: null, paid: 0 }))
      }
      const yearRecords = [...copy[subId][year]]

      if (field === 'old') {
        yearRecords[periodIdx] = {
          ...yearRecords[periodIdx],
          oldDebtManual: cleanVal === '' ? null : num
        }
      } else if (field === 'paid') {
        yearRecords[periodIdx] = {
          ...yearRecords[periodIdx],
          paid: num
        }
      } else if (field === 'rem') {
        // عند تغيير المتبقي نحسب المدفوع = القديم + المستحق - المتبقي
        const currentBilling = calculateBilling(subId, year, copy, subscribers, pricing)
        const row = currentBilling.rows[periodIdx]
        if (row) {
          const calculatedPaid = row.old + row.due - num
          yearRecords[periodIdx] = {
            ...yearRecords[periodIdx],
            paid: calculatedPaid
          }
        }
      }

      copy[subId][year] = yearRecords
      return copy
    })

    const key = `${subId}_${year}_${periodIdx}_${field}`
    setPendingEdits((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  // إضافة مشترك
  const handleAddSubscriberSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const id = Number(newSub.idStr.replace(/[^0-9]/g, ''))
    if (!newSub.idStr.trim() || isNaN(id) || id <= 0) {
      setFormError('رقم المشترك إجباري ويجب أن يكون رقماً صحيحاً')
      return
    }
    if (subscribers.some((s) => s.id === id)) {
      setFormError(`رقم المشترك ${formatNumber(id)} موجود مسبقاً!`)
      return
    }
    if (!newSub.name.trim() || newSub.name.trim().length < 2) {
      setFormError('اسم المشترك إجباري')
      return
    }
    if (!newSub.areaId) {
      setFormError('يرجى اختيار المنطقة')
      return
    }

    const area = areas.find((a) => a.id === newSub.areaId)
    const branchId = newSub.branchId || area?.branches[0]?.id || ''
    const maxOrder = subscribers.reduce((acc, curr) => Math.max(acc, curr.order), 0)

    const created: Subscriber = {
      id,
      name: newSub.name.trim(),
      phone: newSub.phone.trim(),
      areaId: newSub.areaId,
      branchId,
      propertyType: newSub.propertyType,
      meterType: newSub.meterType,
      detailedAddress: `قرب ${area?.name || ''}`,
      order: maxOrder + 1,
      statuses: newSub.statuses
    }

    setSubscribers((prev) => [...prev, created])

    // إنشاء سجلات الديون للسنوات 2026، 2027، 2028
    setBilling((prev) => {
      const copy = { ...prev }
      copy[id] = {}
      YEARS.forEach((y) => {
        copy[id][y] = PERIODS.map(() => ({ oldDebtManual: null, paid: 0 }))
      })
      return copy
    })

    setShowAddModal(false)
    setNewSub({
      idStr: '',
      name: '',
      areaId: areas[0]?.id || '',
      branchId: areas[0]?.branches[0]?.id || '',
      phone: '',
      propertyType: 'سكني',
      meterType: '4 متر',
      statuses: []
    })
  }

  // حفظ تعديل مشترك
  const handleEditSubscriberSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSub.id) return

    setSubscribers((prev) =>
      prev.map((s) => (s.id === editSub.id ? { ...s, ...editSub } as Subscriber : s))
    )
    setShowEditModal(false)
  }

  // أخذ الموقع الحالي وحفظه في حساب المشترك
  const handleUploadLocation = (subId: number) => {
    if (!navigator.geolocation) {
      alert('عذراً، متصفحك أو جهازك لا يدعم تحديد الموقع الجغرافي')
      return
    }

    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        const link = `https://www.google.com/maps?q=${lat},${lng}`
        const newLoc = { lat, lng, link }

        setSubscribers((prev) =>
          prev.map((s) => (s.id === subId ? { ...s, location: newLoc } : s))
        )
        setIsLocating(false)
        alert('تم حفظ الموقع الجغرافي للمشترك بنجاح!')
      },
      (error) => {
        setIsLocating(false)
        let msg = 'تعذر الحصول على موقعك الحالي'
        if (error.code === 1) {
          msg = 'يرجى السماح للتطبيق بالوصول إلى الموقع الجغرافي من إعدادات المتصفح'
        } else if (error.code === 2) {
          msg = 'تعذر التقاط إشارة الموقع الجغرافي، يرجى تفعيل الـ GPS في جهازك'
        } else if (error.code === 3) {
          msg = 'استغرق تحديد الموقع وقتاً طويلاً، يرجى إعادة المحاولة'
        }
        alert(msg)
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0
      }
    )
  }

  // استيراد نص
  const handleParseImport = (text: string) => {
    setImportError('')
    if (!text.trim()) {
      setParsedImport([])
      setImportDuplicates(0)
      return
    }

    const lines = text.split(/\r?\n/)
    const seen = new Set<number>()
    let dupCount = 0
    const items: ParsedImportItem[] = []

    // حالات مقبولة شاملة
    const ACCEPTED_STATUSES = [...STATUS_OPTIONS, 'متوقف', 'ملغي'] as string[]

    for (const rawLine of lines) {
      const line = rawLine.trim().replace(/^[-•*]\s*/, '')
      if (!line) continue

      const match = line.match(/^(\d{1,7})\s*[\t\s]+(.+)$/) || line.match(/^(\d{1,7})\s*[,\-–]\s*(.+)$/) || line.match(/^(\d{1,7})\s+(.+)$/)

      // رقم فقط بدون اسم
      const soloMatch = !match && line.match(/^(\d{1,7})\s*$/)

      if (soloMatch) {
        const id = Number(soloMatch[1])
        if (!id) continue
        if (seen.has(id)) { dupCount++; continue }
        seen.add(id)
        items.push({ id, name: 'رقم شاغر', raw: line, statuses: [] })
        continue
      }

      if (!match) continue

      const id = Number(match[1])
      if (!id) continue

      if (seen.has(id)) {
        dupCount++
        continue
      }
      seen.add(id)

      const rest = match[2].trim()
      let name = rest
      let note: string | undefined = undefined
      const statuses: string[] = []

      if (rest.includes('/')) {
        const parts = rest.split('/')
        name = parts[0].trim()
        note = parts.slice(1).join(' / ').trim()
        if (note) {
          const matchedStatus = ACCEPTED_STATUSES.find((st) => note?.includes(st))
          if (matchedStatus) {
            statuses.push(matchedStatus)
          } else {
            name = `${name} (${note})`
          }
        }
      }

      // رقم شاغر إذا كان الاسم فارغ أو رقم فقط
      if (!name.trim() || name.trim().length < 1) {
        name = 'رقم شاغر'
      }

      items.push({ id, name, raw: line, statuses, note })
    }

    setImportDuplicates(dupCount)
    if (items.length === 0) {
      setImportError('لم يتم التعرف على البيانات. تأكد من الصيغة: رقم اسم المشترك / ملاحظة')
    }
    setParsedImport(items)
  }

  const handleConfirmImport = () => {
    if (parsedImport.length === 0) return
    // المنطقة اختيارية - إذا لم تُختر تُترك فارغة
    const defaultAreaId = importDefaultArea || ''
    const defaultBranchId = defaultAreaId ? (areas.find((a) => a.id === defaultAreaId)?.branches[0]?.id || '') : ''

    const existingIds = new Set(subscribers.map((s) => s.id))
    let added = 0
    let updated = 0
    let skipped = 0
    const toAdd: Subscriber[] = []
    let curOrder = subscribers.reduce((m, s) => Math.max(m, s.order), 0)

    parsedImport.forEach((item) => {
      if (existingIds.has(item.id)) {
        if (importOverwrite) {
          updated++
          setSubscribers((prev) =>
            prev.map((s) =>
              s.id === item.id
                ? {
                    ...s,
                    name: item.name,
                    statuses: item.statuses.length ? item.statuses : s.statuses
                  }
                : s
            )
          )
        } else {
          skipped++
        }
      } else {
        added++
        curOrder++
        toAdd.push({
          id: item.id,
          name: item.name,
          phone: '',
          areaId: defaultAreaId,
          branchId: defaultBranchId,
          propertyType: 'سكني',
          meterType: '4 متر',
          detailedAddress: `قرب ${areas.find((a) => a.id === defaultAreaId)?.name || ''}`,
          order: curOrder,
          statuses: item.statuses
        })
      }
    })

    if (toAdd.length > 0) {
      setSubscribers((prev) => [...prev, ...toAdd])
      setBilling((prev) => {
        const copy = { ...prev }
        toAdd.forEach((s) => {
          copy[s.id] = {}
          YEARS.forEach((y) => {
            copy[s.id][y] = PERIODS.map(() => ({ oldDebtManual: null, paid: 0 }))
          })
        })
        return copy
      })
    }

    alert(`تم الاستيراد بنجاح: ${added} جديد، ${updated} تم تحديثه، ${skipped} موجود مسبقاً، ${importDuplicates} مكرر بالملف`)
    setImportText('')
    setParsedImport([])
    setImportDuplicates(0)
  }

  // سحب المشترك لليسار لفتح التعديل
  const handleTouchStart = (e: React.TouchEvent, subId: number) => {
    swipeStartX.current = e.touches[0].clientX
    swipeStartY.current = e.touches[0].clientY
    swipeSubId.current = subId
  }

  const handleTouchEnd = (e: React.TouchEvent, sub: Subscriber) => {
    if (swipeSubId.current !== sub.id) return
    const diffX = e.changedTouches[0].clientX - swipeStartX.current
    const diffY = Math.abs(e.changedTouches[0].clientY - swipeStartY.current)
    if (diffY < 70 && diffX < -70) {
      setEditSub({ ...sub })
      setShowEditModal(true)
    }
  }

  const handleMouseDown = (e: React.MouseEvent, subId: number) => {
    swipeStartX.current = e.clientX
    swipeStartY.current = e.clientY
    swipeSubId.current = subId
  }

  const handleMouseUp = (e: React.MouseEvent, sub: Subscriber) => {
    if (swipeSubId.current !== sub.id) return
    const diffX = e.clientX - swipeStartX.current
    const diffY = Math.abs(e.clientY - swipeStartY.current)
    if (diffY < 70 && diffX < -70) {
      setEditSub({ ...sub })
      setShowEditModal(true)
    }
  }

  const activeSubscriber = useMemo(
    () => subscribers.find((s) => s.id === selectedSubId) || null,
    [subscribers, selectedSubId]
  )

  const activeBilling = useMemo(() => {
    if (!selectedSubId) return null
    return calculateBilling(selectedSubId, selectedYear, billing, subscribers, pricing)
  }, [selectedSubId, selectedYear, billing, subscribers, pricing])

  // ==========================
  // شاشة تسجيل الدخول الرسمية والاحترافية
  // ==========================
  if (!isAuthenticated) {
    return (
      <div
        dir="rtl"
        className="min-h-screen relative flex items-center justify-center bg-slate-900 px-4 py-8 select-none"
        style={{ fontFamily: 'Tajawal, Inter, system-ui, sans-serif' }}
      >
        {/* خلفية بتدرج أزرق كحلي هادئ وإضاءة خافتة راقية بدون أي إيموجيز أو قطرات مزعجة */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-sky-600/15 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-slate-800/40 blur-[100px] rounded-full"></div>
        </div>

        {/* بطاقة تسجيل الدخول الرسمية المتناسقة */}
        <div className="relative z-10 bg-white border border-slate-200 rounded-2xl p-6 sm:p-7 max-w-[380px] w-full shadow-2xl">
          {/* الشعار المائي الرسمي كـ SVG */}
          <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4 shadow-md">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" className="text-sky-400" />
            </svg>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-[18px] font-bold text-slate-900 tracking-tight">نظام اشتراكات الماء</h2>
            <p className="text-[12px] text-slate-500 mt-1">يرجى إدخال رمز الدخول للمتابعة</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-700 block mb-1.5 text-right">
                رمز الدخول
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value)
                  if (pinError) setPinError('')
                }}
                placeholder="أدخل رمز الدخول..."
                className={`w-full h-12 px-4 border rounded-xl text-[14px] text-center font-mono tracking-wider focus:outline-none transition-all ${
                  pinError
                    ? 'border-red-400 bg-red-50 text-red-700 focus:ring-1 focus:ring-red-200 animate-shake'
                    : 'border-slate-300 bg-white focus:border-slate-900 focus:ring-1 focus:ring-slate-900 text-slate-900'
                }`}
                autoFocus
              />
            </div>

            {pinError && (
              <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded-xl p-2.5 text-center font-medium animate-shake">
                {pinError}
              </div>
            )}

            <button
              type="submit"
              className="w-full h-12 bg-slate-900 hover:bg-black text-white rounded-xl text-[13px] font-bold transition-all shadow-sm hover:shadow-md flex items-center justify-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>تسجيل الدخول</span>
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              النظام متصل
            </span>
            <span>بوابة المحصلين المعتمدة</span>
          </div>
        </div>
      </div>
    )
  }

  // ==========================
  // واجهة التطبيق الرئيسية
  // ==========================
  return (
    <div
      dir="rtl"
      className="min-h-screen text-slate-800 bg-[#f0f9ff]"
      style={{ fontFamily: 'Tajawal, Inter, system-ui, -apple-system, sans-serif' }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* الهيدر الرئيسي - الحفاظ على شكل ومقاس الأزرار 100% */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-sky-100">
        <div className="max-w-[1100px] mx-auto px-4 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L4 9v6l8 6 8-6V9l-8-6z" fill="white" opacity="0.9" />
              </svg>
            </div>
            <h1 className="text-[15px] font-bold tracking-tight text-slate-900">نظام الاشتراكات</h1>
            {/* مؤشر المزامنة السحابية */}
            {isSyncing ? (
              <span className="flex items-center gap-1 text-[10px] text-sky-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                حفظ...
              </span>
            ) : isLoadingCloud ? (
              <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse"></span>
                تحميل...
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                متزامن
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* زر البحث */}
            <button
              type="button"
              aria-label="بحث"
              onClick={() => {
                setSearchOpen((p) => !p)
                if (!searchOpen) setFilterDrawerOpen(false)
              }}
              className={`depth-button w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                searchOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-sky-100 text-slate-600 hover:bg-sky-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="11" cy="11" r="6" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </button>

            {/* زر الفلتر */}
            <button
              type="button"
              aria-label="فلتر"
              onClick={() => {
                setFilterDrawerOpen((p) => !p)
                if (!filterDrawerOpen) setSearchOpen(false)
              }}
              className={`depth-button relative w-8 h-8 rounded-xl border flex items-center justify-center transition-all ${
                filterDrawerOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M3 6h18M7 12h10M10 18h4" />
              </svg>
              {activeFiltersBadge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
                  {formatNumber(activeFiltersBadge)}
                </span>
              )}
            </button>

            {/* زر الإعدادات - يبقى 100% بنفس شكله ومقاسه */}
            <button
              type="button"
              aria-label="الاعدادات"
              onClick={() => {
                setShowSettingsModal((p) => !p)
                setSettingsTab('collector')
                setSearchOpen(false)
                setFilterDrawerOpen(false)
              }}
              className={`depth-button w-8 h-8 border rounded-lg flex items-center justify-center transition-colors ${
                showSettingsModal ? 'bg-[#0e7490] text-white border-[#0e7490]' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
              </svg>
            </button>
          </div>
        </div>

        {/* شريط البحث المنسدل */}
        {searchOpen && (
          <div className="depth-panel border-t border-sky-100 bg-white/90 backdrop-blur">
            <div className="max-w-[1100px] mx-auto px-4 py-3">
              <div className="relative">
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث برقم المشترك او الاسم او الهاتف..."
                  className="w-full h-11 pr-4 pl-10 border border-sky-100 rounded-2xl text-[13px] focus:outline-none focus:border-slate-900 bg-sky-50/50 focus:bg-white transition-colors"
                  autoFocus
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="11" cy="11" r="6" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* درج الفلتر التفاعلي المتسلسل */}
        {filterDrawerOpen && (
          <div className="depth-panel border-t border-sky-100 bg-white/95 backdrop-blur-xl shadow-[0_12px_24px_rgba(0,0,0,0.06)]">
            <div className="max-w-[1100px] mx-auto px-4 py-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13px] font-bold text-slate-900">الفلاتر المتقدمة</h3>
                  {activeFiltersBadge > 0 && (
                    <span className="text-[10px] bg-slate-900 text-white rounded-full px-2.5 py-0.5 font-mono">
                      {formatNumber(activeFiltersBadge)} نشط
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={clearAllFilters}
                    className="h-8 px-4 rounded-full border border-sky-100 bg-sky-50 text-[11px] font-bold text-slate-700 hover:bg-white"
                  >
                    مسح الكل
                  </button>
                  <button
                    onClick={() => setFilterDrawerOpen(false)}
                    className="w-8 h-8 rounded-xl border border-sky-100 bg-white flex items-center justify-center text-slate-500"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                {([
                  ['type', 'نوع العقار'],
                  ['areas', 'المناطق والأفرع'],
                  ['statuses', 'حالات المشترك']
                ] as const).map(([panel, label]) => (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => setFilterPanel((current) => (current === panel ? null : panel))}
                    className={`h-10 rounded-xl border text-[11px] font-bold transition-colors ${
                      filterPanel === panel
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-sky-50/60 border-sky-100 text-slate-700 hover:bg-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* محتوى الفلتر يظهر بعد اختيار الزر */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. النوع */}
                {filterPanel === 'type' && <div className="border border-sky-100 rounded-2xl p-3 bg-sky-50/40">
                  <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1 h-4 rounded-full bg-slate-900"></span> النوع
                    </span>
                    <span className="text-[9px] bg-white border border-sky-100 rounded-full px-2 py-0.5 text-slate-500">
                      الخطوة 1
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(['سكني', 'تجاري'] as const).map((type) => {
                      const count = subscribersInRange.filter((s) => s.propertyType === type).length
                      const isChecked = filterTypes[type]
                      return (
                        <label
                          key={type}
                          className={`flex items-center gap-2.5 h-11 px-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                              : 'bg-white/60 border-sky-100 text-slate-500 hover:bg-white'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => setFilterTypes((p) => ({ ...p, [type]: e.target.checked }))}
                            className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                          />
                          <span className="text-[12px] font-medium flex-1">{type}</span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-bold ${
                              isChecked ? 'bg-white/20 text-white' : 'bg-sky-50 border border-sky-100 text-slate-600'
                            }`}
                          >
                            {formatNumber(count)}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>}

                {/* 2. المناطق */}
                {filterPanel === 'areas' && <div className="border border-sky-100 rounded-2xl p-3 bg-white flex flex-col">
                  <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1 h-4 rounded-full bg-sky-500"></span> المناطق
                    </span>
                    <span className="text-[9px] bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5 text-slate-500">
                      الخطوة 2
                    </span>
                  </div>
                  <div className="relative mb-2.5">
                    <input
                      value={filterAreaSearch}
                      onChange={(e) => setFilterAreaSearch(e.target.value)}
                      placeholder="بحث في المناطق..."
                      className="w-full h-8 pr-3 pl-8 border border-sky-100 rounded-xl text-[11px] bg-sky-50/40 focus:bg-white focus:outline-none focus:border-slate-900"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">⌕</span>
                  </div>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {areas
                      .filter((a) => filterAreaSearch.trim() === '' || a.name.includes(filterAreaSearch.trim()))
                      .map((area) => {
                        const count = areaCounts.get(area.id) || 0
                        const isChecked = filterAreas.includes(area.id)
                        const disabled = count === 0 && !isChecked
                        return (
                          <label
                            key={area.id}
                            className={`flex items-center gap-2.5 h-9 px-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-slate-900 text-white border-slate-900'
                                : disabled
                                ? 'bg-zinc-50 border-zinc-100 text-zinc-400'
                                : 'bg-sky-50/60 border-sky-100 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) setFilterAreas((p) => [...p, area.id])
                                else {
                                  setFilterAreas((p) => p.filter((x) => x !== area.id))
                                  setFilterBranches((p) => p.filter((branchId) => !area.branches.some((b) => b.id === branchId)))
                                }
                                setOpenFilterAreaId(e.target.checked ? area.id : null)
                              }}
                              className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                            />
                            <span className="text-[12px] font-medium flex-1 truncate">{area.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                                isChecked ? 'bg-white/20' : 'bg-white border border-sky-100'
                              }`}
                            >
                              {formatNumber(count)}
                            </span>
                          </label>
                        )
                      })}
                  </div>
                </div>}

                {/* 3. الأفرع: تظهر بعد النقر على منطقة */}
                {filterPanel === 'areas' && <div className="border border-sky-100 rounded-2xl p-3 bg-white flex flex-col">
                  <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1 h-4 rounded-full bg-slate-900"></span> الأفرع
                    </span>
                    <span className="text-[9px] bg-sky-50 border border-sky-100 rounded-full px-2 py-0.5 text-slate-700">
                      الخطوة 3
                    </span>
                  </div>
                  {openFilterAreaId ? (
                    <>
                      <div className="text-[10px] text-slate-500 mb-2">
                        أفرع {areas.find((a) => a.id === openFilterAreaId)?.name}
                      </div>
                      <div className="relative mb-2.5">
                        <input
                          value={filterBranchSearch}
                          onChange={(e) => setFilterBranchSearch(e.target.value)}
                          placeholder="بحث في الأفرع..."
                          className="w-full h-8 pr-3 pl-8 border border-sky-100 rounded-xl text-[11px] bg-sky-50/40 focus:bg-white focus:outline-none focus:border-slate-900"
                        />
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[12px]">⌕</span>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl bg-sky-50/60 border border-dashed border-sky-100 p-4 text-center text-[11px] text-slate-500">
                      انقر على منطقة لإظهار أفرعها
                    </div>
                  )}
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {(openFilterAreaId ? areas.filter((a) => a.id === openFilterAreaId) : [])
                      .flatMap((a) => a.branches.map((b) => ({ ...b, areaId: a.id, areaName: a.name })))
                      .filter(
                        (b) =>
                          filterBranchSearch.trim() === '' ||
                          b.name.includes(filterBranchSearch.trim()) ||
                          b.areaName.includes(filterBranchSearch.trim())
                      )
                      .map((branch) => {
                        const count = branchCounts.get(branch.id) || 0
                        const isChecked = filterBranches.includes(branch.id)
                        const disabled = count === 0 && !isChecked
                        return (
                          <label
                            key={branch.id}
                            className={`flex items-center gap-2.5 h-9 px-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-slate-900 text-white border-slate-900'
                                : disabled
                                ? 'bg-zinc-50 border-zinc-100 text-zinc-400'
                                : 'bg-sky-50/60 border-sky-100 text-slate-700 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              disabled={disabled}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFilterBranches((p) => [...p, branch.id])
                                  if (!filterAreas.includes(branch.areaId)) {
                                    setFilterAreas((p) => [...p, branch.areaId])
                                  }
                                } else {
                                  setFilterBranches((p) => p.filter((x) => x !== branch.id))
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                            />
                            <span className="text-[11px] font-medium flex-1 truncate">{branch.name}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                                isChecked ? 'bg-white/20' : 'bg-white border border-sky-100'
                              }`}
                            >
                              {formatNumber(count)}
                            </span>
                          </label>
                        )
                      })}
                  </div>
                </div>}

                {/* 4. الحالات المتعددة */}
                {filterPanel === 'statuses' && <div className="border border-sky-100 rounded-2xl p-3 bg-white flex flex-col">
                  <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1 h-4 rounded-full bg-violet-500"></span> حالات المشترك
                    </span>
                    <span className="text-[9px] bg-violet-50 border border-violet-100 rounded-full px-2 py-0.5 text-violet-700">
                      الخطوة 4
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
                    {STATUS_OPTIONS.map((st) => {
                      const count = statusCounts.get(st) || 0
                      const isChecked = filterStatuses.includes(st)
                      const cfg = STATUS_CONFIG[st]
                      return (
                        <label
                          key={st}
                          className={`flex items-center gap-2.5 h-9 px-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white border-sky-100 text-slate-700 hover:bg-sky-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setFilterStatuses((p) => [...p, st])
                              else setFilterStatuses((p) => p.filter((x) => x !== st))
                            }}
                            className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                          />
                          <span className={`w-2 h-2 rounded-full ${cfg.dot}`}></span>
                          <span className="text-[11px] font-medium flex-1 truncate">{st}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                              isChecked ? 'bg-white/20' : 'bg-violet-50 border border-violet-100 text-violet-700'
                            }`}
                          >
                            {formatNumber(count)}
                          </span>
                        </label>
                      )
                    })}

                    {/* خيار الأرقام الشاغرة */}
                    {(() => {
                      const vacantCount = branchFiltered.filter((s) => s.name === 'رقم شاغر').length
                      const isChecked = filterStatuses.includes('__vacant__')
                      return (
                        <label
                          className={`flex items-center gap-2.5 h-9 px-3 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white border-sky-100 text-slate-700 hover:bg-sky-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) setFilterStatuses((p) => [...p, '__vacant__'])
                              else setFilterStatuses((p) => p.filter((x) => x !== '__vacant__'))
                            }}
                            className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                          />
                          <span className="w-2 h-2 rounded-full bg-zinc-400"></span>
                          <span className="text-[11px] font-medium flex-1 truncate">أرقام شاغرة</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                              isChecked ? 'bg-white/20' : 'bg-zinc-50 border border-zinc-200 text-zinc-600'
                            }`}
                          >
                            {formatNumber(vacantCount)}
                          </span>
                        </label>
                      )
                    })()}
                  </div>
                </div>}
              </div>

              {/* أسفل الدرج: يوجد X مشترك يطابق الفلتر */}
              <div className="mt-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between bg-slate-900 rounded-2xl px-4 py-3 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[14px]">◉</div>
                  <div>
                    <div className="text-[12px] font-bold">يوجد {formatNumber(matchingFilterCount)} مشترك يطابق الفلتر</div>
                    <div className="text-[10px] text-white/60 mt-0.5">
                      {filterAreas.length > 0 && `${formatNumber(filterAreas.length)} مناطق • `}
                      {filterBranches.length > 0 && `${formatNumber(filterBranches.length)} أفرع • `}
                      {formatNumber(subscribersInRange.length)} الكل
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setFilterDrawerOpen(false)}
                    className="flex-1 sm:flex-none h-9 px-6 rounded-xl bg-white text-slate-900 text-[12px] font-bold hover:bg-sky-50"
                  >
                    تطبيق ({formatNumber(matchingFilterCount)})
                  </button>
                  <button
                    onClick={clearAllFilters}
                    className="h-9 px-4 rounded-xl bg-white/10 border border-white/10 text-[11px] font-bold hover:bg-white/15"
                  >
                    مسح
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* تبويبات المناطق الرئيسية */}
      <main className="max-w-[1100px] mx-auto px-3 sm:px-4 py-4">
        <div className="bg-white rounded-2xl border border-[#e0f2fe] shadow-sm mb-4 overflow-hidden">
          <div className="px-3 py-3 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none items-center">
            {/* زر الكل */}
            <button
              onClick={() => {
                setSelectedAreaId(null)
                setActiveBranchId(null)
                setBranchDrawerAreaId(null)
              }}
              className={`h-8 px-4 rounded-full border text-[12px] shrink-0 font-medium transition-all ${
                !selectedAreaId ? 'bg-slate-900 text-white border-slate-900' : 'bg-sky-50 border-sky-100 text-slate-600 hover:bg-white'
              }`}
            >
              الكل • {formatNumber(subscribersInRange.length)}
            </button>

            {/* المناطق */}
            {areas.map((area) => {
              const count = subscribersInRange.filter((s) => s.areaId === area.id).length
              const isSelected = selectedAreaId === area.id
              const isDrawerOpen = branchDrawerAreaId === area.id

              return (
                <div
                  key={area.id}
                  onClick={() => {
                    if (selectedAreaId !== area.id) {
                      setSelectedAreaId(area.id)
                      setActiveBranchId(null)
                      setBranchDrawerAreaId(area.id)
                    } else if (branchDrawerAreaId !== area.id) {
                      setBranchDrawerAreaId(area.id)
                    } else {
                      setSelectedAreaId(null)
                      setActiveBranchId(null)
                      setBranchDrawerAreaId(null)
                    }
                  }}
                  className={`depth-chip h-8 px-3 rounded-full border text-[12px] shrink-0 flex items-center gap-2 cursor-pointer select-none transition-all ${
                    isSelected
                      ? isDrawerOpen
                        ? 'bg-slate-800 text-white border-slate-800'
                        : 'bg-slate-900 text-white border-slate-900'
                      : 'bg-sky-50 border-sky-100 hover:bg-white text-slate-600'
                  }`}
                >
                  <span className="font-medium">{area.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-white border border-sky-100 text-slate-500'
                    }`}
                  >
                    {formatNumber(count)}
                  </span>
                </div>
              )
            })}
          </div>

          {/* الفروع: لا تظهر إلا بعد فتح المنطقة */}
          {branchDrawerAreaId && (
            <div className="px-3 pb-3 pt-0 border-t border-sky-50 bg-sky-50/30">
              <div className="pt-3 pb-2 flex items-center justify-between">
                <div className="text-[11px] font-bold text-slate-700">
                  أفرع {areas.find((a) => a.id === branchDrawerAreaId)?.name}
                </div>
                <button
                  onClick={() => {
                    setBranchDrawerAreaId(null)
                    setActiveBranchId(null)
                  }}
                  className="text-[10px] border border-sky-100 bg-white rounded-full px-3 py-1 hover:bg-sky-50"
                >
                  إغلاق
                </button>
              </div>
              <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none py-1">
                <button
                  onClick={() => setActiveBranchId(null)}
                  className={`h-7 px-3 rounded-full border text-[11px] shrink-0 ${
                    !activeBranchId ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-sky-100 text-slate-600'
                  }`}
                >
                  كل الأفرع
                </button>
                {(areas.find((a) => a.id === branchDrawerAreaId)?.branches || []).map((branch) => {
                  const bCount = subscribersInRange.filter(
                    (s) => s.areaId === branchDrawerAreaId && s.branchId === branch.id
                  ).length
                  const isBranchActive = activeBranchId === branch.id
                  return (
                    <button
                      key={branch.id}
                      onClick={() => setActiveBranchId(isBranchActive ? null : branch.id)}
                      className={`h-7 px-3 rounded-full border text-[11px] shrink-0 flex items-center gap-1.5 ${
                        isBranchActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-sky-100 text-slate-600 hover:bg-sky-50'
                      }`}
                    >
                      <span>{branch.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${isBranchActive ? 'bg-white/20' : 'bg-sky-50'}`}>
                        {formatNumber(bCount)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* قائمة المشتركين الرئيسية */}
        <div className="bg-white rounded-2xl border border-[#e0f2fe] shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center gap-2 bg-sky-50/40">
            <div className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-900">{formatNumber(displayedSubscribers.length)}</span> من{' '}
              {formatNumber(subscribersInRange.length)} • {formatNumber(rangeFrom)} - {formatNumber(rangeTo)}
            </div>
          </div>

          <div className="divide-y divide-sky-50">
            {displayedSubscribers.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-[13px]">
                لا يوجد مشتركون مطابقون للبحث أو الفلتر
              </div>
            ) : (
              displayedSubscribers.map((sub) => {
                const currentDue = getSubscriberCurrentDue(sub.id)
                return (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setSelectedSubId(sub.id)
                      setSelectedYear(2026) // افتراضي 2026
                    }}
                    onTouchStart={(e) => handleTouchStart(e, sub.id)}
                    onTouchEnd={(e) => handleTouchEnd(e, sub)}
                    onMouseDown={(e) => handleMouseDown(e, sub.id)}
                    onMouseUp={(e) => handleMouseUp(e, sub)}
                    className="depth-card w-full text-right px-4 py-3.5 hover:bg-sky-50/40 flex justify-between items-center gap-3 cursor-pointer transition-colors select-none group bg-white"
                  >
                    {/* الاسم والرقم على اليمين */}
                    <div className="min-w-0 flex-1 text-right">
                      <div className="text-[13px] font-bold truncate text-slate-900 leading-tight">
                        {formatNumber(sub.id)} - {sub.name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                        <span>{areas.find((a) => a.id === sub.areaId)?.name}</span>
                        <span>•</span>
                        <span>{sub.propertyType}</span>
                        {(sub.statuses || []).map((st) => (
                          <span
                            key={st}
                            className={`px-1.5 py-0.2 text-[9px] rounded-full font-medium ${STATUS_CONFIG[st]?.bg || 'bg-zinc-100'} ${STATUS_CONFIG[st]?.text || 'text-zinc-700'}`}
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* الدين يظهر على اليسار بلون أسود واضح وكبير */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-[15px] font-bold text-[#111827] font-mono tracking-tight min-w-[70px] text-left">
                        {formatNumber(currentDue)}
                      </div>
                      <div className="text-sky-200 group-hover:text-slate-400 transition-colors text-[14px]">‹</div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* ==========================
          نافذة تفاصيل المشترك وبلوك الديون
          القاعدة 9: بعرض 100%، 4 أعمدة: 20% | 27% | 26% | 27%، ارتفاع 36px، بدون سكرول جانبي
      ========================== */}
      {activeSubscriber && activeBilling && (
        <div className="subscriber-scene fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] flex flex-col">
          <div className="subscriber-orbit subscriber-orbit-one" />
          <div className="subscriber-orbit subscriber-orbit-two" />
          <div className="subscriber-card bg-[#f0f9ff] w-full h-full sm:max-w-[740px] sm:mx-auto sm:my-4 sm:rounded-2xl sm:border sm:border-sky-100 sm:h-[calc(100%-32px)] flex flex-col overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
            {/* رأس النافذة */}
            <div className="subscriber-hero border-b border-sky-100 px-4 py-4 flex justify-between items-start gap-3 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setEditSub({ ...activeSubscriber })
                      setShowEditModal(true)
                    }}
                    className="text-right text-[15px] font-bold text-slate-900 hover:text-sky-600 transition-colors cursor-pointer"
                    title="انقر لتعديل بيانات المشترك"
                  >
                    {formatNumber(activeSubscriber.id)} - {activeSubscriber.name}
                  </button>
                  <span className="text-[11px] text-slate-500">
                    ({areas.find((a) => a.id === activeSubscriber.areaId)?.name}
                    {' - '}
                    {areas.find((a) => a.id === activeSubscriber.areaId)?.branches.find((b) => b.id === activeSubscriber.branchId)?.name})
                  </span>
                </div>
                <div className="mt-3 flex gap-2 items-center flex-wrap">
                  <div className="inline-flex border border-sky-100 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                    {activeSubscriber.propertyType} - {activeSubscriber.meterType}
                  </div>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="inline-flex items-center gap-1 border border-sky-200 rounded-full bg-white hover:bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700 transition-colors shadow-sm"
                  >
                    التواصل والموقع والصور
                  </button>
                  <div className="text-[10px] text-slate-500 font-mono">
                    المستحق: {formatNumber(activeBilling.due)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedSubId(null)}
                className="w-9 h-9 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500 hover:bg-sky-50"
              >
                ✕
              </button>
            </div>

            {/* المحتوى */}
            <div className="flex-1 overflow-y-auto pb-4">
              {/* السنوات: فقط 2026 و 2027 و 2028 (لا 2025 أبداً)
                  والسنة الحالية 2026 تظهر بلون أحمر دائماً */}
              <div className="subscriber-content subscriber-content-2 px-4 py-2 border-y border-sky-50 bg-white overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-none items-center">
                {YEARS.map((y) => {
                  const is2026 = y === 2026
                  const isSelected = selectedYear === y
                  return (
                    <button
                      key={y}
                      onClick={() => setSelectedYear(y)}
                      className={`h-8 px-4 rounded-full border text-[12px] shrink-0 font-medium transition-all ${
                        is2026
                          ? isSelected
                            ? 'bg-[#ef4444] text-white border-[#ef4444]'
                            : 'bg-red-50 border-red-200 text-red-600'
                          : isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-sky-100 text-slate-600 hover:bg-sky-50'
                      }`}
                    >
                      {y}
                    </button>
                  )
                })}
              </div>

              {/* أزرار التالي والسابق للتنقل بين المشتركين (فوق الجدول) */}
              {(() => {
                const currentIndex = displayedSubscribers.findIndex((s) => s.id === activeSubscriber.id)
                const prevSub = currentIndex > 0 ? displayedSubscribers[currentIndex - 1] : null
                const nextSub = currentIndex < displayedSubscribers.length - 1 ? displayedSubscribers[currentIndex + 1] : null
                return (
                  <div className="subscriber-content px-3 pt-3 flex gap-2">
                    <button
                      onClick={() => { if (prevSub) { setSelectedSubId(prevSub.id); setSelectedYear(2026) } }}
                      disabled={!prevSub}
                      className={`flex-1 h-11 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${prevSub ? 'bg-white border-sky-200 text-slate-700 hover:bg-sky-50' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                      <span className="text-[18px] leading-none font-normal">›</span>
                      <div className="text-right overflow-hidden">
                        {prevSub ? <><div className="text-[9px] text-slate-400 leading-tight">السابق</div><div className="truncate max-w-[100px] leading-tight">{formatNumber(prevSub.id)} - {prevSub.name}</div></> : <span>لا يوجد سابق</span>}
                      </div>
                    </button>
                    <button
                      onClick={() => { if (nextSub) { setSelectedSubId(nextSub.id); setSelectedYear(2026) } }}
                      disabled={!nextSub}
                      className={`flex-1 h-11 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${nextSub ? 'bg-white border-sky-200 text-slate-700 hover:bg-sky-50' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                      <div className="text-left overflow-hidden">
                        {nextSub ? <><div className="text-[9px] text-slate-400 leading-tight">التالي</div><div className="truncate max-w-[100px] leading-tight">{formatNumber(nextSub.id)} - {nextSub.name}</div></> : <span>لا يوجد تالي</span>}
                      </div>
                      <span className="text-[18px] leading-none font-normal">‹</span>
                    </button>
                  </div>
                )
              })()}

              {/* بداية السنة بسيطة: القديم + الفائدة = الناتج */}
              <div className="subscriber-content subscriber-content-3 w-full mt-3 px-2" style={{ boxSizing: 'border-box' }}>
                <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-[12px] flex items-center gap-2 font-mono shadow-sm w-full">
                  <span className="font-bold text-slate-800 font-sans shrink-0">بداية السنة:</span>
                  <span className="text-slate-600">
                    القديم {formatNumber(activeBilling.remainingPrev)} + الفائدة {formatNumber(activeBilling.fee)} = {formatNumber(activeBilling.totalCarried)}
                  </span>
                </div>
              </div>

              {/* بلوك الديون بعرض الشاشة 100%
                  الأعمدة: الفترة 20% | الدين القديم 27% | المدفوع 26% | المتبقي 27%
                  ارتفاع الخلية 36px وبدون سكرول جانبي */}
              <div className="subscriber-content subscriber-content-4 w-full" style={{ width: '100%', margin: 0, padding: '8px', boxSizing: 'border-box', maxWidth: '100%' }}>
                <div className="bg-white rounded-2xl border border-sky-100 overflow-hidden shadow-sm w-full">
                  <div className="w-full">
                    <div
                      className="bg-slate-900 text-white text-[11px] font-bold grid w-full"
                      style={{ gridTemplateColumns: '20% 27% 26% 27%', width: '100%' }}
                    >
                      <div className="px-1 py-3 text-center">الفترة</div>
                      <div className="px-1 py-3 border-r border-white/10 text-center">الدين القديم</div>
                      <div className="px-1 py-3 border-r border-white/10 text-center">المدفوع</div>
                      <div className="px-1 py-3 border-r border-white/10 text-center">المتبقي</div>
                    </div>

                    {activeBilling.rows.map((row, idx) => {
                      // الشهر الحالي يبين بحد أحمر فقط، لا تكتب كلمة "الحالي"
                      const isCurrentPeriod = selectedYear === 2026 && idx === currentPeriodIndex
                      const editKey = (f: string) => `${activeSubscriber.id}_${selectedYear}_${idx}_${f}`

                      return (
                        <div
                          key={row.periodLabel}
                          className={`grid border-b w-full relative ${
                            isCurrentPeriod
                              ? 'bg-[#fef2f2] border-red-100 border-r-[3px] border-r-[#ef4444]'
                              : idx % 2 === 0
                              ? 'bg-white border-sky-50'
                              : 'bg-sky-50/30 border-sky-50'
                          }`}
                          style={{ gridTemplateColumns: '20% 27% 26% 27%', width: '100%', minHeight: '44px' }}
                        >
                          {/* الفترة */}
                          <div
                            className={`px-1 flex items-center justify-center font-bold ${
                              isCurrentPeriod ? 'text-[#ef4444]' : 'text-slate-700'
                            }`}
                            style={{ minHeight: '44px' }}
                          >
                            <span className="font-mono text-[13px]">{row.periodLabel}</span>
                          </div>

                          {/* الدين القديم */}
                          <div className="px-1 border-r border-sky-50 flex items-center justify-center" style={{ minHeight: '44px' }}>
                            <input
                              value={pendingEdits[editKey('old')] !== undefined ? pendingEdits[editKey('old')] : String(row.old)}
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '' || /^[0-9]*$/.test(v)) {
                                  setPendingEdits((p) => ({ ...p, [editKey('old')]: v }))
                                }
                              }}
                              onBlur={(e) => handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'old', e.target.value)}
                              onFocus={(e) => {
                                setPendingEdits((p) => ({ ...p, [editKey('old')]: String(row.old) }))
                                setTimeout(() => e.target.select(), 0)
                              }}
                              placeholder="0"
                              className={`border rounded-lg font-mono focus:outline-none focus:ring-1 bg-white text-center ${
                                isCurrentPeriod
                                  ? 'border-red-200 focus:border-red-400 focus:ring-red-100 text-[#ef4444]'
                                  : 'border-sky-100 focus:border-slate-900 focus:ring-slate-900/5'
                              } ${row.isManual ? 'border-sky-200 bg-sky-50' : ''}`}
                              inputMode="numeric"
                              style={{ width: '100%', height: '36px', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* المدفوع */}
                          <div className="px-1 border-r border-sky-50 flex items-center justify-center" style={{ minHeight: '44px' }}>
                            <input
                              value={
                                pendingEdits[editKey('paid')] !== undefined
                                  ? pendingEdits[editKey('paid')]
                                  : row.paid === 0
                                  ? ''
                                  : String(row.paid)
                              }
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '' || /^[0-9]*$/.test(v)) {
                                  setPendingEdits((p) => ({ ...p, [editKey('paid')]: v }))
                                }
                              }}
                              onBlur={(e) => handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'paid', e.target.value)}
                              onFocus={(e) => {
                                setPendingEdits((p) => ({
                                  ...p,
                                  [editKey('paid')]: row.paid === 0 ? '' : String(row.paid)
                                }))
                                setTimeout(() => e.target.select(), 0)
                              }}
                              placeholder="0"
                              className={`border rounded-lg font-mono focus:outline-none focus:ring-1 bg-white text-center ${
                                isCurrentPeriod
                                  ? 'border-red-200 focus:border-red-400 focus:ring-red-100'
                                  : 'border-sky-100 focus:border-slate-900 focus:ring-slate-900/5'
                              }`}
                              inputMode="numeric"
                              style={{ width: '100%', height: '36px', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* المتبقي */}
                          <div className="px-1 border-r border-sky-50 flex items-center justify-center" style={{ minHeight: '44px' }}>
                            <input
                              value={pendingEdits[editKey('rem')] !== undefined ? pendingEdits[editKey('rem')] : String(row.remaining)}
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '' || /^-?[0-9]*$/.test(v)) {
                                  setPendingEdits((p) => ({ ...p, [editKey('rem')]: v }))
                                }
                              }}
                              onBlur={(e) => handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'rem', e.target.value)}
                              onFocus={(e) => {
                                setPendingEdits((p) => ({ ...p, [editKey('rem')]: String(row.remaining) }))
                                setTimeout(() => e.target.select(), 0)
                              }}
                              className={`border rounded-lg font-mono font-bold focus:outline-none focus:ring-1 text-center ${
                                row.remaining === 0
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                  : row.remaining < 0
                                  ? 'bg-red-50 border-red-100 text-red-700'
                                  : isCurrentPeriod
                                  ? 'bg-white border-red-200 text-[#ef4444]'
                                  : 'bg-slate-900 border-slate-900 text-white'
                              }`}
                              inputMode="numeric"
                              style={{ width: '100%', height: '36px', fontSize: '13px', boxSizing: 'border-box' }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* مفتاح الألوان */}
                <div className="mt-2.5 flex gap-3 flex-wrap text-[10px] px-1 text-slate-500 items-center justify-center">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span> مسدد
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-slate-900"></span> متبقي
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#fef2f2] border border-red-200"></span>
                    {PERIODS[currentPeriodIndex]}
                  </span>
                </div>
              </div>
            </div>

            {/* في نهاية السجل: زر فتح لكيشن أو رفع لكيشن */}
            {(() => {
              const hasLocation = Boolean(
                activeSubscriber.location &&
                ((activeSubscriber.location.lat && activeSubscriber.location.lng) || activeSubscriber.location.link)
              )
              return (
                <div className="subscriber-footer border-t border-sky-100 bg-white px-3 py-2.5 shrink-0">
                  {hasLocation ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const link =
                            activeSubscriber.location?.link ||
                            `https://www.google.com/maps?q=${activeSubscriber.location?.lat},${activeSubscriber.location?.lng}`
                          window.open(link, '_blank', 'noopener,noreferrer')
                        }}
                        className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                          <circle cx="12" cy="9" r="2.5" />
                        </svg>
                        <span>فتح لكيشن</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUploadLocation(activeSubscriber.id)}
                        disabled={isLocating}
                        title="تحديث الموقع لموقعي الحالي"
                        className="h-12 px-3 bg-white border border-sky-200 text-slate-700 hover:bg-sky-50 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                      >
                        {isLocating ? 'جارِ التحديد...' : 'تحديث اللكيشن'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleUploadLocation(activeSubscriber.id)}
                      disabled={isLocating}
                      className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                      <span>{isLocating ? 'جارِ تحديد موقعك وحفظه...' : 'رفع لكيشن'}</span>
                    </button>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ==========================
          فورم إضافة مشترك (A)
      ========================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-[440px] sm:rounded-2xl border-0 sm:border border-sky-100 flex flex-col max-h-[100vh] shadow-2xl">
            <div className="px-5 py-4 border-b border-sky-50 flex justify-between items-center bg-white">
              <h3 className="font-bold text-[14px] text-slate-900">إضافة مشترك جديد</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 border rounded-lg flex items-center justify-center bg-white border-slate-200 text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubscriberSubmit} className="p-5 space-y-4 overflow-y-auto">
              {/* رقم المشترك * إجباري */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">
                  رقم المشترك <span className="text-red-500">*</span>
                </label>
                <input
                  value={newSub.idStr}
                  onChange={(e) => setNewSub((p) => ({ ...p, idStr: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="مثال: 5205"
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[13px] font-mono focus:outline-none focus:border-slate-900 bg-white"
                  inputMode="numeric"
                />
              </div>

              {/* اسم المشترك * إجباري */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">
                  اسم المشترك <span className="text-red-500">*</span>
                </label>
                <input
                  value={newSub.name}
                  onChange={(e) => setNewSub((p) => ({ ...p, name: e.target.value }))}
                  placeholder="الاسم الثلاثي..."
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-slate-900 bg-white"
                />
              </div>

              {/* المنطقة * إجباري */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">
                  المنطقة <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSub.areaId}
                  onChange={(e) => {
                    const aId = e.target.value
                    const targetArea = areas.find((a) => a.id === aId)
                    setNewSub((p) => ({
                      ...p,
                      areaId: aId,
                      branchId: targetArea?.branches[0]?.id || ''
                    }))
                  }}
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-slate-900"
                >
                  <option value="">اختر المنطقة</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* الفرع (تفاعلي يظهر أفرع المنطقة فقط) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">الفرع</label>
                <select
                  value={newSub.branchId}
                  onChange={(e) => setNewSub((p) => ({ ...p, branchId: e.target.value }))}
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-slate-900"
                >
                  {(areas.find((a) => a.id === newSub.areaId)?.branches || []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* نوع العقار وحجم المتر */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700">نوع العقار</label>
                  <select
                    value={newSub.propertyType}
                    onChange={(e) => {
                      const propertyType = e.target.value as PropertyType
                      setNewSub((p) => ({ ...p, propertyType, meterType: metersForProperty(propertyType)[0] }))
                    }}
                    className="mt-1.5 w-full h-11 px-3 border border-slate-200 rounded-xl text-[12px] bg-white"
                  >
                    <option value="سكني">سكني</option>
                    <option value="تجاري">تجاري</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700">حجم المتر</label>
                  <select
                    value={newSub.meterType}
                    onChange={(e) => setNewSub((p) => ({ ...p, meterType: e.target.value as MeterType }))}
                    className="mt-1.5 w-full h-11 px-3 border border-slate-200 rounded-xl text-[12px] bg-white"
                  >
                    {metersForProperty(newSub.propertyType).map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* الهاتف */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">
                  رقم الهاتف <span className="text-[10px] text-slate-400 font-normal mr-1">(اختياري)</span>
                </label>
                <input
                  value={newSub.phone}
                  onChange={(e) => setNewSub((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="07xxxxxxxxx"
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[13px] font-mono focus:outline-none focus:border-slate-900 bg-white"
                  dir="ltr"
                />
              </div>

              {/* حالات المشترك المتعددة */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-2">حالات المشترك</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((st) => {
                    const checked = newSub.statuses.includes(st)
                    return (
                      <label
                        key={st}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] cursor-pointer transition-all ${
                          checked ? 'bg-slate-900 text-white border-slate-900' : 'bg-sky-50/50 border-sky-100 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewSub((p) => ({ ...p, statuses: [...p.statuses, st] }))
                            } else {
                              setNewSub((p) => ({ ...p, statuses: p.statuses.filter((x) => x !== st) }))
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900"
                        />
                        <span className="truncate">{st}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {formError && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                  {formError}
                </div>
              )}

              <button
                type="submit"
                className="w-full h-11 bg-slate-900 text-white rounded-xl text-[13px] font-bold hover:bg-black transition-colors mt-2"
              >
                حفظ المشترك
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ==========================
          فورم تعديل مشترك (B)
      ========================== */}
      {showEditModal && editSub.id && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-[480px] sm:rounded-2xl border-0 sm:border border-sky-100 flex flex-col max-h-[100vh] shadow-xl">
            <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center bg-sky-50/50">
              <h3 className="font-bold text-[13px] text-slate-800">تعديل معلومات المشترك #{editSub.id}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubscriberSubmit} className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[11px] text-slate-600 font-medium">الاسم</label>
                <input
                  value={editSub.name || ''}
                  onChange={(e) => setEditSub((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] focus:outline-none focus:border-slate-900 bg-sky-50/30 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-600 font-medium">الهاتف</label>
                <input
                  value={editSub.phone || ''}
                  onChange={(e) => setEditSub((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] font-mono focus:outline-none focus:border-slate-900 bg-sky-50/30 focus:bg-white"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-600 font-medium">المنطقة</label>
                  <select
                    value={editSub.areaId || ''}
                    onChange={(e) => {
                      const aId = e.target.value
                      const targetArea = areas.find((a) => a.id === aId)
                      setEditSub((p) => ({
                        ...p,
                        areaId: aId,
                        branchId: targetArea?.branches[0]?.id || ''
                      }))
                    }}
                    className="mt-1.5 w-full h-10 px-3 border border-sky-100 rounded-2xl text-[12px] bg-white"
                  >
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 font-medium">الفرع</label>
                  <select
                    value={editSub.branchId || ''}
                    onChange={(e) => setEditSub((p) => ({ ...p, branchId: e.target.value }))}
                    className="mt-1.5 w-full h-10 px-3 border border-sky-100 rounded-2xl text-[12px] bg-white"
                  >
                    {(areas.find((a) => a.id === editSub.areaId)?.branches || []).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-600 font-medium">نوع العقار</label>
                  <select
                    value={editSub.propertyType || 'سكني'}
                    onChange={(e) => {
                      const propertyType = e.target.value as PropertyType
                      setEditSub((p) => ({ ...p, propertyType, meterType: metersForProperty(propertyType)[0] }))
                    }}
                    className="mt-1.5 w-full h-10 px-3 border border-sky-100 rounded-2xl text-[12px] bg-white"
                  >
                    <option value="سكني">سكني</option>
                    <option value="تجاري">تجاري</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 font-medium">نوع المتر</label>
                  <select
                    value={editSub.meterType || '4 متر'}
                    onChange={(e) => setEditSub((p) => ({ ...p, meterType: e.target.value as MeterType }))}
                    className="mt-1.5 w-full h-10 px-3 border border-sky-100 rounded-2xl text-[12px] bg-white"
                  >
                    {metersForProperty(editSub.propertyType || 'سكني').map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-2">تعديل الحالات المتعددة</label>
                <div className="grid grid-cols-2 gap-2">
                  {STATUS_OPTIONS.map((st) => {
                    const checked = (editSub.statuses || []).includes(st)
                    return (
                      <label
                        key={st}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] cursor-pointer transition-all ${
                          checked ? 'bg-slate-900 text-white border-slate-900' : 'bg-sky-50/50 border-sky-100 text-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = editSub.statuses || []
                            if (e.target.checked) {
                              setEditSub((p) => ({ ...p, statuses: [...cur, st] }))
                            } else {
                              setEditSub((p) => ({ ...p, statuses: cur.filter((x) => x !== st) }))
                            }
                          }}
                          className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900"
                        />
                        <span className="truncate">{st}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-slate-900 text-white rounded-2xl text-[13px] font-bold"
              >
                حفظ التعديلات
              </button>
            </form>
          </div>
        </div>
      )}

      {/* نافذة التواصل والموقع والصور */}
      {showContactModal && activeSubscriber && (
        <div className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-[480px] sm:rounded-2xl border-0 sm:border border-sky-100 flex flex-col shadow-xl">
            <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center bg-sky-50/50">
              <h3 className="font-bold text-[13px] text-slate-800">التواصل والموقع والصور</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="w-8 h-8 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/40">
                <div className="text-[11px] text-slate-500">رقم الهاتف</div>
                <div className="font-mono text-[13px] mt-1.5 font-bold" dir="ltr">
                  {activeSubscriber.phone || 'غير مسجل'}
                </div>
                {activeSubscriber.phone && (
                  <div className="flex gap-2 mt-3">
                    <a
                      href={`tel:${activeSubscriber.phone}`}
                      className="h-9 px-4 border border-sky-100 rounded-full text-[12px] flex items-center bg-white text-slate-700 hover:bg-sky-50"
                    >
                      اتصال
                    </a>
                    <a
                      href={`https://wa.me/${activeSubscriber.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener"
                      className="h-9 px-4 border border-sky-100 rounded-full text-[12px] flex items-center bg-white text-slate-700 hover:bg-sky-50"
                    >
                      واتساب
                    </a>
                  </div>
                )}
              </div>

              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/40">
                <div className="text-[11px] text-slate-500">العنوان التفصيلي</div>
                <div className="text-[12px] mt-1.5 font-medium">{activeSubscriber.detailedAddress || 'غير محدد'}</div>
              </div>

              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/40">
                <div className="text-[11px] text-slate-500 mb-2">الموقع الجغرافي (اللوكيشن)</div>
                {Boolean(activeSubscriber.location && ((activeSubscriber.location.lat && activeSubscriber.location.lng) || activeSubscriber.location.link)) ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const link =
                          activeSubscriber.location?.link ||
                          `https://www.google.com/maps?q=${activeSubscriber.location?.lat},${activeSubscriber.location?.lng}`
                        window.open(link, '_blank', 'noopener,noreferrer')
                      }}
                      className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                        <circle cx="12" cy="9" r="2.5" />
                      </svg>
                      <span>فتح لكيشن</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUploadLocation(activeSubscriber.id)}
                      disabled={isLocating}
                      className="h-10 px-3 bg-white border border-sky-200 text-slate-700 hover:bg-sky-50 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                    >
                      {isLocating ? 'جارِ التحديد...' : 'تحديث اللكيشن'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleUploadLocation(activeSubscriber.id)}
                    disabled={isLocating}
                    className="w-full h-10 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[12px] font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all disabled:opacity-60 cursor-pointer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                      <circle cx="12" cy="9" r="2.5" />
                    </svg>
                    <span>{isLocating ? 'جارِ تحديد موقعك وحفظه...' : 'رفع لكيشن'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================
          درج الإعدادات الكامل
          الأسعار: مكتوب "لكل شهرين"
          الاستيراد (C) مع البارسر الذكي
      ========================== */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px] flex">
          <div className="depth-panel bg-white w-full sm:w-[520px] h-full border-l border-sky-100 flex flex-col mr-auto sm:mr-0 ml-auto shadow-[-8px_0_30px_rgba(0,0,0,0.1)]">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="font-bold text-[13px]">الإعدادات</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-7 h-7 border border-white/20 rounded-lg flex items-center justify-center bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="px-3 py-3 border-b border-sky-50 flex gap-2 overflow-x-auto scrollbar-none bg-sky-50/30">
              {(['collector', 'areas', 'import'] as const).map((tab) => {
                const labels = { collector: 'المحصل', pricing: 'التسعير', areas: 'المناطق والافرع', import: 'الاستيراد' }
                return (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`h-8 px-4 rounded-full border text-[11px] whitespace-nowrap font-bold ${
                      settingsTab === tab ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-sky-100 text-slate-600'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#f0f9ff]/50">
              {/* تبويب المحصل */}
              {settingsTab === 'collector' && (
                <div className="space-y-4">
                  {/* زر إضافة مشترك وزر تسجيل الخروج */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => {
                        setShowSettingsModal(false)
                        setFormError('')
                        setShowAddModal(true)
                      }}
                      className="h-12 bg-slate-900 text-white rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors"
                    >
                      <span className="text-[18px] leading-none">+</span>
                      <span>إضافة مشترك</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowSettingsModal(false)
                        handleLogout()
                      }}
                      className="h-12 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-[13px] font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      <span>تسجيل الخروج</span>
                    </button>
                  </div>

                  {/* زر تفريغ الكل - لاختبار المزامنة */}
                  <button
                    onClick={() => {
                      if (!window.confirm('سيتم حذف جميع البيانات المحفوظة محلياً على هذا الجهاز. هل تريد المتابعة؟')) return
                      localStorage.removeItem(STORAGE_KEY)
                      localStorage.removeItem(AUTH_STORAGE_KEY)
                      window.location.reload()
                    }}
                    className="w-full h-11 border border-dashed border-red-300 text-red-500 rounded-2xl text-[12px] font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                    </svg>
                    <span>تفريغ البيانات المحلية (لاختبار المزامنة)</span>
                  </button>

                  <div className="border border-sky-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
                      <div className="text-[12px] font-bold">تفاصيل المحصل</div>
                      <div className="text-[10px] bg-white/15 px-3 py-1 rounded-full font-mono">
                        {formatNumber(subscribersInRange.length)} اشتراك
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-600 font-bold">اسم المحصل</label>
                          <input
                            value={collectorName}
                            onChange={(e) => setCollectorName(e.target.value)}
                            className="mt-1.5 w-full h-9 px-3 border border-sky-100 rounded-xl text-[12px] bg-sky-50/40 focus:bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-600 font-bold">رقم الهاتف</label>
                          <input
                            value={collectorPhone}
                            onChange={(e) => setCollectorPhone(e.target.value)}
                            className="mt-1.5 w-full h-9 px-3 border border-sky-100 rounded-xl text-[12px] bg-sky-50/40 font-mono focus:bg-white focus:outline-none focus:border-slate-900"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="border border-sky-100 rounded-2xl p-3 bg-sky-50/30">
                          <div className="text-[10px] text-slate-500">من رقم</div>
                          <input
                            type="number"
                            value={rangeFrom}
                            onChange={(e) => setRangeFrom(Number(e.target.value) || 1)}
                            className="mt-1.5 w-full h-8 px-3 border border-sky-100 rounded-xl font-mono text-[13px] font-bold bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="border border-sky-100 rounded-2xl p-3 bg-sky-50/30">
                          <div className="text-[10px] text-slate-500">إلى رقم</div>
                          <input
                            type="number"
                            value={rangeTo}
                            onChange={(e) => setRangeTo(Number(e.target.value) || 9999)}
                            className="mt-1.5 w-full h-8 px-3 border border-sky-100 rounded-xl font-mono text-[13px] font-bold bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] text-emerald-700">
                        يتم حفظ اسم المحصل ورقمه وحدود البلوك تلقائياً بعد التعديل.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* تبويب التسعير: مكتوب "لكل شهرين" */}
              {settingsTab === 'pricing' && (
                <div className="space-y-4">
                  {(['سكني', 'تجاري'] as const).map((prop) => (
                    <div key={prop} className="border border-sky-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-sky-50/40 border-b border-sky-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-5 rounded-full ${prop === 'سكني' ? 'bg-slate-900' : 'bg-slate-400'}`}></div>
                          <div className="text-[13px] font-bold text-slate-800">{prop}</div>
                        </div>
                        {/* مكتوب "لكل شهرين" بحسب القاعدة 11 */}
                        <div className="text-[10px] font-bold bg-white border border-sky-100 rounded-full px-3 py-1 text-slate-600">
                          {prop === 'تجاري' ? '60 × 200 لكل متر / شهرين' : 'لكل شهرين'}
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-3">
                        {(prop === 'تجاري' ? ['1 متر', '2 متر', '3 متر', '9 متر', '70 متر'] : RESIDENTIAL_METERS).map((m) => {
                          const key = `${prop}_${m}`
                          const amount = prop === 'تجاري' ? Number.parseInt(m, 10) * 60 * 200 : pricing[prop]?.[m] || 0
                          const isEditing = editingPricingKey === key
                          return (
                            <div key={m} className="depth-card border border-sky-100 rounded-2xl p-3 bg-sky-50/30">
                              <div className="flex justify-between items-center">
                                <div className="text-[12px] font-bold text-slate-800">{m}</div>
                                <div className="text-[9px] bg-white border border-sky-100 rounded-full px-2 py-0.5 text-slate-500">
                                  {prop}
                                </div>
                              </div>
                              {prop === 'تجاري' ? (
                                <div className="mt-2 w-full h-9 px-3 rounded-xl text-[12px] font-bold bg-white text-slate-700 flex items-center justify-between">
                                  <span>{formatNumber(amount)}</span>
                                  <span className="text-[9px] text-slate-400">معادلة ثابتة</span>
                                </div>
                              ) : isEditing ? (
                                <input
                                  autoFocus
                                  value={editingPricingVal}
                                  onChange={(e) => setEditingPricingVal(e.target.value.replace(/[^0-9]/g, ''))}
                                  onBlur={() => {
                                    const val = Number(editingPricingVal) || amount
                                    setPricing((prev) => ({
                                      ...prev,
                                      [prop]: { ...prev[prop], [m]: val }
                                    }))
                                    setEditingPricingKey(null)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const val = Number(editingPricingVal) || amount
                                      setPricing((prev) => ({
                                        ...prev,
                                        [prop]: { ...prev[prop], [m]: val }
                                      }))
                                      setEditingPricingKey(null)
                                    }
                                  }}
                                  className="mt-2 w-full h-9 px-3 border border-slate-900 rounded-xl text-[13px] font-mono font-bold bg-white focus:outline-none"
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingPricingKey(key)
                                    setEditingPricingVal(String(amount))
                                  }}
                                  className="mt-2 w-full h-9 px-3 border border-sky-100 rounded-xl text-[13px] font-mono font-bold bg-white text-slate-800 hover:border-slate-900 hover:bg-sky-50 text-right flex justify-between items-center"
                                >
                                  <span>{formatNumber(amount)}</span>
                                  <span className="text-[9px] text-slate-400">تعديل</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* تبويب المناطق والأفرع */}
              {settingsTab === 'areas' && (
                <div className="space-y-3">
                  <div className="border border-sky-100 rounded-2xl p-4 bg-white shadow-sm">
                    <div className="text-[12px] font-bold text-slate-800">إضافة منطقة جديدة</div>
                    <div className="flex gap-2 mt-3">
                      <input
                        value={newAreaName}
                        onChange={(e) => setNewAreaName(e.target.value)}
                        placeholder="اسم المنطقة..."
                        className="flex-1 h-10 px-4 border border-sky-100 rounded-2xl text-[12px] bg-sky-50/30 focus:bg-white focus:outline-none focus:border-slate-900"
                      />
                      <button
                        onClick={() => {
                          if (!newAreaName.trim()) return
                          const newArea: Area = {
                            id: `area_${Date.now()}`,
                            name: newAreaName.trim(),
                            branches: [{ id: `b_${Date.now()}`, name: 'الرئيسي' }]
                          }
                          setAreas((prev) => [...prev, newArea])
                          setNewAreaName('')
                        }}
                        className="h-10 px-5 bg-slate-900 text-white rounded-2xl text-[11px] font-bold"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  {areas.map((area) => (
                    <div key={area.id} className="border border-sky-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                      <div className="p-4 flex justify-between items-center">
                        {editingAreaId === area.id ? (
                          <div className="flex gap-2 flex-1">
                            <input
                              value={editingAreaName}
                              onChange={(e) => setEditingAreaName(e.target.value)}
                              className="flex-1 h-8 px-3 border border-sky-100 rounded-xl text-[12px]"
                            />
                            <button
                              onClick={() => {
                                if (editingAreaName.trim()) {
                                  setAreas((prev) => prev.map((a) => (a.id === area.id ? { ...a, name: editingAreaName.trim() } : a)))
                                }
                                setEditingAreaId(null)
                              }}
                              className="h-8 px-4 bg-slate-900 text-white rounded-xl text-[11px] font-bold"
                            >
                              حفظ
                            </button>
                          </div>
                        ) : (
                          <div className="font-bold text-[13px] text-slate-800">{area.name}</div>
                        )}
                        <button
                          onClick={() => {
                            setEditingAreaId(area.id)
                            setEditingAreaName(area.name)
                          }}
                          className="w-8 h-8 border border-sky-100 rounded-xl flex items-center justify-center bg-white hover:bg-sky-50 text-slate-500"
                        >
                          ✎
                        </button>
                      </div>

                      {/* أفرع المنطقة */}
                      <div className="border-t border-sky-50 bg-sky-50/30 p-4 space-y-2">
                        {area.branches.map((br) => (
                          <div key={br.id} className="flex justify-between items-center bg-white border border-sky-100 rounded-xl px-4 py-2.5">
                            {editingBranchId === br.id ? (
                              <div className="flex gap-2 flex-1">
                                <input
                                  value={editingBranchName}
                                  onChange={(e) => setEditingBranchName(e.target.value)}
                                  className="flex-1 h-7 px-2 border rounded text-[11px]"
                                />
                                <button
                                  onClick={() => {
                                    if (editingBranchName.trim()) {
                                      setAreas((prev) =>
                                        prev.map((a) =>
                                          a.id === area.id
                                            ? { ...a, branches: a.branches.map((b) => (b.id === br.id ? { ...b, name: editingBranchName.trim() } : b)) }
                                            : a
                                        )
                                      )
                                    }
                                    setEditingBranchId(null)
                                  }}
                                  className="h-7 px-3 bg-slate-900 text-white rounded text-[10px]"
                                >
                                  حفظ
                                </button>
                              </div>
                            ) : (
                              <span className="text-[12px]">{br.name}</span>
                            )}
                            <button
                              onClick={() => {
                                setEditingBranchId(br.id)
                                setEditingBranchName(br.name)
                              }}
                              className="w-6 h-6 border rounded flex items-center justify-center text-[10px] text-slate-500"
                            >
                              ✎
                            </button>
                          </div>
                        ))}

                        <div className="flex gap-2 pt-2">
                          <input
                            id={`add_br_${area.id}`}
                            placeholder={`فرع جديد في ${area.name}...`}
                            className="flex-1 h-9 px-3 border border-sky-100 rounded-xl text-[11px] bg-white focus:outline-none"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const input = e.target as HTMLInputElement
                                if (!input.value.trim()) return
                                setAreas((prev) =>
                                  prev.map((a) =>
                                    a.id === area.id
                                      ? { ...a, branches: [...a.branches, { id: `b_${Date.now()}`, name: input.value.trim() }] }
                                      : a
                                  )
                                )
                                input.value = ''
                              }
                            }}
                          />
                          <button
                            onClick={() => {
                              const input = document.getElementById(`add_br_${area.id}`) as HTMLInputElement
                              if (!input || !input.value.trim()) return
                              setAreas((prev) =>
                                prev.map((a) =>
                                  a.id === area.id
                                    ? { ...a, branches: [...a.branches, { id: `b_${Date.now()}`, name: input.value.trim() }] }
                                    : a
                                )
                              )
                              input.value = ''
                            }}
                            className="h-9 px-4 bg-slate-900 text-white rounded-xl text-[11px] font-bold"
                          >
                            + إضافة فرع
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ==========================
                  تبويب الاستيراد الذكي (C)
              ========================== */}
              {settingsTab === 'import' && (
                <div className="space-y-4">
                  <div className="border border-sky-100 rounded-2xl p-4 bg-white shadow-sm">
                    <div className="text-[12px] font-bold text-slate-800 mb-1">الاستيراد الذكي للنصوص والقوائم</div>
                    <div className="text-[10px] text-slate-500 leading-relaxed mb-3">
                      يدعم نسخ ولصق قائمة المشتركين مباشرة، مثال:
                      <br />
                      <span className="font-mono bg-sky-50 px-1.5 py-0.5 rounded text-slate-700">5 احمد عيسى / مفلش</span>
                      <br />
                      <span className="font-mono bg-sky-50 px-1.5 py-0.5 rounded text-slate-700">7 مالك سويد محمود</span>
                    </div>

                    <textarea
                      rows={6}
                      value={importText}
                      onChange={(e) => {
                        setImportText(e.target.value)
                        handleParseImport(e.target.value)
                      }}
                      placeholder={`الصق هنا النص، مثلاً:
5 احمد عيسى / مفلش
7 مالك سويد محمود
10 ناجي احمد صالح`}
                      className="w-full p-3 border border-sky-100 rounded-xl text-[12px] font-mono focus:outline-none focus:border-slate-900 bg-sky-50/20"
                    />

                    {importError && (
                      <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl p-2.5 mt-2">
                        {importError}
                      </div>
                    )}

                    {/* خيارات الاستيراد */}
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700">المنطقة الافتراضية للمستوردين <span className="text-[10px] font-normal text-slate-400">(اختياري)</span>:</label>
                        <select
                          value={importDefaultArea}
                          onChange={(e) => setImportDefaultArea(e.target.value)}
                          className="mt-1 w-full h-9 px-3 border border-sky-100 rounded-xl text-[11px] bg-white"
                        >
                          <option value="">-- بدون منطقة افتراضية --</option>
                          {areas.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <label className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={importOverwrite}
                          onChange={(e) => setImportOverwrite(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                        />
                        <span>تحديث الأسماء والحالات إذا كان رقم المشترك موجوداً مسبقاً</span>
                      </label>
                    </div>

                    {/* معاينة قبل التأكيد */}
                    {parsedImport.length > 0 && (
                      <div className="mt-4 border-t border-sky-50 pt-3">
                        <div className="text-[11px] font-bold text-slate-800 mb-2 flex justify-between">
                          <span>معاينة ({formatNumber(parsedImport.length)} مشترك جاهز)</span>
                          {importDuplicates > 0 && (
                            <span className="text-red-500 font-normal">تم كشف {importDuplicates} مكرر</span>
                          )}
                        </div>
                        <div className="max-h-[140px] overflow-y-auto space-y-1 bg-sky-50/30 p-2 rounded-xl text-[11px] font-mono">
                          {parsedImport.slice(0, 50).map((it) => (
                            <div key={it.id} className="flex justify-between border-b border-sky-50 pb-1">
                              <span>
                                {it.id} - {it.name}
                              </span>
                              {it.statuses.length > 0 && (
                                <span className="text-emerald-700 font-sans">[{it.statuses.join(', ')}]</span>
                              )}
                            </div>
                          ))}
                          {parsedImport.length > 50 && (
                            <div className="text-slate-400 text-center pt-1 font-sans">
                              ... وباقي {parsedImport.length - 50} مشترك آخرين
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handleConfirmImport}
                          className="mt-3 w-full h-10 bg-slate-900 text-white rounded-xl text-[12px] font-bold hover:bg-black transition-colors"
                        >
                          تأكيد وحفظ الاستيراد ({formatNumber(parsedImport.length)})
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
