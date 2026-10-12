'use client'

import React, { useState, useRef } from 'react'
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  RefreshCw,
  Edit2,
  Trash2,
  Layers,
  MapPin,
  Calendar,
  Wallet,
  Building2,
  ArrowRight,
  Eye,
  Check,
  Search
} from 'lucide-react'
import { DirectorateBranch, Consignment, ConsignmentItem } from '@/lib/directorateTypes'
import { Subscriber, BillingRecords } from '@/components/MainApp'
import { ScannedConsignmentResult, ScannedConsignmentRow } from '@/lib/aiConsignmentScanner'

interface ConsignmentAiScannerModalProps {
  branch: DirectorateBranch
  subscribers: Subscriber[]
  billing: BillingRecords
  apiKeys: string[]
  isOpen: boolean
  onClose: () => void
  onApplyConsignment: (
    consignment: Consignment,
    updatedSubscribers: Subscriber[],
    updatedBilling: BillingRecords
  ) => void
  onTransferToA4: (scannedData: ScannedConsignmentResult) => void
}

export default function ConsignmentAiScannerModal({
  branch,
  subscribers,
  billing,
  apiKeys,
  isOpen,
  onClose,
  onApplyConsignment,
  onTransferToA4
}: ConsignmentAiScannerModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [scannedResult, setScannedResult] = useState<ScannedConsignmentResult | null>(null)
  const [showOriginalImage, setShowOriginalImage] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  // خريطة سريعة للمشتركين للبحث والمطابقة المباشرة
  const subMapById = new Map<number, Subscriber>()
  subscribers.forEach((s) => {
    subMapById.set(Number(s.id), s)
  })

  // التعامل مع اختيار الصورة
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setAnalysisError(null)

    const reader = new FileReader()
    reader.onload = () => {
      setImagePreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  // بدء المسح بالذكاء الاصطناعي
  const handleStartScan = async () => {
    if (!imagePreview) {
      setAnalysisError('يرجى اختيار صورة لورقة الإرسالية أولاً')
      return
    }

    const validKeys = (apiKeys || []).filter((k) => k && k.trim().length > 0)
    if (validKeys.length === 0) {
      setAnalysisError('لا توجد مفاتيح Google Gemini API مسجلة في هذا الفرع. يرجى إضافتها في تبويب الإعدادات و AI أولاً.')
      return
    }

    setIsAnalyzing(true)
    setAnalysisError(null)

    try {
      const res = await fetch('/api/ai/scan-consignment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imagePreview,
          mimeType: selectedFile?.type || 'image/jpeg',
          apiKeys: validKeys
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'فشل مسح وقراءة ورقة الإرسالية')
      }

      setScannedResult(data.data as ScannedConsignmentResult)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة الصورة بالذكاء الاصطناعي'
      setAnalysisError(msg)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // تعديل سطر في النتائج
  const handleUpdateRow = (index: number, field: keyof ScannedConsignmentRow, val: any) => {
    if (!scannedResult) return
    const updatedRows = [...scannedResult.rows]
    updatedRows[index] = { ...updatedRows[index], [field]: val }
    setScannedResult({
      ...scannedResult,
      rows: updatedRows
    })
  }

  // حذف سطر
  const handleDeleteRow = (index: number) => {
    if (!scannedResult) return
    const updatedRows = scannedResult.rows.filter((_, idx) => idx !== index)
    setScannedResult({
      ...scannedResult,
      rows: updatedRows
    })
  }

  // ترحيل المدفوعات وحفظ الإرسالية
  const handleConfirmAndPost = () => {
    if (!scannedResult) return

    const validRows = scannedResult.rows.filter(
      (r) => !r.isVoid && r.subscriberId && (r.amount || 0) > 0
    )

    if (validRows.length === 0) {
      alert('لا توجد أسطر صالحة تحتوي على رقم مشترك ومبلغ مدفوع للترحيل.')
      return
    }

    setIsSubmitting(true)

    const consignmentItems: ConsignmentItem[] = validRows.map((r) => {
      const matched = r.subscriberId ? subMapById.get(r.subscriberId) : undefined
      const amt = r.amount || 0
      const water = r.waterAmount ?? Math.round(amt * 0.8)
      const muni = r.municipalityAmount ?? (amt - water)

      return {
        subscriberId: r.subscriberId!,
        subscriberName: matched?.name || r.subscriberName || `مشترك #${r.subscriberId}`,
        areaName: r.areaName || '',
        amount: amt,
        waterAmount: water,
        municipalityAmount: muni,
        receiptNumber: r.receiptNumber || '',
        paymentDate: scannedResult.date || new Date().toISOString().split('T')[0]
      }
    })

    const totalAmount = consignmentItems.reduce((s, it) => s + it.amount, 0)
    const totalWater = consignmentItems.reduce((s, it) => s + (it.waterAmount || 0), 0)
    const totalMuni = consignmentItems.reduce((s, it) => s + (it.municipalityAmount || 0), 0)

    const newConsignment: Consignment = {
      id: 'cons_ai_' + Date.now().toString(36),
      serialNumber: scannedResult.serialNumber || '02951',
      paperRefNumber: scannedResult.paperRefNumber || '',
      branchId: branch.id,
      collectorName: scannedResult.collectorName || branch.collectors[0]?.name || 'محصل آلي',
      date: scannedResult.date || new Date().toISOString().split('T')[0],
      items: consignmentItems,
      totalAmount,
      totalWaterAmount: totalWater,
      totalMunicipalityAmount: totalMuni,
      createdAt: new Date().toISOString()
    }

    // ترحيل الدفعات وتحديث ديون المشتركين
    const updatedBilling = { ...(billing || {}) }
    const updatedSubscribers = subscribers.map((sub) => {
      const payments = consignmentItems.filter((it) => it.subscriberId === sub.id)
      if (payments.length === 0) return sub

      const paidTotal = payments.reduce((s, p) => s + p.amount, 0)
      const currentDebt = sub.remainingPrev || 0
      const newDebt = Math.max(0, currentDebt - paidTotal)

      const currentYear = 2026
      if (!updatedBilling[sub.id]) updatedBilling[sub.id] = {}
      if (!updatedBilling[sub.id][currentYear]) {
        updatedBilling[sub.id][currentYear] = Array.from({ length: 6 }, () => ({
          oldDebtManual: null,
          paid: 0,
          totalManual: null,
          remainingManual: null
        }))
      }

      const periods = updatedBilling[sub.id][currentYear]
      if (periods && periods.length > 0) {
        periods[0].paid = (periods[0].paid || 0) + paidTotal
      }

      // ربط المنطقة إذا لم تكن موجودة
      let updatedAreaId = sub.areaId
      const firstRow = payments[0]
      if (!updatedAreaId && firstRow.areaName) {
        const foundA = (branch.areas || []).find((a) => a.name === firstRow.areaName)
        if (foundA) updatedAreaId = foundA.id
      }

      return {
        ...sub,
        areaId: updatedAreaId,
        remainingPrev: newDebt
      }
    })

    onApplyConsignment(newConsignment, updatedSubscribers, updatedBilling)
    setIsSubmitting(false)
    onClose()
  }

  // نقل البيانات لشاشة A4
  const handleSendToA4 = () => {
    if (!scannedResult) return
    onTransferToA4(scannedResult)
    onClose()
  }

  // حساب المجاميع من الأسطر
  const validRows = scannedResult?.rows.filter((r) => !r.isVoid && (r.amount || 0) > 0) || []
  const calculatedTotal = validRows.reduce((s, r) => s + (r.amount || 0), 0)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '12px'
      }}
      dir="rtl"
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '24px',
          width: '100%',
          maxWidth: scannedResult ? '1100px' : '650px',
          height: '88vh',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          border: '1px solid #cbd5e1'
        }}
      >
        {/* ===================== الرأسية ===================== */}
        <div
          style={{
            flexShrink: 0,
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc'
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-gradient-to-tr from-purple-600 to-blue-600 text-white rounded-xl shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                استيراد وقراءة الإرسالية من الصورة بالذكاء الاصطناعي
              </h3>
              <p className="text-xs text-slate-500 font-bold leading-tight mt-0.5">
                فحص استمارة الإرسالية الرسمية واستخراج وصولات المشتركين وترحيلها تلقائياً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===================== المحتوى الداخلي ===================== */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px' }} className="space-y-4">
          {/* الخطوة 1: اختيار الصورة (إذا لم يتم الفحص بعد أو لإعادة المسح) */}
          {!scannedResult && (
            <div className="space-y-4 max-w-xl mx-auto py-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 select-none ${
                  imagePreview
                    ? 'border-blue-400 bg-blue-50/30'
                    : 'border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {imagePreview ? (
                  <div className="space-y-3 w-full">
                    <div className="relative max-h-64 mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img
                        src={imagePreview}
                        alt="معاينة الإرسالية"
                        className="max-h-64 w-auto mx-auto object-contain"
                      />
                    </div>
                    <p className="text-xs font-bold text-blue-700">
                      انقر لتغيير الصورة (تم اختيار: {selectedFile?.name})
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                      <Upload className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-slate-800">
                        انقر لاختيار أو التقاط صورة استمارة الإرسالية
                      </h4>
                      <p className="text-xs text-slate-500 font-bold mt-1">
                        يدعم صور الهاتف والكاميرا واستمارات A4 المسحوبة بالسكنر
                      </p>
                    </div>
                  </>
                )}
              </div>

              {analysisError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{analysisError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  disabled={!imagePreview || isAnalyzing}
                  onClick={handleStartScan}
                  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl text-sm font-black transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>جارِ قراءة وفحص الإرسالية بالذكاء الاصطناعي...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>بدء الفحص واستخراج البيانات</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* الخطوة 2: شاشة عرض التفاصيل المستخرجة ومراجعتها (المطلوب الرئيسي للمستخدم) */}
          {scannedResult && (
            <div className="space-y-4">
              {/* بطاقة معلومات الترويسة والتذييل */}
              <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">تسلسل الورقة:</span>
                  <input
                    type="text"
                    value={scannedResult.serialNumber || ''}
                    onChange={(e) =>
                      setScannedResult({ ...scannedResult, serialNumber: e.target.value })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg font-black text-slate-900 font-mono"
                  />
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">المحصل / الجابي:</span>
                  <input
                    type="text"
                    value={scannedResult.collectorName || ''}
                    onChange={(e) =>
                      setScannedResult({ ...scannedResult, collectorName: e.target.value })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                  />
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">التاريخ:</span>
                  <input
                    type="date"
                    value={scannedResult.date || ''}
                    onChange={(e) =>
                      setScannedResult({ ...scannedResult, date: e.target.value })
                    }
                    className="w-full mt-0.5 px-2 py-1 bg-white border border-slate-200 rounded-lg font-bold text-slate-900"
                  />
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">الوصولات الصالحة:</span>
                  <div className="mt-1 font-black text-blue-700 text-sm">
                    {validRows.length} وصل
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] text-slate-500 font-bold">المجموع الكلي:</span>
                  <div className="mt-1 font-black text-emerald-700 text-sm font-mono">
                    {calculatedTotal.toLocaleString('ar-IQ')} د.ع
                  </div>
                </div>
              </div>

              {/* شريط الإجراءات السريعة فوق الجدول */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm">
                    الوصولات المستخرجة من الإرسالية ({scannedResult.rows.length} سطر):
                  </h4>
                  <span className="text-[11px] text-slate-500 font-bold">
                    (يمكنك مراجعة وتعديل أي حقل قبل الترحيل)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOriginalImage(!showOriginalImage)}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center gap-1 border border-indigo-200"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showOriginalImage ? 'إخفاء الصورة' : 'معاينة الصورة الأصلية'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setScannedResult(null)
                      setImagePreview(null)
                      setSelectedFile(null)
                    }}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition"
                  >
                    مسح صورة أخرى
                  </button>
                </div>
              </div>

              {/* معاينة الصورة الأصلية إن طُلب */}
              {showOriginalImage && imagePreview && (
                <div className="p-2 bg-slate-900 rounded-2xl max-h-72 overflow-auto flex items-center justify-center border border-slate-700">
                  <img
                    src={imagePreview}
                    alt="صورة الإرسالية الأصلية"
                    className="max-h-64 object-contain rounded-lg"
                  />
                </div>
              )}

              {/* جدول عرض الوصولات والأسطر المستخرجة */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto max-h-[46vh]">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200 sticky top-0 z-10 text-[11px]">
                      <tr>
                        <th className="p-2.5 text-center w-10">ت</th>
                        <th className="p-2.5">رقم المشترك</th>
                        <th className="p-2.5">اسم المشترك</th>
                        <th className="p-2.5">المنطقة</th>
                        <th className="p-2.5">المبلغ المستلم</th>
                        <th className="p-2.5">رقم الوصل</th>
                        <th className="p-2.5 text-center">مطابقة النظام</th>
                        <th className="p-2.5 text-center w-12">حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {scannedResult.rows.map((row, idx) => {
                        const matched = row.subscriberId ? subMapById.get(row.subscriberId) : undefined
                        const isRowVoid = row.isVoid

                        return (
                          <tr
                            key={idx}
                            className={`transition-colors ${
                              isRowVoid
                                ? 'bg-slate-50 text-slate-400'
                                : matched
                                ? 'hover:bg-blue-50/40'
                                : 'bg-amber-50/30 hover:bg-amber-50/60'
                            }`}
                          >
                            <td className="p-2 text-center font-mono font-bold text-slate-400">
                              {row.rowNumber || idx + 1}
                            </td>

                            {/* رقم المشترك */}
                            <td className="p-2">
                              <input
                                type="text"
                                disabled={isRowVoid}
                                value={row.subscriberId || ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value.replace(/[^\d]/g, ''), 10)
                                  handleUpdateRow(idx, 'subscriberId', isNaN(val) ? undefined : val)
                                }}
                                placeholder="رقم المشترك"
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono font-black text-blue-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                            </td>

                            {/* اسم المشترك */}
                            <td className="p-2">
                              <div className="space-y-0.5">
                                <input
                                  type="text"
                                  disabled={isRowVoid}
                                  value={row.subscriberName || ''}
                                  onChange={(e) => handleUpdateRow(idx, 'subscriberName', e.target.value)}
                                  placeholder="اسم المشترك..."
                                  className="w-full min-w-[130px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                />
                                {matched && matched.name !== row.subscriberName && (
                                  <div className="text-[10px] text-emerald-700 font-bold">
                                    في النظام: {matched.name}
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* المنطقة */}
                            <td className="p-2">
                              <input
                                type="text"
                                disabled={isRowVoid}
                                value={row.areaName || ''}
                                onChange={(e) => handleUpdateRow(idx, 'areaName', e.target.value)}
                                placeholder="المنطقة..."
                                className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                            </td>

                            {/* المبلغ المسدد */}
                            <td className="p-2">
                              <input
                                type="text"
                                disabled={isRowVoid}
                                value={row.amount || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value.replace(/[^\d.]/g, ''))
                                  handleUpdateRow(idx, 'amount', isNaN(val) ? 0 : val)
                                }}
                                placeholder="0"
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono font-black text-emerald-700 text-xs text-left focus:ring-1 focus:ring-emerald-500 outline-none"
                              />
                            </td>

                            {/* رقم الوصل */}
                            <td className="p-2">
                              <input
                                type="text"
                                disabled={isRowVoid}
                                value={row.receiptNumber || ''}
                                onChange={(e) => handleUpdateRow(idx, 'receiptNumber', e.target.value)}
                                placeholder="رقم الوصل"
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold text-slate-800 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                              />
                            </td>

                            {/* مطابقة النظام */}
                            <td className="p-2 text-center whitespace-nowrap">
                              {isRowVoid ? (
                                <span className="text-[10px] text-slate-400 font-bold bg-slate-100 px-2 py-0.5 rounded">
                                  بطال / ملغي
                                </span>
                              ) : matched ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>مطابق للنظام</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                                  <span>مشترك جديد/غير مسجل</span>
                                </span>
                              )}
                            </td>

                            {/* زر الحذف */}
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                                title="حذف هذا السطر"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===================== الشريط السفلي للأزرار ===================== */}
        <div
          style={{
            flexShrink: 0,
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
          >
            إغلاق
          </button>

          {scannedResult && (
            <div className="flex items-center gap-2">
              {/* زر نقل البيانات إلى ورقة A4 الرسمية */}
              <button
                type="button"
                onClick={handleSendToA4}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-300"
              >
                <FileText className="w-4 h-4 text-slate-600" />
                <span>فتح في استمارة A4 للطباعة</span>
              </button>

              {/* زر اعتماد وترحيل المدفوعات فوراً */}
              <button
                type="button"
                disabled={isSubmitting || validRows.length === 0}
                onClick={handleConfirmAndPost}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جارِ ترحيل المبالغ...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>اعتماد وترحيل المدفوعات ({validRows.length} مشترك)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
