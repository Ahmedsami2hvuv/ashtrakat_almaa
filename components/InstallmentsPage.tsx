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
                statusMsg: 'مشترك مسجل في النظام'
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
                statusMsg: 'هذا المشترك غير موجود - سيتم إنشاء حساب جديد له'
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
      // إذا كان سطراً واحداً فقط، نقوم بتفريغه
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
        // إذا وجد المشترك، ننقله فوراً لحقل "المبلغ المدفوع" في نفس السطر
        setTimeout(() => {
          amountInputsRef.current[row.id]?.focus()
          amountInputsRef.current[row.id]?.select()
        }, 30)
      } else {
        // إذا لم يكن المشترك موجوداً، ننبه وننقله لحقل "اسم المشترك" لإنشاء حسابه
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
        alert('يرجى كتابة اسم المشترك أولاً لإنشاء حسابه!')
        return
      }
      // بعد إدخال الاسم، ننقله فوراً لحقل المبلغ المدفوع لنفس السطر
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
        alert('يرجى إدخال المبلغ المدفوع بشكل صحيح!')
        return
      }

      // إذا كان المشترك جديداً ولم يدخل اسمه بعد
      if (row.isNew && !row.name.trim()) {
        alert(`المشترك رقم ${row.subNumber} غير موجود. يرجى كتابة اسمه أولاً لإنشاء حسابه!`)
        nameInputsRef.current[row.id]?.focus()
        return
      }

      // إذا كان السطر الحالي هو الأخير، ننشئ سطراً جديداً وننقل المؤشر إليه
      if (index === rows.length - 1) {
        const newId = addNewRow()
        setTimeout(() => {
          numberInputsRef.current[newId]?.focus()
        }, 50)
      } else {
        // إذا كان هناك سطر تالي بالفعل، ننتقل إلى حقل رقم المشترك فيه
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
      alert('لا توجد أي إرساليات صالحة للحفظ! يرجى إدخال رقم مشترك ومبلغ مدفوع على الأقل.')
      return
    }

    // التحقق من أن المشتركين الجدد لديهم أسماء
    const missingNames = validRows.filter((r) => r.isNew && !r.name.trim())
    if (missingNames.length > 0) {
      alert(`هناك ${missingNames.length} مشتركين جدد بدون اسم. يرجى كتابة أسمائهم قبل الحفظ!`)
      return
    }

    const defaultAreaId = areas[0]?.id || 'area_1'
    const defaultBranchId = areas[0]?.branches[0]?.id || 'b_1'

    // تجهيز المشتركين الجدد
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

    // تجهيز الدفعات
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
      alert('حدث خطأ أثناء حفظ الإرساليات: ' + String(err))
    } finally {
      setIsSaving(false)
    }
  }

  // تنسيق الأرقام
  const formatNum = (num: number) => num.toLocaleString('en-US')

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 select-text" dir="rtl">
      {/* الشريط العلوي الثابت */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 shadow-xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* الجانب الأيمن: عنوان الصفحة وزر الرجوع */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
              <span>الرجوع للرئيسية</span>
            </button>

            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                <span className="p-1 rounded-lg bg-emerald-100 text-emerald-800 text-sm">📥</span>
                <span>تنزيل إرساليات</span>
              </h1>
            </div>
          </div>

          {/* الجانب الأيسر: الفترة المستهدفة وزر الحفظ السريع */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">الشهرين الحاليين:</span>
              <span className="font-bold text-sky-800">
                {PERIODS[selectedPeriodIdx]} لسنة {selectedYear}
              </span>
            </div>

            <button
              type="button"
              disabled={isSaving || validRows.length === 0}
              onClick={handleSave}
              className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span>حفظ الإرساليات ({validRows.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 pt-4">
        {/* بطاقة الفترة والإحصائيات السريعة */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          {/* محدد الفترة الحالية */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <label className="text-[11px] font-bold text-slate-500 block mb-1">
              الفترة المستهدفة للتنزيل (الشهرين)
            </label>
            <div className="flex items-center gap-2">
              <select
                value={selectedPeriodIdx}
                onChange={(e) => setSelectedPeriodIdx(Number(e.target.value))}
                className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              >
                {PERIODS.map((p, idx) => (
                  <option key={idx} value={idx}>
                    شهر {p} {idx === currentPeriodIdx ? '(الشهرين الحاليين)' : ''}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-24 h-8 px-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
              >
                {[2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* إجمالي المبالغ */}
          <div className="bg-white p-3.5 rounded-2xl border border-emerald-100 shadow-2xs bg-gradient-to-br from-emerald-50/40 to-white">
            <div className="text-[11px] font-bold text-emerald-800">إجمالي المبالغ المدفوعة</div>
            <div className="text-xl font-black text-emerald-600 mt-1 flex items-baseline gap-1">
              <span>{formatNum(totalAmount)}</span>
              <span className="text-[10px] font-bold text-emerald-700">د.ع</span>
            </div>
          </div>

          {/* عدد الأسطر الصالحة */}
          <div className="bg-white p-3.5 rounded-2xl border border-sky-100 shadow-2xs bg-gradient-to-br from-sky-50/40 to-white">
            <div className="text-[11px] font-bold text-sky-800">عدد الإرساليات الجاهزة</div>
            <div className="text-xl font-black text-sky-700 mt-1 flex items-baseline gap-1">
              <span>{formatNum(validRows.length)}</span>
              <span className="text-[10px] font-bold text-sky-600">إرسالية</span>
            </div>
          </div>

          {/* المشتركون الجدد */}
          <div className="bg-white p-3.5 rounded-2xl border border-amber-100 shadow-2xs bg-gradient-to-br from-amber-50/40 to-white">
            <div className="text-[11px] font-bold text-amber-800">مشتركون جدد سيتم إنشاؤهم</div>
            <div className="text-xl font-black text-amber-600 mt-1 flex items-baseline gap-1">
              <span>{formatNum(newSubscribersCount)}</span>
              <span className="text-[10px] font-bold text-amber-700">حساب جديد</span>
            </div>
          </div>
        </div>

        {/* جدول الإدخال السريع */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-right text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-black">
                  <th className="py-3 px-3 text-center w-12">#</th>
                  <th className="py-3 px-3 w-40">رقم المشترك</th>
                  <th className="py-3 px-3 min-w-[200px]">اسم المشترك</th>
                  <th className="py-3 px-3 w-48">المبلغ المدفوع (د.ع)</th>
                  <th className="py-3 px-3 min-w-[220px]">حالة المشترك والتنبيهات</th>
                  <th className="py-3 px-2 text-center w-14">حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => {
                  const isCleanId = Number(row.subNumber.replace(/[^0-9]/g, '')) > 0
                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        row.isNew
                          ? 'bg-amber-50/30 hover:bg-amber-50/50'
                          : row.isFound
                          ? 'bg-emerald-50/15 hover:bg-emerald-50/30'
                          : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* التسلسل */}
                      <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                        {idx + 1}
                      </td>

                      {/* رقم المشترك */}
                      <td className="py-2.5 px-3">
                        <input
                          ref={(el) => {
                            numberInputsRef.current[row.id] = el
                          }}
                          type="text"
                          inputMode="numeric"
                          value={row.subNumber}
                          placeholder="اكتب الرقم..."
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '')
                            checkSubscriber(row.id, val)
                          }}
                          onKeyDown={(e) => handleNumberKeyDown(e, row, idx)}
                          className={`w-full h-9 px-2.5 rounded-xl border text-xs font-bold tracking-wider outline-none transition-all ${
                            row.isFound
                              ? 'border-emerald-300 bg-emerald-50/40 text-emerald-900 focus:ring-2 focus:ring-emerald-400 focus:bg-white'
                              : row.isNew
                              ? 'border-amber-300 bg-amber-50/50 text-amber-900 focus:ring-2 focus:ring-amber-400 focus:bg-white'
                              : 'border-slate-200 bg-white text-slate-800 focus:ring-2 focus:ring-sky-400'
                          }`}
                        />
                      </td>

                      {/* اسم المشترك */}
                      <td className="py-2.5 px-3">
                        <div className="relative">
                          <input
                            ref={(el) => {
                              nameInputsRef.current[row.id] = el
                            }}
                            type="text"
                            value={row.name}
                            readOnly={row.isFound}
                            placeholder={
                              row.isNew
                                ? 'اكتب اسم المشترك الجديد ثم اضغط Enter...'
                                : isCleanId && !row.isFound
                                ? 'اكتب اسم المشترك لإنشاء حسابه...'
                                : 'سيظهر الاسم تلقائياً...'
                            }
                            onChange={(e) => {
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, name: e.target.value } : r
                                )
                              )
                            }}
                            onKeyDown={(e) => handleNameKeyDown(e, row)}
                            className={`w-full h-9 px-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                              row.isFound
                                ? 'bg-slate-100/70 border-slate-200 text-slate-800 cursor-default'
                                : row.isNew
                                ? 'border-amber-400 bg-amber-50/60 text-amber-950 focus:ring-2 focus:ring-amber-400 focus:bg-white shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-400'
                            }`}
                          />
                          {row.isFound && (
                            <span className="absolute left-2.5 top-2 text-emerald-600 text-[11px] font-bold">
                              ✓
                            </span>
                          )}
                        </div>
                      </td>

                      {/* المبلغ المدفوع */}
                      <td className="py-2.5 px-3">
                        <div className="relative">
                          <input
                            ref={(el) => {
                              amountInputsRef.current[row.id] = el
                            }}
                            type="text"
                            inputMode="numeric"
                            value={row.amount}
                            placeholder="المبلغ (د.ع)..."
                            onChange={(e) => {
                              const val = e.target.value.replace(/[^0-9]/g, '')
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id ? { ...r, amount: val } : r
                                )
                              )
                            }}
                            onKeyDown={(e) => handleAmountKeyDown(e, row, idx)}
                            className="w-full h-9 pl-8 pr-2.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-sky-400 transition-all placeholder:text-slate-300"
                          />
                          <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-slate-400 select-none">
                            د.ع
                          </span>
                        </div>
                      </td>

                      {/* حالة المشترك والتنبيهات */}
                      <td className="py-2.5 px-3">
                        {row.isFound ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 text-[11px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>مشترك مسجل: {row.existingSub?.meterType || '4 متر'}</span>
                          </div>
                        ) : row.isNew ? (
                          <div className="flex items-center gap-1.5 text-amber-800 text-[11px] font-bold bg-amber-100/60 px-2 py-1 rounded-lg border border-amber-200/60">
                            <span>⚠️</span>
                            <span>غير مسجل - سيتم إنشاء حساب له</span>
                          </div>
                        ) : isCleanId ? (
                          <span className="text-slate-400 text-[11px]">جاري التحقق...</span>
                        ) : (
                          <span className="text-slate-300 text-[11px]">- بانتظار الرقم -</span>
                        )}
                      </td>

                      {/* زر حذف */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors mx-auto"
                          title="حذف هذا السطر"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* أسفل الجدول: زر إضافة سطر يدوي */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const newId = addNewRow()
                setTimeout(() => numberInputsRef.current[newId]?.focus(), 50)
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>إضافة سطر جديد</span>
            </button>

            <span className="text-[11px] text-slate-500 font-medium">
              الأسطر: {rows.length}
            </span>
          </div>
        </div>

        {/* زر الحفظ في الأسفل */}
        <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div>
            <div className="text-sm font-black text-slate-900">
              تنزيل الدفعات في فترة شهر {PERIODS[selectedPeriodIdx]} لسنة {selectedYear}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial h-11 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
            >
              إلغاء ورجوع
            </button>

            <button
              type="button"
              disabled={isSaving || validRows.length === 0}
              onClick={handleSave}
              className="flex-1 sm:flex-initial h-11 px-7 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-95 cursor-pointer disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span>جاري الحفظ والتنزيل...</span>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    حفظ وتنزيل الإرسالية ({validRows.length} مشترك - {formatNum(totalAmount)} د.ع)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* نافذة أو شاشة النجاح بعد الحفظ */}
      {saveSuccess && successSummary && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">
              ✓
            </div>
            <h2 className="text-lg font-black text-slate-900 mb-1">تم حفظ وتنزيل الإرساليات بنجاح!</h2>
            <p className="text-xs text-slate-600 mb-5">
              تم تحديث الدفعات في النظام للفترة المحددة ومزامنتها سحابياً على سوبابيس.
            </p>

            {/* تفاصيل الملخص */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-right space-y-2 mb-6 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>الفترة المطبقة:</span>
                <span className="font-bold text-slate-900">
                  شهر {successSummary.periodLabel} لسنة {successSummary.year}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>عدد الإرساليات:</span>
                <span className="font-bold text-slate-900">{successSummary.totalCount} مشترك</span>
              </div>
              <div className="flex justify-between items-center text-slate-600">
                <span>إجمالي المبلغ:</span>
                <span className="font-bold text-emerald-600">{formatNum(successSummary.totalAmount)} د.ع</span>
              </div>
              {successSummary.newSubscribersCount > 0 && (
                <div className="flex justify-between items-center text-amber-700 bg-amber-50 p-2 rounded-lg font-bold">
                  <span>مشتركون جدد تم إنشاؤهم:</span>
                  <span>{successSummary.newSubscribersCount} مشترك</span>
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
                className="flex-1 h-11 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors"
              >
                تنزيل إرسالية جديدة
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors"
              >
                العودة للرئيسية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
