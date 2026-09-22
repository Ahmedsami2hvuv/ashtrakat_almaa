'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Area, Subscriber, PaymentRow } from '@/lib/types'

// ثوابت الفترات
const PERIODS_PER_YEAR = 6
const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1
const CURRENT_PERIOD = Math.ceil(CURRENT_MONTH / 2)

function getPeriodLabel(period: number, year: number): string {
  return `${period}/${year}`
}

function getCurrentPeriodIndex(rows: PaymentRow[]): number {
  return rows.findIndex(
    (r) => r.period === CURRENT_PERIOD && r.year === CURRENT_YEAR
  )
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

// حالات المشترك
const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  'مسدد': { dot: 'bg-emerald-400', label: 'مسدد' },
  'متبقي': { dot: 'bg-slate-900', label: 'متبقي' },
  'عليه دين': { dot: 'bg-red-500', label: 'عليه دين' },
  'فائض': { dot: 'bg-sky-500', label: 'فائض' },
  'جديد': { dot: 'bg-amber-500', label: 'جديد' },
}

// أنواع المتر
const METER_TYPES = ['3 متر', '4 متر', '5 متر', '6 متر']

function generatePaymentRows(
  remainingPrev: number,
  fee: number,
  pricing: Record<string, Record<string, number>>,
  propertyType: string,
  meterType: string,
  existingPayments: PaymentRow[]
): PaymentRow[] {
  const rows: PaymentRow[] = []
  const price = pricing[propertyType]?.[meterType] || 0
  let totalCarried = remainingPrev + fee

  for (let y = CURRENT_YEAR - 1; y <= CURRENT_YEAR + 1; y++) {
    for (let p = 1; p <= PERIODS_PER_YEAR; p++) {
      if (y > CURRENT_YEAR || (y === CURRENT_YEAR && p > CURRENT_PERIOD)) break

      const existing = existingPayments.find((ep) => ep.period === p && ep.year === y)
      const old = existing ? existing.old : totalCarried
      const paid = existing ? existing.paid : 0
      const remaining = old + price - paid

      rows.push({
        period: p,
        year: y,
        periodLabel: getPeriodLabel(p, y),
        old,
        paid,
        remaining,
        isManual: existing?.isManual,
      })

      totalCarried = remaining
    }
  }

  return rows
}

function getSubscriberStatus(subscriber: Subscriber): string {
  if (!subscriber.payments || subscriber.payments.length === 0) return 'جديد'
  const lastPayment = subscriber.payments[subscriber.payments.length - 1]
  if (lastPayment.remaining === 0) return 'مسدد'
  if (lastPayment.remaining < 0) return 'فائض'
  return 'عليه دين'
}

function getDue(subscriber: Subscriber): number {
  if (!subscriber.payments || subscriber.payments.length === 0) return 0
  const lastPayment = subscriber.payments[subscriber.payments.length - 1]
  return lastPayment.remaining
}

export default function MainApp() {
  // بيانات رئيسية
  const [areas, setAreas] = useState<Area[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [pricing, setPricing] = useState<Record<string, Record<string, number>>>({
    'سكني': { '3 متر': 15000, '4 متر': 20000, '5 متر': 25000, '6 متر': 30000 },
    'تجاري': { '3 متر': 20000, '4 متر': 25000, '5 متر': 30000, '6 متر': 35000 },
  })
  const [collectorName, setCollectorName] = useState('')
  const [collectorPhone, setCollectorPhone] = useState('')
  const [rangeFrom, setRangeFrom] = useState(1)
  const [rangeTo, setRangeTo] = useState(9999)
  const [loading, setLoading] = useState(true)

  // فلاتر
  const [selectedArea, setSelectedArea] = useState<string | null>(null)
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [filterTypes, setFilterTypes] = useState({ سكني: true, تجاري: true })
  const [filterAreas, setFilterAreas] = useState<string[]>([])
  const [filterBranches, setFilterBranches] = useState<string[]>([])
  const [filterStatuses, setFilterStatuses] = useState<string[]>([])
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  // المشترك المحدد
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('')
  const [showContactModal, setShowContactModal] = useState(false)

  // نموذج إضافة مشترك
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSub, setNewSub] = useState({ idStr: '', name: '', areaId: '', branchId: '', phone: '' })
  const [addError, setAddError] = useState('')

  // نموذج تعديل مشترك
  const [showEditModal, setShowEditModal] = useState(false)
  const [editSub, setEditSub] = useState<Partial<Subscriber>>({})
  const [showAddAreaInEdit, setShowAddAreaInEdit] = useState(false)
  const [showAddBranchInEdit, setShowAddBranchInEdit] = useState(false)

  // الإعدادات
  const [showSettings, setShowSettings] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'collector' | 'pricing' | 'areas' | 'import'>('collector')
  const [newAreaName, setNewAreaName] = useState('')
  const [newBranchName, setNewBranchName] = useState('')
  const [editingPricingKey, setEditingPricingKey] = useState<string | null>(null)
  const [editingPricingValue, setEditingPricingValue] = useState('')
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [editingAreaName, setEditingAreaName] = useState('')
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)
  const [editingBranchName, setEditingBranchName] = useState('')

  // تعديل الدفعات
  const [pendingEdits, setPendingEdits] = useState<Record<string, string>>({})

  // السحب والإفلات للتبويبات
  const [draggingAreaId, setDraggingAreaId] = useState<string | null>(null)
  const [longPressAreaId, setLongPressAreaId] = useState<string | null>(null)
  const longPressTimer = useRef<NodeJS.Timeout | null>(null)

  // جلب البيانات من سوبا بيس
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [areasRes, subsRes, pricingRes, collectorRes] = await Promise.all([
        fetch('/api/areas'),
        fetch(`/api/subscribers?from=${rangeFrom}&to=${rangeTo}`),
        fetch('/api/pricing'),
        fetch('/api/collector'),
      ])

      if (areasRes.ok) {
        const areasData = await areasRes.json()
        setAreas(areasData)
      }

      if (pricingRes.ok) {
        const pricingData = await pricingRes.json()
        if (Object.keys(pricingData).length > 0) setPricing(pricingData)
      }

      if (collectorRes.ok) {
        const collectorData = await collectorRes.json()
        if (collectorData.name) setCollectorName(collectorData.name)
        if (collectorData.phone) setCollectorPhone(collectorData.phone)
        if (collectorData.range_from) setRangeFrom(collectorData.range_from)
        if (collectorData.range_to) setRangeTo(collectorData.range_to)
      }

      if (subsRes.ok) {
        const subsData = await subsRes.json()
        // تحويل بيانات سوبا بيس للشكل المطلوب
        const subs: Subscriber[] = subsData.map((s: Record<string, unknown>) => ({
          id: s.id as number,
          name: s.name as string,
          areaId: s.area_id as string,
          branchId: s.branch_id as string,
          phone: (s.phone as string) || '',
          propertyType: (s.property_type as 'سكني' | 'تجاري') || 'سكني',
          meterType: (s.meter_type as string) || '4 متر',
          detailedAddress: (s.detailed_address as string) || '',
          location: s.location_lat ? {
            lat: s.location_lat as number,
            lng: s.location_lng as number,
            link: (s.location_link as string) || '',
          } : undefined,
          doorImage: (s.door_image as string) || undefined,
          remainingPrev: (s.remaining_prev as number) || 0,
          fee: (s.fee as number) || 0,
          payments: [],
        }))
        setSubscribers(subs)
      }
    } catch (err) {
      console.error('خطأ في جلب البيانات:', err)
    } finally {
      setLoading(false)
    }
  }, [rangeFrom, rangeTo])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // جلب دفعات مشترك عند تحديده
  useEffect(() => {
    if (selectedId === null) return

    const fetchPayments = async () => {
      const res = await fetch(`/api/payments?subscriber_id=${selectedId}`)
      if (!res.ok) return

      const paymentsData = await res.json()
      const sub = subscribers.find((s) => s.id === selectedId)
      if (!sub) return

      const existingPayments: PaymentRow[] = paymentsData.map((p: Record<string, unknown>) => ({
        period: p.period as number,
        year: p.year as number,
        periodLabel: p.period_label as string,
        old: p.old_debt as number,
        paid: p.paid as number,
        remaining: p.remaining as number,
        isManual: p.is_manual as boolean,
      }))

      const rows = generatePaymentRows(
        sub.remainingPrev || 0,
        sub.fee || 0,
        pricing,
        sub.propertyType,
        sub.meterType,
        existingPayments
      )

      setSubscribers((prev) =>
        prev.map((s) => s.id === selectedId ? { ...s, payments: rows } : s)
      )

      // تحديد الفترة الحالية تلقائياً
      const currentIdx = getCurrentPeriodIndex(rows)
      if (currentIdx >= 0 && !selectedPeriod) {
        setSelectedPeriod(rows[currentIdx].periodLabel)
      }
    }

    fetchPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // المشترك المحدد
  const selectedSubscriber = subscribers.find((s) => s.id === selectedId) || null

  // قائمة المشتركين بعد الفلاتر
  const filteredSubscribers = subscribers.filter((s) => {
    if (!filterTypes[s.propertyType as keyof typeof filterTypes]) return false
    if (filterAreas.length > 0 && !filterAreas.includes(s.areaId)) return false
    if (filterBranches.length > 0 && !filterBranches.includes(s.branchId)) return false
    if (selectedArea && s.areaId !== selectedArea) return false
    if (selectedBranch && s.branchId !== selectedBranch) return false
    if (filterStatuses.length > 0) {
      const status = getSubscriberStatus(s)
      if (!filterStatuses.includes(status)) return false
    }
    return true
  })

  // عدد الفلاتر النشطة
  const activeFiltersCount =
    (!filterTypes.سكني || !filterTypes.تجاري ? 1 : 0) +
    filterAreas.length +
    filterBranches.length +
    filterStatuses.length

  // حفظ دفعة
  const savePayment = async (
    subscriberId: number,
    periodIdx: number,
    field: 'old' | 'paid' | 'rem',
    value: string
  ) => {
    const sub = subscribers.find((s) => s.id === subscriberId)
    if (!sub || !sub.payments[periodIdx]) return

    const row = sub.payments[periodIdx]
    const numVal = parseInt(value) || 0

    let newOld = row.old
    let newPaid = row.paid
    let newRemaining = row.remaining

    if (field === 'old') {
      newOld = numVal
      newRemaining = newOld + (pricing[sub.propertyType]?.[sub.meterType] || 0) - newPaid
    } else if (field === 'paid') {
      newPaid = numVal
      newRemaining = newOld + (pricing[sub.propertyType]?.[sub.meterType] || 0) - newPaid
    } else {
      newRemaining = numVal
    }

    // تحديث محلياً
    const newPayments = sub.payments.map((p, i) =>
      i === periodIdx
        ? { ...p, old: newOld, paid: newPaid, remaining: newRemaining, isManual: field === 'rem' }
        : p
    )

    setSubscribers((prev) =>
      prev.map((s) => s.id === subscriberId ? { ...s, payments: newPayments } : s)
    )

    // حفظ في سوبا بيس
    await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriberId,
        period: row.period,
        year: row.year,
        periodLabel: row.periodLabel,
        oldDebt: newOld,
        paid: newPaid,
        remaining: newRemaining,
        isManual: field === 'rem',
      }),
    })

    setPendingEdits({})
  }

  // إضافة مشترك
  const handleAddSubscriber = async () => {
    setAddError('')
    const id = parseInt(newSub.idStr)
    if (!id || !newSub.name.trim() || !newSub.areaId) {
      setAddError('يرجى تعبئة الحقول الإلزامية')
      return
    }
    if (subscribers.find((s) => s.id === id)) {
      setAddError('رقم المشترك موجود مسبقاً')
      return
    }

    const area = areas.find((a) => a.id === newSub.areaId)
    const branchId = newSub.branchId || area?.branches[0]?.id || ''

    const res = await fetch('/api/subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        name: newSub.name.trim(),
        areaId: newSub.areaId,
        branchId,
        phone: newSub.phone || '',
        propertyType: 'سكني',
        meterType: '4 متر',
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      setAddError(err.error || 'خطأ في الحفظ')
      return
    }

    setSubscribers((prev) => [
      ...prev,
      {
        id,
        name: newSub.name.trim(),
        areaId: newSub.areaId,
        branchId,
        phone: newSub.phone || '',
        propertyType: 'سكني',
        meterType: '4 متر',
        detailedAddress: '',
        remainingPrev: 0,
        fee: 0,
        payments: [],
      },
    ])

    setShowAddModal(false)
    setNewSub({ idStr: '', name: '', areaId: '', branchId: '', phone: '' })
  }

  // حفظ تعديل المشترك
  const handleSaveEdit = async () => {
    if (!selectedSubscriber) return

    const res = await fetch(`/api/subscribers/${selectedSubscriber.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editSub.name,
        areaId: editSub.areaId,
        branchId: editSub.branchId,
        phone: editSub.phone,
        propertyType: editSub.propertyType,
        meterType: editSub.meterType,
      }),
    })

    if (res.ok) {
      setSubscribers((prev) =>
        prev.map((s) =>
          s.id === selectedSubscriber.id ? { ...s, ...editSub } : s
        )
      )
      setShowEditModal(false)
    }
  }

  // إضافة منطقة
  const handleAddArea = async (fromEdit = false) => {
    if (!newAreaName.trim()) return
    const id = `area_${Date.now()}`

    const res = await fetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'area', id, name: newAreaName.trim() }),
    })

    if (res.ok) {
      setAreas((prev) => [...prev, { id, name: newAreaName.trim(), branches: [] }])
      setNewAreaName('')
      if (fromEdit) {
        setShowAddAreaInEdit(false)
        setEditSub((prev) => ({ ...prev, areaId: id, branchId: '' }))
      }
    }
  }

  // إضافة فرع
  const handleAddBranch = async (areaId: string, name: string) => {
    if (!name.trim()) return
    const id = `branch_${Date.now()}`

    const res = await fetch('/api/areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'branch', id, areaId, name: name.trim() }),
    })

    if (res.ok) {
      setAreas((prev) =>
        prev.map((a) =>
          a.id === areaId
            ? { ...a, branches: [...a.branches, { id, name: name.trim() }] }
            : a
        )
      )
    }
  }

  // تعديل أسماء المناطق
  const handleRenameArea = async (areaId: string, name: string) => {
    if (!name.trim()) return
    const res = await fetch('/api/areas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'area', id: areaId, name: name.trim() }),
    })
    if (res.ok) {
      setAreas((prev) => prev.map((a) => a.id === areaId ? { ...a, name: name.trim() } : a))
      setEditingAreaId(null)
    }
  }

  const handleRenameBranch = async (branchId: string, name: string) => {
    if (!name.trim()) return
    const res = await fetch('/api/areas', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'branch', id: branchId, name: name.trim() }),
    })
    if (res.ok) {
      setAreas((prev) =>
        prev.map((a) => ({
          ...a,
          branches: a.branches.map((b) => b.id === branchId ? { ...b, name: name.trim() } : b)
        }))
      )
      setEditingBranchId(null)
    }
  }

  // حفظ التسعير
  const handleSavePricing = async (propertyType: string, meterType: string) => {
    const amount = parseInt(editingPricingValue) || 0
    await fetch('/api/pricing', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ propertyType, meterType, amount }),
    })
    setPricing((prev) => ({
      ...prev,
      [propertyType]: { ...prev[propertyType], [meterType]: amount }
    }))
    setEditingPricingKey(null)
  }

  // حفظ بيانات المحصل
  const handleSaveCollector = async () => {
    await fetch('/api/collector', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: collectorName,
        phone: collectorPhone,
        rangeFrom,
        rangeTo,
      }),
    })
  }

  // مسح كل الفلاتر
  const clearFilters = () => {
    setFilterTypes({ سكني: true, تجاري: true })
    setFilterAreas([])
    setFilterBranches([])
    setFilterStatuses([])
  }

  // اسم المنطقة
  const getAreaName = (id: string) => areas.find((a) => a.id === id)?.name || id
  const getBranchName = (areaId: string, branchId: string) =>
    areas.find((a) => a.id === areaId)?.branches.find((b) => b.id === branchId)?.name || branchId

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f0f9ff]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-sky-200 border-t-slate-900 rounded-full animate-spin mx-auto mb-3"></div>
          <div className="text-[13px] text-slate-500">جاري التحميل...</div>
        </div>
      </div>
    )
  }

  // ===== الواجهة الرئيسية =====
  return (
    <div className="min-h-screen bg-[#f0f9ff]" dir="rtl">
      {/* الهيدر */}
      <header className="sticky top-0 z-20 bg-slate-900 text-white px-4 py-3 flex items-center justify-between shadow-[0_12px_24px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-[18px]">💧</div>
          <div>
            <div className="text-[13px] font-bold">اشتراكات الماء</div>
            <div className="text-[10px] text-white/60 font-mono">{formatNumber(filteredSubscribers.length)} مشترك</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* زر الفلتر */}
          <button
            onClick={() => setShowFilterPanel(true)}
            className={`h-8 px-3 rounded-full border text-[11px] font-bold transition-all ${
              activeFiltersCount > 0
                ? 'bg-white text-slate-900 border-white'
                : 'bg-white/10 border-white/20 text-white'
            }`}
          >
            فلتر {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}
          </button>

          {/* زر إضافة مشترك */}
          <button
            onClick={() => setShowAddModal(true)}
            className="h-8 px-3 rounded-full bg-white/10 border border-white/20 text-[11px] font-bold text-white"
          >
            + إضافة
          </button>

          {/* زر الإعدادات */}
          <button
            onClick={() => setShowSettings(true)}
            className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[14px]"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* تبويبات المناطق */}
      <div className="bg-white border-b border-[#e0f2fe] shadow-sm">
        <div className="px-3 py-3 flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none items-center">
          {/* زر الكل */}
          <button
            onClick={() => { setSelectedArea(null); setSelectedBranch(null) }}
            className={`h-8 px-4 rounded-full border text-[12px] shrink-0 font-medium transition-all ${
              !selectedArea
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-sky-50 border-sky-100 text-slate-600 hover:bg-white'
            }`}
          >
            الكل • {formatNumber(subscribers.length)}
          </button>

          {areas.map((area) => {
            const count = subscribers.filter((s) => s.areaId === area.id).length
            const isSelected = selectedArea === area.id
            const isLongPress = longPressAreaId === area.id

            return (
              <div
                key={area.id}
                draggable={isLongPress}
                onDragStart={() => setDraggingAreaId(area.id)}
                onDragOver={(e) => { e.preventDefault() }}
                onDragEnd={() => { setDraggingAreaId(null); setLongPressAreaId(null) }}
                onMouseDown={() => {
                  longPressTimer.current = setTimeout(() => setLongPressAreaId(area.id), 600)
                }}
                onMouseUp={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current)
                }}
                onMouseLeave={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current)
                }}
                onTouchStart={() => {
                  longPressTimer.current = setTimeout(() => setLongPressAreaId(area.id), 600)
                }}
                onTouchEnd={() => {
                  if (longPressTimer.current) clearTimeout(longPressTimer.current)
                }}
                className={`h-8 px-3 rounded-full border text-[12px] shrink-0 flex items-center gap-2 select-none transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900'
                    : draggingAreaId === area.id
                    ? 'opacity-40 scale-95'
                    : 'bg-sky-50 border-sky-100 hover:bg-white text-slate-600'
                } ${isLongPress ? 'cursor-grab' : 'cursor-pointer'}`}
              >
                <button
                  onClick={() => {
                    if (!isLongPress) {
                      setSelectedArea(isSelected ? null : area.id)
                      setSelectedBranch(null)
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="font-medium">{area.name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-white border border-sky-100 text-slate-500'
                  }`}>
                    {formatNumber(count)}
                  </span>
                </button>

                {isLongPress && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLongPressAreaId(null) }}
                    className="w-5 h-5 rounded-full bg-white text-slate-900 text-[10px] flex items-center justify-center ml-1"
                  >
                    ✕
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* أفرع المنطقة المحددة */}
        {selectedArea && (
          <div className="px-3 pb-3 pt-0 border-t border-sky-50 bg-sky-50/30">
            <div className="pt-3 pb-2 flex items-center justify-between">
              <div className="text-[11px] font-bold text-slate-700">
                افرع {getAreaName(selectedArea)}
              </div>
              <button
                onClick={() => { setSelectedArea(null); setSelectedBranch(null) }}
                className="text-[10px] border border-sky-100 bg-white rounded-full px-3 py-1 hover:bg-sky-50"
              >
                اغلاق
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto whitespace-nowrap scrollbar-none py-1">
              <button
                onClick={() => setSelectedBranch(null)}
                className={`h-7 px-3 rounded-full border text-[11px] shrink-0 ${
                  !selectedBranch
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white border-sky-100 text-slate-600'
                }`}
              >
                كل الافرع
              </button>
              {(areas.find((a) => a.id === selectedArea)?.branches || []).map((branch) => {
                const count = subscribers.filter(
                  (s) => s.areaId === selectedArea && s.branchId === branch.id
                ).length
                const isSelected = selectedBranch === branch.id

                return (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranch(isSelected ? null : branch.id)}
                    className={`h-7 px-3 rounded-full border text-[11px] shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-sky-100 text-slate-600 hover:bg-sky-50'
                    }`}
                  >
                    <span>{branch.name}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono ${
                      isSelected ? 'bg-white/20' : 'bg-sky-50'
                    }`}>
                      {formatNumber(count)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* الفلاتر النشطة */}
      {activeFiltersCount > 0 && (
        <div className="mx-3 mt-3 flex flex-wrap gap-2 items-center bg-white border border-sky-100 rounded-2xl px-3 py-2.5 shadow-sm">
          <span className="text-[11px] font-bold text-slate-700">فلتر نشط:</span>
          {(!filterTypes.سكني || !filterTypes.تجاري) && (
            <span className="h-6 px-2.5 rounded-full bg-slate-900 text-white text-[10px] flex items-center gap-1">
              {filterTypes.سكني ? 'سكني' : 'تجاري'}
              <button onClick={() => setFilterTypes({ سكني: true, تجاري: true })} className="ml-1">✕</button>
            </span>
          )}
          {filterAreas.map((id) => (
            <span key={id} className="h-6 px-2.5 rounded-full bg-sky-50 border border-sky-100 text-[10px] text-slate-700 flex items-center gap-1">
              {getAreaName(id)}
              <button onClick={() => setFilterAreas((p) => p.filter((x) => x !== id))} className="text-slate-400">✕</button>
            </span>
          ))}
          {filterBranches.map((id) => {
            const area = areas.find((a) => a.branches.some((b) => b.id === id))
            const branch = area?.branches.find((b) => b.id === id)
            return (
              <span key={id} className="h-6 px-2.5 rounded-full bg-amber-50 border border-amber-100 text-[10px] text-slate-700 flex items-center gap-1">
                {branch?.name || id}
                <button onClick={() => setFilterBranches((p) => p.filter((x) => x !== id))} className="text-slate-400">✕</button>
              </span>
            )
          })}
          {filterStatuses.map((s) => (
            <span key={s} className="h-6 px-2.5 rounded-full bg-violet-50 border border-violet-100 text-[10px] text-slate-700 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_CONFIG[s]?.dot}`}></span>
              {s}
              <button onClick={() => setFilterStatuses((p) => p.filter((x) => x !== s))} className="text-slate-400">✕</button>
            </span>
          ))}
          <button onClick={clearFilters} className="mr-auto h-6 px-3 rounded-full bg-white border border-sky-100 text-[10px] text-slate-600">
            مسح الكل
          </button>
        </div>
      )}

      {/* قائمة المشتركين */}
      <main className="max-w-[1100px] mx-auto px-3 sm:px-4 py-4">
        <div className="bg-white rounded-2xl border border-[#e0f2fe] shadow-sm overflow-hidden">
          {/* رأس الجدول */}
          <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center gap-2 bg-sky-50/40">
            <div className="text-[11px] text-slate-600">
              <span className="font-bold text-slate-900">{formatNumber(filteredSubscribers.length)}</span>
              {' '}من {formatNumber(subscribers.length)}
            </div>
          </div>

          {/* صفوف المشتركين */}
          <div className="divide-y divide-sky-50">
            {filteredSubscribers.length === 0 ? (
              <div className="py-16 text-center text-[13px] text-slate-400">
                <div className="text-4xl mb-3">💧</div>
                <div>لا يوجد مشتركون</div>
                <div className="text-[11px] mt-1">أضف مشتركين أو عدّل الفلاتر</div>
              </div>
            ) : (
              filteredSubscribers.map((sub) => {
                const due = getDue(sub)
                return (
                  <div
                    key={sub.id}
                    onClick={() => {
                      setSelectedId(sub.id)
                      const periods = sub.payments.map((p) => p.periodLabel)
                      const currentPeriod = getPeriodLabel(CURRENT_PERIOD, CURRENT_YEAR)
                      setSelectedPeriod(periods.includes(currentPeriod) ? currentPeriod : periods[periods.length - 1] || currentPeriod)
                    }}
                    className="w-full text-right px-4 py-3.5 hover:bg-sky-50/40 flex justify-between items-center gap-3 cursor-pointer transition-colors select-none group bg-white"
                  >
                    <div className="min-w-0 flex-1 text-right">
                      <div className="text-[13px] font-bold truncate text-slate-900 leading-tight">
                        {formatNumber(sub.id)} - {sub.name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {getAreaName(sub.areaId)}
                        {sub.branchId && ` - ${getBranchName(sub.areaId, sub.branchId)}`}
                        {' • '}{sub.propertyType}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className={`text-[15px] font-bold font-mono tracking-tight min-w-[70px] text-left ${
                        due === 0 ? 'text-emerald-700' : due < 0 ? 'text-sky-700' : 'text-[#111827]'
                      }`}>
                        {formatNumber(due)}
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

      {/* ===== نافذة تفاصيل المشترك ===== */}
      {selectedSubscriber && (
        <div className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[1px] flex flex-col">
          <div className="bg-[#f0f9ff] w-full h-full sm:max-w-[740px] sm:mx-auto sm:my-4 sm:rounded-2xl sm:border sm:border-sky-100 sm:h-[calc(100%-32px)] flex flex-col overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.12)]">
            {/* رأس النافذة */}
            <div className="border-b border-sky-100 px-4 py-4 flex justify-between items-start gap-3 bg-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-[15px] font-bold text-slate-900">
                    {formatNumber(selectedSubscriber.id)} - {selectedSubscriber.name}
                  </h2>
                  <button
                    onClick={() => {
                      setEditSub({ ...selectedSubscriber })
                      setShowEditModal(true)
                    }}
                    className="w-7 h-7 border border-sky-100 rounded-xl flex items-center justify-center hover:bg-sky-50 bg-white text-slate-500"
                  >
                    ✎
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 mt-1.5">
                  {getAreaName(selectedSubscriber.areaId)}
                  {selectedSubscriber.branchId && ` - ${getBranchName(selectedSubscriber.areaId, selectedSubscriber.branchId)}`}
                </div>
                <div className="mt-3 flex gap-2 items-center">
                  <div className="inline-flex border border-sky-100 rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-slate-700">
                    {selectedSubscriber.propertyType} - {selectedSubscriber.meterType}
                  </div>
                  <div className={`text-[13px] font-bold font-mono ${
                    getDue(selectedSubscriber) === 0 ? 'text-emerald-700' :
                    getDue(selectedSubscriber) < 0 ? 'text-sky-700' : 'text-[#ef4444]'
                  }`}>
                    {formatNumber(getDue(selectedSubscriber))}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="w-9 h-9 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500 hover:bg-sky-50"
              >
                ✕
              </button>
            </div>

            {/* محتوى النافذة */}
            <div className="flex-1 overflow-y-auto">
              {/* زر التواصل */}
              <div className="px-4 py-3">
                <button
                  onClick={() => setShowContactModal(true)}
                  className="w-full h-10 border border-sky-100 rounded-2xl bg-white text-[12px] font-medium hover:bg-sky-50 text-slate-700"
                >
                  التواصل والموقع والصور
                </button>
              </div>

              {/* تبويبات الفترات */}
              <div className="px-4 py-2 border-y border-sky-50 bg-white overflow-x-auto whitespace-nowrap flex gap-2 scrollbar-none items-center">
                {selectedSubscriber.payments.map((row) => {
                  const isCurrentPeriod = row.period === CURRENT_PERIOD && row.year === CURRENT_YEAR
                  const isSelected = selectedPeriod === row.periodLabel
                  return (
                    <button
                      key={row.periodLabel}
                      onClick={() => setSelectedPeriod(row.periodLabel)}
                      className={`h-8 px-4 rounded-full border text-[12px] shrink-0 font-medium transition-all ${
                        isCurrentPeriod
                          ? isSelected
                            ? 'bg-[#ef4444] text-white border-[#ef4444]'
                            : 'bg-red-50 border-red-200 text-red-600'
                          : isSelected
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white border-sky-100 text-slate-600 hover:bg-sky-50'
                      }`}
                    >
                      {row.periodLabel}
                    </button>
                  )
                })}
              </div>

              {/* معلومات بداية السنة */}
              <div className="w-full mt-3 px-2" style={{ boxSizing: 'border-box' }}>
                <div className="rounded-2xl border border-sky-100 bg-white px-4 py-3 text-[12px] flex items-center gap-2 font-mono shadow-sm w-full">
                  <span className="font-bold text-slate-800 font-sans shrink-0">بداية السنة:</span>
                  <span className="text-slate-600">
                    القديم {formatNumber(selectedSubscriber.remainingPrev || 0)} + الفائدة {formatNumber(selectedSubscriber.fee || 0)} = {formatNumber((selectedSubscriber.remainingPrev || 0) + (selectedSubscriber.fee || 0))}
                  </span>
                </div>
              </div>

              {/* جدول الدفعات */}
              <div className="w-full" style={{ width: '100%', margin: 0, padding: '8px', boxSizing: 'border-box' }}>
                <div className="bg-white rounded-2xl border border-sky-100 overflow-hidden shadow-sm w-full">
                  <div className="w-full">
                    {/* رأس الجدول */}
                    <div
                      className="bg-slate-900 text-white text-[11px] font-bold grid w-full"
                      style={{ gridTemplateColumns: '20% 27% 26% 27%' }}
                    >
                      <div className="px-1 py-3 text-center">الفترة</div>
                      <div className="px-1 py-3 border-r border-white/10 text-center">الدين القديم</div>
                      <div className="px-1 py-3 border-r border-white/10 text-center">المدفوع</div>
                      <div className="px-1 py-3 border-r border-white/10 text-center">المتبقي</div>
                    </div>

                    {/* صفوف الدفعات */}
                    {selectedSubscriber.payments.map((row, idx) => {
                      const isCurrentPeriod = row.period === CURRENT_PERIOD && row.year === CURRENT_YEAR
                      const isSelectedPeriod = selectedPeriod === row.periodLabel
                      const editKey = (field: string) => `${idx}_${field}`

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
                          style={{ gridTemplateColumns: '20% 27% 26% 27%', minHeight: '44px' }}
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
                                if (v === '' || /^[0-9]*$/.test(v))
                                  setPendingEdits((p) => ({ ...p, [editKey('old')]: v }))
                              }}
                              onBlur={(e) => savePayment(selectedSubscriber.id, idx, 'old', e.target.value)}
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
                              value={pendingEdits[editKey('paid')] !== undefined ? pendingEdits[editKey('paid')] : (row.paid === 0 ? '' : String(row.paid))}
                              onChange={(e) => {
                                const v = e.target.value
                                if (v === '' || /^[0-9]*$/.test(v))
                                  setPendingEdits((p) => ({ ...p, [editKey('paid')]: v }))
                              }}
                              onBlur={(e) => savePayment(selectedSubscriber.id, idx, 'paid', e.target.value)}
                              onFocus={(e) => {
                                setPendingEdits((p) => ({ ...p, [editKey('paid')]: row.paid === 0 ? '' : String(row.paid) }))
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
                                if (v === '' || /^-?[0-9]*$/.test(v))
                                  setPendingEdits((p) => ({ ...p, [editKey('rem')]: v }))
                              }}
                              onBlur={(e) => savePayment(selectedSubscriber.id, idx, 'rem', e.target.value)}
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
                    {getPeriodLabel(CURRENT_PERIOD, CURRENT_YEAR)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== نافذة التواصل والموقع ===== */}
      {showContactModal && selectedSubscriber && (
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
              {/* الهاتف */}
              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/40">
                <div className="text-[11px] text-slate-500">رقم الهاتف</div>
                <div className="font-mono text-[13px] mt-1.5 font-bold" dir="ltr">
                  {selectedSubscriber.phone || 'غير محدد'}
                </div>
                {selectedSubscriber.phone && (
                  <div className="flex gap-2 mt-3">
                    <a
                      href={`tel:${selectedSubscriber.phone}`}
                      className="h-9 px-4 border border-sky-100 rounded-full text-[12px] flex items-center bg-white text-slate-700 hover:bg-sky-50"
                    >
                      اتصال
                    </a>
                    <a
                      href={`https://wa.me/${selectedSubscriber.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noopener"
                      className="h-9 px-4 border border-sky-100 rounded-full text-[12px] flex items-center bg-white text-slate-700 hover:bg-sky-50"
                    >
                      واتساب
                    </a>
                  </div>
                )}
              </div>

              {/* الموقع */}
              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/40">
                <div className="text-[11px] text-slate-500">العنوان التفصيلي</div>
                <div className="text-[12px] mt-1.5 font-medium">
                  {selectedSubscriber.detailedAddress || 'غير محدد'}
                </div>
                {selectedSubscriber.location?.link && (
                  <a
                    href={selectedSubscriber.location.link}
                    target="_blank"
                    rel="noopener"
                    className="mt-3 inline-flex h-9 px-4 border border-sky-100 rounded-full text-[12px] items-center bg-white text-slate-700"
                  >
                    فتح الخريطة
                  </a>
                )}
              </div>

              {/* صورة الباب */}
              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/40">
                <div className="text-[11px] text-slate-500">صورة الباب</div>
                {selectedSubscriber.doorImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedSubscriber.doorImage}
                    className="mt-3 w-full h-48 object-cover rounded-2xl border border-sky-100"
                    alt="صورة الباب"
                  />
                ) : (
                  <div className="mt-3 h-32 bg-white border border-dashed border-sky-100 rounded-2xl flex items-center justify-center text-[11px] text-slate-400">
                    لا توجد صورة
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== نافذة إضافة مشترك ===== */}
      {showAddModal && (
        <div className="fixed inset-0 z-[60] bg-slate-900/20 backdrop-blur-[2px] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-[420px] sm:rounded-2xl border-0 sm:border border-sky-100 flex flex-col max-h-[100vh] shadow-2xl">
            <div className="px-5 py-4 border-b border-sky-50 flex justify-between items-center bg-white">
              <h3 className="font-bold text-[14px] text-slate-900">اضافة مشترك جديد</h3>
              <button
                onClick={() => { setShowAddModal(false); setAddError('') }}
                className="w-8 h-8 border rounded-lg flex items-center justify-center bg-white border-slate-200 text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* رقم المشترك */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">
                  رقم المشترك <span className="text-red-500">*</span>
                </label>
                <input
                  value={newSub.idStr}
                  onChange={(e) => setNewSub((p) => ({ ...p, idStr: e.target.value.replace(/[^0-9]/g, '') }))}
                  placeholder="مثال 7000"
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[13px] font-mono focus:outline-none focus:border-slate-900 bg-white"
                  inputMode="numeric"
                />
              </div>

              {/* الاسم */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">
                  اسم المشترك <span className="text-red-500">*</span>
                </label>
                <input
                  value={newSub.name}
                  onChange={(e) => setNewSub((p) => ({ ...p, name: e.target.value }))}
                  placeholder="الاسم الثلاثي"
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[13px] focus:outline-none focus:border-slate-900 bg-white"
                />
              </div>

              {/* المنطقة */}
              <div>
                <label className="text-[11px] font-bold text-slate-700">
                  المنطقة <span className="text-red-500">*</span>
                </label>
                <select
                  value={newSub.areaId}
                  onChange={(e) => {
                    const areaId = e.target.value
                    const area = areas.find((a) => a.id === areaId)
                    setNewSub((p) => ({ ...p, areaId, branchId: area?.branches[0]?.id || '' }))
                  }}
                  className="mt-1.5 w-full h-11 px-4 border border-slate-200 rounded-xl text-[12px] bg-white focus:outline-none focus:border-slate-900"
                >
                  <option value="">اختر المنطقة</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
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

              {addError && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-100 rounded-xl p-3">
                  {addError}
                </div>
              )}

              <button
                onClick={handleAddSubscriber}
                className="w-full h-11 bg-slate-900 text-white rounded-xl text-[13px] font-bold hover:bg-black transition-colors mt-1"
              >
                حفظ المشترك
              </button>
              <div className="text-[10px] text-slate-400 text-center">
                الحقول المشار اليها بـ * اجبارية
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== نافذة تعديل المشترك ===== */}
      {showEditModal && selectedSubscriber && (
        <div className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-[1px] flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-[520px] sm:rounded-2xl border-0 sm:border border-sky-100 flex flex-col max-h-[100vh] shadow-xl">
            <div className="px-4 py-3 border-b border-sky-50 flex justify-between items-center bg-sky-50/50">
              <h3 className="font-bold text-[13px] text-slate-800">تعديل معلومات المشترك</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-slate-500"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* الاسم */}
              <div>
                <label className="text-[11px] text-slate-600 font-medium">الاسم</label>
                <input
                  value={editSub.name || ''}
                  onChange={(e) => setEditSub((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] focus:outline-none focus:border-slate-900 bg-sky-50/30 focus:bg-white"
                />
              </div>

              {/* الهاتف */}
              <div>
                <label className="text-[11px] text-slate-600 font-medium">الهاتف</label>
                <input
                  value={editSub.phone || ''}
                  onChange={(e) => setEditSub((p) => ({ ...p, phone: e.target.value }))}
                  className="mt-1.5 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] font-mono focus:outline-none focus:border-slate-900 bg-sky-50/30 focus:bg-white"
                  dir="ltr"
                />
              </div>

              {/* المنطقة */}
              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/30">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-700">المنطقة</label>
                  <button
                    onClick={() => setShowAddAreaInEdit((p) => !p)}
                    className="text-[11px] h-7 px-3 border border-sky-100 bg-white rounded-full text-slate-600"
                  >
                    اضافة منطقة
                  </button>
                </div>
                {showAddAreaInEdit && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="اسم المنطقة الجديدة"
                      className="flex-1 h-9 px-3 border border-sky-100 rounded-xl text-[12px] bg-white"
                    />
                    <button
                      onClick={() => handleAddArea(true)}
                      className="h-9 px-4 bg-slate-900 text-white rounded-xl text-[11px]"
                    >
                      حفظ
                    </button>
                  </div>
                )}
                <select
                  value={editSub.areaId || ''}
                  onChange={(e) => {
                    const areaId = e.target.value
                    const area = areas.find((a) => a.id === areaId)
                    setEditSub((p) => ({ ...p, areaId, branchId: area?.branches[0]?.id || '' }))
                  }}
                  className="mt-3 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] bg-white"
                >
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* الفرع */}
              <div className="border border-sky-100 rounded-2xl p-4 bg-sky-50/30">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-bold text-slate-700">الفرع</label>
                  <button
                    onClick={() => setShowAddBranchInEdit((p) => !p)}
                    className="text-[11px] h-7 px-3 border border-sky-100 bg-white rounded-full text-slate-600"
                  >
                    اضافة فرع
                  </button>
                </div>
                {showAddBranchInEdit && (
                  <div className="mt-3 flex gap-2">
                    <input
                      value={newBranchName}
                      onChange={(e) => setNewBranchName(e.target.value)}
                      placeholder="اسم الفرع الجديد"
                      className="flex-1 h-9 px-3 border border-sky-100 rounded-xl text-[12px] bg-white"
                    />
                    <button
                      onClick={() => {
                        if (editSub.areaId) {
                          handleAddBranch(editSub.areaId, newBranchName)
                          setNewBranchName('')
                          setShowAddBranchInEdit(false)
                        }
                      }}
                      className="h-9 px-4 bg-slate-900 text-white rounded-xl text-[11px]"
                    >
                      حفظ
                    </button>
                  </div>
                )}
                <select
                  value={editSub.branchId || ''}
                  onChange={(e) => setEditSub((p) => ({ ...p, branchId: e.target.value }))}
                  className="mt-3 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] bg-white"
                >
                  {(areas.find((a) => a.id === editSub.areaId)?.branches || []).map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                <div className="text-[10px] text-slate-500 mt-2.5">
                  الفروع المعروضة تابعة فقط لمنطقة {getAreaName(editSub.areaId || '')}
                </div>
              </div>

              {/* نوع العقار ونوع المتر */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-600 font-medium">نوع العقار</label>
                  <select
                    value={editSub.propertyType || 'سكني'}
                    onChange={(e) => setEditSub((p) => ({ ...p, propertyType: e.target.value as 'سكني' | 'تجاري' }))}
                    className="mt-1.5 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] bg-white"
                  >
                    <option value="سكني">سكني</option>
                    <option value="تجاري">تجاري</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-600 font-medium">نوع المتر</label>
                  <select
                    value={editSub.meterType || '4 متر'}
                    onChange={(e) => setEditSub((p) => ({ ...p, meterType: e.target.value }))}
                    className="mt-1.5 w-full h-10 px-4 border border-sky-100 rounded-2xl text-[13px] bg-white"
                  >
                    {METER_TYPES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSaveEdit}
                className="w-full h-11 bg-slate-900 text-white rounded-2xl text-[13px] font-bold"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== لوحة الفلتر ===== */}
      {showFilterPanel && (
        <div className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px] flex">
          <div className="bg-white w-full sm:w-[520px] h-full border-l border-sky-100 flex flex-col mr-auto sm:mr-0 ml-auto shadow-[-8px_0_30px_rgba(0,0,0,0.1)]">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="font-bold text-[13px]">الفلتر المتقدم</h3>
              <button
                onClick={() => setShowFilterPanel(false)}
                className="w-7 h-7 border border-white/20 rounded-lg flex items-center justify-center bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* نوع العقار */}
              <div className="border border-sky-100 rounded-2xl p-3 bg-white">
                <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <span className="w-1 h-4 rounded-full bg-sky-500"></span>
                  نوع العقار
                </div>
                <div className="flex gap-2">
                  {(['سكني', 'تجاري'] as const).map((type) => (
                    <label
                      key={type}
                      className={`flex-1 h-9 px-3 rounded-xl border cursor-pointer flex items-center gap-2 ${
                        filterTypes[type]
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-sky-50/60 border-sky-100 text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={filterTypes[type]}
                        onChange={(e) => setFilterTypes((p) => ({ ...p, [type]: e.target.checked }))}
                        className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                      />
                      <span className="text-[11px] font-medium">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* المناطق */}
              <div className="border border-sky-100 rounded-2xl p-3 bg-white">
                <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <span className="w-1 h-4 rounded-full bg-sky-500"></span>
                  المناطق
                </div>
                <div className="space-y-1.5">
                  {areas.map((area) => {
                    const count = subscribers.filter((s) => s.areaId === area.id).length
                    const isChecked = filterAreas.includes(area.id)
                    return (
                      <label
                        key={area.id}
                        className={`flex items-center gap-2.5 h-9 px-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-sky-50/60 border-sky-100 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) setFilterAreas((p) => [...p, area.id])
                            else setFilterAreas((p) => p.filter((x) => x !== area.id))
                          }}
                          className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                        />
                        <span className="text-[11px] font-medium flex-1 truncate">{area.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                          isChecked ? 'bg-white/20' : 'bg-white border border-sky-100'
                        }`}>
                          {formatNumber(count)}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* الحالات */}
              <div className="border border-sky-100 rounded-2xl p-3 bg-white">
                <div className="text-[11px] font-bold text-slate-800 mb-2.5 flex items-center gap-1.5">
                  <span className="w-1 h-4 rounded-full bg-violet-500"></span>
                  حالة المشترك
                </div>
                <div className="space-y-1.5">
                  {Object.entries(STATUS_CONFIG).map(([status, config]) => {
                    const isChecked = filterStatuses.includes(status)
                    return (
                      <label
                        key={status}
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
                            if (e.target.checked) setFilterStatuses((p) => [...p, status])
                            else setFilterStatuses((p) => p.filter((x) => x !== status))
                          }}
                          className="w-4 h-4 rounded border-slate-300 accent-slate-900"
                        />
                        <span className={`w-2 h-2 rounded-full ${config.dot}`}></span>
                        <span className="text-[11px] font-medium flex-1">{status}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* أزرار أسفل لوحة الفلتر */}
            <div className="mt-auto pt-2 border-t border-sky-50 p-4 flex items-center justify-between gap-3 bg-white">
              <button
                onClick={clearFilters}
                className="h-9 px-4 rounded-xl bg-white border border-sky-100 text-[12px] font-bold text-slate-700"
              >
                مسح
              </button>
              <button
                onClick={() => setShowFilterPanel(false)}
                className="flex-1 h-9 px-6 rounded-xl bg-white text-slate-900 text-[12px] font-bold hover:bg-sky-50 border border-sky-100"
              >
                تطبيق ({formatNumber(filteredSubscribers.length)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== لوحة الإعدادات ===== */}
      {showSettings && (
        <div className="fixed inset-0 z-40 bg-slate-900/10 backdrop-blur-[1px] flex">
          <div className="bg-white w-full sm:w-[520px] h-full border-l border-sky-100 flex flex-col mr-auto sm:mr-0 ml-auto shadow-[-8px_0_30px_rgba(0,0,0,0.1)]">
            <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-900 text-white">
              <h3 className="font-bold text-[13px]">الاعدادات</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="w-7 h-7 border border-white/20 rounded-lg flex items-center justify-center bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* تبويبات الإعدادات */}
            <div className="px-3 py-3 border-b border-sky-50 flex gap-2 overflow-x-auto scrollbar-none bg-sky-50/30">
              {(['collector', 'pricing', 'areas'] as const).map((tab) => {
                const labels = { collector: 'المحصل', pricing: 'التسعير', areas: 'المناطق والافرع' }
                return (
                  <button
                    key={tab}
                    onClick={() => setSettingsTab(tab)}
                    className={`h-8 px-4 rounded-full border text-[11px] whitespace-nowrap font-bold ${
                      settingsTab === tab
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white border-sky-100 text-slate-600'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                )
              })}
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-[#f0f9ff]/50">
              {/* إعدادات المحصل */}
              {settingsTab === 'collector' && (
                <div className="space-y-4">
                  <div className="border border-sky-100 rounded-2xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center">
                      <div className="text-[12px] font-bold">تفاصيل المحصل</div>
                      <div className="text-[10px] bg-white/15 px-3 py-1 rounded-full font-mono">
                        {formatNumber(subscribers.length)} اشتراك
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] text-slate-600 font-bold">اسم المحصل</label>
                          <input
                            value={collectorName}
                            onChange={(e) => setCollectorName(e.target.value)}
                            onBlur={handleSaveCollector}
                            className="mt-1.5 w-full h-9 px-3 border border-sky-100 rounded-xl text-[12px] bg-sky-50/40 focus:bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-600 font-bold">رقم الهاتف</label>
                          <input
                            value={collectorPhone}
                            onChange={(e) => setCollectorPhone(e.target.value)}
                            onBlur={handleSaveCollector}
                            className="mt-1.5 w-full h-9 px-3 border border-sky-100 rounded-xl text-[12px] bg-sky-50/40 font-mono focus:bg-white focus:outline-none focus:border-slate-900"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="border border-sky-100 rounded-2xl p-3 bg-sky-50/30">
                          <div className="text-[10px] text-slate-500">من</div>
                          <input
                            type="number"
                            value={rangeFrom}
                            onChange={(e) => setRangeFrom(Number(e.target.value) || 1)}
                            onBlur={handleSaveCollector}
                            className="mt-1.5 w-full h-8 px-3 border border-sky-100 rounded-xl font-mono text-[13px] font-bold bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                        <div className="border border-sky-100 rounded-2xl p-3 bg-sky-50/30">
                          <div className="text-[10px] text-slate-500">الى</div>
                          <input
                            type="number"
                            value={rangeTo}
                            onChange={(e) => setRangeTo(Number(e.target.value) || 9999)}
                            onBlur={handleSaveCollector}
                            className="mt-1.5 w-full h-8 px-3 border border-sky-100 rounded-xl font-mono text-[13px] font-bold bg-white focus:outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* إعدادات التسعير */}
              {settingsTab === 'pricing' && (
                <div className="space-y-4">
                  {(['سكني', 'تجاري'] as const).map((propertyType) => (
                    <div key={propertyType} className="border border-sky-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-sky-50/40 border-b border-sky-50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <div className={`w-1 h-5 rounded-full ${propertyType === 'سكني' ? 'bg-slate-900' : 'bg-slate-400'}`}></div>
                          <div className="text-[13px] font-bold text-slate-800">{propertyType}</div>
                        </div>
                        <div className="text-[10px] font-bold bg-white border border-sky-100 rounded-full px-3 py-1 text-slate-600">
                          لكل شهرين
                        </div>
                      </div>
                      <div className="p-4 grid grid-cols-2 gap-3">
                        {METER_TYPES.map((meterType) => {
                          const key = `${propertyType}_${meterType}`
                          const amount = pricing[propertyType]?.[meterType] || 0
                          const isEditing = editingPricingKey === key

                          return (
                            <div key={meterType} className="border border-sky-100 rounded-2xl p-3 bg-sky-50/30">
                              <div className="flex justify-between items-center">
                                <div className="text-[12px] font-bold text-slate-800">{meterType}</div>
                                <div className="text-[9px] bg-white border border-sky-100 rounded-full px-2 py-0.5 text-slate-500">
                                  {propertyType}
                                </div>
                              </div>
                              {isEditing ? (
                                <input
                                  autoFocus
                                  value={editingPricingValue}
                                  onChange={(e) => setEditingPricingValue(e.target.value.replace(/[^0-9]/g, ''))}
                                  onBlur={() => handleSavePricing(propertyType, meterType)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSavePricing(propertyType, meterType)
                                    if (e.key === 'Escape') setEditingPricingKey(null)
                                  }}
                                  className="mt-2 w-full h-9 px-3 border border-slate-900 rounded-xl text-[13px] font-mono font-bold bg-white focus:outline-none"
                                  inputMode="numeric"
                                />
                              ) : (
                                <button
                                  onClick={() => {
                                    setEditingPricingKey(key)
                                    setEditingPricingValue(String(amount))
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

              {/* إعدادات المناطق */}
              {settingsTab === 'areas' && (
                <div className="space-y-3">
                  {/* إضافة منطقة جديدة */}
                  <div className="border border-sky-100 rounded-2xl p-4 bg-white shadow-sm">
                    <div className="text-[12px] font-bold text-slate-800">اضافة منطقة جديدة</div>
                    <div className="flex gap-2 mt-3">
                      <input
                        value={newAreaName}
                        onChange={(e) => setNewAreaName(e.target.value)}
                        placeholder="اسم المنطقة"
                        className="flex-1 h-10 px-4 border border-sky-100 rounded-2xl text-[12px] bg-sky-50/30 focus:bg-white focus:outline-none focus:border-slate-900"
                      />
                      <button
                        onClick={() => handleAddArea(false)}
                        className="h-10 px-5 bg-slate-900 text-white rounded-2xl text-[11px] font-bold"
                      >
                        اضافة
                      </button>
                    </div>
                  </div>

                  {/* قائمة المناطق */}
                  {areas.map((area) => {
                    const count = subscribers.filter((s) => s.areaId === area.id).length
                    return (
                      <div key={area.id} className="border border-sky-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                        <div className="p-4 flex justify-between items-start gap-3">
                          <div className="flex-1 min-w-0">
                            {editingAreaId === area.id ? (
                              <div className="flex gap-2">
                                <input
                                  value={editingAreaName}
                                  onChange={(e) => setEditingAreaName(e.target.value)}
                                  className="flex-1 h-8 px-3 border border-sky-100 rounded-xl text-[12px] bg-white"
                                />
                                <button
                                  onClick={() => handleRenameArea(area.id, editingAreaName)}
                                  className="h-8 px-4 bg-slate-900 text-white rounded-xl text-[11px] font-bold"
                                >
                                  حفظ
                                </button>
                                <button
                                  onClick={() => setEditingAreaId(null)}
                                  className="h-8 px-3 border border-sky-100 rounded-xl text-[11px]"
                                >
                                  الغاء
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="font-bold text-[13px] text-slate-800">{area.name}</div>
                                <span className="text-[10px] bg-sky-50 border border-sky-100 rounded-full px-2.5 py-0.5 font-mono text-slate-600">
                                  {formatNumber(count)} مشترك
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => { setEditingAreaId(area.id); setEditingAreaName(area.name) }}
                            className="w-8 h-8 border border-sky-100 rounded-xl flex items-center justify-center bg-white hover:bg-sky-50 text-slate-500"
                          >
                            ✎
                          </button>
                        </div>

                        {/* الأفرع */}
                        <div className="border-t border-sky-50 bg-sky-50/30 p-4 space-y-3">
                          <div className="space-y-2">
                            {area.branches.map((branch) => {
                              const bCount = subscribers.filter((s) => s.areaId === area.id && s.branchId === branch.id).length
                              const isEditingBranch = editingBranchId === branch.id
                              return (
                                <div
                                  key={branch.id}
                                  className="flex justify-between items-center bg-white border border-sky-100 rounded-xl px-4 py-3"
                                >
                                  {isEditingBranch ? (
                                    <div className="flex gap-2 flex-1">
                                      <input
                                        value={editingBranchName}
                                        onChange={(e) => setEditingBranchName(e.target.value)}
                                        className="flex-1 h-8 px-3 border border-sky-100 rounded-xl text-[11px]"
                                      />
                                      <button
                                        onClick={() => handleRenameBranch(branch.id, editingBranchName)}
                                        className="h-8 px-3 bg-slate-900 text-white rounded-xl text-[10px] font-bold"
                                      >
                                        حفظ
                                      </button>
                                      <button
                                        onClick={() => setEditingBranchId(null)}
                                        className="h-8 px-3 border border-sky-100 rounded-xl text-[10px]"
                                      >
                                        الغاء
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <div>
                                        <div className="text-[12px] font-medium text-slate-800">{branch.name}</div>
                                        <div className="text-[10px] text-slate-500 font-mono">{formatNumber(bCount)} مشترك</div>
                                      </div>
                                      <div className="flex gap-1.5">
                                        <button
                                          onClick={() => { setEditingBranchId(branch.id); setEditingBranchName(branch.name) }}
                                          className="w-7 h-7 border border-sky-100 rounded-xl flex items-center justify-center bg-white text-[10px]"
                                        >
                                          ✎
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          {/* إضافة فرع جديد */}
                          <div className="flex gap-2 pt-1">
                            <input
                              id={`branch_add_${area.id}`}
                              placeholder={`فرع جديد في ${area.name}`}
                              className="flex-1 h-10 px-4 border border-sky-100 rounded-2xl text-[11px] bg-white focus:outline-none focus:border-slate-900"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const input = e.target as HTMLInputElement
                                  if (!input.value.trim()) return
                                  handleAddBranch(area.id, input.value)
                                  input.value = ''
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const input = document.getElementById(`branch_add_${area.id}`) as HTMLInputElement
                                if (!input || !input.value.trim()) return
                                handleAddBranch(area.id, input.value)
                                input.value = ''
                              }}
                              className="h-10 px-4 bg-slate-900 text-white rounded-2xl text-[11px] font-bold"
                            >
                              اضافة فرع
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
