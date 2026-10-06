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
          const maxDim = 1400
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
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
    <>
      {/* النافذة الرئيسية مع أعلى z-index لتغطي كامل الهاتف بدون أي تداخل */}
      <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 select-none">
        <div className="bg-white w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-3xl sm:rounded-3xl rounded-none shadow-2xl flex flex-col border border-sky-100 overflow-hidden">
          
          {/* شريط العنوان العلوي المدمج والأنيق */}
          <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <span className="text-base">✨</span>
              <div>
                <h3 className="font-bold text-sm leading-tight">تنزيل إرساليات بالذكاء الاصطناعي</h3>
                <p className="text-[10px] text-slate-300">قراءة وصولات الماء وتنزيل مبالغها تلقائياً</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-colors text-sm font-bold"
              title="إغلاق"
            >
              ✕
            </button>
          </div>

          {/* تنبيه إذا لم تكن هناك مفاتيح */}
          {apiKeys.length === 0 && (
            <div className="m-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900 flex-shrink-0">
              <span className="text-[11px] font-medium">⚠️ لم تقم بإضافة مفتاح الذكاء الاصطناعي بعد في الإعدادات.</span>
              <button
                onClick={() => {
                  onClose()
                  onOpenSettings()
                }}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] transition-colors"
              >
                إضافة مفتاح
              </button>
            </div>
          )}

          {/* شريط إضافة الصور المدمج والأنيق (زر صغير مو بلوك ضخم) */}
          <div className="px-3 py-2.5 bg-sky-50/50 border-b border-sky-100 flex items-center justify-between gap-2 flex-shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectFiles}
              multiple
              accept="image/*"
              className="hidden"
              id="compact-receipt-input"
            />

            <label
              htmlFor="compact-receipt-input"
              className="cursor-pointer h-9 px-3.5 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <span>📷</span>
              <span>إضافة صور الوصولات</span>
            </label>

            {receipts.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setReceipts([])}
                  disabled={isProcessing}
                  className="h-9 px-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-medium transition-colors"
                  title="مسح كل الوصولات"
                >
                  مسح
                </button>
                <button
                  onClick={handleStartAnalysis}
                  disabled={isProcessing}
                  className="h-9 px-3 bg-[#0e7490] hover:bg-[#085a70] active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span className="text-[11px]">
                        ({currentProcessingIdx !== null ? currentProcessingIdx + 1 : 0}/{receipts.length})
                      </span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>قراءة الكل</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* شريط الإحصاء السريع المدمج */}
          {receipts.length > 0 && (
            <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[11px] font-bold text-slate-600 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span>الوصولات: <strong className="text-slate-900">{receipts.length}</strong></span>
                <span className="text-emerald-700">المكتملة: <strong>{successCount}</strong></span>
              </div>
              {receipts.some((r) => r.status === 'error') && (
                <span className="text-red-600">
                  أخطاء: {receipts.filter((r) => r.status === 'error').length}
                </span>
              )}
            </div>
          )}

          {/* محتوى قائمة الوصولات (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-2.5 sm:p-4 space-y-2.5">
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-center font-bold text-xs">
                🎉 {successMessage}
              </div>
            )}

            {receipts.length === 0 ? (
              <div className="py-12 px-4 text-center text-slate-400 space-y-2">
                <div className="text-3xl">🧾</div>
                <div className="text-xs font-bold text-slate-600">لم تقم بإضافة أي وصولات بعد</div>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-relaxed">
                  اضغط على زر <strong className="text-sky-700">"إضافة صور الوصولات"</strong> في الأعلى لاختيار صور الوصولات من جهازك وسيقوم الذكاء الاصطناعي بقراءتها وتنزيلها فوراً.
                </p>
              </div>
            ) : (
              receipts.map((rc, idx) => (
                <div
                  key={rc.id}
                  className={`p-2.5 rounded-2xl border transition-all ${
                    rc.status === 'processing'
                      ? 'border-sky-400 bg-sky-50/50'
                      : rc.status === 'error'
                      ? 'border-red-200 bg-red-50/40'
                      : rc.status === 'success'
                      ? 'border-emerald-200 bg-white shadow-sm'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* رأس بطاقة الوصل: المصغّر + معلومات الوصل + زر الحذف */}
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      {/* صورة مصغرة قابلة للنقر مع تنبيه واضح للتكبير */}
                      <button
                        type="button"
                        onClick={() => setPreviewImage(rc.imageUrl)}
                        className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0 relative active:scale-95 transition-transform"
                        title="اضغط لتكبير الوصل"
                      >
                        <img
                          src={rc.imageUrl}
                          alt="وصل"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-tl">
                          🔍
                        </span>
                      </button>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900">
                            وصل {idx + 1}
                          </span>
                          {rc.receiptNumber && (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-mono font-bold">
                              #{rc.receiptNumber}
                            </span>
                          )}
                          {rc.status === 'success' && (
                            <span className="text-emerald-700 font-bold text-[10px]">
                              ✓ جاهز
                            </span>
                          )}
                          {rc.status === 'processing' && (
                            <span className="text-sky-600 font-bold text-[10px] animate-pulse">
                              جاري القراءة...
                            </span>
                          )}
                          {rc.status === 'error' && (
                            <span className="text-red-600 font-bold text-[10px]">
                              خطأ
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* زر حذف الوصل */}
                    <button
                      onClick={() => handleRemoveReceipt(idx)}
                      className="w-6 h-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors text-xs"
                      title="حذف هذا الوصل"
                    >
                      ✕
                    </button>
                  </div>

                  {/* الحقول: السطر الأول (رقم المشترك صغير + اسم المشترك كبير وعريض) */}
                  <div className="flex items-start gap-2 mb-2">
                    {/* رقم المشترك: خلية صغيرة وواضحة */}
                    <div className="w-24 flex-shrink-0">
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
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
                        placeholder="الرقم"
                        className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 text-center focus:outline-none focus:border-slate-800 bg-white"
                      />
                    </div>

                    {/* اسم المشترك: خلية كبيرة وعريضة تتسع للاسم الرباعي */}
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                        اسم المشترك
                      </label>
                      <input
                        type="text"
                        value={rc.subscriberName || ''}
                        onChange={(e) => handleUpdateReceipt(idx, 'subscriberName', e.target.value)}
                        placeholder="اسم المشترك المقروء..."
                        className="w-full h-8 px-2.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800 bg-white"
                      />
                      {rc.matchedSubscriber ? (
                        <div className="text-[10px] text-emerald-700 font-bold truncate mt-0.5">
                          ✓ مطابق للنظام: {rc.matchedSubscriber.name}
                        </div>
                      ) : rc.subscriberId ? (
                        <div className="text-[10px] text-amber-700 font-semibold truncate mt-0.5">
                          ⚠️ الرقم غير مسجل بالقائمة
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* السطر الثاني: المبلغ المسدد + الفترة المستهدفة */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* المبلغ المسدد */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                        المبلغ المسدد (دينار)
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
                        className="w-full h-8 px-2 border border-slate-200 rounded-lg text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-slate-800 bg-white"
                      />
                    </div>

                    {/* الفترة المستهدفة */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                        الفترة المستهدفة
                      </label>
                      <select
                        value={rc.periodIndex}
                        onChange={(e) =>
                          handleUpdateReceipt(idx, 'periodIndex', parseInt(e.target.value, 10))
                        }
                        className="w-full h-8 px-1.5 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-slate-800"
                      >
                        {PERIODS.map((pLabel: string, pIdx: number) => (
                          <option key={pIdx} value={pIdx}>
                            فترة ({pLabel})
                          </option>
                        ))}
                      </select>
                      <span className="text-[9px] text-slate-500 block mt-0.5">
                        سنة: {rc.targetYear || 2026} {rc.paymentMonth ? `(شهر ${rc.paymentMonth})` : ''}
                      </span>
                    </div>
                  </div>

                  {rc.errorMessage && (
                    <div className="mt-1.5 text-[10px] text-red-600 font-medium">
                      ⚠️ {rc.errorMessage}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* الشريط السفلي الثابت مع احتساب شريط الهاتف بأمان (Sticky Safe Footer) */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-shrink-0 pb-[max(12px,env(safe-area-inset-bottom))]">
            <button
              onClick={onClose}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-100 active:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              إلغاء
            </button>

            <button
              onClick={handleConfirmAndApply}
              disabled={successCount === 0 || isProcessing}
              className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <span>💾</span>
              <span>تنزيل الإرساليات بالحسابات ({successCount})</span>
            </button>
          </div>
        </div>
      </div>

      {/* نافذة معاينة وتكبير صورة الوصل مع زر إغلاق عملاق ومريح جداً */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[100005] bg-black/95 flex flex-col items-center justify-between p-3 select-none"
        >
          {/* شريط الإغلاق العلوي البارز جداً */}
          <div className="w-full max-w-lg flex justify-between items-center py-2 px-1 flex-shrink-0">
            <span className="text-xs text-white/80 font-bold">معاينة صورة الوصل</span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(null)
              }}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg"
            >
              <span>✕</span>
              <span>إغلاق الصورة</span>
            </button>
          </div>

          {/* حاوية الصورة المتجاوبة والمضبوطة تماماً داخل الشاشة */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center w-full max-w-lg overflow-hidden py-2"
          >
            <img
              src={previewImage}
              alt="معاينة الوصل"
              className="max-w-[95vw] max-h-[75vh] rounded-xl object-contain shadow-2xl border border-white/10"
            />
          </div>

          {/* زر سفلي إضافي للإغلاق باللمس السريع */}
          <div className="py-2 flex-shrink-0">
            <button
              onClick={() => setPreviewImage(null)}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold"
            >
              اضغط هنا أو على أي مكان للإغلاق
            </button>
          </div>
        </div>
      )}
    </>
  )
}
