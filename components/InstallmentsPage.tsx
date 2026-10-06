'use client'

import React, { useState, useEffect, useRef } from 'react'
import type { Subscriber, BillingRecords, Area, Pricing } from './MainApp'
import { PERIODS } from './MainApp'

export interface ConsignmentRow {
  id: string
  subNumber: string
  name: string
  amount: string
  isNew: boolean
  isFound: boolean
  existingSub?: Subscriber
  statusMsg?: string
}

interface InstallmentsPageProps {
  subscribers: Subscriber[]
  billing: BillingRecords
  areas: Area[]
  pricing: Pricing
  onClose: () => void
  onSaveConsignments: (
    newSubscribers: Subscriber[],
    paymentsToApply: Array<{
      subId: number
      year: number
      periodIdx: number
      amount: number
    }>
  ) => Promise<boolean> | boolean
}

export default function InstallmentsPage({
  subscribers,
  areas,
  onClose,
  onSaveConsignments
}: InstallmentsPageProps) {
  // حساب الفترة الحالية الافتراضية (الشهرين الحاليين)
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentPeriodIdx = Math.min(5, Math.max(0, Math.floor(now.getMonth() / 2)))

  const [selectedYear, setSelectedYear] = useState<number>(currentYear)
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState<number>(currentPeriodIdx)

  // صفوف الإرسالية
  const [rows, setRows] = useState<ConsignmentRow[]>([
    {
      id: 'row-1',
      subNumber: '',
      name: '',
      amount: '',
      isNew: false,
      isFound: false,
      statusMsg: ''
    }
  ])

  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false)
  const [successSummary, setSuccessSummary] = useState<{
    totalCount: number
    totalAmount: number
    newSubscribersCount: number
    periodLabel: string
    year: number
  } | null>(null)

  // مراجع عناصر الإدخال للتحكم الدقيق بالـ Focus
  const numberInputsRef = useRef<Record<string, HTMLInputElement | null>>({})
  const nameInputsRef = useRef<Record<string, HTMLInputElement | null>>({})
  const amountInputsRef = useRef<Record<string, HTMLInputElement | null>>({})

  // تركيز المؤشر تلقائياً على أول خلية رقم مشترك عند فتح الصفحة
  useEffect(() => {
    const timer = setTimeout(() => {
      if (rows[0] && numberInputsRef.current[rows[0].id]) {
        numberInputsRef.current[rows[0].id]?.focus()
      }
    }, 150)
    return () => clearTimeout(timer)
  }, [])

  // دالة فحص رقم المشترك
  const checkSubscriber = (rowId: string, value: string) => {
    const cleanId = Number(value.replace(/[^0-9]/g, ''))
    if (!value || isNaN(cleanId) || cleanId <= 0) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                subNumber: value,
                name: '',
                isFound: false,
                isNew: false,
                statusMsg: ''
              }
            : r
        )
      )
      return { found: false, sub: null }
    }

    const found = subscribers.find((s) => s.id === cleanId)
    if (found) {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                subNumber: String(cleanId),
                name: found.name || 'بدون اسم',
                isFound: true,
                isNew: false,
                existingSub: found,
                statusMsg: 'مسجل'
              }
            : r
        )
      )
      return { found: true, sub: found }
    } else {
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                subNumber: String(cleanId),
                name: r.name || '',
                isFound: false,
                isNew: true,
                existingSub: undefined,
                statusMsg: 'غير مسجل'
              }
            : r
        )
      )
      return { found: false, sub: null }
    }
  }

  // إضافة سطر جديد
  const addNewRow = () => {
    const newId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`
    setRows((prev) => [
      ...prev,
      {
        id: newId,
        subNumber: '',
        name: '',
        amount: '',
        isNew: false,
        isFound: false,
        statusMsg: ''
      }
    ])
    return newId
  }

  // حذف سطر
  const handleDeleteRow = (rowId: string) => {
    if (rows.length === 1) {
      setRows([
        {
          id: `row-${Date.now()}`,
          subNumber: '',
          name: '',
          amount: '',
          isNew: false,
          isFound: false,
          statusMsg: ''
        }
      ])
      return
    }
    setRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  // معالجة الضغط على Enter في حقل "رقم المشترك"
  const handleNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: ConsignmentRow, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const { found } = checkSubscriber(row.id, row.subNumber)

      if (found) {
        // إذا وجد المشترك، ننقله فوراً لحقل المبلغ المدفوع
        setTimeout(() => {
          amountInputsRef.current[row.id]?.focus()
          amountInputsRef.current[row.id]?.select()
        }, 30)
      } else {
        // إذا لم يكن المشترك موجوداً، ننقله لحقل اسم المشترك لكتابة اسمه
        setTimeout(() => {
          nameInputsRef.current[row.id]?.focus()
          nameInputsRef.current[row.id]?.select()
        }, 30)
      }
    }
  }

  // معالجة الضغط على Enter في حقل "اسم المشترك" (للمشترك الجديد)
  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: ConsignmentRow) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!row.name.trim()) {
        alert('يرجى كتابة اسم المشترك لإنشاء حسابه')
        return
      }
      setTimeout(() => {
        amountInputsRef.current[row.id]?.focus()
        amountInputsRef.current[row.id]?.select()
      }, 30)
    }
  }

  // معالجة الضغط على Enter في حقل "المبلغ المدفوع"
  const handleAmountKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: ConsignmentRow, index: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const cleanAmount = Number(row.amount.replace(/[^0-9]/g, ''))
      if (!row.amount || isNaN(cleanAmount) || cleanAmount <= 0) {
        alert('يرجى إدخال المبلغ المدفوع')
        return
      }

      if (row.isNew && !row.name.trim()) {
        alert(`يرجى كتابة اسم المشترك للرقم ${row.subNumber} لإنشاء حسابه`)
        nameInputsRef.current[row.id]?.focus()
        return
      }

      if (index === rows.length - 1) {
        const newId = addNewRow()
        setTimeout(() => {
          numberInputsRef.current[newId]?.focus()
        }, 50)
      } else {
        const nextRow = rows[index + 1]
        if (nextRow) {
          numberInputsRef.current[nextRow.id]?.focus()
          numberInputsRef.current[nextRow.id]?.select()
        }
      }
    }
  }

  // إحصائيات الإرسالية الحالية
  const validRows = rows.filter((r) => {
    const num = Number(r.subNumber.replace(/[^0-9]/g, ''))
    const amt = Number(r.amount.replace(/[^0-9]/g, ''))
    return num > 0 && amt > 0 && (!r.isNew || r.name.trim().length > 0)
  })

  const totalAmount = validRows.reduce((sum, r) => {
    return sum + Number(r.amount.replace(/[^0-9]/g, ''))
  }, 0)

  const newSubscribersCount = validRows.filter((r) => r.isNew).length

  // دالة الحفظ
  const handleSave = async () => {
    if (validRows.length === 0) {
      alert('يرجى كتابة رقم مشترك والمبلغ المدفوع قبل الحفظ')
      return
    }

    const missingNames = validRows.filter((r) => r.isNew && !r.name.trim())
    if (missingNames.length > 0) {
      alert(`يرجى كتابة أسماء المشتركين الجدد قبل الحفظ`)
      return
    }

    const defaultAreaId = areas[0]?.id || 'area_1'
    const defaultBranchId = areas[0]?.branches[0]?.id || 'b_1'

    const newSubsToAdd: Subscriber[] = []
    const createdIds = new Set<number>()
    const maxOrder = subscribers.reduce((acc, curr) => Math.max(acc, curr.order || 0), 0)

    validRows.forEach((r, idx) => {
      const subId = Number(r.subNumber.replace(/[^0-9]/g, ''))
      if (r.isNew && !createdIds.has(subId)) {
        createdIds.add(subId)
        newSubsToAdd.push({
          id: subId,
          name: r.name.trim(),
          phone: '',
          areaId: defaultAreaId,
          branchId: defaultBranchId,
          propertyType: 'سكني',
          meterType: '4 متر',
          detailedAddress: 'تم إضافته عبر تنزيل الإرساليات',
          remainingPrev: 0,
          fee: 0,
          order: maxOrder + idx + 1,
          statuses: ['يدفع باستمرار'],
          createdAt: new Date().toISOString()
        })
      }
    })

    const paymentsToApply = validRows.map((r) => {
      const subId = Number(r.subNumber.replace(/[^0-9]/g, ''))
      const amount = Number(r.amount.replace(/[^0-9]/g, ''))
      return {
        subId,
        year: selectedYear,
        periodIdx: selectedPeriodIdx,
        amount
      }
    })

    setIsSaving(true)
    try {
      const success = await onSaveConsignments(newSubsToAdd, paymentsToApply)
      if (success !== false) {
        setSuccessSummary({
          totalCount: validRows.length,
          totalAmount,
          newSubscribersCount,
          periodLabel: PERIODS[selectedPeriodIdx],
          year: selectedYear
        })
        setSaveSuccess(true)
      }
    } catch (err) {
      alert('حدث خطأ أثناء الحفظ: ' + String(err))
    } finally {
      setIsSaving(false)
    }
  }

  const formatNum = (num: number) => num.toLocaleString('en-US')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-28 select-text" dir="rtl">
      {/* 1. الشريط العلوي الرشيق المتناسق مع الموبايل */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-3 py-2.5 shadow-xs">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {/* الجانب الأيمن: زر الرجوع وعنوان الصفحة الهادئ الناعم */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1 transition-all active:scale-95"
            >
              <span>←</span>
              <span>رجوع</span>
            </button>

            <span className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1">
              <span>📥</span>
              <span>تنزيل إرساليات</span>
            </span>
          </div>

          {/* الجانب الأيسر: زر حفظ واضح جداً وبارز وغير باهت إطلاقاً */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{ backgroundColor: '#059669', color: '#ffffff', opacity: 1 }}
              className="h-9 px-3.5 rounded-xl text-white font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer border border-emerald-400"
            >
              {isSaving ? (
                <span style={{ color: '#ffffff', fontWeight: 800 }}>جاري الحفظ...</span>
              ) : (
                <>
                  <span className="text-sm font-black" style={{ color: '#ffffff' }}>✓</span>
                  <span style={{ color: '#ffffff', fontWeight: 800, fontSize: '12px' }}>
                    حفظ ({validRows.length})
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-4xl mx-auto px-2.5 sm:px-4 pt-3">
        {/* 2. شريط تحكم وإحصائيات مدمج وأنيق (يناسب الموبايل تماماً) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-2.5 mb-3 shadow-2xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* اختيار الفترة */}
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span className="text-slate-500 text-[11px]">الفترة:</span>
              <select
                value={selectedPeriodIdx}
                onChange={(e) => setSelectedPeriodIdx(Number(e.target.value))}
                className="h-7.5 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
              >
                {PERIODS.map((p, idx) => (
                  <option key={idx} value={idx}>
                    شهر {p} {idx === currentPeriodIdx ? '⭐' : ''}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-7.5 px-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 outline-none"
              >
                {[2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* الإحصائيات المدمجة */}
            <div className="flex items-center gap-2 text-xs">
              <div className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-black">
                <span>{formatNum(totalAmount)}</span>
                <span className="text-[10px] mr-1">د.ع</span>
              </div>
              <div className="px-2 py-1 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 font-bold text-[11px]">
                <span>{validRows.length} وصل</span>
              </div>
              {newSubscribersCount > 0 && (
                <div className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px]">
                  <span>{newSubscribersCount} جديد</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. قائمة أسطر الإدخال السريع (مرتبة ومريحة للموبايل: رقم المشترك بحجم 4-5 أرقام، والمبلغ كبير، والاسم كامل تحتهما) */}
        <div className="space-y-2.5">
          {rows.map((row, idx) => {
            const isCleanId = Number(row.subNumber.replace(/[^0-9]/g, '')) > 0
            return (
              <div
                key={row.id}
                className={`p-2.5 sm:p-3 rounded-2xl border transition-all ${
                  row.isNew
                    ? 'bg-amber-50/40 border-amber-300'
                    : row.isFound
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-white border-slate-200 shadow-2xs'
                }`}
              >
                {/* الصف الأول: التسلسل + رقم المشترك (مخصص لـ 4-5 أرقام) + المبلغ (كبير وواسع) + زر الحذف */}
                <div className="flex items-center gap-2">
                  {/* رقم التسلسل */}
                  <span className="w-5 text-center text-xs font-bold text-slate-400 shrink-0">
                    {idx + 1}
                  </span>

                  {/* 1. خلية رقم المشترك (صغيرة ومحددة لحجم 4 إلى 5 أرقام فقط: 72 بكسل) */}
                  <div style={{ width: '72px', minWidth: '72px', maxWidth: '72px' }} className="shrink-0">
                    <input
                      ref={(el) => {
                        numberInputsRef.current[row.id] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      value={row.subNumber}
                      placeholder="الرقم"
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '')
                        checkSubscriber(row.id, val)
                      }}
                      onKeyDown={(e) => handleNumberKeyDown(e, row, idx)}
                      style={{ width: '72px' }}
                      className={`h-11 text-center rounded-xl border text-base font-black outline-none transition-all ${
                        row.isFound
                          ? 'border-emerald-500 bg-white text-emerald-950 focus:ring-2 focus:ring-emerald-400'
                          : row.isNew
                          ? 'border-amber-500 bg-white text-amber-950 focus:ring-2 focus:ring-amber-400'
                          : 'border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-sky-400'
                      }`}
                    />
                  </div>

                  {/* 2. خلية المبلغ المدفوع (كبيرة وواسعة جداً تأخذ باقي الشاشة بالكامل) */}
                  <div className="flex-1 relative" style={{ minWidth: 0 }}>
                    <input
                      ref={(el) => {
                        amountInputsRef.current[row.id] = el
                      }}
                      type="text"
                      inputMode="numeric"
                      value={row.amount}
                      placeholder="المبلغ المدفوع (د.ع)..."
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '')
                        setRows((prev) =>
                          prev.map((r) =>
                            r.id === row.id ? { ...r, amount: val } : r
                          )
                        )
                      }}
                      onKeyDown={(e) => handleAmountKeyDown(e, row, idx)}
                      className="w-full h-11 pl-10 pr-3 rounded-xl border-2 border-slate-300 focus:border-emerald-500 bg-white text-base sm:text-lg font-black text-slate-950 outline-none focus:ring-2 focus:ring-emerald-400 shadow-2xs transition-all placeholder:text-slate-400"
                    />
                    <span className="absolute left-2.5 top-3 text-xs font-black text-slate-500 select-none">
                      د.ع
                    </span>
                  </div>

                  {/* زر حذف السطر */}
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(row.id)}
                    className="w-9 h-11 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                    title="حذف هذا السطر"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>

                {/* الصف الثاني: اسم المشترك بالكامل تحت الخليتين ممتداً على كامل العرض */}
                <div className="mt-2 w-full">
                  {row.isFound ? (
                    <div className="min-h-[36px] px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs sm:text-sm font-black flex items-center justify-between gap-1 shadow-2xs">
                      <span className="flex items-center gap-1.5 break-words">
                        <span className="text-emerald-700 text-base">👤</span>
                        <span className="text-emerald-950 font-black">{row.name}</span>
                      </span>
                      <span className="text-[11px] text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-md font-semibold shrink-0">
                        {row.existingSub?.meterType || 'مسجل'}
                      </span>
                    </div>
                  ) : row.isNew ? (
                    <div>
                      <input
                        ref={(el) => {
                          nameInputsRef.current[row.id] = el
                        }}
                        type="text"
                        value={row.name}
                        placeholder="⚠️ غير مسجل! اكتب اسم المشترك بالكامل لإنشاء حسابه..."
                        onChange={(e) => {
                          setRows((prev) =>
                            prev.map((r) =>
                              r.id === row.id ? { ...r, name: e.target.value } : r
                            )
                          )
                        }}
                        onKeyDown={(e) => handleNameKeyDown(e, row)}
                        className="w-full h-10 px-3 rounded-xl border-2 border-amber-400 bg-amber-50 text-xs sm:text-sm font-bold text-amber-950 outline-none focus:bg-white shadow-2xs placeholder:text-amber-700/80"
                      />
                    </div>
                  ) : isCleanId ? (
                    <div className="text-xs text-slate-400 px-1">جاري التحقق...</div>
                  ) : null}
                </div>
              </div>
            )
          })}

          {/* زر إضافة سطر أسفل الأسطر */}
          <div className="p-2.5 bg-white rounded-2xl border border-slate-200 flex items-center justify-between shadow-2xs">
            <button
              type="button"
              onClick={() => {
                const newId = addNewRow()
                setTimeout(() => numberInputsRef.current[newId]?.focus(), 50)
              }}
              className="h-9 px-3.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <span className="text-base font-bold leading-none">+</span>
              <span>إضافة سطر جديد</span>
            </button>

            <span className="text-xs text-slate-600 font-bold">
              الأسطر: {rows.length}
            </span>
          </div>
        </div>

        {/* 4. شريط الحفظ السفلي البارز والواضح 100% بكتابة ساطعة غير باهتة */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t-2 border-slate-200 p-2.5 sm:p-3 shadow-2xl">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-4 rounded-xl border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors shrink-0"
            >
              إلغاء ورجوع
            </button>

            {/* الزر الرئيسي الأخضر البارز الصريح */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: '#059669',
                color: '#ffffff',
                opacity: 1
              }}
              className="flex-1 h-12 px-4 rounded-xl text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-98 cursor-pointer border-2 border-emerald-400"
            >
              {isSaving ? (
                <span style={{ color: '#ffffff', fontWeight: 900 }}>جاري الحفظ والتنزيل...</span>
              ) : (
                <>
                  <span className="text-base">💾</span>
                  <span style={{ color: '#ffffff', fontWeight: 900, fontSize: '13.5px' }}>
                    حفظ وتنزيل الإرساليات ({validRows.length} وصل - {formatNum(totalAmount)} د.ع)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* نافذة النجاح بعد الحفظ */}
      {saveSuccess && successSummary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 text-center shadow-2xl border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-2xl mx-auto mb-3">
              ✓
            </div>
            <h2 className="text-base font-black text-slate-900 mb-1">تم حفظ وتنزيل الإرساليات بنجاح</h2>
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-right space-y-1.5 my-4 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>الفترة:</span>
                <span className="font-bold text-slate-900">
                  شهر {successSummary.periodLabel} لسنة {successSummary.year}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>الوصولات:</span>
                <span className="font-bold text-slate-900">{successSummary.totalCount} مشترك</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>المبلغ الكلي:</span>
                <span className="font-bold text-emerald-600">{formatNum(successSummary.totalAmount)} د.ع</span>
              </div>
              {successSummary.newSubscribersCount > 0 && (
                <div className="flex justify-between items-center text-amber-700 bg-amber-50 p-1.5 rounded-lg font-bold">
                  <span>مشتركون جدد:</span>
                  <span>{successSummary.newSubscribersCount}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setSaveSuccess(false)
                  setRows([
                    {
                      id: `row-${Date.now()}`,
                      subNumber: '',
                      name: '',
                      amount: '',
                      isNew: false,
                      isFound: false,
                      statusMsg: ''
                    }
                  ])
                  setTimeout(() => {
                    const firstInput = Object.values(numberInputsRef.current)[0]
                    firstInput?.focus()
                  }, 100)
                }}
                className="flex-1 h-10 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
              >
                إرسالية جديدة
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm"
              >
                تم والرجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
