'use client'

import React, { useState, useRef } from 'react'
import { Subscriber, Pricing, BillingRecords, PERIODS } from './MainApp'
import { analyzeReceiptImage, ScannedReceipt, getPeriodIndexFromMonth } from '@/lib/aiReceiptScanner'

interface ReceiptScannerModalProps {
  isOpen: boolean
  onClose: () => void
  apiKeys: string[]
  subscribers: Subscriber[]
  billing: BillingRecords
  pricing: Pricing
  onApplyPayments: (paymentsToApply: Array<{
    subId: number
    year: number
    periodIdx: number
    amount: number
  }>) => void
  onOpenSettings: () => void
}

export default function ReceiptScannerModal({
  isOpen,
  onClose,
  apiKeys,
  subscribers,
  billing,
  pricing,
  onApplyPayments,
  onOpenSettings
}: ReceiptScannerModalProps) {
  const [receipts, setReceipts] = useState<ScannedReceipt[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProcessingIdx, setCurrentProcessingIdx] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  if (!isOpen) return null

  // ضغط وتصغير حجم الصورة للمتصفح وسرعة الإرسال
  const compressImage = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxDim = 1600
          let width = img.width
          let height = img.height

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width)
              width = maxDim
            } else {
              width = Math.round((width * maxDim) / height)
              height = maxDim
            }
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve({ base64: e.target?.result as string, mimeType: file.type || 'image/jpeg' })
            return
          }

          ctx.drawImage(img, 0, 0, width, height)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
          resolve({ base64: dataUrl, mimeType: 'image/jpeg' })
        }
        img.onerror = reject
        img.src = e.target?.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // اختيار الصور وإضافتها للقائمة
  const handleSelectFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files)

    const newItems: ScannedReceipt[] = []
    for (const f of files) {
      try {
        const { base64, mimeType } = await compressImage(f)
        newItems.push({
          id: Math.random().toString(36).substring(2, 9),
          fileName: f.name,
          imageUrl: base64,
          base64Data: base64,
          mimeType: mimeType,
          periodIndex: 0,
          targetYear: new Date().getFullYear(),
          status: 'pending'
        })
      } catch (err) {
        console.error('Error compressing image:', err)
      }
    }

    setReceipts((prev) => [...prev, ...newItems])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // بدء التحليل بالذكاء الاصطناعي لجميع الوصولات المعلقة
  const handleStartAnalysis = async () => {
    if (apiKeys.length === 0) {
      alert('يرجى إضافة مفتاح الذكاء الاصطناعي في الإعدادات أولاً')
      onOpenSettings()
      return
    }

    setIsProcessing(true)
    setSuccessMessage(null)

    for (let i = 0; i < receipts.length; i++) {
      if (receipts[i].status === 'success') continue

      setCurrentProcessingIdx(i)
      setReceipts((prev) => {
        const updated = [...prev]
        updated[i] = { ...updated[i], status: 'processing', errorMessage: undefined }
        return updated
      })

      try {
        const item = receipts[i]
        const result = await analyzeReceiptImage(item.base64Data || item.imageUrl, item.mimeType || 'image/jpeg', apiKeys)

        // مطابقة المشترك
        const matched = subscribers.find((s) => s.id === result.subscriberId)

        setReceipts((prev) => {
          const updated = [...prev]
          updated[i] = {
            ...updated[i],
            status: 'success',
            receiptNumber: result.receiptNumber,
            subscriberId: result.subscriberId,
            subscriberName: result.subscriberName,
            amount: result.amount,
            paymentDay: result.paymentDay,
            paymentMonth: result.paymentMonth,
            paymentYear: result.paymentYear,
            periodIndex: result.periodIndex,
            targetYear: result.targetYear,
            matchedSubscriber: matched ? { id: matched.id, name: matched.name } : undefined
          }
          return updated
        })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'تعذر قراءة الوصل'
        setReceipts((prev) => {
          const updated = [...prev]
          updated[i] = { ...updated[i], status: 'error', errorMessage: msg }
          return updated
        })
      }
    }

    setIsProcessing(false)
    setCurrentProcessingIdx(null)
  }

  // تعديل حقل في وصل معين
  const handleUpdateReceipt = (idx: number, field: keyof ScannedReceipt, val: any) => {
    setReceipts((prev) => {
      const updated = [...prev]
      const current = { ...updated[idx], [field]: val }

      if (field === 'subscriberId') {
        const matched = subscribers.find((s) => s.id === Number(val))
        current.matchedSubscriber = matched ? { id: matched.id, name: matched.name } : undefined
      }

      if (field === 'paymentMonth') {
        const m = Number(val)
        current.periodIndex = getPeriodIndexFromMonth(m)
      }

      updated[idx] = current
      return updated
    })
  }

  // حذف وصل من القائمة
  const handleRemoveReceipt = (idx: number) => {
    setReceipts((prev) => prev.filter((_, i) => i !== idx))
  }

  // اعتماد وتنزيل الدفعات
  const handleConfirmAndApply = () => {
    const validToApply = receipts.filter(
      (r) => r.status === 'success' && r.subscriberId && r.amount !== undefined && r.amount > 0
    )

    if (validToApply.length === 0) {
      alert('لا توجد وصولات جاهزة أو مكتملة البيانات لتنزيلها!')
      return
    }

    const payload = validToApply.map((r) => ({
      subId: r.subscriberId!,
      year: r.targetYear || new Date().getFullYear(),
      periodIdx: r.periodIndex,
      amount: r.amount!
    }))

    onApplyPayments(payload)
    setSuccessMessage(`تم بنجاح تنزيل ${validToApply.length} وصل في حسابات المشتركين!`)
    setTimeout(() => {
      onClose()
    }, 1500)
  }

  const successCount = receipts.filter((r) => r.status === 'success').length

  return (
    <div className="fixed inset-0 z-[10060] bg-slate-900/40 backdrop-blur-[3px] flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white w-full max-w-4xl max-h-[92vh] rounded-3xl shadow-2xl flex flex-col border border-sky-100 overflow-hidden">
        {/* شريط العنوان العلوي */}
        <div className="px-5 py-4 bg-slate-900 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-xl font-bold">
              ✨
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">تنزيل إرساليات بالذكاء الاصطناعي</h3>
              <p className="text-xs text-slate-300">قراءة وتنزيل مبالغ وصولات الماء تلقائياً حسب التاريخ والفترة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-sm"
          >
            ✕
          </button>
        </div>

        {/* تنبيه إذا لم تكن هناك مفاتيح */}
        {apiKeys.length === 0 && (
          <div className="m-4 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <span>لم تقم بإضافة مفتاح الذكاء الاصطناعي بعد في الإعدادات.</span>
            </div>
            <button
              onClick={() => {
                onClose()
                onOpenSettings()
              }}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition-colors"
            >
              إضافة مفتاح الآن
            </button>
          </div>
        )}

        {/* المحتوى الرئيسي */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* منطقة رفع الصور */}
          <div className="border-2 border-dashed border-sky-200 hover:border-sky-400 rounded-3xl p-6 text-center bg-sky-50/40 transition-colors">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectFiles}
              multiple
              accept="image/*"
              className="hidden"
              id="receipt-files-input"
            />
            <label
              htmlFor="receipt-files-input"
              className="cursor-pointer flex flex-col items-center justify-center gap-2"
            >
              <div className="w-14 h-14 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl shadow-sm">
                📷
              </div>
              <span className="text-sm font-bold text-slate-800">
                اضغط لاختيار صورة أو مجموعة صور للوصولات
              </span>
              <span className="text-xs text-slate-500">
                يمكنك تحديد أكثر من وصل معاً، وسيقوم الذكاء الاصطناعي بقراءتها وتنزيل مبالغها فوراً
              </span>
            </label>
          </div>

          {/* أزرار الإجراءات والشريط الإحصائي */}
          {receipts.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div className="flex items-center gap-3 text-xs font-bold text-slate-700">
                <span>إجمالي الوصولات: {receipts.length}</span>
                <span className="text-emerald-700">المكتملة: {successCount}</span>
                {receipts.some((r) => r.status === 'error') && (
                  <span className="text-red-600">
                    أخطاء: {receipts.filter((r) => r.status === 'error').length}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setReceipts([])}
                  disabled={isProcessing}
                  className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-xs font-bold text-slate-600 transition-colors"
                >
                  مسح الكل
                </button>
                <button
                  onClick={handleStartAnalysis}
                  disabled={isProcessing || receipts.length === 0}
                  className="px-4 py-2 bg-[#0e7490] hover:bg-[#085a70] text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>
                        جاري القراءة ({currentProcessingIdx !== null ? currentProcessingIdx + 1 : 0} من {receipts.length})...
                      </span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>قراءة الكل بالذكاء الاصطناعي</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* رسالة النجاح */}
          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center font-bold text-sm">
              🎉 {successMessage}
            </div>
          )}

          {/* جدول مراجعة وتعديل الوصولات */}
          {receipts.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-bold text-xs text-slate-700">قائمة الوصولات والمراجعة السريعة:</h4>
              <div className="space-y-3">
                {receipts.map((rc, idx) => (
                  <div
                    key={rc.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      rc.status === 'processing'
                        ? 'border-sky-400 bg-sky-50/50'
                        : rc.status === 'error'
                        ? 'border-red-200 bg-red-50/40'
                        : rc.status === 'success'
                        ? 'border-emerald-200 bg-white shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                      {/* معاينة الصورة ومعلوماتها */}
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => setPreviewImage(rc.imageUrl)}
                          className="w-14 h-14 rounded-xl border border-slate-200 overflow-hidden cursor-pointer relative bg-slate-100 flex-shrink-0 group"
                          title="اضغط لتكبير الصورة"
                        >
                          <img
                            src={rc.imageUrl}
                            alt="وصل"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold">
                            🔍
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-800">
                              وصل رقم {idx + 1}
                            </span>
                            {rc.receiptNumber && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-semibold">
                                قائمة: {rc.receiptNumber}
                              </span>
                            )}
                            {rc.status === 'success' && (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[10px] font-bold">
                                مكتمل
                              </span>
                            )}
                            {rc.status === 'processing' && (
                              <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded-md text-[10px] font-bold animate-pulse">
                                جاري القراءة...
                              </span>
                            )}
                            {rc.status === 'error' && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-md text-[10px] font-bold">
                                خطأ
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 block truncate max-w-[200px]">
                            {rc.fileName}
                          </span>
                        </div>
                      </div>

                      {/* الحقول المستخرجة والقابلة للتعديل */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-1 w-full md:w-auto">
                        {/* رقم المشترك */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            رقم المشترك
                          </label>
                          <input
                            type="number"
                            value={rc.subscriberId || ''}
                            onChange={(e) =>
                              handleUpdateReceipt(
                                idx,
                                'subscriberId',
                                e.target.value ? parseInt(e.target.value, 10) : undefined
                              )
                            }
                            placeholder="رقم المشترك"
                            className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800"
                          />
                          {rc.matchedSubscriber ? (
                            <span className="text-[10px] text-emerald-700 font-bold block truncate mt-0.5">
                              ✓ {rc.matchedSubscriber.name}
                            </span>
                          ) : rc.subscriberId ? (
                            <span className="text-[10px] text-amber-700 font-semibold block truncate mt-0.5">
                              ⚠️ غير موجود
                            </span>
                          ) : null}
                        </div>

                        {/* اسم المشترك */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            اسم المشترك
                          </label>
                          <input
                            type="text"
                            value={rc.subscriberName || ''}
                            onChange={(e) => handleUpdateReceipt(idx, 'subscriberName', e.target.value)}
                            placeholder="اسم المشترك"
                            className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-slate-800"
                          />
                        </div>

                        {/* المبلغ المسدد */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            المبلغ المسدد
                          </label>
                          <input
                            type="number"
                            value={rc.amount || ''}
                            onChange={(e) =>
                              handleUpdateReceipt(
                                idx,
                                'amount',
                                e.target.value ? parseInt(e.target.value, 10) : undefined
                              )
                            }
                            placeholder="المبلغ"
                            className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-bold text-emerald-700 focus:outline-none focus:border-slate-800"
                          />
                        </div>

                        {/* الفترة المحددة تلقائياً */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            الفترة المستهدفة
                          </label>
                          <select
                            value={rc.periodIndex}
                            onChange={(e) =>
                              handleUpdateReceipt(idx, 'periodIndex', parseInt(e.target.value, 10))
                            }
                            className="w-full h-8 px-1 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-slate-800"
                          >
                            {PERIODS.map((pLabel: string, pIdx: number) => (
                              <option key={pIdx} value={pIdx}>
                                فترة ({pLabel})
                              </option>
                            ))}
                          </select>
                          <span className="text-[10px] text-slate-500 block mt-0.5">
                            سنة: {rc.targetYear || 2026} {rc.paymentMonth ? `(شهر ${rc.paymentMonth})` : ''}
                          </span>
                        </div>
                      </div>

                      {/* زر الحذف */}
                      <button
                        onClick={() => handleRemoveReceipt(idx)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors text-xs flex-shrink-0"
                        title="حذف هذا الوصل"
                      >
                        ✕
                      </button>
                    </div>

                    {rc.errorMessage && (
                      <div className="mt-2 text-[11px] text-red-600 font-medium">
                        ⚠️ {rc.errorMessage}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* الشريط السفلي وزر الاعتماد والتنزيل */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            {successCount > 0 ? (
              <span>
                جاهز لتنزيل <strong className="text-emerald-700">{successCount}</strong> دفعة في الحسابات
              </span>
            ) : (
              <span>قم برفع الصور وقراءتها بالذكاء الاصطناعي أولاً</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleConfirmAndApply}
              disabled={successCount === 0 || isProcessing}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span>💾</span>
              <span>تنزيل جميع الإرساليات في الحسابات</span>
            </button>
          </div>
        </div>
      </div>

      {/* نافذة معاينة وتكبير صورة الوصل */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[10070] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[90vh]">
            <img
              src={previewImage}
              alt="معاينة الوصل"
              className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center font-bold text-sm"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
