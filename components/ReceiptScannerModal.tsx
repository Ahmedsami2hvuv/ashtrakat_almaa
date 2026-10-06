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
      {/* صفحة مستقلة كاملة ملء الشاشة مع تمرير طبيعي 100% */}
      <div
        dir="rtl"
        className="fixed inset-0 z-[10050] bg-[#f0f9ff] flex flex-col overflow-hidden"
        style={{ fontFamily: 'var(--font-tajawal), Tajawal, Inter, system-ui, sans-serif' }}
      >
        {/* شريط العنوان العلوي الثابت مع زر الرجوع السريع */}
        <header className="sticky top-0 z-20 bg-slate-900 text-white border-b border-slate-800 shadow-md flex-shrink-0">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 h-[56px] flex items-center justify-between gap-2">
            
            {/* زر الرجوع للرئيسية */}
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center gap-1.5 transition-all text-xs font-bold"
              title="الرجوع للرئيسية"
            >
              <span className="text-sm">←</span>
              <span>رجوع</span>
            </button>

            {/* عنوان الصفحة */}
            <div className="flex items-center gap-2 text-center">
              <span className="text-base">✨</span>
              <h2 className="font-bold text-[14px] sm:text-base tracking-tight">
                تنزيل إرساليات بالذكاء الاصطناعي
              </h2>
            </div>

            {/* مساحة توازن */}
            <div className="w-16 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center font-bold text-sm"
                title="إغلاق الصفحة"
              >
                ✕
              </button>
            </div>
          </div>
        </header>

        {/* شريط الأدوات المدمج لإضافة الصور وقراءة الكل */}
        <div className="bg-white border-b border-sky-100 shadow-xs flex-shrink-0">
          <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleSelectFiles}
              multiple
              accept="image/*"
              className="hidden"
              id="page-receipt-files-input"
            />

            {/* زر إضافة صور الوصولات (زر صغير ومباشر) */}
            <label
              htmlFor="page-receipt-files-input"
              className="cursor-pointer h-10 px-4 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <span className="text-sm">📷</span>
              <span>إضافة صور الوصولات</span>
            </label>

            {/* أزرار مسح وقراءة الكل */}
            {receipts.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReceipts([])}
                  disabled={isProcessing}
                  className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  مسح
                </button>
                <button
                  type="button"
                  onClick={handleStartAnalysis}
                  disabled={isProcessing}
                  className="h-10 px-4 bg-[#0e7490] hover:bg-[#085a70] active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                      <span>
                        جاري القراءة ({currentProcessingIdx !== null ? currentProcessingIdx + 1 : 0}/{receipts.length})
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
        </div>

        {/* شريط الإحصاء المدمج */}
        {receipts.length > 0 && (
          <div className="bg-sky-50/70 border-b border-sky-100 py-1.5 px-4 text-xs font-bold text-slate-700 flex-shrink-0">
            <div className="max-w-4xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span>إجمالي الوصولات: <strong className="text-slate-900">{receipts.length}</strong></span>
                <span className="text-emerald-700">المكتملة: <strong>{successCount}</strong></span>
              </div>
              {receipts.some((r) => r.status === 'error') && (
                <span className="text-red-600">
                  أخطاء: {receipts.filter((r) => r.status === 'error').length}
                </span>
              )}
            </div>
          </div>
        )}

        {/* محتوى الصفحة الرئيسي مع سكرول طبيعي وتام وسلس لأعلى ولأسفل */}
        <main className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5 max-w-4xl w-full mx-auto pb-32">
          
          {/* تنبيه إذا لم تكن هناك مفاتيح */}
          {apiKeys.length === 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
              <span className="font-semibold">⚠️ لم تقم بإضافة مفتاح الذكاء الاصطناعي بعد في الإعدادات.</span>
              <button
                onClick={() => {
                  onClose()
                  onOpenSettings()
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs transition-colors"
              >
                إضافة مفتاح
              </button>
            </div>
          )}

          {/* رسالة النجاح */}
          {successMessage && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center font-bold text-sm shadow-sm">
              🎉 {successMessage}
            </div>
          )}

          {/* حالة عدم وجود وصولات */}
          {receipts.length === 0 ? (
            <div className="my-10 p-8 text-center bg-white border border-sky-100 rounded-3xl shadow-sm space-y-3">
              <div className="text-4xl">🧾</div>
              <h3 className="text-base font-bold text-slate-800">
                لا توجد وصولات مضافة حالياً
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                اضغط على زر <strong className="text-sky-700">"📷 إضافة صور الوصولات"</strong> في الأعلى لاختيار صور الوصولات من هاتفك، وسيقوم الذكاء الاصطناعي بقراءة أرقام المشتركين والمبالغ والفترات وتنزيلها تلقائياً.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h4 className="font-bold text-xs text-slate-700">قائمة الوصولات ({receipts.length}):</h4>
                <span className="text-[11px] text-slate-500">يمكنك مراجعة وتعديل أي حقل قبل الحفظ</span>
              </div>

              {receipts.map((rc, idx) => (
                <div
                  key={rc.id}
                  className={`p-3.5 rounded-2xl border transition-all ${
                    rc.status === 'processing'
                      ? 'border-sky-400 bg-sky-50/50 ring-2 ring-sky-200'
                      : rc.status === 'error'
                      ? 'border-red-200 bg-red-50/40'
                      : rc.status === 'success'
                      ? 'border-emerald-200 bg-white shadow-sm'
                      : 'border-slate-200 bg-white shadow-xs'
                  }`}
                >
                  {/* شريط عنوان البطاقة والمصغّر */}
                  <div className="flex items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      {/* مصغر الصورة مع إمكانية التكبير */}
                      <button
                        type="button"
                        onClick={() => setPreviewImage(rc.imageUrl)}
                        className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0 relative active:scale-95 transition-transform group"
                        title="اضغط لتكبير الوصل"
                      >
                        <img
                          src={rc.imageUrl}
                          alt="وصل"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-tl font-bold">
                          🔍
                        </span>
                      </button>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">
                            وصل رقم {idx + 1}
                          </span>
                          {rc.receiptNumber && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[11px] font-mono font-bold">
                              قائمة #{rc.receiptNumber}
                            </span>
                          )}
                          {rc.status === 'success' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                              ✓ مكتمل
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
                        <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                          {rc.fileName}
                        </span>
                      </div>
                    </div>

                    {/* زر حذف الوصل */}
                    <button
                      type="button"
                      onClick={() => handleRemoveReceipt(idx)}
                      className="w-8 h-8 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 flex items-center justify-center transition-colors text-sm"
                      title="حذف هذا الوصل"
                    >
                      ✕
                    </button>
                  </div>

                  {/* الحقول: السطر الأول (رقم المشترك صغير + اسم المشترك كبير وعريض) */}
                  <div className="flex items-start gap-2 mb-2.5">
                    {/* رقم المشترك (خلية صغيرة) */}
                    <div className="w-24 sm:w-28 flex-shrink-0">
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
                        placeholder="الرقم"
                        className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 text-center focus:outline-none focus:border-slate-800 bg-white"
                      />
                    </div>

                    {/* اسم المشترك (خلية عريضة وكبيرة) */}
                    <div className="flex-1 min-w-0">
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        اسم المشترك
                      </label>
                      <input
                        type="text"
                        value={rc.subscriberName || ''}
                        onChange={(e) => handleUpdateReceipt(idx, 'subscriberName', e.target.value)}
                        placeholder="اسم المشترك المقروء..."
                        className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800 bg-white"
                      />
                      {rc.matchedSubscriber ? (
                        <div className="text-[10px] text-emerald-700 font-bold truncate mt-1">
                          ✓ مطابق في النظام: {rc.matchedSubscriber.name}
                        </div>
                      ) : rc.subscriberId ? (
                        <div className="text-[10px] text-amber-700 font-semibold truncate mt-1">
                          ⚠️ غير مسجل بقائمة المشتركين
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* السطر الثاني: المبلغ المسدد + الفترة المستهدفة */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* المبلغ المسدد */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        المبلغ المسدد (د.ع)
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
                        className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-slate-800 bg-white"
                      />
                    </div>

                    {/* الفترة المستهدفة */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 block mb-1">
                        الفترة المستهدفة
                      </label>
                      <select
                        value={rc.periodIndex}
                        onChange={(e) =>
                          handleUpdateReceipt(idx, 'periodIndex', parseInt(e.target.value, 10))
                        }
                        className="w-full h-9 px-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-slate-800"
                      >
                        {PERIODS.map((pLabel: string, pIdx: number) => (
                          <option key={pIdx} value={pIdx}>
                            فترة ({pLabel})
                          </option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 block mt-1">
                        سنة {rc.targetYear || 2026} {rc.paymentMonth ? `(شهر ${rc.paymentMonth})` : ''}
                      </span>
                    </div>
                  </div>

                  {rc.errorMessage && (
                    <div className="mt-2 text-[11px] text-red-600 font-medium">
                      ⚠️ {rc.errorMessage}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        {/* الشريط السفلي الثابت والواضح لحفظ المعلومات وتنزيل الإرساليات */}
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-4px_25px_rgba(0,0,0,0.1)] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-12 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-2xl text-xs font-bold transition-colors"
            >
              إلغاء ورجوع
            </button>

            {/* زر حفظ وتنزيل الإرساليات الكبير والواضح */}
            <button
              type="button"
              onClick={handleConfirmAndApply}
              disabled={successCount === 0 || isProcessing}
              className="flex-1 h-12 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <span className="text-base">💾</span>
              <span>تنزيل وحفظ جميع الإرساليات بالحسابات ({successCount})</span>
            </button>
          </div>
        </footer>
      </div>

      {/* نافذة تكبير الصورة النظيفة مع زر إغلاق أحمر عملاق وواضح */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-[100050] bg-black/95 flex flex-col items-center justify-between p-3 select-none"
        >
          {/* شريط الإغلاق العلوي */}
          <div className="w-full max-w-xl flex justify-between items-center py-2 px-1 flex-shrink-0">
            <span className="text-xs text-white/80 font-bold">معاينة صورة الوصل</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setPreviewImage(null)
              }}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xl"
            >
              <span>✕</span>
              <span>إغلاق الصورة</span>
            </button>
          </div>

          {/* حاوية الصورة المتجاوبة */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center w-full max-w-xl overflow-hidden py-2"
          >
            <img
              src={previewImage}
              alt="معاينة الوصل"
              className="max-w-[95vw] max-h-[75vh] rounded-2xl object-contain shadow-2xl border border-white/10"
            />
          </div>

          {/* زر سفلي للإغلاق السريع */}
          <div className="py-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold"
            >
              اضغط هنا أو على أي مكان لإغلاق الصورة
            </button>
          </div>
        </div>
      )}
    </>
  )
}
