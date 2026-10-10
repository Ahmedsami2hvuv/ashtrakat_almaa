'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import ReceiptScannerModal from './ReceiptScannerModal'
import InstallmentsPage from './InstallmentsPage'
import { testGeminiApiKey } from '../lib/aiReceiptScanner'
import { syncPendingOfflineData, getPendingSyncCount } from '../lib/directorateStore'
import type { Consignment, ConsignmentItem } from '../lib/directorateTypes'
import { BookOpen, Check, RefreshCw, Printer, X, CheckCheck } from 'lucide-react'

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
  areaIds?: string[]
  branchId: string
  propertyType: PropertyType
  meterType: MeterType
  detailedAddress: string
  doorImage?: string
  location?: { lat: number; lng: number; link: string }
  order: number
  statuses?: string[]
  remainingPrev?: number
  fee?: number
  createdAt?: string
}

export type Pricing = Record<PropertyType, Record<MeterType, number>>
export type BillingPeriodRecord = {
  oldDebtManual: number | null
  paid: number
  totalManual?: number | null
  remainingManual?: number | null
}
export type BillingRecords = Record<number, Record<number, BillingPeriodRecord[]>>
export type ParsedImportItem = { id: number; name: string; raw: string; statuses: string[]; note?: string }

// نوع بيانات المشتركين الذين يحتاجون مراجعة في الدائرة
export interface ReviewItem {
  id: string
  subscriberId?: number
  name: string
  phone?: string
  reason: string
  createdAt: string
  status: 'pending' | 'resolved'
  notes?: string
}

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
export const PERIODS = ['1 و 2', '3 و 4', '5 و 6', '7 و 8', '9 و 10', '11 و 12']
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
  'مفلش',
  'لا ينظم',
  'فارغ'
] as const

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'ممتنع': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  'مؤجر': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'مؤجر لا يعلم بالتفاصيل': { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-800' },
  'يدفع بالدائرة': { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', dot: 'bg-sky-500' },
  'يجب فحص حسابه': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  'يدفع باستمرار': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'مفلش': { bg: 'bg-zinc-100', text: 'text-zinc-700', border: 'border-zinc-300', dot: 'bg-zinc-500' },
  'لا ينظم': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'فارغ': { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200', dot: 'bg-teal-500' }
}

// دالة فحص ما إذا كان المشترك مصفّر الحساب كلياً بناءً على حالته (مفلش، لا ينظم)
export function isZeroAccountSubscriber(sub: Subscriber | null | undefined): boolean {
  if (!sub || !sub.statuses || sub.statuses.length === 0) return false
  return sub.statuses.some((st) => {
    if (!st) return false
    const s = st.trim()
    return (
      s === 'مفلش' ||
      s === 'لا ينظم' ||
      s.includes('مفلش') ||
      s.includes('لا ينظم')
    )
  })
}

// دالة فحص ما إذا كان المشترك مضافاً حديثاً (خلال آخر 1 ساعة) ليبقى في مقدمة القائمة
export function isRecentlyAddedSubscriber(sub: Subscriber | null | undefined): boolean {
  if (!sub || !sub.createdAt) return false
  const time = new Date(sub.createdAt).getTime()
  if (isNaN(time)) return false
  const oneHour = 60 * 60 * 1000 // 60 دقيقة
  return (Date.now() - time) < oneHour
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

// دالة ذكية لتنظيف مدخلات الأرقام ودعم نتائج حاسبة الكيبورد وفواصل الآلاف والأرقام العربية
export function sanitizeNumberInput(val: string, allowNegative = false): string {
  if (!val) return ''
  // 1. تحويل الأرقام العربية المشرقية والفارسية (٠١٢٣٤٥٦٧٨٩) إلى أرقام لاتينية (0-9)
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  let res = String(val)
  for (let i = 0; i < 10; i++) {
    res = res.replaceAll(arabicDigits[i], String(i))
  }

  // 2. التحقق من الإشارة السالبة إن كانت مسموحة
  const isNegative = allowNegative && res.trim().startsWith('-')

  // 3. إزالة فواصل الآلاف بجميع أنواعها (، , ٬) والمسافات
  res = res.replace(/[,،٬\s]/g, '')

  // 4. معالجة الأعداد العشرية الناتجة عن الحاسبة (مثلاً 107400.00)
  if (res.includes('.')) {
    const floatVal = parseFloat(res)
    if (!isNaN(floatVal)) {
      res = String(Math.round(floatVal))
    }
  }

  // 5. استخراج الأرقام فقط
  res = res.replace(/[^0-9]/g, '')

  // 6. إزالة الأصفار البادئة الزائدة (مثلاً إذا كان الحقل فيه 0 وضغط المستخدم على ناتج الحاسبة فصار 0107400)
  if (res.length > 1 && res.startsWith('0')) {
    res = res.replace(/^0+/, '')
    if (res === '') res = '0'
  }

  if (allowNegative && isNegative && res !== '') {
    return '-' + res
  }
  return res
}

// دالة لتنسيق الأرقام بفواصل خفيفة وصغيرة بعد كل 3 أرقام لكي لا تزيد حجم الخلية
export function formatInputDisplay(val: string | number | null | undefined): string {
  if (val === null || val === undefined || val === '') return ''
  const str = String(val).trim()
  if (str === '-' || str === '') return str
  const isNegative = str.startsWith('-')
  const clean = sanitizeNumberInput(str, true)
  if (!clean || clean === '-') return isNegative ? '-' : ''
  const isNegClean = clean.startsWith('-')
  const pureNum = isNegClean ? clean.slice(1) : clean
  // فصل كل 3 أرقام بفاصلة صغيرة
  const withCommas = pureNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return isNegClean ? '-' + withCommas : withCommas
}

// حساب الديون لفترات سنة معينة
export function calculateBilling(
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
      total: number
      paid: number
      remaining: number
      isManual: boolean
      isTotalManual?: boolean
      isRemainingManual?: boolean
    }>,
    remainingPrev: 0,
    fee: 0,
    totalCarried: 0,
    due: 24600,
    totalRemaining: 0
  }
  if (!sub) return emptyRes

  // إذا كان المشترك مؤشراً عليه (مفلش) أو (لا ينظم / لا ينظف) يكون حسابه مصفراً كلياً
  if (isZeroAccountSubscriber(sub)) {
    return {
      rows: PERIODS.map((periodLabel) => ({
        periodLabel,
        old: 0,
        due: 0,
        total: 0,
        paid: 0,
        remaining: 0,
        isManual: false,
        isTotalManual: false,
        isRemainingManual: false
      })),
      remainingPrev: 0,
      fee: 0,
      totalCarried: 0,
      due: 0,
      totalRemaining: 0
    }
  }

  const meterAmount = Number.parseInt(sub.meterType, 10)
  const due =
    sub.propertyType === 'تجاري'
      ? (Number.isFinite(meterAmount) && meterAmount > 0 ? meterAmount * 60 * 200 : 0)
      : pricing[sub.propertyType]?.[sub.meterType] ?? 24600

  // الدين السابق من السنة السابقة (لـ 2027 و 2028 من السنة السابقة، ولـ 2026 من الديون السابقة)
  let prevRemaining = 0
  if (year > 2026) {
    const prevBilling = calculateBilling(subId, year - 1, billingRecords, subscribers, pricing)
    if (prevBilling.rows.length > 0) {
      prevRemaining = prevBilling.rows[prevBilling.rows.length - 1].remaining
    }
  } else {
    const rec0 = billingRecords[subId]?.[2026]?.[0]
    prevRemaining =
      rec0?.oldDebtManual !== null && rec0?.oldDebtManual !== undefined
        ? rec0.oldDebtManual
        : (sub.remainingPrev ?? 0)
  }

  // بداية السنة بسيطة: القديم + الفائدة = الناتج
  const fee = prevRemaining >= due * 4 && due > 0 ? Math.round(prevRemaining * 0.1) : 0
  const totalCarried = prevRemaining + fee

  const rows: Array<{
    periodLabel: string
    old: number
    due: number
    total: number
    paid: number
    remaining: number
    isManual: boolean
    isTotalManual?: boolean
    isRemainingManual?: boolean
  }> = []

  for (let p = 0; p < 6; p++) {
    const rec = billingRecords[subId]?.[year]?.[p]
    const paid = rec?.paid ?? 0
    const manualOld = rec?.oldDebtManual
    const isManual = manualOld !== null && manualOld !== undefined
    const oldDebt: number = (p === 0)
      ? (isManual ? (manualOld as number) : totalCarried)
      : (isManual ? (manualOld as number) : rows[p - 1].remaining)

    // حساب المجموع: إما القيمة اليدوية المدخلة أو (الديون السابقة + المستحق)
    const manualTotal = rec?.totalManual
    const isTotalManual = manualTotal !== null && manualTotal !== undefined
    const total: number = isTotalManual ? (manualTotal as number) : (oldDebt + due)

    // حساب المجموع الكلي: إما القيمة اليدوية المدخلة أو (المجموع - المدفوع)
    const manualRemaining = rec?.remainingManual
    const isRemainingManual = manualRemaining !== null && manualRemaining !== undefined
    const remaining: number = isRemainingManual ? (manualRemaining as number) : (total - paid)

    rows.push({
      periodLabel: PERIODS[p],
      old: oldDebt,
      due,
      total,
      paid,
      remaining,
      isManual,
      isTotalManual,
      isRemainingManual
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

// دالة تحديد حالات المشترك الواحد تلقائياً:
// 1. إزالة "لا ينظف" نهائياً
// 2. إذا كان الحساب مصفراً (مفلش، لا ينظم) -> إزالة "يدفع باستمرار"
// 3. فحص حساب سنة 2026: إذا كان يزيد عن 50,000 د.ع -> إزالة "يدفع باستمرار" تلقائياً
//    إذا كان 50,000 د.ع أو أقل -> إضافة "يدفع باستمرار" تلقائياً
export function computeSubscriberStatuses(
  sub: Subscriber,
  billingRecords: BillingRecords,
  allSubs: Subscriber[],
  pricing: Pricing
): string[] {
  let statuses = Array.isArray(sub.statuses) ? [...sub.statuses] : []

  // 1. إزالة "لا ينظف" أو "لاينظف" نهائياً
  statuses = statuses.filter((st) => {
    if (!st) return false
    const trimmed = st.trim()
    return (
      trimmed !== 'لا ينظف' &&
      trimmed !== 'لاينظف' &&
      !trimmed.includes('لا ينظف') &&
      !trimmed.includes('لاينظف')
    )
  })

  // 2. فحص هل المشترك مصفّر الحساب (مفلش، لا ينظم)
  const isZero = isZeroAccountSubscriber({ ...sub, statuses })
  if (isZero) {
    return statuses.filter((s) => s !== 'يدفع باستمرار')
  }

  // 3. فحص رصيد / حساب المشترك في سنة 2026 (السنة الحالية)
  const pIdx = Math.floor(new Date().getMonth() / 2)
  let currentDue = 0
  try {
    const b = calculateBilling(sub.id, 2026, billingRecords, allSubs, pricing)
    currentDue = b.rows.length > pIdx ? b.rows[pIdx].remaining : b.totalRemaining
  } catch {
    currentDue = sub.remainingPrev ?? 0
  }

  // إذا زاد حسابه عن 50,000 د.ع في سنة 2026 -> يُزال عنه خيار "يدفع باستمرار" تلقائياً
  if (currentDue > 50000) {
    statuses = statuses.filter((s) => s !== 'يدفع باستمرار')
  } else {
    // حسابه 50,000 د.ع أو أقل -> يُعيّن له "يدفع باستمرار" تلقائياً
    if (!statuses.includes('يدفع باستمرار')) {
      statuses.push('يدفع باستمرار')
    }
  }

  return statuses
}

// دالة التحقق وتعيين حالات المشتركين تلقائياً:
export function applyAutoStatuses(
  subs: Subscriber[],
  billingRecords: BillingRecords,
  pricing: Pricing
): { updatedSubscribers: Subscriber[]; hasChanges: boolean } {
  let hasChanges = false

  const updatedSubscribers = subs.map((sub) => {
    const originalStatuses = Array.isArray(sub.statuses) ? sub.statuses : []
    const newStatuses = computeSubscriberStatuses(sub, billingRecords, subs, pricing)

    const changed =
      originalStatuses.length !== newStatuses.length ||
      originalStatuses.some((st, idx) => st !== newStatuses[idx])

    if (changed) {
      hasChanges = true
      return { ...sub, statuses: newStatuses }
    }
    return sub
  })

  return { updatedSubscribers, hasChanges }
}


// حساب ملخص مدة وتاريخ الدين المتراكم للمشترك
function calculateDebtSummary(
  subId: number,
  billingRecords: BillingRecords,
  subscribers: Subscriber[],
  pricing: Pricing,
  selectedYear = 2026,
  activeRows?: Array<{ remaining: number; periodLabel?: string }>
) {
  const sub = subscribers.find((s) => s.id === subId)
  if (!sub || isZeroAccountSubscriber(sub)) {
    return {
      debt: 0,
      months: 0,
      years: 0,
      remainingMonths: 0,
      startDate: '',
      startPeriod: '',
      startYear: selectedYear,
      monthlyDue: 0,
      periodDue: 0,
      remainder: 0,
      durationText: '',
      isZeroAccount: Boolean(sub && isZeroAccountSubscriber(sub))
    }
  }

  // نعتمد السنة المختارة أو 2026 كأساس
  const baseYear = YEARS.includes(selectedYear) ? selectedYear : 2026
  const now = new Date()
  const currentPeriodIndex = Math.min(5, Math.max(0, Math.floor(now.getMonth() / 2)))

  // أسطر السجل للمشترك
  const rows = activeRows || calculateBilling(subId, baseYear, billingRecords, subscribers, pricing).rows

  // استخراج الدين المتبقي في الفترة الحالية؛ وإن كانت 0 نأخذ آخر فترة متبقية
  const currentRow = rows[currentPeriodIndex]
  let debt = 0
  if (currentRow && Number.isFinite(Number(currentRow.remaining))) {
    debt = Math.max(0, Math.round(Number(currentRow.remaining)))
  } else if (rows.length > 0) {
    const lastRow = rows[rows.length - 1]
    debt = Math.max(0, Math.round(Number(lastRow.remaining)))
  }

  // قيمة الاستحقاق لكل شهرين حسب نوع المشترك والعداد
  const meterAmount = Number.parseInt(sub.meterType, 10)
  const periodDue =
    sub.propertyType === 'تجاري'
      ? (Number.isFinite(meterAmount) && meterAmount > 0 ? meterAmount * 60 * 200 : 0)
      : pricing[sub.propertyType]?.[sub.meterType] ?? 24600

  // قيمة الاستحقاق للشهر الواحد
  const monthlyDue = periodDue > 0 ? periodDue / 2 : 12300

  if (debt <= 0) {
    return {
      debt: 0,
      months: 0,
      years: 0,
      remainingMonths: 0,
      startDate: '',
      startPeriod: '',
      startYear: baseYear,
      monthlyDue,
      periodDue,
      remainder: 0,
      durationText: 'مسدد بالكامل',
      isZeroAccount: false
    }
  }

  // حساب عدد الأشهر (تقريب لأقرب شهر)
  const totalMonths = Math.max(1, Math.round(debt / monthlyDue))
  const years = Math.floor(totalMonths / 12)
  const remainingMonths = totalMonths % 12
  const remainder = Math.max(0, debt - totalMonths * monthlyDue)

  // صياغة المدة بالعربي البسيط
  let durationText = ''
  if (years > 0 && remainingMonths > 0) {
    const yStr = years === 1 ? 'سنة واحدة' : years === 2 ? 'سنتان' : `${years} سنوات`
    const mStr = remainingMonths === 1 ? 'شهر واحد' : remainingMonths === 2 ? 'شهران' : `${remainingMonths} أشهر`
    durationText = `${yStr} و ${mStr}`
  } else if (years > 0 && remainingMonths === 0) {
    const yStr = years === 1 ? 'سنة كاملة' : years === 2 ? 'سنتان' : `${years} سنوات`
    durationText = yStr
  } else {
    const mStr = totalMonths === 1 ? 'شهر واحد' : totalMonths === 2 ? 'شهران' : `${totalMonths} أشهر`
    durationText = mStr
  }

  // حساب تاريخ بداية تراكم الدين رجوعاً من نهاية الفترة الحالية
  const endMonth = (currentPeriodIndex + 1) * 2 // شهر 10 مثلاً
  const startMonthRaw = endMonth - totalMonths + 1 // مثلاً 10 - 4 + 1 = 7
  let startYear = baseYear
  let startMonth = startMonthRaw
  while (startMonth <= 0) {
    startMonth += 12
    startYear -= 1
  }

  const startDate = `${startYear}/${String(startMonth).padStart(2, '0')}/01`
  const startPeriodIdx = Math.floor((startMonth - 1) / 2)
  const startPeriod = PERIODS[startPeriodIdx] || ''

  return {
    debt,
    months: totalMonths,
    years,
    remainingMonths,
    startDate,
    startPeriod,
    startYear,
    monthlyDue,
    periodDue,
    remainder,
    durationText,
    isZeroAccount: false
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

// دالة لتنظيف وتجهيز رقم الهاتف للواتساب بدعم الأرقام العراقية والدولية والأرقام المشرقية
function formatWhatsAppPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  let str = String(phone).trim()
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩']
  for (let i = 0; i < 10; i++) {
    str = str.replaceAll(arabicDigits[i], String(i))
  }
  let cleaned = str.replace(/[^0-9]/g, '')
  if (!cleaned) return ''
  if (cleaned.startsWith('00964')) {
    cleaned = cleaned.substring(2)
  } else if (cleaned.startsWith('07') && cleaned.length === 11) {
    cleaned = '964' + cleaned.substring(1)
  } else if (cleaned.startsWith('7') && cleaned.length === 10) {
    cleaned = '964' + cleaned
  }
  return cleaned
}

// دالة توليد رسالة ورابط مشاركة كشف حساب المشترك عبر واتساب
function buildWhatsAppShareMessage(
  sub: Subscriber,
  selectedYear: number,
  activeBilling: { rows: Array<{ remaining: number; periodLabel: string }>; totalRemaining: number } | null | undefined,
  areas: Area[]
): { message: string; url: string; endDate: string; totalAmount: number } {
  const areaObj = areas.find((a) => a.id === sub.areaId)
  const branchObj = areaObj?.branches.find((b) => b.id === sub.branchId)
  const areaText = areaObj ? (branchObj ? `${areaObj.name} - ${branchObj.name}` : areaObj.name) : 'غير محدد'

  const now = new Date()
  const currentYear = now.getFullYear()

  // تحديد الفترة المستهدفة بناء على السنة
  let periodIdx = 0
  if (selectedYear < currentYear) {
    // سنة سابقة: نعتمد نهاية السنة بالكامل (الفترة الأخيرة)
    periodIdx = 5
  } else if (selectedYear === currentYear) {
    // السنة الحالية: نعتمد الفترة الحالية بحسب الشهر الحالي
    periodIdx = Math.min(5, Math.max(0, Math.floor(now.getMonth() / 2)))
  } else {
    // سنة لاحقة: نعتمد الفترة الأولى
    periodIdx = 0
  }

  const endMonth = (periodIdx + 1) * 2
  const lastDay = new Date(selectedYear, endMonth, 0).getDate()
  const endDate = `${selectedYear}/${String(endMonth).padStart(2, '0')}/${String(lastDay).padStart(2, '0')}`

  const isZero = isZeroAccountSubscriber(sub)
  const targetRow = activeBilling?.rows?.[periodIdx]
  const totalAmount = isZero ? 0 : Math.max(0, targetRow?.remaining ?? activeBilling?.totalRemaining ?? 0)

  const message = `مرحبا مشتركنا العزيز
${sub.name}
صاحب رقم الاشتراك ${sub.id}
في منطقه ${areaText}
الديون التي عليك لنهاية ${endDate}
المبلغ الكلي هو ${formatNumber(totalAmount)} د.ع`

  const cleanPhone = formatWhatsAppPhone(sub.phone)
  const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}` : ''

  return { message, url, endDate, totalAmount }
}

export interface MainAppProps {
  initialShowInstallments?: boolean
  userRole?: 'director' | 'manager' | 'collector' | 'writer' | 'guest'
  canEdit?: boolean
  assignedAreaIds?: string[]
  assignedSubscriberIds?: number[]
  customHeaderTitle?: string
  onBack?: () => void
  bypassAuth?: boolean
  branchId?: string
  initialSubscribers?: Subscriber[]
  initialAreas?: Area[]
  initialBilling?: BillingRecords
  initialPricing?: Pricing
  initialAiApiKeys?: string[]
  initialConsignments?: Consignment[]
  onSaveBranchData?: (data: {
    subscribers: Subscriber[]
    areas: Area[]
    billing: BillingRecords
    pricing: Pricing
    aiApiKeys?: string[]
  }) => void
}

export default function MainApp({
  initialShowInstallments = false,
  userRole = 'collector',
  canEdit = true,
  assignedAreaIds,
  assignedSubscriberIds,
  customHeaderTitle,
  onBack,
  bypassAuth = false,
  branchId,
  initialSubscribers,
  initialAreas,
  initialBilling,
  initialPricing,
  initialAiApiKeys,
  initialConsignments = [],
  onSaveBranchData
}: MainAppProps = {}) {
  // حالة تسجيل الدخول (إذا كان دخول مباشر عبر الرابط يتم تجاوزه فوراً)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(bypassAuth)
  const [pinInput, setPinInput] = useState<string>('')
  const [pinError, setPinError] = useState<string>('')

  // حالات إرساليات الكاتب لتحديث السجل الورقي
  const [consignmentsList, setConsignmentsList] = useState<Consignment[]>(() => initialConsignments || [])
  const [showWriterConsignmentsModal, setShowWriterConsignmentsModal] = useState<boolean>(false)
  const [writerConsignmentsFilter, setWriterConsignmentsFilter] = useState<'all' | 'unread'>('unread')
  const [recordedItemIds, setRecordedItemIds] = useState<Set<string>>(new Set())
  const [isRefreshingConsignments, setIsRefreshingConsignments] = useState<boolean>(false)

  // حفظ ومزامنة السطور التي تم تثبيتها في السجل الورقي محلياً
  const recordedStorageKey = `writer_recorded_consignments_${branchId || 'main'}`

  useEffect(() => {
    try {
      const saved = localStorage.getItem(recordedStorageKey)
      if (saved) {
        setRecordedItemIds(new Set(JSON.parse(saved)))
      }
    } catch {}
  }, [recordedStorageKey])

  const toggleRecordItem = (itemId: string) => {
    setRecordedItemIds(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) {
        next.delete(itemId)
      } else {
        next.add(itemId)
      }
      try {
        localStorage.setItem(recordedStorageKey, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  const markAllAsRecorded = (itemIds: string[]) => {
    setRecordedItemIds(prev => {
      const next = new Set(prev)
      itemIds.forEach(id => next.add(id))
      try {
        localStorage.setItem(recordedStorageKey, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  // تحديث قائمة الإرساليات سحابياً فوراً
  const handleRefreshConsignments = async () => {
    setIsRefreshingConsignments(true)
    try {
      const res = await fetch('/api/directorate')
      if (res.ok) {
        const json = await res.json()
        if (json.success && json.data?.branches) {
          const thisBranch = json.data.branches.find((b: any) => b.id === branchId)
          if (thisBranch && thisBranch.consignments) {
            setConsignmentsList(thisBranch.consignments)
          }
        }
      }
    } catch (e) {
      console.error('Error refreshing consignments:', e)
    } finally {
      setIsRefreshingConsignments(false)
    }
  }

  // البيانات الأساسية معزولة لكل فرع حصراً
  const [areas, setAreas] = useState<Area[]>(() => initialAreas || DEFAULT_AREAS)
  const [pricing, setPricing] = useState<Pricing>(() => initialPricing || DEFAULT_PRICING)
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => initialSubscribers || [])
  const [billing, setBilling] = useState<BillingRecords>(() => initialBilling || {})
  const [collectorName, setCollectorName] = useState<string>('احمد المحصل')
  const [collectorPhone, setCollectorPhone] = useState<string>('07801234567')
  const [rangeFrom, setRangeFrom] = useState<number>(1)
  const [rangeTo, setRangeTo] = useState<number>(999999)


  // البحث والفلترة
  const [searchOpen, setSearchOpen] = useState<boolean>(false)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [filterDrawerOpen, setFilterDrawerOpen] = useState<boolean>(false)
  const [filterTypes, setFilterTypes] = useState<{ سكني: boolean; تجاري: boolean }>({ سكني: true, تجاري: true })
  const [filterMeters, setFilterMeters] = useState<string[]>([])
  const [filterCustomMeter, setFilterCustomMeter] = useState<string>('')
  const [filterMeterSearch, setFilterMeterSearch] = useState<string>('')
  const [filterAreas, setFilterAreas] = useState<string[]>([])
  const [filterBranches, setFilterBranches] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [filterAreaSearch, setFilterAreaSearch] = useState<string>('')
  const [filterBranchSearch, setFilterBranchSearch] = useState<string>('')
  const [openFilterAreaId, setOpenFilterAreaId] = useState<string | null>(null)
  const [filterPanel, setFilterPanel] = useState<'type' | 'meter' | 'areas' | 'statuses' | null>(null)

  // الاختيار الحالي
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null)
  const [branchDrawerAreaId, setBranchDrawerAreaId] = useState<string | null>(null)
  const [selectedSubId, setSelectedSubId] = useState<number | null>(null)
  const [selectedYear, setSelectedYear] = useState<number>(2026) // السنة الحالية 2026 افتراضياً

  // القائمة السفلية وقسم يحتاج مراجعة
  const [bottomNavTab, setBottomNavTab] = useState<'subscribers' | 'areas' | 'review' | 'stats'>('subscribers')
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])
  const [reviewSearchQuery, setReviewSearchQuery] = useState<string>('')
  const [reviewReason, setReviewReason] = useState<string>('مراجعة حساب بالدائرة')
  const [reviewPhone, setReviewPhone] = useState<string>('')
  const [reviewNotes, setReviewNotes] = useState<string>('')
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'resolved' | 'all'>('pending')
  const [reviewSelectedArea, setReviewSelectedArea] = useState<string>('all')

  // النوافذ المنبثقة
  const [showAddModal, setShowAddModal] = useState<boolean>(false)
  const [showEditModal, setShowEditModal] = useState<boolean>(false)
  const [showContactModal, setShowContactModal] = useState<boolean>(false)
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false)
  const [settingsTab, setSettingsTab] = useState<'collector' | 'pricing' | 'areas' | 'import' | 'ai'>('collector')
  const [isLocating, setIsLocating] = useState<boolean>(false)

  // صفحة تنزيل الإرساليات والذكاء الاصطناعي
  const [showInstallmentsPage, setShowInstallmentsPage] = useState<boolean>(initialShowInstallments)
  const [showReceiptScannerModal, setShowReceiptScannerModal] = useState<boolean>(false)
  const [aiApiKeys, setAiApiKeys] = useState<string[]>([])
  const [newAiKeyInput, setNewAiKeyInput] = useState<string>('')
  const [aiTestingKey, setAiTestingKey] = useState<string | null>(null)
  const [aiTestResult, setAiTestResult] = useState<{ [key: string]: { success: boolean; message: string } }>({})

  // حساب الإرساليات الخاصة باشتراكات الكاتب
  const writerConsignmentItems = useMemo(() => {
    const list: Array<{
      uniqueKey: string
      consignmentId: string
      serialNumber: string
      paperRefNumber?: string
      collectorName: string
      consignmentDate: string
      createdAt: string
      item: ConsignmentItem
      isRecorded: boolean
    }> = []

    const allowedSubIdSet = new Set<number>()
    const hasSpecificSubs = assignedSubscriberIds && assignedSubscriberIds.length > 0
    const hasSpecificAreas = assignedAreaIds && assignedAreaIds.length > 0

    if (hasSpecificSubs) {
      assignedSubscriberIds.forEach(id => allowedSubIdSet.add(id))
    } else if (hasSpecificAreas) {
      subscribers.forEach(sub => {
        if (sub.areaId && assignedAreaIds.includes(sub.areaId)) {
          allowedSubIdSet.add(sub.id)
        }
      })
    } else {
      subscribers.forEach(sub => allowedSubIdSet.add(sub.id))
    }

    (consignmentsList || []).forEach(c => {
      (c.items || []).forEach((it, idx) => {
        if (allowedSubIdSet.has(it.subscriberId)) {
          const itemKey = `${c.id}_${it.subscriberId}_${it.receiptNumber || idx}`
          list.push({
            uniqueKey: itemKey,
            consignmentId: c.id,
            serialNumber: c.serialNumber || 'بدون رقم',
            paperRefNumber: c.paperRefNumber,
            collectorName: c.collectorName || 'غير محدد',
            consignmentDate: it.paymentDate || c.date || '',
            createdAt: c.createdAt || '',
            item: it,
            isRecorded: recordedItemIds.has(itemKey)
          })
        }
      })
    })

    return list.reverse()
  }, [consignmentsList, assignedSubscriberIds, assignedAreaIds, subscribers, recordedItemIds])

  const unrecordedWriterItems = useMemo(() => {
    return writerConsignmentItems.filter(x => !x.isRecorded)
  }, [writerConsignmentItems])

  const displayedWriterItems = useMemo(() => {
    if (writerConsignmentsFilter === 'unread') {
      return unrecordedWriterItems
    }
    return writerConsignmentItems
  }, [writerConsignmentsFilter, unrecordedWriterItems, writerConsignmentItems])

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
  const [showInlineAddArea, setShowInlineAddArea] = useState<boolean>(false)
  const [inlineAreaName, setInlineAreaName] = useState<string>('')
  const [showInlineAddBranch, setShowInlineAddBranch] = useState<boolean>(false)
  const [inlineBranchName, setInlineBranchName] = useState<string>('')
  const [addSuccessMsg, setAddSuccessMsg] = useState<string>('')
  const [duplicateSubId, setDuplicateSubId] = useState<number | null>(null)

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

  // تعديل الدفعات اللحظي النشط حالياً فقط
  const [editingCell, setEditingCell] = useState<{ key: string; value: string } | null>(null)

  // مراجع السحب
  const swipeStartX = useRef<number>(0)
  const swipeStartY = useRef<number>(0)
  const swipeSubId = useRef<number | null>(null)

  // مرجع التركيز التلقائي على الديون السابقة
  const shouldFocusOldDebtRef = useRef<boolean>(false)



  const focusOldDebtInput = useCallback(() => {
    const tryFocus = () => {
      const el = document.getElementById('first-old-debt-input') as HTMLInputElement | null
      if (el) {
        el.focus()
        el.select()
        return true
      }
      return false
    }

    if (!tryFocus()) {
      setTimeout(tryFocus, 60)
      setTimeout(tryFocus, 180)
      setTimeout(tryFocus, 350)
    }
  }, [])

  // حالة المزامنة السحابية والعمل بدون إنترنت (أوفلاين)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(true)
  const [dataLoaded, setDataLoaded] = useState<boolean>(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // حالات العمل دون إنترنت وقائمة الانتظار
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') return navigator.onLine
    return true
  })
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0)
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false)
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null)

  // مراقبة الاتصال بالإنترنت ومزامنة العمليات المعلقة تلقائياً
  useEffect(() => {
    const checkStatus = () => {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true
      setIsOnline(online)
      setPendingSyncCount(getPendingSyncCount())
    }

    const handleOffline = () => {
      setIsOnline(false)
      setSyncToastMessage('تم التحول لوضع العمل بدون إنترنت (أوفلاين) - جميع العمليات محفوظة محلياً بأمان')
      setTimeout(() => setSyncToastMessage(null), 5000)
    }

    const handleOnline = async () => {
      setIsOnline(true)
      setIsManualSyncing(true)
      const res = await syncPendingOfflineData()
      setIsManualSyncing(false)
      setPendingSyncCount(getPendingSyncCount())
      if (res.syncedCount > 0) {
        setSyncToastMessage(`تم الاتصال بالإنترنت ومزامنة ${res.syncedCount} من العمليات بنجاح!`)
      } else {
        setSyncToastMessage('تم الاتصال بالإنترنت بنجاح')
      }
      setTimeout(() => setSyncToastMessage(null), 4000)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    checkStatus()

    const interval = setInterval(() => {
      setPendingSyncCount(getPendingSyncCount())
    }, 8000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  // دالة تشغيل المزامنة اليدوية فوراً
  const handleTriggerSync = async () => {
    if (!navigator.onLine) {
      setSyncToastMessage('الجهاز غير متصل بالإنترنت حالياً - سيتم الرفع تلقائياً فور توفر الشبكة')
      setTimeout(() => setSyncToastMessage(null), 4000)
      return
    }
    setIsManualSyncing(true)
    const res = await syncPendingOfflineData()
    setIsManualSyncing(false)
    setPendingSyncCount(getPendingSyncCount())
    if (res.syncedCount > 0) {
      setSyncToastMessage(`تمت مزامنة ${res.syncedCount} من العمليات بنجاح مع السحابة`)
    } else {
      setSyncToastMessage('كافة البيانات متزامنة مع السحابة بالفعل')
    }
    setTimeout(() => setSyncToastMessage(null), 3500)
  }

  // الشهر الحالي 0-5
  const currentPeriodIndex = useMemo(() => {
    const month = new Date().getMonth() // 0-11
    return Math.floor(month / 2) // 0-5
  }, [])

  // فحص تسجيل الدخول عند البدء
  useEffect(() => {
    if (bypassAuth) {
      setIsAuthenticated(true)
      return
    }
    const auth = localStorage.getItem(AUTH_STORAGE_KEY)
    if (auth === 'true') {
      setIsAuthenticated(true)
    }
  }, [bypassAuth])

  // مراقبة الانتقال بين المشتركين للتركيز التلقائي
  useEffect(() => {
    if (shouldFocusOldDebtRef.current && selectedSubId) {
      shouldFocusOldDebtRef.current = false
      const timer = setTimeout(() => {
        focusOldDebtInput()
      }, 70)
      return () => clearTimeout(timer)
    }
  }, [selectedSubId, focusOldDebtInput])

  // إغلاق نافذة حساب المشترك وتحديث تاريخ المتصفح
  const handleCloseSubscriberModal = useCallback(() => {
    setSelectedSubId(null)
    setEditingCell(null)
    setShowContactModal(false)
    setShowEditModal(false)
    if (typeof window !== 'undefined' && window.location.hash === '#sub') {
      window.history.back()
    }
  }, [])

  // ربط زر الرجوع في الهاتف بإغلاق نافذة حساب المشترك دون الخروج من الموقع
  useEffect(() => {
    if (typeof window === 'undefined') return

    if (selectedSubId !== null) {
      if (window.location.hash !== '#sub') {
        window.location.hash = 'sub'
      }
    } else {
      if (window.location.hash === '#sub') {
        window.history.replaceState(null, '', window.location.pathname)
      }
    }

    const handleHashChange = () => {
      if (window.location.hash !== '#sub') {
        setSelectedSubId(null)
        setEditingCell(null)
        setShowContactModal(false)
        setShowEditModal(false)
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [selectedSubId])

  // تحميل البيانات: عزل الفرع أولاً لمنع ظهور مشتركي الأفرع الأخرى
  useEffect(() => {
    if (!isAuthenticated) return

    // إذا كانت بيانات الفرع محددة مسبقاً (وضع المديرية متعدد الأفرع)
    if (branchId !== undefined || initialSubscribers !== undefined) {
      if (initialAreas) setAreas(initialAreas)
      if (initialPricing) setPricing(initialPricing)
      if (initialBilling) setBilling(initialBilling)
      if (initialAiApiKeys) setAiApiKeys(initialAiApiKeys)
      if (initialSubscribers) {
        const { updatedSubscribers } = applyAutoStatuses(initialSubscribers, initialBilling || {}, initialPricing || DEFAULT_PRICING)
        setSubscribers(updatedSubscribers)
      } else {
        setSubscribers([])
      }
      setIsLoadingCloud(false)
      setDataLoaded(true)
      return
    }

    const applyData = (data: Record<string, unknown>) => {
      const rawSubs = (data.subscribers as Subscriber[]) || []
      const rawBill = (data.billing as BillingRecords) || {}
      const rawPrice = (data.pricing as Pricing) || DEFAULT_PRICING
      const { updatedSubscribers } = applyAutoStatuses(rawSubs, rawBill, rawPrice)

      if (data.areas) setAreas(data.areas as Area[])
      if (data.pricing) setPricing(data.pricing as Pricing)
      setSubscribers(updatedSubscribers)
      if (data.billing) setBilling(data.billing as BillingRecords)
      if (data.collectorName) setCollectorName(data.collectorName as string)
      if (data.collectorPhone) setCollectorPhone(data.collectorPhone as string)
      if (data.rangeFrom !== undefined) setRangeFrom(data.rangeFrom as number)
      if (data.rangeTo !== undefined) setRangeTo(data.rangeTo as number)
      if (data.reviewItems) setReviewItems(data.reviewItems as ReviewItem[])
      if (data.aiApiKeys && Array.isArray(data.aiApiKeys)) {
        setAiApiKeys(data.aiApiKeys as string[])
      }
    }

    const init = async () => {
      setIsLoadingCloud(true)
      try {
        const savedKeys = localStorage.getItem('AI_GEMINI_API_KEYS')
        if (savedKeys) {
          const parsed = JSON.parse(savedKeys)
          if (Array.isArray(parsed) && parsed.length > 0) setAiApiKeys(parsed)
        }
      } catch {}

      const cloudData = await loadFromCloud()
      if (cloudData) {
        applyData(cloudData)
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudData)) } catch {}
      } else {
        try {
          const saved = localStorage.getItem(STORAGE_KEY)
          if (saved) applyData(JSON.parse(saved))
        } catch {}
      }
      setIsLoadingCloud(false)
      setDataLoaded(true)
    }
    init()
  }, [isAuthenticated, branchId, initialSubscribers, initialAreas, initialBilling, initialPricing, initialAiApiKeys])

  // مراقبة تحديثات الفواتير والمدفوعات لتحديث الحالات تلقائياً
  useEffect(() => {
    if (!isAuthenticated || !dataLoaded || subscribers.length === 0) return
    const { updatedSubscribers, hasChanges } = applyAutoStatuses(subscribers, billing, pricing)
    if (hasChanges) {
      setSubscribers(updatedSubscribers)
    }
  }, [billing, dataLoaded, isAuthenticated])

  // المزامنة اللحظية الحية الفورية (Realtime Broadcast + Database Changes)
  const isIncomingSyncRef = useRef<boolean>(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!isAuthenticated || !dataLoaded) return

    const applyIncomingData = (data: Record<string, unknown>) => {
      isIncomingSyncRef.current = true
      const rawSubs = (data.subscribers as Subscriber[]) || []
      const rawBill = (data.billing as BillingRecords) || {}
      const rawPrice = (data.pricing as Pricing) || DEFAULT_PRICING
      const { updatedSubscribers } = applyAutoStatuses(rawSubs, rawBill, rawPrice)

      if (data.areas) setAreas(data.areas as Area[])
      if (data.pricing) setPricing(data.pricing as Pricing)
      setSubscribers(updatedSubscribers)
      if (data.billing) setBilling(data.billing as BillingRecords)
      if (data.collectorName) setCollectorName(data.collectorName as string)
      if (data.collectorPhone) setCollectorPhone(data.collectorPhone as string)
      if (data.rangeFrom !== undefined) setRangeFrom(data.rangeFrom as number)
      if (data.rangeTo !== undefined) setRangeTo(data.rangeTo as number)
      if (data.reviewItems) setReviewItems(data.reviewItems as ReviewItem[])
      setTimeout(() => { isIncomingSyncRef.current = false }, 100)
    }

    const channel = supabase.channel('app_sync_realtime_broadcast', {
      config: { broadcast: { self: false } }
    })

    channel
      .on('broadcast', { event: 'instant_sync_ping' }, async () => {
        const latest = await loadFromCloud()
        if (latest) applyIncomingData(latest)
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
  }, [dataLoaded, isAuthenticated])

  // الحفظ التلقائي المحلي + البث اللحظي السريع + الحفظ السحابي
  useEffect(() => {
    if (!isAuthenticated || !dataLoaded) return
    if (isIncomingSyncRef.current) return

    const data = { areas, pricing, subscribers, billing, collectorName, collectorPhone, rangeFrom, rangeTo, reviewItems, aiApiKeys }

    // 1. حفظ محلي فوري
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}

    // 2. بث مباشر فوري خفيف للأجهزة الأخرى (إشعار خفيف لتفادي خطأ 422 وتجاوز سعة سوبابيس)
    if (channelRef.current && (channelRef.current as unknown as { state?: string }).state === 'joined') {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'instant_sync_ping',
          payload: { t: Date.now() }
        })
      } catch {}
    }

    // 3. حفظ سحابي دائم: إما للفرع المحدد حصراً أو حفظ عام
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    setIsSyncing(true)
    saveTimerRef.current = setTimeout(async () => {
      if (onSaveBranchData) {
        onSaveBranchData({
          subscribers,
          areas,
          billing,
          pricing,
          aiApiKeys
        })
      } else {
        await saveToCloud(data as Record<string, unknown>)
      }
      setIsSyncing(false)
    }, 500)
  }, [areas, pricing, subscribers, billing, collectorName, collectorPhone, rangeFrom, rangeTo, reviewItems, aiApiKeys, dataLoaded, isAuthenticated, onSaveBranchData])

  // تسجيل الدخول بشكل آمن عبر السيرفر
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pinInput.trim()) {
      setPinError('يرجى إدخال الرمز السري')
      return
    }
    try {
      const res = await fetch('/api/auth/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput.trim() })
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setIsAuthenticated(true)
        localStorage.setItem(AUTH_STORAGE_KEY, 'true')
        setPinError('')
      } else {
        setPinError(data.error || 'رمز الدخول غير صحيح، يرجى المحاولة مجدداً')
      }
    } catch {
      setPinError('تعذر الاتصال بالخادم للتحقق من الرمز')
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

  // المشتركون ضمن نطاق الفرع والمناطق المخصصة
  const subscribersInRange = useMemo(() => {
    let list = subscribers.filter((s) => 
      (s.id >= rangeFrom && s.id <= rangeTo) || 
      isRecentlyAddedSubscriber(s) || 
      (Boolean(s.name) && s.name.trim() !== '' && s.name !== 'رقم شاغر')
    )

    // إذا كان للمستخدم مناطق أو مشتركون مخصصون حصراً
    const hasAssignedAreas = assignedAreaIds && assignedAreaIds.length > 0
    const hasAssignedSubs = assignedSubscriberIds && assignedSubscriberIds.length > 0

    if (hasAssignedAreas || hasAssignedSubs) {
      list = list.filter((s) => {
        const matchesArea = hasAssignedAreas && (
          (s.areaId && assignedAreaIds.includes(s.areaId)) ||
          (s.areaIds && s.areaIds.some(aid => assignedAreaIds.includes(aid)))
        )
        const matchesSubId = hasAssignedSubs && assignedSubscriberIds.includes(s.id)
        return Boolean(matchesArea || matchesSubId)
      })
    }

    return list
  }, [subscribers, rangeFrom, rangeTo, assignedAreaIds, assignedSubscriberIds])

  // فلترة المشتركين حسب النوع
  const typeFiltered = useMemo(() => {
    const both = filterTypes.سكني && filterTypes.تجاري
    const none = !filterTypes.سكني && !filterTypes.تجاري
    if (both || none) return subscribersInRange
    if (filterTypes.سكني) return subscribersInRange.filter((s) => s.propertyType === 'سكني')
    return subscribersInRange.filter((s) => s.propertyType === 'تجاري')
  }, [subscribersInRange, filterTypes])

  // أنواع المتر المتوفرة بناءً على نوع العقار ونطاق المشتركين
  const availableMeterTypes = useMemo(() => {
    const set = new Set<string>()
    const isOnlyResidential = filterTypes.سكني && !filterTypes.تجاري
    const isOnlyCommercial = !filterTypes.سكني && filterTypes.تجاري

    if (isOnlyResidential) {
      RESIDENTIAL_METERS.forEach((m) => set.add(m))
    } else if (isOnlyCommercial) {
      subscribersInRange
        .filter((s) => s.propertyType === 'تجاري' && s.meterType)
        .forEach((s) => set.add(s.meterType))
      if (set.size === 0) {
        COMMERCIAL_METERS.slice(0, 10).forEach((m) => set.add(m))
      }
    } else {
      RESIDENTIAL_METERS.forEach((m) => set.add(m))
      subscribersInRange.forEach((s) => {
        if (s.meterType) set.add(s.meterType)
      })
    }

    return Array.from(set).sort((a, b) => {
      const numA = parseInt(a, 10) || 0
      const numB = parseInt(b, 10) || 0
      if (numA !== numB) return numA - numB
      return a.localeCompare(b, 'ar')
    })
  }, [subscribersInRange, filterTypes])

  // عدد المشتركين لكل نوع متر بناءً على نوع العقار المختار
  const meterCounts = useMemo(() => {
    const map = new Map<string, number>()
    availableMeterTypes.forEach((m) => map.set(m, 0))
    typeFiltered.forEach((s) => {
      if (s.meterType) {
        map.set(s.meterType, (map.get(s.meterType) || 0) + 1)
      }
    })
    return map
  }, [availableMeterTypes, typeFiltered])

  // فلترة حسب نوع المتر المختار أو المكتوب يدوياً
  const meterFiltered = useMemo(() => {
    const hasCustom = filterCustomMeter.trim() !== ''
    const hasSelected = filterMeters.length > 0
    if (!hasCustom && !hasSelected) return typeFiltered

    const customNum = hasCustom ? parseInt(filterCustomMeter, 10) : NaN

    return typeFiltered.filter((s) => {
      if (hasCustom) {
        const subNum = parseInt(s.meterType, 10)
        if (!isNaN(customNum) && !isNaN(subNum) && subNum === customNum) return true
        if (s.meterType.includes(filterCustomMeter.trim())) return true
      }
      if (hasSelected && filterMeters.includes(s.meterType)) return true
      return false
    })
  }, [typeFiltered, filterMeters, filterCustomMeter])

  // عدد المشتركين لكل منطقة بناءً على نوع العقار ونوع المتر المختار
  const areaCounts = useMemo(() => {
    const map = new Map<string, number>()
    areas.forEach((a) => map.set(a.id, 0))
    meterFiltered.forEach((s) => {
      map.set(s.areaId, (map.get(s.areaId) || 0) + 1)
    })
    return map
  }, [meterFiltered, areas])

  // فلترة حسب المناطق المختارة
  const areaFiltered = useMemo(() => {
    if (filterAreas.length === 0) return meterFiltered
    return meterFiltered.filter((s) => filterAreas.includes(s.areaId))
  }, [meterFiltered, filterAreas])

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
    if (filterMeters.length > 0 || filterCustomMeter.trim() !== '') count++
    if (filterAreas.length > 0) count++
    if (filterBranches.length > 0) count++
    if (filterStatuses.length > 0) count++
    return count
  }, [filterTypes, filterMeters, filterCustomMeter, filterAreas, filterBranches, filterStatuses])

  // القائمة المعروضة في الصفحة الرئيسية
  const displayedSubscribers = useMemo(() => {
    const q = searchQuery.trim()
    // إذا كان هناك بحث نشط، نبحث في كل المشتركين بلا استثناء لضمان إيجاد أي مشترك مسجل
    let list = q ? subscribers : subscribersInRange

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

    // فلتر نوع المتر (مختار أو مكتوب يدوياً)
    if (filterMeters.length > 0 || filterCustomMeter.trim() !== '') {
      const hasCustom = filterCustomMeter.trim() !== ''
      const hasSelected = filterMeters.length > 0
      const customNum = hasCustom ? parseInt(filterCustomMeter, 10) : NaN

      list = list.filter((s) => {
        if (hasCustom) {
          const subNum = parseInt(s.meterType, 10)
          if (!isNaN(customNum) && !isNaN(subNum) && subNum === customNum) return true
          if (s.meterType.includes(filterCustomMeter.trim())) return true
        }
        if (hasSelected && filterMeters.includes(s.meterType)) return true
        return false
      })
    }

    // المنطقة المحددة من التبويبات العلوية أو الفلتر
    if (selectedAreaId) {
      list = list.filter((s) => s.areaId === selectedAreaId)
      if (activeBranchId) {
        list = list.filter((s) => s.branchId === activeBranchId)
      } else if (filterBranches.length > 0) {
        list = list.filter((s) => filterBranches.includes(s.branchId))      }
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

    // وضع المشتركين المضافين حديثاً (خلال آخر 1 ساعة) في المقدمة دائماً
    const recentList: Subscriber[] = []
    const normalList: Subscriber[] = []

    for (const sub of list) {
      if (isRecentlyAddedSubscriber(sub)) {
        recentList.push(sub)
      } else {
        normalList.push(sub)
      }
    }

    // ترتيب المشتركين الجدد من الأحدث إضافة إلى الأقدم
    recentList.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return timeB - timeA
    })

    return [...recentList, ...normalList]
  }, [
    subscribers,
    subscribersInRange,
    searchQuery,
    filterTypes,
    filterMeters,
    filterCustomMeter,
    selectedAreaId,
    activeBranchId,
    filterAreas,
    filterBranches,
    filterStatuses
  ])

  // مسح الفلاتر
  const clearAllFilters = () => {
    setFilterTypes({ سكني: true, تجاري: true })
    setFilterMeters([])
    setFilterCustomMeter('')
    setFilterAreas([])
    setFilterBranches([])
    setFilterStatuses([])
    setOpenFilterAreaId(null)
    setFilterPanel(null)
    setFilterAreaSearch('')
    setFilterBranchSearch('')
    setFilterMeterSearch('')
  }

  // حفظ تعديل في جدول الديون مع تسلسل الحسابات تلقائياً لكل فترات السنة
  const handlePaymentEdit = (subId: number, year: number, periodIdx: number, field: 'old' | 'total' | 'paid' | 'rem', value: string) => {
    const cleanVal = sanitizeNumberInput(value, field === 'rem')
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
          oldDebtManual: cleanVal === '' ? null : num,
          remainingManual: null
        }
      } else if (field === 'total') {
        // عند تعديل خانة المجموع
        yearRecords[periodIdx] = {
          ...yearRecords[periodIdx],
          totalManual: cleanVal === '' ? null : num,
          remainingManual: null
        }
      } else if (field === 'paid') {
        yearRecords[periodIdx] = {
          ...yearRecords[periodIdx],
          paid: num,
          remainingManual: null
        }
      } else if (field === 'rem') {
        // عند تعديل خانة المجموع الكلي
        if (cleanVal === '') {
          yearRecords[periodIdx] = {
            ...yearRecords[periodIdx],
            remainingManual: null
          }
        } else {
          // حساب المجموع الحالي لمعرفة فرق الدفع
          const currentBilling = calculateBilling(subId, year, copy, subscribers, pricing)
          const row = currentBilling.rows[periodIdx]
          const currentTotal = row ? row.total : 0
          const diff = currentTotal - num
          if (diff >= 0) {
            yearRecords[periodIdx] = {
              ...yearRecords[periodIdx],
              paid: diff,
              remainingManual: num
            }
          } else {
            yearRecords[periodIdx] = {
              ...yearRecords[periodIdx],
              paid: 0,
              remainingManual: num
            }
          }
        }
      }

      // مسح أي تجميد يدوي في كل الفترات اللاحقة لكي تتسلسل وتتحدث تلقائياً
      for (let nextP = periodIdx + 1; nextP < 6; nextP++) {
        if (yearRecords[nextP]) {
          yearRecords[nextP] = {
            ...yearRecords[nextP],
            oldDebtManual: null,
            totalManual: null,
            remainingManual: null
          }
        }
      }

      copy[subId][year] = yearRecords

      // تحديث حالة المشترك (يدفع باستمرار) فوراً ولحظياً بناءً على الحساب الجديد
      setSubscribers((prevSubs) => {
        let anyChange = false
        const nextSubs = prevSubs.map((s) => {
          if (s.id !== subId) return s
          const updatedSub = field === 'old' && periodIdx === 0 && year === 2026
            ? { ...s, remainingPrev: num }
            : s
          const newStatuses = computeSubscriberStatuses(updatedSub, copy, prevSubs, pricing)
          const oldStatuses = Array.isArray(s.statuses) ? s.statuses : []
          const isDiff =
            oldStatuses.length !== newStatuses.length ||
            oldStatuses.some((st, i) => st !== newStatuses[i]) ||
            (field === 'old' && periodIdx === 0 && year === 2026 && s.remainingPrev !== num)

          if (isDiff) {
            anyChange = true
            return { ...updatedSub, statuses: newStatuses }
          }
          return s
        })
        return anyChange ? nextSubs : prevSubs
      })

      return copy
    })
  }

  // إدارة مفاتيح الذكاء الاصطناعي
  const handleAddAiKey = () => {
    const key = newAiKeyInput.trim()
    if (!key) return
    if (aiApiKeys.includes(key)) {
      alert('هذا المفتاح مضاف مسبقاً')
      return
    }
    const next = [...aiApiKeys, key]
    setAiApiKeys(next)
    try { localStorage.setItem('AI_GEMINI_API_KEYS', JSON.stringify(next)) } catch {}
    setNewAiKeyInput('')
  }

  const handleRemoveAiKey = (keyToRemove: string) => {
    const next = aiApiKeys.filter((k) => k !== keyToRemove)
    setAiApiKeys(next)
    try { localStorage.setItem('AI_GEMINI_API_KEYS', JSON.stringify(next)) } catch {}
  }

  const handleTestAiKey = async (key: string) => {
    setAiTestingKey(key)
    try {
      const res = await testGeminiApiKey(key)
      setAiTestResult((prev) => ({ ...prev, [key]: res }))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل الفحص'
      setAiTestResult((prev) => ({ ...prev, [key]: { success: false, message: msg } }))
    } finally {
      setAiTestingKey(null)
    }
  }

  // تعديل اسم المشترك مباشرة في النظام
  const handleUpdateSubscriberName = (subId: number, newName: string) => {
    setSubscribers((prev) => prev.map((s) => (s.id === subId ? { ...s, name: newName.trim() } : s)))
  }

  // تنزيل وتطبيق الدفعات المستخرجة من وصولات الذكاء الاصطناعي مع إمكانية تحديث الأسماء
  const handleApplyScannedPayments = (
    paymentsToApply: Array<{
      subId: number
      year: number
      periodIdx: number
      amount: number
    }>,
    nameUpdates?: Array<{ subId: number; newName: string }>
  ) => {
    // 1. تحديث الأسماء في قائمة المشتركين إذا تم تعديلها
    if (nameUpdates && nameUpdates.length > 0) {
      setSubscribers((prevSubs) => {
        return prevSubs.map((s) => {
          const update = nameUpdates.find((u) => u.subId === s.id)
          if (update && update.newName) {
            return { ...s, name: update.newName }
          }
          return s
        })
      })
    }

    // 2. تحديث جدول الفواتير والمدفوعات
    setBilling((prev) => {
      const copy = { ...prev }
      paymentsToApply.forEach(({ subId, year, periodIdx, amount }) => {
        if (!copy[subId]) copy[subId] = {}
        if (!copy[subId][year]) {
          copy[subId][year] = PERIODS.map(() => ({ oldDebtManual: null, paid: 0 }))
        }
        const yearRecords = [...copy[subId][year]]
        yearRecords[periodIdx] = {
          ...yearRecords[periodIdx],
          paid: amount,
          remainingManual: null
        }

        // مسح أي تجميد يدوي في الفترات اللاحقة لتتسلسل الحسابات تلقائياً
        for (let nextP = periodIdx + 1; nextP < 6; nextP++) {
          if (yearRecords[nextP]) {
            yearRecords[nextP] = {
              ...yearRecords[nextP],
              oldDebtManual: null,
              totalManual: null,
              remainingManual: null
            }
          }
        }
        copy[subId][year] = yearRecords
      })

      // تحديث حالات المشتركين بناءً على المبالغ الجديدة
      setSubscribers((prevSubs) => {
        const nextSubs = prevSubs.map((s) => {
          const wasModified = paymentsToApply.some((p) => p.subId === s.id)
          if (!wasModified) return s
          const newStatuses = computeSubscriberStatuses(s, copy, prevSubs, pricing)
          return { ...s, statuses: newStatuses }
        })
        return nextSubs
      })

      return copy
    })
  }

  // حفظ وتنزيل الإرساليات (إنشاء حسابات المشتركين الجدد وتنزيل دفعات الشهرين الحاليين)
  const handleSaveConsignments = async (
    newSubsToAdd: Subscriber[],
    paymentsToApply: Array<{
      subId: number
      year: number
      periodIdx: number
      amount: number
    }>
  ) => {
    // 1. إضافة المشتركين الجدد إلى قائمة المشتركين
    let nextSubscribers = [...subscribers]
    if (newSubsToAdd.length > 0) {
      const existingIds = new Set(nextSubscribers.map((s) => s.id))
      const trulyNew = newSubsToAdd.filter((ns) => !existingIds.has(ns.id))
      nextSubscribers = [...trulyNew, ...nextSubscribers]
      setSubscribers(nextSubscribers)
    }

    // 2. تحديث جدول الفواتير والمدفوعات
    const copyBilling: BillingRecords = { ...billing }

    // تجهيز سجلات الفواتير للمشتركين الجدد
    newSubsToAdd.forEach((ns) => {
      if (!copyBilling[ns.id]) {
        copyBilling[ns.id] = {}
        YEARS.forEach((y) => {
          copyBilling[ns.id][y] = PERIODS.map(() => ({ oldDebtManual: null, paid: 0 }))
        })
      }
    })

    // تطبيق وتنزيل مبالغ الدفعات في الشهرين المحددين
    paymentsToApply.forEach(({ subId, year, periodIdx, amount }) => {
      if (!copyBilling[subId]) copyBilling[subId] = {}
      if (!copyBilling[subId][year]) {
        copyBilling[subId][year] = PERIODS.map(() => ({ oldDebtManual: null, paid: 0 }))
      }
      const yearRecords = [...copyBilling[subId][year]]
      const existingRec = yearRecords[periodIdx] || { oldDebtManual: null, paid: 0 }
      const currentPaid = existingRec.paid || 0

      // إضافة المبلغ المدفوع الجديد إلى المدفوع سابقاً
      yearRecords[periodIdx] = {
        ...existingRec,
        paid: currentPaid + amount,
        remainingManual: null
      }

      // مسح أي تجميد يدوي في الفترات اللاحقة لتسلسل الحسابات تلقائياً
      for (let nextP = periodIdx + 1; nextP < 6; nextP++) {
        if (yearRecords[nextP]) {
          yearRecords[nextP] = {
            ...yearRecords[nextP],
            oldDebtManual: null,
            totalManual: null,
            remainingManual: null
          }
        }
      }
      copyBilling[subId][year] = yearRecords
    })

    // 3. تحديث الحالات المالية لجميع المشتركين المتأثرين
    const updatedSubsWithStatus = nextSubscribers.map((s) => {
      const wasModified = paymentsToApply.some((p) => p.subId === s.id)
      if (!wasModified) return s
      const newStatuses = computeSubscriberStatuses(s, copyBilling, nextSubscribers, pricing)
      return { ...s, statuses: newStatuses }
    })

    setSubscribers(updatedSubsWithStatus)
    setBilling(copyBilling)

    // 4. حفظ سحابي ومحلي فوري في سوبابيس
    const syncData = {
      areas,
      pricing,
      subscribers: updatedSubsWithStatus,
      billing: copyBilling,
      collectorName,
      collectorPhone,
      rangeFrom,
      rangeTo,
      reviewItems,
      aiApiKeys
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncData))
    } catch {}

    await saveToCloud(syncData)

    // 5. إرسال بث فوري للأجهزة الأخرى المفتوحة
    if (channelRef.current && (channelRef.current as unknown as { state?: string }).state === 'joined') {
      try {
        channelRef.current.send({
          type: 'broadcast',
          event: 'instant_sync_ping',
          payload: { t: Date.now() }
        })
      } catch {}
    }

    return true
  }

  // تصفير حساب المشترك بالكامل وإعادته لوضعه الأصلي وجعل الدين السابق لأول شهرين 0
  const handleResetSubscriberAccount = (subId: number) => {
    const sub = subscribers.find((s) => s.id === subId)
    const subName = sub ? sub.name : `رقم ${subId}`
    if (!window.confirm(`هل أنت متأكد من تصفير حساب المشترك (${subName}) بالكامل وإعادة الدين السابق لأول شهرين إلى 0؟`)) {
      return
    }

    // 1. تصفير الدين السابق في بيانات المشترك
    setSubscribers((prevSubs) => {
      return prevSubs.map((s) => {
        if (s.id !== subId) return s
        const updated = { ...s, remainingPrev: 0 }
        const newStatuses = computeSubscriberStatuses(updated, billing, prevSubs, pricing)
        return { ...updated, statuses: newStatuses }
      })
    })

    // 2. تصفير كافة السجلات والمدفوعات لجميع السنوات وجعلها فارغة ونظيفة
    setBilling((prev) => {
      const copy = { ...prev }
      copy[subId] = {
        2026: PERIODS.map(() => ({
          oldDebtManual: null,
          paid: 0,
          totalManual: null,
          remainingManual: null
        })),
        2027: PERIODS.map(() => ({
          oldDebtManual: null,
          paid: 0,
          totalManual: null,
          remainingManual: null
        })),
        2028: PERIODS.map(() => ({
          oldDebtManual: null,
          paid: 0,
          totalManual: null,
          remainingManual: null
        }))
      }
      return copy
    })

    // 3. مسح أي خلية تحرير نشطة
    setEditingCell(null)
  }

  // فتح نافذة إضافة مشترك وتجهيز الخيارات تلقائياً
  const openAddModal = () => {
    setFormError('')
    const defaultArea = areas[0]?.id || ''
    const defaultBranch = areas[0]?.branches[0]?.id || ''
    setNewSub({
      idStr: '',
      name: '',
      areaId: defaultArea,
      branchId: defaultBranch,
      phone: '',
      propertyType: 'سكني',
      meterType: '4 متر',
      statuses: []
    })
    setShowInlineAddArea(false)
    setShowInlineAddBranch(false)
    setInlineAreaName('')
    setInlineBranchName('')
    setDuplicateSubId(null)
    setShowAddModal(true)
  }

  // إضافة سريعة لمنطقة من داخل فورم إضافة المشترك
  const handleQuickAddArea = () => {
    if (!inlineAreaName.trim()) return
    const newAreaId = `area_${Date.now()}`
    const newBranchId = `b_${Date.now()}`
    const newArea: Area = {
      id: newAreaId,
      name: inlineAreaName.trim(),
      branches: [{ id: newBranchId, name: 'الرئيسي' }]
    }
    setAreas((prev) => [...prev, newArea])
    setNewSub((p) => ({
      ...p,
      areaId: newAreaId,
      branchId: newBranchId
    }))
    setInlineAreaName('')
    setShowInlineAddArea(false)
  }

  // إضافة سريعة لفرع من داخل فورم إضافة المشترك
  const handleQuickAddBranch = () => {
    if (!inlineBranchName.trim()) return
    if (!newSub.areaId) {
      setFormError('يرجى اختيار المنطقة أولاً لإضافة فرع لها')
      return
    }
    const newBranchId = `b_${Date.now()}`
    const branchName = inlineBranchName.trim()
    setAreas((prev) =>
      prev.map((a) =>
        a.id === newSub.areaId
          ? { ...a, branches: [...a.branches, { id: newBranchId, name: branchName }] }
          : a
      )
    )
    setNewSub((p) => ({
      ...p,
      branchId: newBranchId
    }))
    setInlineBranchName('')
    setShowInlineAddBranch(false)
  }

  // إضافة مشترك
  const handleAddSubscriberSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setDuplicateSubId(null)

    const id = Number(newSub.idStr.replace(/[^0-9]/g, ''))
    if (!newSub.idStr.trim() || isNaN(id) || id <= 0) {
      setFormError('رقم المشترك إجباري ويجب أن يكون رقماً صحيحاً')
      return
    }

    const existing = subscribers.find((s) => s.id === id)
    if (existing) {
      // إذا كان الرقم مسجلاً كـ "رقم شاغر"، نملؤه فوراً باسم المشترك الجديد
      if (!existing.name || existing.name === 'رقم شاغر' || existing.name.trim() === '') {
        const area = areas.find((a) => a.id === newSub.areaId)
        const branchId = newSub.branchId || area?.branches[0]?.id || ''
        const rawMeter = newSub.meterType?.trim()
        const meterDigits = rawMeter ? rawMeter.replace(/[^\d]/g, '') : ''
        const meterType = meterDigits ? `${meterDigits} متر` : (newSub.propertyType === 'تجاري' ? '10 متر' : '4 متر')

        const updated: Subscriber = {
          ...existing,
          name: newSub.name.trim(),
          phone: newSub.phone.trim(),
          areaId: newSub.areaId,
          branchId,
          propertyType: newSub.propertyType,
          meterType,
          detailedAddress: `قرب ${area?.name || ''}`,
          statuses: newSub.statuses,
          createdAt: new Date().toISOString()
        }

        setSubscribers((prev) => prev.map((s) => (s.id === id ? updated : s)))
        setShowAddModal(false)
        setAddSuccessMsg(`تم تحديث المشترك (${formatNumber(id)} - ${updated.name}) بنجاح! وسيبقى في أعلى القائمة لمدة ساعة.`)
        setTimeout(() => setAddSuccessMsg(''), 6000)
        return
      } else {
        setFormError(`رقم المشترك ${formatNumber(id)} مسجل مسبقاً باسم: ${existing.name}`)
        setDuplicateSubId(id)
        return
      }
    }
    if (!newSub.name.trim() || newSub.name.trim().length < 2) {
      setFormError('اسم المشترك إجباري')
      return
    }
    if (!newSub.areaId) {
      setFormError('يرجى اختيار المنطقة أو إضافة منطقة جديدة')
      return
    }

    const area = areas.find((a) => a.id === newSub.areaId)
    const branchId = newSub.branchId || area?.branches[0]?.id || ''
    const maxOrder = subscribers.reduce((acc, curr) => Math.max(acc, curr.order), 0)

    const rawMeter = newSub.meterType?.trim()
    const meterDigits = rawMeter ? rawMeter.replace(/[^\d]/g, '') : ''
    const meterType = meterDigits ? `${meterDigits} متر` : (newSub.propertyType === 'تجاري' ? '10 متر' : '4 متر')

    const created: Subscriber = {
      id,
      name: newSub.name.trim(),
      phone: newSub.phone.trim(),
      areaId: newSub.areaId,
      branchId,
      propertyType: newSub.propertyType,
      meterType,
      detailedAddress: `قرب ${area?.name || ''}`,
      order: maxOrder + 1,
      statuses: newSub.statuses,
      createdAt: new Date().toISOString()
    }

    setSubscribers((prev) => [created, ...prev])

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
    setAddSuccessMsg(`تمت إضافة المشترك (${formatNumber(id)} - ${created.name}) بنجاح! وسيبقى في أعلى القائمة لمدة ساعة.`)
    setTimeout(() => {
      setAddSuccessMsg('')
    }, 6000)
  }

  // حفظ تعديل مشترك
  const handleEditSubscriberSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editSub.id) return

    const originalSub = subscribers.find((s) => s.id === editSub.id)
    const rawMeter = editSub.meterType?.trim()
    const meterDigits = rawMeter ? rawMeter.replace(/[^\d]/g, '') : ''
    const finalMeterType = meterDigits ? `${meterDigits} متر` : (originalSub?.meterType || '4 متر')
    const finalEditSub = { ...editSub, meterType: finalMeterType }

    setSubscribers((prev) =>
      prev.map((s) => (s.id === editSub.id ? { ...s, ...finalEditSub } as Subscriber : s))
    )

    // إذا تغير نوع العقار أو حجم المتر للمشترك، نضمن إعادة احتساب الفواتير بالسعر الجديد وتدفق الديون بمسح أي تجميد يدوي سابق
    const isPricingChanged =
      (finalEditSub.propertyType && finalEditSub.propertyType !== originalSub?.propertyType) ||
      (finalEditSub.meterType && finalEditSub.meterType !== originalSub?.meterType)

    if (isPricingChanged) {
      setBilling((prev) => {
        const copy = { ...prev }
        if (copy[editSub.id!]) {
          const subBilling = { ...copy[editSub.id!] }
          YEARS.forEach((y) => {
            if (subBilling[y]) {
              subBilling[y] = subBilling[y].map((rec, idx) => ({
                ...rec,
                totalManual: null,
                remainingManual: null,
                oldDebtManual: idx === 0 ? rec.oldDebtManual : null
              }))
            }
          })
          copy[editSub.id!] = subBilling
        }
        return copy
      })
    }

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

  // تجهيز رابط ورسالة مشاركة كشف الحساب عبر واتساب للمشترك الحالي
  const activeShareData = useMemo(() => {
    if (!activeSubscriber) return null
    return buildWhatsAppShareMessage(activeSubscriber, selectedYear, activeBilling, areas)
  }, [activeSubscriber, selectedYear, activeBilling, areas])

  // المشتركون المقترحون عند البحث في قسم المراجعة
  const reviewSuggestions = useMemo(() => {
    const q = reviewSearchQuery.trim()
    if (!q) return []
    return subscribers
      .filter((s) => s.name.includes(q) || String(s.id).includes(q) || s.phone?.includes(q))
      .slice(0, 6)
  }, [subscribers, reviewSearchQuery])

  // إضافة منطقة جديدة
  const handleAddArea = () => {
    if (!newAreaName.trim()) return
    const newArea: Area = {
      id: `area_${Date.now()}`,
      name: newAreaName.trim(),
      branches: [{ id: `b_${Date.now()}`, name: 'الرئيسي' }]
    }
    setAreas((prev) => [...prev, newArea])
    setNewAreaName('')
  }

  // إضافة شخص إلى قائمة المراجعة
  const handleAddReview = (targetSub?: { id?: number; name: string; phone?: string } | Subscriber) => {
    const name = targetSub ? targetSub.name : reviewSearchQuery.trim()
    const subId = targetSub ? targetSub.id : (Number.isFinite(Number(reviewSearchQuery.trim())) ? Number(reviewSearchQuery.trim()) : undefined)
    const phone = targetSub ? targetSub.phone : reviewPhone.trim()

    if (!name && !subId) return

    const newItem: ReviewItem = {
      id: `rev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subscriberId: subId,
      name: name || `مشترك رقم ${subId}`,
      phone: phone || '',
      reason: reviewReason.trim() || 'يتعين عليه مراجعة الدائرة',
      createdAt: new Date().toLocaleDateString('ar-IQ', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: 'pending',
      notes: reviewNotes.trim()
    }

    setReviewItems((prev) => [newItem, ...prev])
    setReviewSearchQuery('')
    setReviewPhone('')
    setReviewNotes('')
  }

  // تبديل حالة المراجعة (قيد المراجعة / تم حلها ومراجعتها)
  const handleToggleReviewStatus = (id: string) => {
    setReviewItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: item.status === 'pending' ? 'resolved' : 'pending' } : item
      )
    )
  }

  // حذف مراجعة
  const handleDeleteReview = (id: string) => {
    setReviewItems((prev) => prev.filter((item) => item.id !== id))
  }

  // مشتركون تلقائيون بحاجة لمراجعة الدائرة (حالتهم: يدفع بالدائرة أو يجب فحص حسابه)
  const officeStatusSubscribers = useMemo(() => {
    return subscribers.filter((s) =>
      s.statuses?.some((st) => st === 'يدفع بالدائرة' || st === 'يجب فحص حسابه')
    )
  }, [subscribers])

  // عدد المراجعات النشطة
  const pendingReviewCount = useMemo(() => {
    return reviewItems.filter((r) => r.status === 'pending').length
  }, [reviewItems])

  // إجمالي عدد المعلقين في المراجعة (قائمتنا المخصصة + من يحملون حالة بالدائرة ولم يضافوا بعد)
  const totalReviewBadgeCount = useMemo(() => {
    const customPending = reviewItems.filter((r) => r.status === 'pending')
    const addedSubIds = new Set(customPending.map((r) => r.subscriberId).filter(Boolean))
    const notAddedOfficeCount = officeStatusSubscribers.filter((s) => !addedSubIds.has(s.id)).length
    return customPending.length + notAddedOfficeCount
  }, [reviewItems, officeStatusSubscribers])

  // إحصائيات مالية شاملة للقسم الإضافي (الإحصائيات والتحصيل)
  const overallFinancialStats = useMemo(() => {
    let totalDueAll = 0
    let totalPaidAll = 0
    let totalRemainingAll = 0
    const subDebtList: Array<{ id: number; name: string; debt: number; phone?: string; areaName?: string }> = []

    subscribersInRange.forEach((sub) => {
      const b = calculateBilling(sub.id, 2026, billing, subscribers, pricing)
      const currentDue = b.rows.length > currentPeriodIndex ? b.rows[currentPeriodIndex].remaining : b.totalRemaining
      const totalPaid = b.rows.reduce((sum, r) => sum + (r.paid || 0), 0)
      const totalRequired = b.totalCarried + b.rows.reduce((sum, r) => sum + (r.due || 0), 0)

      totalDueAll += totalRequired
      totalPaidAll += totalPaid
      totalRemainingAll += currentDue

      if (currentDue > 0) {
        subDebtList.push({
          id: sub.id,
          name: sub.name,
          debt: currentDue,
          phone: sub.phone,
          areaName: areas.find((a) => a.id === sub.areaId)?.name
        })
      }
    })

    subDebtList.sort((a, b) => b.debt - a.debt)
    const collectionRate = totalDueAll > 0 ? Math.round((totalPaidAll / totalDueAll) * 100) : 0

    return {
      totalDueAll,
      totalPaidAll,
      totalRemainingAll,
      collectionRate,
      topDebtors: subDebtList.slice(0, 15),
      totalDebtorsCount: subDebtList.length
    }
  }, [subscribersInRange, billing, subscribers, pricing, currentPeriodIndex, areas])

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
            <p className="text-[12px] text-slate-600 font-medium mt-1">يرجى إدخال رمز الدخول للمتابعة</p>
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

          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 font-medium">
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
  // صفحة تنزيل الإرساليات (صفحة مستقلة كاملة)
  // ==========================
  if (showInstallmentsPage) {
    return (
      <InstallmentsPage
        subscribers={subscribers}
        billing={billing}
        areas={areas}
        pricing={pricing}
        onClose={() => setShowInstallmentsPage(false)}
        onSaveConsignments={handleSaveConsignments}
      />
    )
  }

  // ==========================
  // صفحة تنزيل الإرساليات بالذكاء الاصطناعي (صفحة مستقلة كاملة منفصلة)
  // ==========================
  if (showReceiptScannerModal) {
    return (
      <ReceiptScannerModal
        onClose={() => setShowReceiptScannerModal(false)}
        apiKeys={aiApiKeys}
        subscribers={subscribers}
        billing={billing}
        pricing={pricing}
        onApplyPayments={handleApplyScannedPayments}
        onUpdateSubscriberName={handleUpdateSubscriberName}
        onOpenSettings={() => {
          setShowReceiptScannerModal(false)
          setShowSettingsModal(true)
          setSettingsTab('ai')
        }}
      />
    )
  }

  // ==========================
  // واجهة التطبيق الرئيسية
  // ==========================
  return (
    <div
      dir="rtl"
      className="min-h-screen text-slate-800 bg-[#f0f9ff]"
      style={{ fontFamily: 'var(--font-tajawal), Tajawal, Inter, system-ui, -apple-system, sans-serif' }}
    >

      {/* الهيدر الرئيسي - الحفاظ على شكل ومقاس الأزرار 100% */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-xl border-b border-sky-100">
        <div className="max-w-[1100px] mx-auto px-4 h-[56px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && userRole !== 'writer' && (
              <button
                type="button"
                onClick={onBack}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition flex items-center gap-1"
                title="العودة"
              >
                ← عودة
              </button>
            )}
            <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 3L4 9v6l8 6 8-6V9l-8-6z" fill="white" opacity="0.9" />
              </svg>
            </div>
            <div className="flex flex-col">
              <h1 className="text-[14px] font-bold tracking-tight text-slate-900">
                {customHeaderTitle || 'نظام الاشتراكات'}
              </h1>
              {!canEdit && (
                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 w-fit">
                  وضع المتابعة (للقراءة فقط)
                </span>
              )}
            </div>

            {/* مؤشر المزامنة السحابية الذكي (يدعم العمل بدون إنترنت كلياً) */}
            {!isOnline ? (
              <span className="flex items-center gap-1.5 text-[11px] text-amber-800 font-bold bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                <span>أوفلاين</span>
                {pendingSyncCount > 0 && (
                  <span className="bg-amber-600 text-white text-[10px] px-1 rounded-full font-bold">
                    {pendingSyncCount} معلق
                  </span>
                )}
              </span>
            ) : isManualSyncing || isSyncing ? (
              <span className="flex items-center gap-1.5 text-[11px] text-sky-800 font-semibold bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping"></span>
                مزامنة...
              </span>
            ) : pendingSyncCount > 0 ? (
              <button
                type="button"
                onClick={handleTriggerSync}
                className="flex items-center gap-1 text-[11px] text-amber-900 bg-amber-200 hover:bg-amber-300 font-bold px-2 py-0.5 rounded-full border border-amber-400 transition-all active:scale-95 shadow-sm"
                title="اضغط لرفع العمليات المعلقة إلى السحابة الآن"
              >
                <span>مزامنة ({pendingSyncCount})</span>
                <span className="text-xs">🔄</span>
              </button>
            ) : isLoadingCloud ? (
              <span className="flex items-center gap-1 text-[11px] text-slate-700 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse"></span>
                تحميل...
              </span>
            ) : (
              <button
                type="button"
                onClick={handleTriggerSync}
                className="flex items-center gap-1 text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold hover:bg-emerald-100 transition-colors"
                title="كافة البيانات متزامنة، اضغط للتحديث"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                متزامن
              </button>
            )}
          </div>

          {/* تنبيه حالة الاتصال المنبثق */}
          {syncToastMessage && (
            <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl shadow-2xl border text-xs font-bold transition-all flex items-center gap-2 bg-slate-900 text-white border-slate-700 pointer-events-none">
              <span>🔔</span>
              <span>{syncToastMessage}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* زر الإرساليات الجديدة المخصص للكاتب لتحديث السجل الورقي */}
            {userRole === 'writer' && (
              <button
                type="button"
                aria-label="الإرساليات الجديدة"
                onClick={() => {
                  setShowWriterConsignmentsModal(true)
                  setSearchOpen(false)
                  setFilterDrawerOpen(false)
                }}
                className="h-8 px-2.5 rounded-xl border border-amber-400 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white flex items-center gap-1.5 transition-all text-xs font-black shadow-sm shadow-amber-500/20"
                title="الإرساليات الجديدة لتعديل السجل الورقي"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span className="inline">الإرساليات الجديدة</span>
                {unrecordedWriterItems.length > 0 && (
                  <span className="bg-white text-amber-700 text-[10px] font-black px-1.5 py-0.2 rounded-full shadow-2xs">
                    {unrecordedWriterItems.length}
                  </span>
                )}
              </button>
            )}

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


            {/* زر ماسح الوصولات بالذكاء الاصطناعي */}
            <button
              type="button"
              aria-label="ماسح الوصولات"
              onClick={() => {
                setShowReceiptScannerModal(true)
                setSearchOpen(false)
                setFilterDrawerOpen(false)
              }}
              className="h-8 px-2 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 flex items-center gap-1 transition-all text-[11px] font-medium shadow-2xs"
              title="ماسح الوصولات بالذكاء الاصطناعي"
            >
              <span className="text-[12px] leading-none"></span>
              <span className="hidden md:inline text-[10px]">ماسح الوصولات</span>
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
                  className="w-full h-11 pr-4 pl-16 border border-sky-100 rounded-2xl text-[13px] focus:outline-none focus:border-slate-900 bg-sky-50/50 focus:bg-white transition-colors"
                  autoFocus
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {Boolean(searchQuery) && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="w-6 h-6 rounded-full bg-slate-200/80 hover:bg-slate-300 active:scale-90 text-slate-600 flex items-center justify-center text-[12px] font-bold transition-all"
                      title="مسح البحث"
                    >
                      
                    </button>
                  )}
                  <span className="text-slate-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                      <circle cx="11" cy="11" r="6" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                  </span>
                </div>
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
                    
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {([
                  ['type', 'نوع العقار'],
                  ['meter', 'نوع المتر'],
                  ['areas', 'المناطق والأفرع'],
                  ['statuses', 'حالات المشترك']
                ] as const).map(([panel, label]) => (
                  <button
                    key={panel}
                    type="button"
                    onClick={() => setFilterPanel((current) => (current === panel ? null : panel))}
                    className={`h-10 rounded-xl border text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5 ${
                      filterPanel === panel
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-sky-50/60 border-sky-100 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <span>{label}</span>
                    {panel === 'meter' && (filterMeters.length > 0 || filterCustomMeter.trim() !== '') && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-mono">
                        {formatNumber(filterMeters.length + (filterCustomMeter.trim() !== '' ? 1 : 0))}
                      </span>
                    )}
                    {panel === 'areas' && (filterAreas.length > 0 || filterBranches.length > 0) && (
                      <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center font-mono">
                        {formatNumber(filterAreas.length + filterBranches.length)}
                      </span>
                    )}
                    {panel === 'statuses' && filterStatuses.length > 0 && (
                      <span className="w-5 h-5 rounded-full bg-violet-500 text-white text-[10px] flex items-center justify-center font-mono">
                        {formatNumber(filterStatuses.length)}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* محتوى الفلتر يظهر بعد اختيار الزر */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. النوع */}
                {filterPanel === 'type' && <div className="border border-sky-100 rounded-2xl p-3 bg-sky-50/40">
                  <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1 h-4 rounded-full bg-slate-900"></span> نوع العقار
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

                {/* 2. نوع المتر */}
                {filterPanel === 'meter' && (
                  <div className="border border-sky-100 rounded-2xl p-3 bg-white flex flex-col">
                    <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">                        <span className="w-1 h-4 rounded-full bg-emerald-500"></span> نوع المتر
                      </span>
                      <div className="flex items-center gap-2">
                        {(filterMeters.length > 0 || filterCustomMeter.trim() !== '') && (
                          <button
                            type="button"
                            onClick={() => {
                              setFilterMeters([])
                              setFilterCustomMeter('')
                            }}
                            className="text-[10px] text-red-500 hover:underline font-medium"
                          >
                            إلغاء التحديد
                          </button>
                        )}
                        <span className="text-[9px] bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5 text-emerald-700 font-bold">
                          {filterMeters.length > 0 || filterCustomMeter.trim() !== ''
                            ? `${formatNumber(filterMeters.length + (filterCustomMeter.trim() !== '' ? 1 : 0))} محدد`
                            : 'الكل'}
                        </span>
                      </div>
                    </div>

                    {/* خانة كتابة رقم المتر يدوياً - ظاهرة دائماً وواضحة */}
                    <div className="mb-3 p-2.5 rounded-xl bg-emerald-50/40 border border-emerald-200">
                      <label className="text-[11px] font-bold text-emerald-900 block mb-1.5">
                        كتابة رقم المتر يدوياً:
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={filterCustomMeter}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^\d]/g, '')
                            setFilterCustomMeter(val)
                          }}
                          placeholder="اكتب رقم المتر (مثال: 70 أو 75 أو 80 أو 100)..."
                          className="w-full h-10 pr-3 pl-16 border border-emerald-300 rounded-xl text-[13px] font-mono focus:outline-none focus:border-emerald-600 bg-white"
                        />
                        <div className="absolute left-2.5 flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-500 select-none">
                            متر
                          </span>
                          {Boolean(filterCustomMeter) && (
                            <button
                              type="button"
                              onClick={() => setFilterCustomMeter('')}
                              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-[10px] font-bold"
                              title="مسح"
                            >
                              
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* قائمة الأمتار المتوفرة للاختيار السريع */}
                    <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                      <span>أو اختر من الأمتار المسجلة:</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                      {availableMeterTypes.map((meter) => {
                        const count = meterCounts.get(meter) || 0
                        const isChecked = filterMeters.includes(meter)
                        const disabled = count === 0 && !isChecked
                        return (
                          <label
                            key={meter}
                            className={`flex items-center gap-2.5 h-10 px-3 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
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
                                if (e.target.checked) setFilterMeters((p) => [...p, meter])
                                else setFilterMeters((p) => p.filter((x) => x !== meter))
                              }}
                              className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                            />
                            <span className="text-[12px] font-medium flex-1 truncate">{meter}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                                isChecked ? 'bg-white/20 text-white' : 'bg-white border border-sky-100 text-slate-600'
                              }`}
                            >
                              {formatNumber(count)}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}

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
                      className="w-full h-8 pr-3 pl-14 border border-sky-100 rounded-xl text-[11px] bg-sky-50/40 focus:bg-white focus:outline-none focus:border-slate-900"
                    />
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      {Boolean(filterAreaSearch) && (
                        <button
                          type="button"
                          onClick={() => setFilterAreaSearch('')}
                          className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 active:scale-90 text-slate-600 flex items-center justify-center text-[10px] font-bold"
                          title="مسح"
                        >
                          
                        </button>
                      )}
                      <span className="text-slate-400 text-[12px]">⌕</span>
                    </div>
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
                          className="w-full h-8 pr-3 pl-14 border border-sky-100 rounded-xl text-[11px] bg-sky-50/40 focus:bg-white focus:outline-none focus:border-slate-900"
                        />
                        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                          {Boolean(filterBranchSearch) && (
                            <button
                              type="button"
                              onClick={() => setFilterBranchSearch('')}
                              className="w-4 h-4 rounded-full bg-slate-200 hover:bg-slate-300 active:scale-90 text-slate-600 flex items-center justify-center text-[10px] font-bold"
                              title="مسح"
                            >
                              
                            </button>
                          )}
                          <span className="text-slate-400 text-[12px]">⌕</span>
                        </div>
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
                      {filterCustomMeter.trim() !== '' && `${formatNumber(Number(filterCustomMeter))} متر • `}
                      {filterMeters.length > 0 && `${formatNumber(filterMeters.length)} أمتار مسجلة • `}
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

      {/* المحتوى الرئيسي للتطبيق بحسب التبويب السفلي المختار */}
      <main className="max-w-[1100px] mx-auto px-3 sm:px-4 py-4 pb-28">

        {/* ========================================================= */}
        {/* التبويب 1: المشتركين */}
        {/* ========================================================= */}
        {bottomNavTab === 'subscribers' && (
          <div>
            {/* شريط المناطق الرئيسي للأفرع والتنقل السريع */}
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

            {/* إشعار نجاح إضافة مشترك */}
            {addSuccessMsg && (
              <div className="bg-emerald-600 text-white px-4 py-3 rounded-2xl font-bold text-[12.5px] flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2">
                  <span className="text-[16px]"></span>
                  <span>{addSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddSuccessMsg('')}
                  className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-xs"
                >
                  
                </button>
              </div>
            )}

            {/* قائمة المشتركين الرئيسية */}
            <div className="bg-white rounded-2xl border border-[#e0f2fe] shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center gap-2 bg-sky-50/40">
                <div className="text-[11px] text-slate-600">
                  <span className="font-bold text-slate-900">{formatNumber(displayedSubscribers.length)}</span> من{' '}
                  {formatNumber(subscribersInRange.length)} • {formatNumber(rangeFrom)} - {formatNumber(rangeTo)}
                </div>
                <div className="text-[11px] text-slate-400">
                  اسحب المشترك لليسار للتعديل السريع
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
                          <div className="text-[15px] sm:text-[16px] font-bold truncate text-slate-900 leading-snug flex items-center gap-2">
                            {isRecentlyAddedSubscriber(sub) && (
                              <span className="shrink-0 px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[10px] font-bold flex items-center gap-1 shadow-xs animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                                جديد
                              </span>
                            )}
                            <span className="font-mono text-slate-900 font-extrabold">{formatNumber(sub.id)}</span> - <span>{sub.name}</span>
                          </div>
                          <div className="text-[11.5px] text-slate-600 mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="px-2 py-0.5 bg-sky-50 text-sky-800 rounded-md border border-sky-100 font-medium">{areas.find((a) => a.id === sub.areaId)?.name}</span>
                            <span className="px-2 py-0.5 bg-slate-50 text-slate-700 rounded-md border border-slate-200/80 font-medium">{sub.propertyType}</span>
                            {(sub.statuses || []).map((st) => (
                              <span
                                key={st}
                                className={`px-2 py-0.5 text-[11px] rounded-md font-bold shadow-xs ${STATUS_CONFIG[st]?.bg || 'bg-zinc-100'} ${STATUS_CONFIG[st]?.text || 'text-zinc-700'}`}
                              >
                                {st}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* الدين يظهر على اليسار بلون أسود واضح وكبير أو شارة مصفّر */}
                        <div className="flex items-center gap-3 shrink-0">
                          {isZeroAccountSubscriber(sub) ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2.5 py-0.5 rounded-md font-bold">
                                مصفّر
                              </span>
                              <div className="text-[16px] font-bold text-zinc-400 font-mono tracking-tight min-w-[50px] text-left">
                                0
                              </div>
                            </div>
                          ) : (
                            <div className="text-[16px] font-bold text-[#111827] font-mono tracking-tight min-w-[70px] text-left">
                              {formatNumber(currentDue)}
                            </div>
                          )}
                          <div className="text-sky-300 group-hover:text-slate-400 transition-colors text-[16px] font-bold">‹</div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 2: المناطق */}
        {/* ========================================================= */}
        {bottomNavTab === 'areas' && (
          <div className="space-y-4">
            {/* ترويسة قسم المناطق */}
            <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-bold text-slate-900">إدارة واستعراض المناطق</h2>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  استعراض جميع المناطق وتوزيع المشتركين حسب الأفرع، وإضافة مناطق وأفرع جديدة
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-sky-50 border border-sky-100 text-sky-800 rounded-xl text-[11px] font-bold">
                  {formatNumber(areas.length)} مناطق
                </span>
                <span className="px-3 py-1 bg-slate-900 text-white rounded-xl text-[11px] font-bold">
                  {formatNumber(subscribersInRange.length)} مشترك
                </span>
              </div>
            </div>

            {/* إضافة منطقة جديدة سريعة */}
            <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-sm">
              <div className="text-[12px] font-bold text-slate-800 mb-2">إضافة منطقة سكنية جديدة:</div>
              <div className="flex gap-2">
                <input
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="اكتب اسم المنطقة الجديدة..."
                  className="flex-1 h-10 px-3.5 border border-sky-100 rounded-xl text-[12px] focus:outline-none focus:border-slate-900 bg-sky-50/20"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddArea()
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddArea}
                  className="h-10 px-5 bg-slate-900 hover:bg-black text-white rounded-xl text-[12px] font-bold transition-colors shrink-0"
                >
                  + إضافة المنطقة
                </button>
              </div>
            </div>

            {/* بطاقات المناطق */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {areas.map((area) => {
                const areaSubscribers = subscribersInRange.filter((s) => s.areaId === area.id)
                const areaCount = areaSubscribers.length

                return (
                  <div key={area.id} className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden flex flex-col justify-between">
                    <div className="p-4">
                      {/* رأس بطاقة المنطقة */}
                      <div className="flex items-center justify-between pb-3 border-b border-sky-50">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-800 flex items-center justify-center font-bold text-[13px]">
                            
                          </div>
                          <div>
                            {editingAreaId === area.id ? (
                              <div className="flex gap-1.5 items-center">
                                <input
                                  value={editingAreaName}
                                  onChange={(e) => setEditingAreaName(e.target.value)}
                                  className="h-7 px-2 border rounded-lg text-[12px]"
                                  autoFocus
                                />
                                <button
                                  onClick={() => {
                                    if (editingAreaName.trim()) {
                                      setAreas((prev) =>
                                        prev.map((a) => (a.id === area.id ? { ...a, name: editingAreaName.trim() } : a))
                                      )
                                    }
                                    setEditingAreaId(null)
                                  }}
                                  className="h-7 px-2.5 bg-slate-900 text-white rounded-lg text-[10px] font-bold"
                                >
                                  حفظ
                                </button>
                              </div>
                            ) : (
                              <h3 className="font-bold text-[14px] text-slate-900">{area.name}</h3>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {formatNumber(area.branches.length)} أفرع متفرعة
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAreaId(area.id)
                              setEditingAreaName(area.name)
                            }}
                            className="w-7 h-7 rounded-lg border border-sky-100 bg-sky-50 hover:bg-white text-slate-600 flex items-center justify-center text-[11px]"
                            title="تعديل اسم المنطقة"
                          >
                            
                          </button>
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-900 text-white font-mono">
                            {formatNumber(areaCount)} مشترك
                          </span>
                        </div>
                      </div>

                      {/* قائمة أفرع المنطقة */}
                      <div className="mt-3 space-y-1.5">
                        <div className="text-[11px] font-bold text-slate-600 mb-1.5 flex items-center justify-between">
                          <span>أفرع {area.name}:</span>
                          <span className="text-[10px] text-slate-400 font-normal">عدد المشتركين</span>
                        </div>
                        {area.branches.length === 0 ? (
                          <div className="text-[11px] text-slate-400 py-2 text-center bg-sky-50/30 rounded-xl">
                            لا توجد أفرع مضافة في هذه المنطقة
                          </div>
                        ) : (
                          area.branches.map((br) => {
                            const brCount = areaSubscribers.filter((s) => s.branchId === br.id).length
                            return (
                              <div
                                key={br.id}
                                className="flex items-center justify-between bg-sky-50/40 border border-sky-50 rounded-xl px-3 py-2 text-[11px]"
                              >
                                <span className="font-medium text-slate-800">{br.name}</span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white border border-sky-100 text-slate-600">
                                  {formatNumber(brCount)} مشترك
                                </span>
                              </div>
                            )
                          })
                        )}
                      </div>

                      {/* إضافة فرع جديد للمنطقة */}
                      <div className="mt-3 pt-3 border-t border-sky-50 flex gap-2">
                        <input
                          id={`quick_br_${area.id}`}
                          placeholder={`إضافة فرع جديد في ${area.name}...`}
                          className="flex-1 h-8 px-3 border border-sky-100 rounded-xl text-[11px] bg-sky-50/30 focus:bg-white focus:outline-none"
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
                          type="button"
                          onClick={() => {
                            const input = document.getElementById(`quick_br_${area.id}`) as HTMLInputElement
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
                          className="h-8 px-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold hover:bg-black transition-colors"
                        >
                          + فرع
                        </button>
                      </div>
                    </div>

                    {/* زر الذهاب للمشتركين التابعين للمنطقة */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAreaId(area.id)
                        setActiveBranchId(null)
                        setBranchDrawerAreaId(area.id)
                        setBottomNavTab('subscribers')
                      }}
                      className="w-full py-2.5 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-bold border-t border-sky-100 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <span>عرض وتصفح مشتركي {area.name}</span>
                      <span>‹</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 3: يحتاج مراجعة (مراجعة الدائرة) */}
        {/* ========================================================= */}
        {bottomNavTab === 'review' && (
          <div className="space-y-4">
            {/* كارت الترحيب والتعريف بقسم المراجعة */}
            <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                  <h2 className="text-[16px] font-bold text-slate-900">قسم المشتركين المطلوب مراجعتهم في الدائرة</h2>
                </div>
                <p className="text-[12px] text-slate-500 mt-1">
                  سجل خاص بالمشتركين الذين يتعين عليهم مراجعة الدائرة لتدقيق العدادات أو تسوية الحسابات أو الدفع
                </p>
              </div>

              {/* أزرار الفلترة للحالات */}
              <div className="flex items-center gap-2 bg-sky-50/70 p-1 rounded-xl border border-sky-100 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setReviewFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    reviewFilter === 'pending'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  قيد المراجعة ({formatNumber(reviewItems.filter((r) => r.status === 'pending').length)})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('resolved')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    reviewFilter === 'resolved'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  تمت المراجعة ({formatNumber(reviewItems.filter((r) => r.status === 'resolved').length)})
                </button>
                <button
                  type="button"
                  onClick={() => setReviewFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                    reviewFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  الكل ({formatNumber(reviewItems.length)})
                </button>
              </div>
            </div>

            {/* فورم إضافة مراجعة جديدة: اسم الشخص أو رقم اشتراكه */}
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4 relative">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-[12px] font-bold">
                  
                </span>
                <h3 className="text-[13px] font-bold text-slate-900">
                  إضافة مشترك يتعين عليه مراجعة الدائرة
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                {/* حقل اسم الشخص أو رقم اشتراكه مع اقتراحات فورية */}
                <div className="relative">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    اسم الشخص أو رقم اشتراكه <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      value={reviewSearchQuery}
                      onChange={(e) => setReviewSearchQuery(e.target.value)}
                      placeholder="اكتب رقم الاشتراك أو اسم الشخص..."
                      className="w-full h-11 pr-3.5 pl-10 border border-sky-100 rounded-xl text-[12px] focus:outline-none focus:border-slate-900 bg-sky-50/20"
                    />
                    {Boolean(reviewSearchQuery) && (
                      <button
                        type="button"
                        onClick={() => setReviewSearchQuery('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200/80 hover:bg-slate-300 active:scale-90 text-slate-600 flex items-center justify-center text-[12px] font-bold transition-all"
                        title="مسح"
                      >
                        
                      </button>
                    )}
                  </div>
                  {/* اقتراحات المشتركين الفورية عند الكتابة */}
                  {reviewSuggestions.length > 0 && (
                    <div className="absolute top-[100%] right-0 left-0 mt-1 bg-white border border-sky-200 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-sky-50">
                      <div className="px-3 py-1.5 bg-sky-50 text-[10px] font-bold text-sky-800">
                        مشتركون مطابقون (انقر للاختيار التلقائي):
                      </div>
                      {reviewSuggestions.map((s) => (
                        <div
                          key={s.id}
                          onClick={() => {
                            setReviewSearchQuery(`${s.id} - ${s.name}`)
                            setReviewPhone(s.phone || '')
                          }}
                          className="px-3 py-2 text-[11px] hover:bg-sky-50 cursor-pointer flex justify-between items-center transition-colors"
                        >
                          <span className="font-bold text-slate-800">
                            {formatNumber(s.id)} - {s.name}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {areas.find((a) => a.id === s.areaId)?.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* رقم هاتف المشترك */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    رقم الهاتف للتواصل <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
                  </label>
                  <input
                    value={reviewPhone}
                    onChange={(e) => setReviewPhone(e.target.value)}
                    placeholder="رقم هاتف المشترك (مثال: 0780...)"
                    className="w-full h-11 px-3.5 border border-sky-100 rounded-xl text-[12px] focus:outline-none focus:border-slate-900 bg-sky-50/20"
                  />
                </div>
              </div>

              {/* سبب المراجعة مع أزرار سريعة جاهزة */}
              <div className="mb-3">
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  سبب المراجعة بالدائرة:
                </label>
                <input
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  placeholder="سبب مراجعة الدائرة..."
                  className="w-full h-10 px-3.5 border border-sky-100 rounded-xl text-[12px] focus:outline-none focus:border-slate-900 bg-sky-50/20 mb-2"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {[
                    'مراجعة حساب بالدائرة',
                    'تسوية ديون متراكمة',
                    'تدقيق قراءة العداد',
                    'اعتراض على القسط',
                    'تحديث وتصحيح بيانات',
                    'تغيير ملكية أو عقد'
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReviewReason(preset)}
                      className={`text-[10px] px-2.5 py-1 rounded-lg border transition-all ${
                        reviewReason === preset
                          ? 'bg-slate-900 text-white border-slate-900 font-bold'
                          : 'bg-sky-50 border-sky-100 text-slate-600 hover:bg-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* ملاحظات إضافية وزر الإضافة */}
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    ملاحظات إضافية <span className="text-[10px] text-slate-400 font-normal">(اختياري)</span>
                  </label>
                  <input
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="ملاحظة خاصة للموظف أو المحصل..."
                    className="w-full h-10 px-3.5 border border-sky-100 rounded-xl text-[12px] focus:outline-none focus:border-slate-900 bg-sky-50/20"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddReview()}
                  disabled={!reviewSearchQuery.trim()}
                  className="w-full sm:w-auto h-10 px-6 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white rounded-xl text-[12px] font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed shrink-0"
                >
                  <span>+ إضافة إلى قائمة المراجعة</span>
                </button>
              </div>
            </div>

            {/* تنبيه ذكي: المشتركون الذين حالتهم بالدائرة في النظام */}
            {officeStatusSubscribers.length > 0 && (
              <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-700 font-bold text-[12px]"> مشتركون لديهم حالة مراجعة بالدائرة تلقائياً:</span>
                    <span className="bg-amber-200 text-amber-900 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      {formatNumber(officeStatusSubscribers.length)} مشتركون
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-600 mb-2.5">
                  هؤلاء المشتركون محددون بحالة «يدفع بالدائرة» أو «يجب فحص حسابه» في جدول المشتركين، يمكنك إضافتهم لقائمة المراجعة بنقرة واحدة:
                </div>                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                  {officeStatusSubscribers.slice(0, 10).map((sub) => {
                    const isAlreadyAdded = reviewItems.some((r) => r.subscriberId === sub.id)
                    return (
                      <div
                        key={sub.id}
                        className="bg-white border border-amber-200 rounded-xl p-2.5 shrink-0 min-w-[200px] flex flex-col justify-between"
                      >
                        <div>
                          <div className="font-bold text-[12px] text-slate-900 truncate">
                            {formatNumber(sub.id)} - {sub.name}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {areas.find((a) => a.id === sub.areaId)?.name}
                          </div>
                          <div className="mt-1 flex gap-1">
                            {sub.statuses?.map((st) => (
                              <span key={st} className="text-[9px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded font-medium">
                                {st}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="mt-2.5 pt-2 border-t border-amber-100 flex gap-1.5">
                          {isAlreadyAdded ? (
                            <span className="text-[10px] text-emerald-600 font-bold py-1">مدرج بالقائمة </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                handleAddReview({
                                  id: sub.id,
                                  name: sub.name,
                                  phone: sub.phone
                                })
                              }
                              className="w-full py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-colors"
                            >
                              + إدراج للمراجعة
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubId(sub.id)
                              setSelectedYear(2026)
                            }}
                            className="px-2 py-1 bg-white border border-slate-200 text-slate-700 rounded-lg text-[10px] hover:bg-slate-50"
                          >
                            كشف
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* قائمة كروت المراجعات */}
            <div className="space-y-2.5">
              <div className="text-[12px] font-bold text-slate-800 flex items-center justify-between">
                <span>سجل المراجعات ({formatNumber(reviewItems.filter((r) => reviewFilter === 'all' || r.status === reviewFilter).length)}):</span>
              </div>

              {reviewItems.filter((r) => reviewFilter === 'all' || r.status === reviewFilter).length === 0 ? (
                <div className="bg-white rounded-2xl border border-sky-100 py-12 text-center text-slate-400 text-[13px]">
                  {reviewFilter === 'pending'
                    ? 'لا توجد طلبات مراجعة معلقة حالياً في الدائرة '
                    : reviewFilter === 'resolved'
                    ? 'لم يتم إكمال أي مراجعة بعد'
                    : 'سجل المراجعات فارغ حالياً، أضف مشتركاً من الأعلى'}
                </div>
              ) : (
                reviewItems
                  .filter((r) => reviewFilter === 'all' || r.status === reviewFilter)
                  .map((item) => {
                    const isPending = item.status === 'pending'
                    const matchedSub = item.subscriberId
                      ? subscribers.find((s) => s.id === item.subscriberId)
                      : null

                    return (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border p-4 shadow-sm transition-all ${
                          isPending ? 'border-amber-200 hover:border-amber-300' : 'border-emerald-200 bg-emerald-50/20'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isPending ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                                }`}
                              ></span>
                              <h4 className="font-bold text-[14px] text-slate-900">
                                {item.name}
                              </h4>
                              {item.subscriberId && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-800">
                                  رقم الاشتراك: {formatNumber(item.subscriberId)}
                                </span>
                              )}
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                  isPending
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isPending ? 'يتعين عليه مراجعة الدائرة' : 'تمت المراجعة بالدائرة '}
                              </span>
                            </div>

                            <div className="text-[12px] text-slate-700 mt-2 flex items-center gap-2">
                              <span className="font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                                السبب: {item.reason}
                              </span>
                              {item.notes && (
                                <span className="text-slate-500 text-[11px]">• {item.notes}</span>
                              )}
                            </div>

                            <div className="text-[10px] text-slate-400 mt-2 flex items-center gap-3">
                              <span>التاريخ: {item.createdAt}</span>
                              {matchedSub && (
                                <span>المنطقة: {areas.find((a) => a.id === matchedSub.areaId)?.name}</span>
                              )}
                            </div>
                          </div>

                          {/* أزرار الإجراءات */}
                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {/* زر الاتصال */}
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                className="h-8 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                              >
                                <span></span>
                                <span>اتصال</span>
                              </a>
                            )}

                            {/* زر فتح ملف الحساب */}
                            {item.subscriberId && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSubId(item.subscriberId!)
                                  setSelectedYear(2026)
                                }}
                                className="h-8 px-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-[11px] font-bold flex items-center gap-1 transition-colors"
                              >
                                <span>كشف الحساب ↗</span>
                              </button>
                            )}

                            {/* زر تبديل الحالة: تمت المراجعة بالدائرة */}
                            <button
                              type="button"
                              onClick={() => handleToggleReviewStatus(item.id)}
                              className={`h-8 px-3 rounded-xl text-[11px] font-bold transition-colors ${
                                isPending
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isPending ? ' تمت المراجعة' : 'إعادة للمراجعة'}
                            </button>

                            {/* زر الحذف */}
                            <button
                              type="button"
                              onClick={() => handleDeleteReview(item.id)}
                              className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 flex items-center justify-center text-[12px] transition-colors"
                              title="حذف من المراجعات"
                            >
                              
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* التبويب 4: الخيار المفيد (الإحصائيات والتحصيل الشامل) */}
        {/* ========================================================= */}
        {bottomNavTab === 'stats' && (
          <div className="space-y-4">
            {/* ترويسة قسم الإحصائيات */}
            <div className="bg-white rounded-2xl border border-sky-100 p-4 shadow-sm">
              <h2 className="text-[16px] font-bold text-slate-900">تقرير الإحصائيات والتحصيل المالي</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">
                متابعة المبالغ المحصلة والديون المتبقية ونسبة الإنجاز وأعلى المشتركين مديونية
              </p>
            </div>

            {/* كروت الأرقام المالية الكبرى */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* إجمالي المبالغ المحصلة */}
              <div className="bg-white rounded-2xl border border-emerald-200 p-4 shadow-sm relative overflow-hidden">
                <div className="text-[11px] font-bold text-emerald-700 mb-1">المبالغ المسددة والمحصلة (2026)</div>
                <div className="text-[22px] font-bold text-emerald-600 font-mono">
                  {formatNumber(overallFinancialStats.totalPaidAll)} <span className="text-[12px] font-sans font-normal text-slate-500">د.ع</span>
                </div>
                <div className="text-[10px] text-emerald-600 mt-2 flex items-center gap-1 font-bold">
                  <span>نسبة التحصيل: {overallFinancialStats.collectionRate}%</span>
                </div>
              </div>

              {/* إجمالي الديون المتبقية */}
              <div className="bg-white rounded-2xl border border-red-200 p-4 shadow-sm relative overflow-hidden">
                <div className="text-[11px] font-bold text-red-700 mb-1">إجمالي الديون المتبقية بالذمة</div>
                <div className="text-[22px] font-bold text-red-600 font-mono">
                  {formatNumber(overallFinancialStats.totalRemainingAll)} <span className="text-[12px] font-sans font-normal text-slate-500">د.ع</span>
                </div>
                <div className="text-[10px] text-red-500 mt-2">
                  من إجمالي المستحق: {formatNumber(overallFinancialStats.totalDueAll)} د.ع
                </div>
              </div>

              {/* نسبة الإنجاز مع شريط تقدم */}
              <div className="bg-white rounded-2xl border border-sky-200 p-4 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-700 mb-1">مؤشر التحصيل العام</div>
                  <div className="text-[22px] font-bold text-slate-900 font-mono">
                    {overallFinancialStats.collectionRate}%
                  </div>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                    className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, overallFinancialStats.collectionRate)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* تفاصيل توزيع المشتركين والحالات */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white border border-sky-100 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-500">إجمالي المشتركين</div>
                <div className="text-[16px] font-bold text-slate-900 font-mono mt-0.5">
                  {formatNumber(subscribersInRange.length)}
                </div>
              </div>
              <div className="bg-white border border-sky-100 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-500">الاشتراكات السكنية</div>
                <div className="text-[16px] font-bold text-sky-700 font-mono mt-0.5">
                  {formatNumber(subscribersInRange.filter((s) => s.propertyType === 'سكني').length)}
                </div>
              </div>
              <div className="bg-white border border-sky-100 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-500">الاشتراكات التجارية</div>
                <div className="text-[16px] font-bold text-amber-700 font-mono mt-0.5">
                  {formatNumber(subscribersInRange.filter((s) => s.propertyType === 'تجاري').length)}
                </div>
              </div>
              <div className="bg-white border border-sky-100 rounded-xl p-3 text-center">
                <div className="text-[10px] text-slate-500">مشتركون عليهم ديون</div>
                <div className="text-[16px] font-bold text-red-600 font-mono mt-0.5">
                  {formatNumber(overallFinancialStats.totalDebtorsCount)}
                </div>
              </div>
            </div>

            {/* جدول أعلى المشتركين مديونية للمتابعة السريعة */}
            <div className="bg-white rounded-2xl border border-sky-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-red-50/50 border-b border-red-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[14px]"></span>
                  <h3 className="font-bold text-[13px] text-red-900">
                    أعلى 15 مشتركاً بالمديونية (الأكثر طلباً للتحصيل)
                  </h3>
                </div>
                <span className="text-[11px] text-red-700 font-bold">
                  مجموع ديونهم كبير يتطلب المتابعة
                </span>
              </div>

              <div className="divide-y divide-sky-50">
                {overallFinancialStats.topDebtors.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-[12px]">
                    لا توجد ديون مسجلة على المشتركين حالياً
                  </div>
                ) : (
                  overallFinancialStats.topDebtors.map((deb, idx) => (
                    <div
                      key={deb.id}
                      className="px-4 py-3 hover:bg-sky-50/40 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-[13px] text-slate-900 truncate">
                            {formatNumber(deb.id)} - {deb.name}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {deb.areaName || 'منطقة غير محددة'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-[14px] font-bold text-red-600 font-mono">
                          {formatNumber(deb.debt)} <span className="text-[10px] font-sans font-normal text-slate-400">د.ع</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubId(deb.id)
                            setSelectedYear(2026)
                          }}
                          className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-lg text-[10px] font-bold border border-sky-100 transition-colors"
                        >
                          كشف الحساب
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* ==========================
          نافذة تفاصيل المشترك وبلوك الديون
          القاعدة 9: بعرض 100%، 4 أعمدة: 20% | 27% | 26% | 27%، ارتفاع 36px، بدون سكرول جانبي
      ========================== */}
      {activeSubscriber && activeBilling && (
        <div
          className="subscriber-scene fixed inset-0 z-[10000] bg-slate-900/25 backdrop-blur-[1px] flex flex-col"
          style={{ paddingTop: '75px' }}
        >
          <div className="subscriber-orbit subscriber-orbit-one" />
          <div className="subscriber-orbit subscriber-orbit-two" />
          <div className="subscriber-card bg-[#f0f9ff] w-full flex-1 sm:h-[calc(100%-32px)] sm:max-w-[740px] sm:mx-auto sm:my-4 rounded-t-2xl sm:rounded-2xl border-t sm:border border-sky-100 flex flex-col overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
            {/* رأس النافذة */}
            <div className="subscriber-hero border-b border-sky-100 px-4 py-3 flex justify-between items-start gap-3 bg-white">
              <div className="min-w-0">
                <div className="mt-2.5 flex gap-2 items-center flex-wrap">
                  <div className="inline-flex border border-sky-100 rounded-lg bg-sky-50 px-3 py-1 text-[12px] font-semibold text-slate-700">
                    {activeSubscriber.propertyType} - {activeSubscriber.meterType}
                  </div>
                  <button
                    onClick={() => setShowContactModal(true)}
                    className="inline-flex items-center gap-1.5 border border-sky-200 rounded-lg bg-white hover:bg-sky-50 px-3.5 py-1 text-[12px] font-bold text-sky-700 transition-colors shadow-xs active:scale-95"
                  >
                    التواصل والموقع والصور
                  </button>
                  {Boolean(activeSubscriber.phone && activeSubscriber.phone.trim()) && activeShareData?.url && (
                    <a
                      href={activeShareData.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 border border-emerald-400 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1 text-[12px] font-bold transition-all shadow-sm active:scale-95 cursor-pointer ring-1 ring-emerald-300"
                      title="مراسلة المشترك بمطالبة كشف الحساب والديون عبر واتساب"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>مراسلة واتساب</span>
                    </a>
                  )}
                  <div className="text-[12px] text-slate-600 font-mono font-bold bg-slate-50 border border-slate-200/60 rounded-lg px-2.5 py-1">
                    المستحق: {formatNumber(activeBilling.due)}
                  </div>
                </div>
              </div>
              <button
                onClick={handleCloseSubscriberModal}
                className="w-9 h-9 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500 hover:bg-sky-50 shrink-0"
              >
                
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

              {/* بداية السنة أو تنبيه تصفير الحساب كلياً */}
              <div className="subscriber-content subscriber-content-3 w-full mt-3 px-2" style={{ boxSizing: 'border-box' }}>
                {isZeroAccountSubscriber(activeSubscriber) ? (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[12px] flex items-center justify-between shadow-sm w-full">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-zinc-400"></span>
                      <span className="font-bold text-zinc-800">الحساب مصفّر كلياً (0 د.ع)</span>
                      <span className="text-zinc-500 text-[11px]">
                        بسبب حالة المشترك ({activeSubscriber.statuses?.filter((s) => s === 'مفلش' || s === 'لا ينظم' || s.includes('مفلش') || s.includes('لا ينظم')).join('، ')})
                      </span>
                    </div>
                    <span className="text-[10px] bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded-full font-bold">
                      بدون ديون أو مستحقات
                    </span>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-[12px] flex items-center gap-2 font-mono shadow-sm w-full">
                    <span className="font-bold text-slate-800 font-sans shrink-0">بداية السنة:</span>
                    <span className="text-slate-600">
                      القديم {formatNumber(activeBilling.remainingPrev)} + الفائدة {formatNumber(activeBilling.fee)} = {formatNumber(activeBilling.totalCarried)}
                    </span>
                  </div>
                )}
              </div>

              {/* اسم ورقم المشترك فوق أزرار التنقل مباشرة */}
              <div className="subscriber-content px-4 pt-2.5 pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setEditSub({ ...activeSubscriber })
                      setShowEditModal(true)
                    }}
                    className="text-right text-[16px] sm:text-[17px] font-bold text-slate-900 hover:text-sky-600 transition-colors cursor-pointer"
                    title="انقر لتعديل بيانات المشترك"
                  >
                    <span className="font-mono font-extrabold">{formatNumber(activeSubscriber.id)}</span> - <span>{activeSubscriber.name}</span>
                  </button>
                  <span className="text-[12px] text-slate-500 font-medium">
                    ({areas.find((a) => a.id === activeSubscriber.areaId)?.name}
                    {' - '}
                    {areas.find((a) => a.id === activeSubscriber.areaId)?.branches.find((b) => b.id === activeSubscriber.branchId)?.name})
                  </span>
                </div>
              </div>

              {/* زر مراسلة المشترك عبر واتساب - كبير وواضح وبارز في واجهة الحساب */}
              {Boolean(activeSubscriber.phone && activeSubscriber.phone.trim()) && (
                <div className="subscriber-content px-2 pt-1.5 pb-0.5">
                  <div className="flex gap-2 items-center">
                    {activeShareData?.url ? (
                      <a
                        href={activeShareData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-h-[46px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold text-[13px] sm:text-[14px] flex items-center justify-center gap-2 shadow-md transition-all border border-emerald-500 cursor-pointer"
                        title="مراسلة المشترك بمطالبة الدين وكشف الحساب عبر واتساب"
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0">
                          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                        </svg>
                        <span>مراسلة واتساب ({activeSubscriber.phone})</span>
                      </a>
                    ) : null}
                    <a
                      href={`tel:${activeSubscriber.phone}`}
                      className="px-3 min-h-[46px] rounded-xl bg-white border border-sky-200 text-slate-700 hover:bg-sky-50 font-bold text-[12px] flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                      title="اتصال هاتفي"
                    >
                      <span></span>
                      <span>اتصال</span>
                    </a>
                  </div>
                </div>
              )}

              {/* أزرار التالي والسابق للتنقل بين المشتركين (تعمل دائماً حتى عند البحث) */}
              {(() => {
                // قائمة التنقل الذكية:
                // إذا كان هناك بحث نشط أو كانت نتائج البحث عنصراً واحداً فقط،
                // نعتمد على القائمة الكاملة مرتبة بالتسلسل لكي تعمل أزرار التالي والسابق دائماً
                const navList = (searchQuery.trim() || displayedSubscribers.length <= 1)
                  ? [...subscribersInRange].sort((a, b) => a.id - b.id)
                  : displayedSubscribers

                const currentIndex = navList.findIndex((s) => s.id === activeSubscriber.id)
                const prevSub = currentIndex > 0 ? navList[currentIndex - 1] : null
                const nextSub = currentIndex >= 0 && currentIndex < navList.length - 1 ? navList[currentIndex + 1] : null
                return (
                  <div className="subscriber-content px-2 pt-2.5 flex gap-2">
                    <button
                      onClick={() => {
                        if (prevSub) {
                          shouldFocusOldDebtRef.current = true
                          setSelectedSubId(prevSub.id)
                          setSelectedYear(2026)
                          focusOldDebtInput()
                        }
                      }}
                      disabled={!prevSub}
                      className={`flex-1 min-h-[46px] rounded-xl border text-[12px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${prevSub ? 'bg-white border-sky-200 text-slate-700 hover:bg-sky-50' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                      <span className="text-[18px] leading-none font-bold text-slate-700">‹</span>
                      <div className="text-right overflow-hidden">
                        {prevSub ? (
                          <>
                            <div className="text-[10px] text-slate-500 font-bold leading-tight">السابق</div>
                            <div className="truncate max-w-[150px] leading-tight text-[12.5px] font-bold text-slate-900">
                              <span className="font-mono">{formatNumber(prevSub.id)}</span> - {prevSub.name}
                            </div>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400">لا يوجد سابق</span>
                        )}
                      </div>
                    </button>
                    <button
                      onClick={() => {
                        if (nextSub) {
                          shouldFocusOldDebtRef.current = true
                          setSelectedSubId(nextSub.id)
                          setSelectedYear(2026)
                          focusOldDebtInput()
                        }
                      }}
                      disabled={!nextSub}
                      className={`flex-1 min-h-[46px] rounded-xl border text-[12px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${nextSub ? 'bg-white border-sky-200 text-slate-700 hover:bg-sky-50' : 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed'}`}
                    >
                      <div className="text-left overflow-hidden">
                        {nextSub ? (
                          <>
                            <div className="text-[10px] text-slate-500 font-bold leading-tight">التالي</div>
                            <div className="truncate max-w-[150px] leading-tight text-[12.5px] font-bold text-slate-900">
                              <span className="font-mono">{formatNumber(nextSub.id)}</span> - {nextSub.name}
                            </div>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400">لا يوجد تالي</span>
                        )}
                      </div>
                      <span className="text-[18px] leading-none font-bold text-slate-700">›</span>
                    </button>
                  </div>
                )
              })()}

              {/* بلوك الديون بعرض الشاشة 100%
                  الأعمدة: الفترة 20% | الدين القديم 27% | المدفوع 26% | المتبقي 27%
                  ارتفاع الخلية 36px وبدون سكرول جانبي */}
              <div className="subscriber-content subscriber-content-4 w-full" style={{ width: '100%', margin: 0, padding: '8px', boxSizing: 'border-box', maxWidth: '100%' }}>
                <div className="bg-white rounded-2xl border border-sky-100 overflow-hidden shadow-sm w-full">
                  <div className="w-full">
                    <div
                      className="bg-slate-900 text-white text-[11.5px] font-bold grid w-full"
                      style={{ gridTemplateColumns: '25% 25% 25% 25%', width: '100%' }}
                    >
                      <div className="px-1 py-2 text-center">الديون السابقة</div>
                      <div className="px-1 py-2 border-r border-white/10 text-center">المجموع</div>
                      <div className="px-1 py-2 border-r border-white/10 text-center">المدفوع</div>
                      <div className="px-1 py-2 border-r border-white/10 text-center">المجموع الكلي</div>
                    </div>

                    {activeBilling.rows.map((row, idx) => {
                      // الشهر الحالي يبين بحد أحمر فقط، لا تكتب كلمة "الحالي"
                      const isCurrentPeriod = selectedYear === 2026 && idx === currentPeriodIndex
                      const oldKey = `${activeSubscriber.id}_${selectedYear}_${idx}_old`
                      const totalKey = `${activeSubscriber.id}_${selectedYear}_${idx}_total`
                      const paidKey = `${activeSubscriber.id}_${selectedYear}_${idx}_paid`
                      const remKey = `${activeSubscriber.id}_${selectedYear}_${idx}_rem`

                      const isEditingOld = editingCell?.key === oldKey
                      const isEditingTotal = editingCell?.key === totalKey
                      const isEditingPaid = editingCell?.key === paidKey
                      const isEditingRem = editingCell?.key === remKey

                      const oldDisplay = isEditingOld ? editingCell.value : formatInputDisplay(row.old)
                      const totalDisplay = isEditingTotal ? editingCell.value : formatInputDisplay(row.total)
                      const paidDisplay = isEditingPaid
                        ? editingCell.value
                        : row.paid === 0
                        ? ''
                        : formatInputDisplay(row.paid)
                      const remDisplay = isEditingRem ? editingCell.value : formatInputDisplay(row.remaining)

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
                          style={{ gridTemplateColumns: '25% 25% 25% 25%', width: '100%', minHeight: '38px' }}
                        >
                          {/* 1. الديون السابقة */}
                          <div className="px-0.5 flex items-center justify-center" style={{ minHeight: '38px' }}>
                            <input
                              id={idx === 0 ? 'first-old-debt-input' : undefined}
                              value={oldDisplay}
                              onChange={(e) => {
                                const formatted = formatInputDisplay(e.target.value)
                                setEditingCell({ key: oldKey, value: formatted })
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'old', formatted)
                              }}
                              onPaste={(e) => {
                                const text = e.clipboardData.getData('text')
                                if (text) {
                                  e.preventDefault()
                                  const formatted = formatInputDisplay(text)
                                  setEditingCell({ key: oldKey, value: formatted })
                                  handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'old', formatted)
                                }
                              }}
                              onBlur={(e) => {
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'old', e.target.value)
                                setEditingCell(null)
                              }}
                              onFocus={(e) => {
                                setEditingCell({ key: oldKey, value: formatInputDisplay(row.old) })
                                setTimeout(() => e.target.select(), 0)
                              }}
                              placeholder="0"
                              className={`border rounded-lg font-sans font-bold tabular-nums tracking-tight focus:outline-none focus:ring-1 bg-white text-center ${
                                isCurrentPeriod
                                  ? 'border-red-200 focus:border-red-400 focus:ring-red-100 text-[#ef4444]'
                                  : 'border-sky-100 focus:border-slate-900 focus:ring-slate-900/5 text-slate-800'
                              } ${row.isManual ? 'border-sky-200 bg-sky-50' : ''}`}
                              inputMode="numeric"
                              type="text"
                              style={{ width: '100%', height: '32px', fontSize: '14px', padding: '0 1px', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* 2. المجموع */}
                          <div className="px-0.5 border-r border-sky-50 flex items-center justify-center" style={{ minHeight: '38px' }}>
                            <input
                              value={totalDisplay}
                              onChange={(e) => {
                                const formatted = formatInputDisplay(e.target.value)
                                setEditingCell({ key: totalKey, value: formatted })
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'total', formatted)
                              }}
                              onPaste={(e) => {
                                const text = e.clipboardData.getData('text')
                                if (text) {
                                  e.preventDefault()
                                  const formatted = formatInputDisplay(text)
                                  setEditingCell({ key: totalKey, value: formatted })
                                  handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'total', formatted)
                                }
                              }}
                              onBlur={(e) => {
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'total', e.target.value)
                                setEditingCell(null)
                              }}
                              onFocus={(e) => {
                                setEditingCell({ key: totalKey, value: formatInputDisplay(row.total) })
                                setTimeout(() => e.target.select(), 0)
                              }}
                              placeholder="0"
                              className={`border rounded-lg font-sans font-bold tabular-nums tracking-tight focus:outline-none focus:ring-1 text-center bg-white ${
                                row.isTotalManual
                                  ? 'border-sky-300 bg-sky-50 text-sky-900'
                                  : isCurrentPeriod
                                  ? 'border-red-200 focus:border-red-400 focus:ring-red-100 text-slate-800'
                                  : 'border-sky-100 focus:border-slate-900 focus:ring-slate-900/5 text-slate-800'
                              }`}
                              inputMode="numeric"
                              type="text"
                              style={{ width: '100%', height: '32px', fontSize: '14px', padding: '0 1px', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* 3. المدفوع */}
                          <div className="px-0.5 border-r border-sky-50 flex items-center justify-center" style={{ minHeight: '38px' }}>
                            <input
                              value={paidDisplay}
                              onChange={(e) => {
                                const formatted = formatInputDisplay(e.target.value)
                                setEditingCell({ key: paidKey, value: formatted })
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'paid', formatted)
                              }}
                              onPaste={(e) => {
                                const text = e.clipboardData.getData('text')
                                if (text) {
                                  e.preventDefault()
                                  const formatted = formatInputDisplay(text)
                                  setEditingCell({ key: paidKey, value: formatted })
                                  handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'paid', formatted)
                                }
                              }}
                              onBlur={(e) => {
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'paid', e.target.value)
                                setEditingCell(null)
                              }}
                              onFocus={(e) => {
                                setEditingCell({
                                  key: paidKey,
                                  value: row.paid === 0 ? '' : formatInputDisplay(row.paid)
                                })
                                setTimeout(() => e.target.select(), 0)
                              }}
                              placeholder="0"
                              className={`border rounded-lg font-sans font-bold tabular-nums tracking-tight focus:outline-none focus:ring-1 bg-white text-center ${
                                isCurrentPeriod
                                  ? 'border-red-200 focus:border-red-400 focus:ring-red-100 text-slate-800'
                                  : 'border-sky-100 focus:border-slate-900 focus:ring-slate-900/5 text-slate-800'
                              }`}
                              inputMode="numeric"
                              type="text"
                              style={{ width: '100%', height: '32px', fontSize: '14px', padding: '0 1px', boxSizing: 'border-box' }}
                            />
                          </div>

                          {/* 4. المجموع الكلي */}
                          <div className="px-0.5 border-r border-sky-50 flex items-center justify-center" style={{ minHeight: '38px' }}>
                            <input
                              value={remDisplay}
                              onChange={(e) => {
                                const formatted = formatInputDisplay(e.target.value)
                                setEditingCell({ key: remKey, value: formatted })
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'rem', formatted)
                              }}
                              onPaste={(e) => {
                                const text = e.clipboardData.getData('text')
                                if (text) {
                                  e.preventDefault()
                                  const formatted = formatInputDisplay(text)
                                  setEditingCell({ key: remKey, value: formatted })
                                  handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'rem', formatted)
                                }
                              }}
                              onBlur={(e) => {
                                handlePaymentEdit(activeSubscriber.id, selectedYear, idx, 'rem', e.target.value)
                                setEditingCell(null)
                              }}
                              onFocus={(e) => {
                                setEditingCell({ key: remKey, value: formatInputDisplay(row.remaining) })
                                setTimeout(() => e.target.select(), 0)
                              }}
                              className={`border rounded-lg font-sans font-bold tabular-nums tracking-tight focus:outline-none focus:ring-1 text-center ${
                                row.remaining === 0
                                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                                  : row.remaining < 0
                                  ? 'bg-red-50 border-red-100 text-red-700'
                                  : isCurrentPeriod
                                  ? 'bg-white border-red-200 text-[#ef4444]'
                                  : 'bg-slate-900 border-slate-900 text-white'
                              } ${row.isRemainingManual ? 'ring-1 ring-sky-400' : ''}`}
                              inputMode="numeric"
                              type="text"
                              style={{ width: '100%', height: '32px', fontSize: '14px', padding: '0 1px', boxSizing: 'border-box' }}
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

                {/* ملخص مدة وتاريخ الدين المتراكم أسفل السجل */}
                {(() => {
                  const debtSummary = calculateDebtSummary(
                    activeSubscriber.id,
                    billing,
                    subscribers,
                    pricing,
                    selectedYear,
                    activeBilling.rows
                  )

                  if (debtSummary.isZeroAccount) {
                    return (
                      <div className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-center shadow-sm">
                        <div className="text-[12px] font-bold text-zinc-600">الحساب مصفّر كلياً (0 د.ع) ولا توجد مطالبات</div>
                      </div>
                    )
                  }

                  if (debtSummary.debt <= 0) {
                    return (
                      <div className="mt-3 w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center shadow-sm">
                        <div className="text-[12.5px] font-bold text-emerald-800 flex items-center justify-center gap-1.5">
                          <span></span>
                          <span>الحساب مسدد بالكامل - لا توجد ديون متراكمة (0 د.ع)</span>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div className="mt-3 w-full rounded-2xl border-2 border-red-300 bg-gradient-to-b from-red-50 to-red-100/60 p-4 shadow-md transition-all">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-[12px] font-bold">!</span>
                            <span className="text-[14px] font-black text-red-900">
                              عليه دين: {debtSummary.durationText}
                            </span>
                          </div>
                          <div className="text-[12px] font-bold text-red-800 mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span> منذ:</span>
                            <span className="font-mono bg-white/80 px-2 py-0.5 rounded-lg border border-red-200 text-red-950 font-black">
                              {debtSummary.startDate}
                            </span>
                            {debtSummary.startPeriod && (
                              <span className="text-red-700 font-semibold text-[11px]">
                                (فترة {debtSummary.startPeriod})
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="shrink-0 text-left bg-white/90 px-3 py-2 rounded-xl border border-red-200 shadow-sm">
                          <div className="text-[10px] text-red-600 font-bold">المبلغ المتراكم</div>
                          <div className="text-[16px] font-black text-red-700 font-mono leading-tight">
                            {formatNumber(debtSummary.debt)} <span className="text-[10px] font-sans">د.ع</span>
                          </div>
                          <div className="text-[10px] font-bold text-red-500 mt-0.5">
                            يعادل {formatNumber(debtSummary.months)} {debtSummary.months === 1 ? 'شهر' : 'أشهر'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-red-200/80 flex items-center justify-between text-[11px] text-red-800 font-medium flex-wrap gap-2">
                        <div>
                          الاشتراك: <span className="font-bold">{formatNumber(debtSummary.periodDue)} د.ع</span> كل شهرين ({formatNumber(debtSummary.monthlyDue)} د.ع شهرياً)
                        </div>
                        {debtSummary.remainder > 0 && (
                          <div className="text-red-700 font-bold bg-white/60 px-2 py-0.5 rounded-md">
                            متبقي إضافي: {formatNumber(debtSummary.remainder)} د.ع
                          </div>
                        )}
                      </div>

                      {Boolean(activeSubscriber.phone && activeSubscriber.phone.trim()) && activeShareData?.url && (
                        <div className="mt-3 pt-2.5 border-t border-red-200">
                          <a
                            href={activeShareData.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[12.5px] flex items-center justify-center gap-2 shadow-sm transition-all border border-emerald-500 cursor-pointer active:scale-[0.99]"
                            title="إرسال رسالة مطالبة بالدين عبر واتساب"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                            </svg>
                            <span>مراسلة المشترك بمبلغ الدين عبر واتساب</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* زر رفع أو فتح لكيشن ملحق بالسجل مباشرة لتقليص الفراغ */}
                {(() => {
                  const hasLocation = Boolean(
                    activeSubscriber.location &&
                    ((activeSubscriber.location.lat && activeSubscriber.location.lng) || activeSubscriber.location.link)
                  )
                  return (
                    <div className="mt-3.5 mb-2 w-full">
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
                            className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12.5px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer active:scale-[0.98]"
                          >
                            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
                            className="h-11 px-3 bg-white border border-sky-200 text-slate-700 hover:bg-sky-50 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
                          >
                            {isLocating ? 'جارِ التحديد...' : 'تحديث اللكيشن'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleUploadLocation(activeSubscriber.id)}
                          disabled={isLocating}
                          className="w-full h-11 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[12.5px] font-bold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60 cursor-pointer active:scale-[0.98]"
                        >
                          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          </div>
        </div>
      )}

      {/* ==========================
          فورم إضافة مشترك (A)
      ========================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-[10050] bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-[460px] rounded-2xl border border-sky-100 flex flex-col max-h-[90vh] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* رأس النافذة */}
            <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <h3 className="font-bold text-[14px] text-slate-900">إضافة مشترك جديد</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors text-sm"
              >
                
              </button>
            </div>

            <form onSubmit={handleAddSubscriberSubmit} className="p-4 space-y-3 overflow-y-auto">
              {/* السطر الأول: رقم المشترك على اليمين صغير جداً، واسم المشترك على اليسار كبير */}
              <div className="flex gap-2 items-start">
                {/* رقم المشترك (على اليمين، حجم صغير جداً ومضغوط) */}
                <div className="w-[76px] shrink-0">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1 text-center truncate">
                    الرقم <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newSub.idStr}
                    onChange={(e) => setNewSub((p) => ({ ...p, idStr: sanitizeNumberInput(e.target.value) }))}
                    placeholder="5205"
                    className="w-full h-10 px-1 border border-slate-200 rounded-xl text-[13px] font-mono font-bold text-center focus:outline-none focus:border-slate-900 bg-white shadow-xs"
                    inputMode="numeric"
                    autoFocus
                  />
                </div>

                {/* اسم المشترك (على اليسار، حجم كبير وواسع يأخذ أغلب السطر) */}
                <div className="flex-1 min-w-0">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    اسم المشترك <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      value={newSub.name}
                      onChange={(e) => setNewSub((p) => ({ ...p, name: e.target.value }))}
                      placeholder="الاسم الثلاثي أو الرباعي للمشترك..."
                      className="w-full h-10 pr-3 pl-8 border border-slate-200 rounded-xl text-[13px] font-medium focus:outline-none focus:border-slate-900 bg-white shadow-xs"
                    />
                    {Boolean(newSub.name) && (
                      <button
                        type="button"
                        onClick={() => setNewSub((p) => ({ ...p, name: '' }))}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-600 flex items-center justify-center text-[10px] font-bold transition-all"
                        title="مسح الاسم"
                      >
                        
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* السطر الثاني: المنطقة والفرع كلاهما بجانب بعضهما، مع إضافة منطقة وإضافة فرع */}
              <div className="grid grid-cols-2 gap-2">
                {/* المنطقة */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      المنطقة <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineAddArea((p) => !p)
                        setShowInlineAddBranch(false)
                      }}
                      className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200 transition-colors"
                      title="إضافة منطقة جديدة"
                    >
                      + إضافة منطقة
                    </button>
                  </div>
                  {showInlineAddArea ? (
                    <div className="flex gap-1">
                      <input
                        value={inlineAreaName}
                        onChange={(e) => setInlineAreaName(e.target.value)}
                        placeholder="اسم المنطقة..."
                        className="w-full h-10 px-2 border border-sky-400 rounded-xl text-[11px] focus:outline-none bg-sky-50/40"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleQuickAddArea()
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddArea}
                        className="px-2.5 h-10 bg-slate-900 text-white rounded-xl text-[11px] font-bold shrink-0"
                      >
                        حفظ
                      </button>
                    </div>
                  ) : (
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
                      className="w-full h-10 px-2.5 border border-slate-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-slate-900 shadow-xs"
                    >
                      <option value="">اختر المنطقة</option>
                      {areas.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* الفرع */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-bold text-slate-700">الفرع</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newSub.areaId) {
                          setFormError('يرجى اختيار المنطقة أولاً لإضافة فرع جديد لها')
                          return
                        }
                        setShowInlineAddBranch((p) => !p)
                        setShowInlineAddArea(false)
                      }}
                      className="text-[10px] font-bold text-sky-700 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-1.5 py-0.5 rounded border border-sky-200 transition-colors"
                      title="إضافة فرع جديد"
                    >
                      + إضافة فرع
                    </button>
                  </div>
                  {showInlineAddBranch ? (
                    <div className="flex gap-1">
                      <input
                        value={inlineBranchName}
                        onChange={(e) => setInlineBranchName(e.target.value)}
                        placeholder="اسم الفرع..."
                        className="w-full h-10 px-2 border border-sky-400 rounded-xl text-[11px] focus:outline-none bg-sky-50/40"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            handleQuickAddBranch()
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleQuickAddBranch}
                        className="px-2.5 h-10 bg-slate-900 text-white rounded-xl text-[11px] font-bold shrink-0"
                      >
                        حفظ
                      </button>
                    </div>
                  ) : (
                    <select
                      value={newSub.branchId}
                      onChange={(e) => setNewSub((p) => ({ ...p, branchId: e.target.value }))}
                      className="w-full h-10 px-2.5 border border-slate-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-slate-900 shadow-xs"
                    >
                      {(areas.find((a) => a.id === newSub.areaId)?.branches || []).map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* السطر الثالث: نوع العقار ورقم المتر (نوع العداد) بجانب بعضهما */}
              <div className="grid grid-cols-2 gap-2">
                {/* نوع العقار */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">نوع العقار</label>
                  <select
                    value={newSub.propertyType}
                    onChange={(e) => {
                      const propertyType = e.target.value as PropertyType
                      setNewSub((p) => ({
                        ...p,
                        propertyType,
                        meterType: propertyType === 'سكني' ? '4 متر' : p.meterType || '10 متر'
                      }))
                    }}
                    className="w-full h-10 px-2.5 border border-slate-200 rounded-xl text-[12px] bg-white font-medium focus:outline-none focus:border-slate-900 shadow-xs"
                  >
                    <option value="سكني">سكني</option>
                    <option value="تجاري">تجاري</option>
                  </select>
                </div>

                {/* رقم المتر (نوع العداد) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    رقم المتر <span className="text-[10px] text-slate-400 font-normal">(العداد)</span>
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={newSub.meterType ? newSub.meterType.replace(/[^\d]/g, '') : ''}
                      onChange={(e) => {
                        const num = e.target.value.replace(/[^\d]/g, '')
                        setNewSub((p) => ({ ...p, meterType: num ? `${num} متر` : '' }))
                      }}
                      placeholder="4"
                      className="w-full h-10 pr-3 pl-10 border border-slate-200 rounded-xl text-[13px] font-mono focus:outline-none focus:border-slate-900 bg-white shadow-xs"
                    />
                    <span className="absolute left-2.5 text-[11px] font-bold text-slate-500 pointer-events-none select-none">
                      متر
                    </span>
                  </div>
                </div>
              </div>

              {/* أزرار سريعة لاختيار المتر بشكل أنيق ومدمج */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 font-medium">سريع:</span>
                {(newSub.propertyType === 'سكني'
                  ? ['3 متر', '4 متر']
                  : ['1 متر', '2 متر', '3 متر', '4 متر', '10 متر', '50 متر', '70 متر']
                ).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setNewSub((p) => ({ ...p, meterType: m }))}
                    className={`text-[10.5px] px-2 py-0.5 rounded-lg border font-bold transition-all ${
                      newSub.meterType === m
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* الهاتف */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  رقم الهاتف <span className="text-[10px] text-slate-400 font-normal mr-1">(اختياري)</span>
                </label>
                <input
                  value={newSub.phone}
                  onChange={(e) => setNewSub((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="07xxxxxxxxx"
                  className="w-full h-10 px-3 border border-slate-200 rounded-xl text-[12.5px] font-mono focus:outline-none focus:border-slate-900 bg-white shadow-xs"
                  dir="ltr"
                />
              </div>

              {/* حالات المشترك المتعددة (مدمجة وأنيقة بدون إطالة اللوحة) */}
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1.5">حالات المشترك (اختياري):</label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200/80">
                  {STATUS_OPTIONS.map((st) => {
                    const checked = newSub.statuses.includes(st)
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setNewSub((p) => ({
                            ...p,
                            statuses: checked ? p.statuses.filter((x) => x !== st) : [...p.statuses, st]
                          }))
                        }}
                        className={`text-[10.5px] px-2 py-1 rounded-lg border font-semibold transition-all ${
                          checked
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {checked ? ' ' : ''}{st}
                      </button>
                    )
                  })}
                </div>
              </div>

              {formError && (
                <div className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-xl p-2.5 font-bold space-y-1.5">
                  <div> {formError}</div>
                  {duplicateSubId && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false)
                        setSelectedSubId(duplicateSubId)
                        setSelectedYear(2026)
                      }}
                      className="w-full h-8 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      <span></span>
                      <span>فتح ملف المشترك #{formatNumber(duplicateSubId)} وتعديله فوراً</span>
                    </button>
                  )}
                </div>
              )}

              {/* زر الحفظ واضح وبارز في الأسفل */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full h-11 bg-slate-900 hover:bg-black text-white rounded-xl text-[13px] font-bold transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="text-[16px] leading-none">+</span>
                  <span>حفظ وإضافة المشترك</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==========================
          فورم تعديل مشترك (B)
      ========================== */}
      {showEditModal && editSub.id && (
        <div className="fixed inset-0 z-[10050] bg-slate-900/25 backdrop-blur-[2px] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-[480px] sm:rounded-2xl border-0 sm:border border-sky-100 flex flex-col max-h-[100vh] shadow-xl">
            <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center bg-sky-50/50">
              <h3 className="font-bold text-[13px] text-slate-800">تعديل معلومات المشترك #{editSub.id}</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500"
              >
                
              </button>
            </div>

            <form onSubmit={handleEditSubscriberSubmit} className="p-4 space-y-4 overflow-y-auto">
              <div>
                <label className="text-[11px] text-slate-600 font-medium">الاسم</label>
                <div className="relative mt-1.5">
                  <input
                    value={editSub.name || ''}
                    onChange={(e) => setEditSub((p) => ({ ...p, name: e.target.value }))}
                    className="w-full h-10 pr-4 pl-10 border border-sky-100 rounded-2xl text-[13px] focus:outline-none focus:border-slate-900 bg-sky-50/30 focus:bg-white"
                  />
                  {Boolean(editSub.name) && (
                    <button
                      type="button"
                      onClick={() => setEditSub((p) => ({ ...p, name: '' }))}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200/80 hover:bg-slate-300 active:scale-90 text-slate-600 flex items-center justify-center text-[12px] font-bold transition-all"
                      title="مسح الاسم بالكامل"
                    >
                      
                    </button>
                  )}
                </div>
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
                      setEditSub((p) => ({
                        ...p,
                        propertyType,
                        meterType: propertyType === 'سكني' ? '4 متر' : p.meterType || '10 متر'
                      }))
                    }}
                    className="mt-1.5 w-full h-10 px-3 border border-sky-100 rounded-2xl text-[12px] bg-white font-medium"
                  >
                    <option value="سكني">سكني</option>
                    <option value="تجاري">تجاري</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 font-medium">
                    نوع العداد <span className="text-[10px] text-slate-400 font-normal mr-1">(اكتب الرقم بالمتر)</span>
                  </label>
                  <div className="relative mt-1.5 flex items-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editSub.meterType ? editSub.meterType.replace(/[^\d]/g, '') : ''}
                      onChange={(e) => {
                        const num = e.target.value.replace(/[^\d]/g, '')
                        setEditSub((p) => ({ ...p, meterType: num ? `${num} متر` : '' }))
                      }}
                      placeholder="اكتب رقم المتر (مثال: 4 أو 75 أو 100)"
                      className="w-full h-10 pr-3 pl-12 border border-sky-100 rounded-2xl text-[13px] font-mono focus:outline-none focus:border-slate-900 bg-white"
                    />
                    <span className="absolute left-3 text-[11px] font-bold text-slate-500 pointer-events-none select-none">
                      متر
                    </span>
                  </div>
                  {/* أزرار اختيار سريعة */}
                  {(editSub.propertyType || 'سكني') === 'سكني' ? (
                    <div className="flex gap-1.5 mt-1.5">
                      {['3 متر', '4 متر'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setEditSub((p) => ({ ...p, meterType: m }))}
                          className={`text-[10px] px-2.5 py-1 rounded-lg border font-bold transition-all ${
                            editSub.meterType === m
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-sky-50/50 border-sky-100 text-slate-600 hover:bg-sky-100'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {['1 متر', '2 متر', '3 متر', '4 متر', '10 متر', '50 متر', '70 متر'].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setEditSub((p) => ({ ...p, meterType: m }))}
                          className={`text-[10px] px-2 py-0.5 rounded-lg border font-medium transition-all ${
                            editSub.meterType === m
                              ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                              : 'bg-sky-50/50 border-sky-100 text-slate-600 hover:bg-sky-100'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
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

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (editSub.id) {
                      handleResetSubscriberAccount(editSub.id)
                      setShowEditModal(false)
                    }
                  }}
                  className="w-full h-10 border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-2xl text-[12px] font-bold flex items-center justify-center gap-2 transition-all active:scale-98"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                  <span>تصفير حساب المشترك (إعادة الدين السابق إلى 0)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة التواصل والموقع والصور */}
      {showContactModal && activeSubscriber && (
        <div className="fixed inset-0 z-[10050] bg-slate-900/25 backdrop-blur-[2px] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-[480px] sm:rounded-2xl border-0 sm:border border-sky-100 flex flex-col shadow-xl">
            <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center bg-sky-50/50">
              <h3 className="font-bold text-[13px] text-slate-800">التواصل والموقع والصور</h3>
              <button
                onClick={() => setShowContactModal(false)}
                className="w-8 h-8 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500"
              >
                
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/40">
                <div className="text-[11px] text-slate-500">رقم الهاتف</div>
                <div className="font-mono text-[13px] mt-1.5 font-bold" dir="ltr">
                  {activeSubscriber.phone || 'غير مسجل'}
                </div>
                {activeSubscriber.phone && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    <a
                      href={`tel:${activeSubscriber.phone}`}
                      className="h-9 px-4 border border-sky-100 rounded-full text-[12px] flex items-center bg-white text-slate-700 hover:bg-sky-50 font-bold"
                    >
                      اتصال
                    </a>
                    <a
                      href={activeShareData?.url || `https://wa.me/${formatWhatsAppPhone(activeSubscriber.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-4 border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-colors"
                      title="مشاركة كشف الحساب عبر واتساب"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                      </svg>
                      <span>مشاركة عبر واتساب</span>
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
        <div className="fixed inset-0 z-[10050] bg-slate-900/25 backdrop-blur-[2px] flex">
          <div className="depth-panel bg-white w-full sm:w-[520px] h-full border-l border-sky-100 flex flex-col mr-auto sm:mr-0 ml-auto shadow-[-8px_0_30px_rgba(0,0,0,0.1)]">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="font-bold text-[13px]">الإعدادات</h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-7 h-7 border border-white/20 rounded-lg flex items-center justify-center bg-white/10"
              >
                
              </button>
            </div>

            <div className="px-3 py-3 border-b border-sky-50 flex gap-2 overflow-x-auto scrollbar-none bg-sky-50/30">
              {(['collector', 'areas', 'import', 'ai'] as const).map((tab) => {
                const labels = {
                  collector: 'المحصل',
                  pricing: 'التسعير',
                  areas: 'المناطق والافرع',
                  import: 'الاستيراد',
                  ai: 'الذكاء الاصطناعي '
                }
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
                  {/* زر إضافة مشترك وزر تنزيل إرساليات وزر تسجيل الخروج */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => {
                        setShowSettingsModal(false)
                        openAddModal()
                      }}
                      className="h-12 bg-slate-900 text-white rounded-2xl text-[12.5px] font-bold flex items-center justify-center gap-1.5 hover:bg-black transition-colors"
                    >
                      <span className="text-[17px] leading-none">+</span>
                      <span>إضافة مشترك</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowSettingsModal(false)
                        setShowInstallmentsPage(true)
                      }}
                      className="h-12 bg-emerald-600 text-white rounded-2xl text-[12.5px] font-bold flex items-center justify-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-2xs"
                    >
                      <span className="text-[15px] leading-none"></span>
                      <span>تنزيل إرساليات</span>
                    </button>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setShowSettingsModal(false)
                        handleLogout()
                      }}
                      className="w-full h-11 bg-red-50 border border-red-200 text-red-600 rounded-2xl text-[12.5px] font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
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

              {/* ==========================
                  تبويب الذكاء الاصطناعي (AI)
              ========================== */}
              {settingsTab === 'ai' && (
                <div className="space-y-4">
                  <div className="border border-sky-100 rounded-2xl p-4 bg-white shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl"></span>
                      <div>
                        <div className="text-[13px] font-bold text-slate-800">مفاتيح الذكاء الاصطناعي</div>
                      </div>
                    </div>

                    {/* حقل إضافة مفتاح جديد */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-bold text-slate-700 block">
                        إضافة مفتاح جديد (API Key):
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={newAiKeyInput}
                          onChange={(e) => setNewAiKeyInput(e.target.value)}
                          className="flex-1 h-10 px-3 border border-sky-100 rounded-xl text-[12px] font-mono focus:outline-none focus:border-slate-900 bg-sky-50/30"
                        />
                        <button
                          type="button"
                          onClick={handleAddAiKey}
                          disabled={!newAiKeyInput.trim()}
                          className="px-4 h-10 bg-slate-900 hover:bg-black text-white text-[12px] font-bold rounded-xl transition-colors disabled:opacity-50"
                        >
                          إضافة
                        </button>
                      </div>
                    </div>

                    {/* قائمة المفاتيح المضافة */}
                    <div className="pt-2 space-y-2">
                      <div className="text-[11px] font-bold text-slate-700 flex justify-between items-center">
                        <span>المفاتيح المحفوظة ({aiApiKeys.length}):</span>
                        {aiApiKeys.length > 0 && (
                          <span className="text-[10px] text-emerald-700 font-semibold">جاهز للاستخدام في النظام</span>
                        )}
                      </div>

                      {aiApiKeys.length === 0 ? (
                        <div className="p-4 text-center border border-dashed border-slate-200 rounded-xl text-slate-400 text-xs">
                          لا توجد مفاتيح مضافة حتى الآن. أضف مفتاحك لتبدأ في قراءة وتنزيل الوصولات!
                        </div>
                      ) : (
                        aiApiKeys.map((k, idx) => {
                          const testRes = aiTestResult[k]
                          const isTesting = aiTestingKey === k
                          const masked = k.length > 10 ? `${k.substring(0, 6)}...${k.substring(k.length - 4)}` : k

                          return (
                            <div
                              key={idx}
                              className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                    {idx + 1}
                                  </span>
                                  <span className="font-mono text-xs text-slate-800 font-semibold truncate">
                                    {masked}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleTestAiKey(k)}
                                    disabled={isTesting}
                                    className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-bold transition-colors disabled:opacity-50"
                                  >
                                    {isTesting ? 'جاري الفحص...' : 'فحص الاتصال '}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAiKey(k)}
                                    className="w-7 h-7 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg flex items-center justify-center transition-colors text-xs"
                                    title="حذف هذا المفتاح"
                                  >
                                    
                                  </button>
                                </div>
                              </div>

                              {testRes && (
                                <div
                                  className={`text-[11px] p-2 rounded-lg font-medium ${
                                    testRes.success
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-red-50 text-red-700 border border-red-200'
                                  }`}
                                >
                                  {testRes.success ? ' ' : ' '}
                                  {testRes.message}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>

                  {/* زر تجربة تنزيل إرساليات */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowSettingsModal(false)
                        setShowReceiptScannerModal(true)
                      }}
                      className="w-full h-11 bg-[#0e7490] hover:bg-[#085a70] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      <span></span>
                      <span>فتح شاشة تنزيل الإرساليات الآن</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* زر إضافة مشترك عائم وسريع (يظهر في تبويب المشتركين) */}
      {/* ========================================================= */}
      {/* ========================================================= */}
      {/* زر إضافة مشترك عائم وسريع (يظهر في تبويب المشتركين) */}
      {/* ========================================================= */}
      {bottomNavTab === 'subscribers' && !activeSubscriber && !showAddModal && !showEditModal && !showReceiptScannerModal && !showInstallmentsPage && (
        <div
          style={{ position: 'fixed', bottom: '68px', left: '16px', zIndex: 9998 }}
          className="flex items-center gap-2"
        >
          {/* زر تنزيل إرساليات - بلون أخضر زمردي داكن وصلب 100% وكتابة بيضاء ناصعة */}
          <button
            type="button"
            onClick={() => {
              setShowInstallmentsPage(true)
              setSearchOpen(false)
              setFilterDrawerOpen(false)
            }}
            style={{
              height: '44px',
              padding: '0 16px',
              backgroundColor: '#047857',
              color: '#ffffff',
              borderRadius: '9999px',
              boxShadow: '0 8px 25px rgba(4, 120, 87, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1.5px solid #059669',
              cursor: 'pointer',
              opacity: 1
            }}
            title="تنزيل إرساليات الدفع"
          >
            <span style={{ fontSize: '15px', lineHeight: 1 }}></span>
            <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '12.5px' }}>تنزيل إرساليات</span>
          </button>

          {/* زر إضافة مشترك */}
          <button
            type="button"
            onClick={openAddModal}
            className="h-11 px-4 bg-slate-900 hover:bg-black text-white rounded-full shadow-[0_8px_25px_rgba(15,23,42,0.35)] flex items-center gap-2 transition-all active:scale-95 cursor-pointer border border-slate-700/80 font-bold text-[12px]"
            title="إضافة مشترك جديد"
          >
            <span className="text-[18px] font-bold leading-none">+</span>
            <span>إضافة مشترك</span>
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* القائمة السفلية العصرية الثابتة بأسفل الشاشة (أفقية بارتفاع 58px) */}
      {/* ========================================================= */}
      <nav
        aria-label="شريط التنقل السفلي"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          width: '100%',
          height: '58px',
          zIndex: 40,
          backgroundColor: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          boxShadow: '0 -2px 12px rgba(15, 23, 42, 0.06)',
          display: (activeSubscriber || showReceiptScannerModal) ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            height: '100%',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 4px',
            boxSizing: 'border-box'
          }}
        >
          {/* 1. المشتركين */}
          <button
            type="button"
            onClick={() => setBottomNavTab('subscribers')}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              outline: 'none',
              padding: '2px 0',
              cursor: 'pointer',
              color: bottomNavTab === 'subscribers' ? '#0f172a' : '#94a3b8',
              transition: 'all 0.15s ease'
            }}
          >
            <div
              style={{
                width: '38px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                backgroundColor: bottomNavTab === 'subscribers' ? '#0f172a' : 'transparent',
                color: bottomNavTab === 'subscribers' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={bottomNavTab === 'subscribers' ? 2.2 : 1.8}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '10.5px',
                marginTop: '2px',
                fontWeight: bottomNavTab === 'subscribers' ? 'bold' : '500',
                color: bottomNavTab === 'subscribers' ? '#0f172a' : '#94a3b8'
              }}
            >
              المشتركين
            </span>
          </button>

          {/* 2. المناطق */}
          <button
            type="button"
            onClick={() => setBottomNavTab('areas')}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              outline: 'none',
              padding: '2px 0',
              cursor: 'pointer',
              color: bottomNavTab === 'areas' ? '#0f172a' : '#94a3b8',
              transition: 'all 0.15s ease'
            }}
          >
            <div
              style={{
                width: '38px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                backgroundColor: bottomNavTab === 'areas' ? '#0f172a' : 'transparent',
                color: bottomNavTab === 'areas' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={bottomNavTab === 'areas' ? 2.2 : 1.8}>                <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                <line x1="8" y1="2" x2="8" y2="18" />
                <line x1="16" y1="6" x2="16" y2="22" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '10.5px',
                marginTop: '2px',
                fontWeight: bottomNavTab === 'areas' ? 'bold' : '500',
                color: bottomNavTab === 'areas' ? '#0f172a' : '#94a3b8'
              }}
            >
              المناطق
            </span>
          </button>

          {/* 3. يحتاج مراجعة */}
          <button
            type="button"
            onClick={() => setBottomNavTab('review')}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              outline: 'none',
              padding: '2px 0',
              cursor: 'pointer',
              color: bottomNavTab === 'review' ? '#d97706' : '#94a3b8',
              position: 'relative',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: '38px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '12px',
                  backgroundColor: bottomNavTab === 'review' ? '#d97706' : 'transparent',
                  color: bottomNavTab === 'review' ? '#ffffff' : '#94a3b8',
                  transition: 'all 0.2s ease'
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={bottomNavTab === 'review' ? 2.2 : 1.8}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <polyline points="10 9 9 9 8 9" />
                </svg>
              </div>
              {totalReviewBadgeCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-4px',
                    minWidth: '15px',
                    height: '15px',
                    padding: '0 3px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 'bold',
                    borderRadius: '99px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1.5px solid #ffffff'
                  }}
                >
                  {totalReviewBadgeCount}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '10.5px',
                marginTop: '2px',
                fontWeight: bottomNavTab === 'review' ? 'bold' : '500',
                color: bottomNavTab === 'review' ? '#d97706' : '#94a3b8'
              }}
            >
              يحتاج مراجعة
            </span>
          </button>

          {/* 4. الإحصائيات */}
          <button
            type="button"
            onClick={() => setBottomNavTab('stats')}
            style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              outline: 'none',
              padding: '2px 0',
              cursor: 'pointer',
              color: bottomNavTab === 'stats' ? '#0f172a' : '#94a3b8',
              transition: 'all 0.15s ease'
            }}
          >
            <div
              style={{
                width: '38px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '12px',
                backgroundColor: bottomNavTab === 'stats' ? '#0f172a' : 'transparent',
                color: bottomNavTab === 'stats' ? '#ffffff' : '#94a3b8',
                transition: 'all 0.2s ease'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={bottomNavTab === 'stats' ? 2.2 : 1.8}>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <span
              style={{
                fontSize: '10.5px',
                marginTop: '2px',
                fontWeight: bottomNavTab === 'stats' ? 'bold' : '500',
                color: bottomNavTab === 'stats' ? '#0f172a' : '#94a3b8'
              }}
            >
              الإحصائيات
            </span>
          </button>
        </div>
      </nav>

      {/* نافذة الإرساليات الجديدة لتعديل السجل الورقي للكاتب */}
      {showWriterConsignmentsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* رأس النافذة */}
            <div className="p-4 md:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-amber-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
                    <span>الإرساليات الجديدة (لتعديل السجل الورقي)</span>
                    {unrecordedWriterItems.length > 0 && (
                      <span className="text-[11px] bg-amber-500 text-white px-2 py-0.5 rounded-full font-bold">
                        {unrecordedWriterItems.length} بانتظار التثبيت
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    الإرساليات والدفعات المسجلة على اشتراكاتك لتثبيتها في سجلك الورقي وتأشيرها
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshConsignments}
                  disabled={isRefreshingConsignments}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                  title="تحديث البيانات من السحابة"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshingConsignments ? 'animate-spin text-amber-600' : ''}`} />
                  <span className="hidden sm:inline">تحديث</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                  title="طباعة كشف الإرساليات"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">طباعة</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowWriterConsignmentsModal(false)}
                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* شريط الفلترة والأوامر السريعة */}
            <div className="px-4 md:px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWriterConsignmentsFilter('unread')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    writerConsignmentsFilter === 'unread'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>الجديدة فقط (غير المثبتة)</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${writerConsignmentsFilter === 'unread' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {unrecordedWriterItems.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setWriterConsignmentsFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 ${
                    writerConsignmentsFilter === 'all'
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>جميع الإرساليات</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${writerConsignmentsFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                    {writerConsignmentItems.length}
                  </span>
                </button>
              </div>

              {displayedWriterItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const keys = displayedWriterItems.map(x => x.uniqueKey)
                    markAllAsRecorded(keys)
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>تحديد المعروض كمثبت في السجل ✓</span>
                </button>
              )}
            </div>

            {/* جسم النافذة: الجدول وقائمة الإرساليات */}
            <div className="flex-1 overflow-y-auto p-4 md:p-5">
              {displayedWriterItems.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/60 rounded-3xl border border-dashed border-slate-200 my-4 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">
                    {writerConsignmentsFilter === 'unread'
                      ? 'رائع! لا توجد إرساليات جديدة تنتظر التثبيت'
                      : 'لا توجد إرساليات مسجلة لاشتراكاتك حالياً'}
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {writerConsignmentsFilter === 'unread'
                      ? 'جميع الإرساليات والدفعات المسجلة على اشتراكاتك تم تأشيرها كمثبتة في السجل الورقي.'
                      : 'عند تسجيل أي إرسالية جديدة لاشتراكاتك في الفرع، ستظهر هنا فوراً لتعديلها في سجلك الورقي.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 text-[11px]">
                        <th className="py-3 px-3">التثبيت بالسجل</th>
                        <th className="py-3 px-3">رقم الوصل</th>
                        <th className="py-3 px-3">رقم الاشتراك</th>
                        <th className="py-3 px-3">اسم المشترك</th>
                        <th className="py-3 px-3">المنطقة</th>
                        <th className="py-3 px-3">المبلغ المدفوع</th>
                        <th className="py-3 px-3">رقم الإرسالية</th>
                        <th className="py-3 px-3">المحصل</th>
                        <th className="py-3 px-3">تاريخ الدفع</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayedWriterItems.map((entry) => (
                        <tr
                          key={entry.uniqueKey}
                          className={`hover:bg-slate-50 transition-colors ${
                            entry.isRecorded ? 'bg-slate-50/40 text-slate-500' : 'bg-amber-50/30 font-semibold text-slate-900'
                          }`}
                        >
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => toggleRecordItem(entry.uniqueKey)}
                              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-2xs ${
                                entry.isRecorded
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 hover:bg-emerald-200'
                                  : 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                              }`}
                            >
                              {entry.isRecorded ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-700 stroke-[3]" />
                                  <span>مثبت بالسجل ✓</span>
                                </>
                              ) : (
                                <span>تثبيت بالسجل</span>
                              )}
                            </button>
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-blue-700">
                            {entry.item.receiptNumber || '—'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-black text-slate-900">
                            {entry.item.subscriberId}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-900">
                            {entry.item.subscriberName}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                            {entry.item.areaName || '—'}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono font-black text-emerald-700">
                            {formatNumber(entry.item.amount)} د.ع
                            {(entry.item.waterAmount || entry.item.municipalityAmount) ? (
                              <div className="text-[10px] text-slate-600 font-normal">
                                {entry.item.waterAmount ? `ماء: ${formatNumber(entry.item.waterAmount)} ` : ''}
                                {entry.item.municipalityAmount ? `بلدية: ${formatNumber(entry.item.municipalityAmount)}` : ''}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-slate-700">
                            {entry.serialNumber}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                            {entry.collectorName}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px] text-slate-600">
                            {entry.consignmentDate || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ذيل النافذة */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <div>
                إجمالي الإرساليات المعروضة: <strong className="text-slate-800">{displayedWriterItems.length}</strong> حركة
              </div>
              <button
                type="button"
                onClick={() => setShowWriterConsignmentsModal(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl transition shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
