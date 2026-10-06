'use client'

import React, { useState, useRef } from 'react'
import { Subscriber, Pricing, BillingRecords, PERIODS } from './MainApp'
import { analyzeReceiptImage, ScannedReceipt, getPeriodIndexFromMonth } from '@/lib/aiReceiptScanner'

export interface ExtendedScannedReceipt extends ScannedReceipt {
  suggestedSubscribers?: Subscriber[]
  updateNameInSystem?: boolean
}

interface ReceiptScannerModalProps {
  onClose: () => void
  apiKeys: string[]
  subscribers: Subscriber[]
  billing: BillingRecords
  pricing: Pricing
  onApplyPayments: (
    paymentsToApply: Array<{
      subId: number
      year: number
      periodIdx: number
      amount: number
    }>,
    nameUpdates?: Array<{ subId: number; newName: string }>
  ) => void
  onUpdateSubscriberName?: (subId: number, newName: string) => void
  onOpenSettings: () => void
}

export default function ReceiptScannerModal({
  onClose,
  apiKeys,
  subscribers,
  billing,
  pricing,
  onApplyPayments,
  onUpdateSubscriberName,
  onOpenSettings
}: ReceiptScannerModalProps) {
  const [receipts, setReceipts] = useState<ExtendedScannedReceipt[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentProcessingIdx, setCurrentProcessingIdx] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // دالة الفرز والترتيب بالتسلسل حسب رقم القائمة أو رقم المشترك
  const sortReceiptsList = (list: ExtendedScannedReceipt[]): ExtendedScannedReceipt[] => {
    return [...list].sort((a, b) => {
      const numA = a.receiptNumber ? parseInt(String(a.receiptNumber).replace(/[^\d]/g, ''), 10) : 0
      const numB = b.receiptNumber ? parseInt(String(b.receiptNumber).replace(/[^\d]/g, ''), 10) : 0
      if (numA && numB) return numA - numB
      return (a.subscriberId || 0) - (b.subscriberId || 0)
    })
  }

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

    const newItems: ExtendedScannedReceipt[] = []
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

  // بدء التحليل بالذكاء الاصطناعي لجميع الوصولات المعلقة مع تسطيرها بالتسلسل
  const handleStartAnalysis = async () => {
    if (apiKeys.length === 0) {
      alert('يرجى إضافة مفتاح الذكاء الاصطناعي في الإعدادات أولاً')
      onOpenSettings()
      return
    }

    setIsProcessing(true)
    setSuccessMessage(null)

    const updatedList = [...receipts]

    for (let i = 0; i < updatedList.length; i++) {
      if (updatedList[i].status === 'success') continue

      setCurrentProcessingIdx(i)
      setReceipts((prev) => {
        const copy = [...prev]
        copy[i] = { ...copy[i], status: 'processing', errorMessage: undefined }
        return copy
      })

      try {
        const item = updatedList[i]
        const result = await analyzeReceiptImage(item.base64Data || item.imageUrl, item.mimeType || 'image/jpeg', apiKeys)

        // مطابقة المشترك في النظام
        const matched = subscribers.find((s) => s.id === result.subscriberId)

        const processedItem: ExtendedScannedReceipt = {
          ...item,
          status: 'success',
          receiptNumber: result.receiptNumber,
          subscriberId: result.subscriberId,
          subscriberName: result.subscriberName || (matched ? matched.name : ''),
          amount: result.amount,
          paymentDay: result.paymentDay,
          paymentMonth: result.paymentMonth,
          paymentYear: result.paymentYear,
          periodIndex: result.periodIndex,
          targetYear: result.targetYear,
          matchedSubscriber: matched ? { id: matched.id, name: matched.name } : undefined
        }

        updatedList[i] = processedItem
        setReceipts([...updatedList])
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'تعذر قراءة الوصل'
        updatedList[i] = { ...updatedList[i], status: 'error', errorMessage: msg }
        setReceipts([...updatedList])
      }
    }

    // تسطير وترتيب الوصولات بالتسلسل تلقائياً حسب رقم القائمة/الوصل
    const sorted = sortReceiptsList(updatedList)
    setReceipts(sorted)

    setIsProcessing(false)
    setCurrentProcessingIdx(null)
  }

  // فرز يدوي بنقرة زر للتسلسل
  const handleManualSort = () => {
    setReceipts((prev) => sortReceiptsList(prev))
  }

  // 1. عند تعديل رقم المشترك: يظهر فوراً الاسم الأصلي المسجل في النظام
  const handleUpdateSubscriberId = (idx: number, idVal: string) => {
    const cleanIdStr = idVal.replace(/[^\d]/g, '')
    const numId = cleanIdStr ? parseInt(cleanIdStr, 10) : undefined

    setReceipts((prev) => {
      const updated = [...prev]
      const current = { ...updated[idx], subscriberId: numId }

      if (numId) {
        const matched = subscribers.find((s) => s.id === numId)
        current.matchedSubscriber = matched ? { id: matched.id, name: matched.name } : undefined
        // إذا كان الاسم فارغاً نملأه تلقائياً باسم المشترك المسجل بالنظام
        if (matched && (!current.subscriberName || current.subscriberName.trim() === '')) {
          current.subscriberName = matched.name
        }
      } else {
        current.matchedSubscriber = undefined
      }

      updated[idx] = current
      return updated
    })
  }

  // اعتماد اسم المشترك المسجل بالنظام في خانة الاسم
  const handleApplyMatchedName = (idx: number) => {
    setReceipts((prev) => {
      const updated = [...prev]
      const current = updated[idx]
      if (current.matchedSubscriber) {
        updated[idx] = {
          ...current,
          subscriberName: current.matchedSubscriber.name,
          updateNameInSystem: false
        }
      }
      return updated
    })
  }

  // 2. عند تعديل اسم المشترك: يبحث في السجل ويقترح المشترك ورقمه
  const handleUpdateSubscriberName = (idx: number, nameVal: string) => {
    setReceipts((prev) => {
      const updated = [...prev]
      const current = { ...updated[idx], subscriberName: nameVal }

      // البحث عن المشتركين المقترحين إذا كتب المستخدم نصاً
      const trimmed = nameVal.trim().toLowerCase()
      if (trimmed.length >= 2) {
        const matchedList = subscribers
          .filter((s) => s.name.toLowerCase().includes(trimmed) || String(s.id).includes(trimmed))
          .slice(0, 4)
        current.suggestedSubscribers = matchedList
      } else {
        current.suggestedSubscribers = []
      }

      updated[idx] = current
      return updated
    })
  }

  // تطبيق اختيار مشترك مقترح من القائمة بنقرة زر
  const handleSelectSuggestedSubscriber = (idx: number, sub: Subscriber) => {
    setReceipts((prev) => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        subscriberId: sub.id,
        subscriberName: sub.name,
        matchedSubscriber: { id: sub.id, name: sub.name },
        suggestedSubscribers: [],
        updateNameInSystem: false
      }
      return updated
    })
  }

  // تعديل باقي الحقول (المبلغ، الفترة)
  const handleUpdateReceiptField = (idx: number, field: keyof ExtendedScannedReceipt, val: any) => {
    setReceipts((prev) => {
      const updated = [...prev]
      const current = { ...updated[idx], [field]: val }

      if (field === 'paymentMonth') {
        const m = Number(val)
        current.periodIndex = getPeriodIndexFromMonth(m)
      }

      updated[idx] = current
      return updated
    })
  }

  // تحديث فوري لاسم المشترك في النظام بضغطة زر
  const handleInstantUpdateNameInSystem = (subId: number, newName: string, idx: number) => {
    if (!subId || !newName.trim()) return
    if (onUpdateSubscriberName) {
      onUpdateSubscriberName(subId, newName.trim())
    }
    // تحديث الحالة محلياً أيضاً
    setReceipts((prev) => {
      const updated = [...prev]
      updated[idx] = {
        ...updated[idx],
        matchedSubscriber: { id: subId, name: newName.trim() },
        updateNameInSystem: false
      }
      return updated
    })
    alert(`تم بنجاح تحديث اسم المشترك رقم (${subId}) في سجلات النظام إلى: "${newName.trim()}"`)
  }

  // حذف وصل من القائمة
  const handleRemoveReceipt = (idx: number) => {
    setReceipts((prev) => prev.filter((_, i) => i !== idx))
  }

  // اعتماد وتنزيل الدفعات وتحديث الأسماء إن وجدت
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

    // جمع التحديثات المطلوبة لأسماء المشتركين
    const nameUpdates: Array<{ subId: number; newName: string }> = []
    validToApply.forEach((r) => {
      if (r.updateNameInSystem && r.subscriberId && r.subscriberName && r.subscriberName.trim()) {
        nameUpdates.push({
          subId: r.subscriberId,
          newName: r.subscriberName.trim()
        })
      }
    })

    onApplyPayments(payload, nameUpdates.length > 0 ? nameUpdates : undefined)
    setSuccessMessage(`تم بنجاح تنزيل ${validToApply.length} وصل في حسابات المشتركين وحفظ التعديلات!`)
    setTimeout(() => {
      onClose()
    }, 1200)
  }

  const successCount = receipts.filter((r) => r.status === 'success').length

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#f0f9ff] text-slate-800 flex flex-col justify-between"
      style={{ fontFamily: 'var(--font-tajawal), Tajawal, Inter, system-ui, -apple-system, sans-serif' }}
    >
      {/* 1. الشريط العلوي الرئيسي للصفحة المستقلة */}
      <header className="sticky top-0 z-30 bg-slate-900 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* زر الرجوع للرئيسية */}
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center gap-1.5 transition-all text-xs font-bold"
          >
            <span className="text-base font-bold">←</span>
            <span>الرجوع للرئيسية</span>
          </button>

          {/* عنوان الصفحة */}
          <div className="flex items-center gap-2">
            <span className="text-base">✨</span>
            <h1 className="font-bold text-sm sm:text-base tracking-tight text-white">
              تنزيل إرساليات بالذكاء الاصطناعي
            </h1>
          </div>

          {/* زر إغلاق دائري */}
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 active:bg-white/30 text-white flex items-center justify-center font-bold text-base transition-colors"
            title="إغلاق والرجوع"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 2. شريط أدوات إضافة الصور وقراءة الكل والتسطير بالتسلسل */}
      <div className="sticky top-14 z-20 bg-white border-b border-sky-100 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleSelectFiles}
            multiple
            accept="image/*"
            className="hidden"
            id="standalone-receipt-files-input"
          />

          {/* زر إضافة صور الوصولات */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="standalone-receipt-files-input"
              className="cursor-pointer h-10 px-4 bg-sky-600 hover:bg-sky-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
            >
              <span className="text-base">📷</span>
              <span>إضافة صور الوصولات</span>
            </label>

            {receipts.length > 1 && (
              <button
                type="button"
                onClick={handleManualSort}
                className="h-10 px-3 bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="ترتيب الوصولات تصاعدياً بالتسلسل حسب رقم الوصل"
              >
                <span>🔢</span>
                <span>تسطير بالتسلسل</span>
              </button>
            )}
          </div>

          {/* أزرار مسح وقراءة الكل */}
          {receipts.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReceipts([])}
                disabled={isProcessing}
                className="h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                مسح الكل
              </button>
              <button
                type="button"
                onClick={handleStartAnalysis}
                disabled={isProcessing}
                className="h-10 px-4 bg-[#0e7490] hover:bg-[#085a70] active:scale-95 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
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
                    <span>قراءة الكل بالذكاء الاصطناعي</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 3. شريط الإحصاء السريع */}
      {receipts.length > 0 && (
        <div className="bg-sky-50 border-b border-sky-100 py-2 px-4 text-xs font-bold text-slate-700">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span>إجمالي الوصولات: <strong className="text-slate-900">{receipts.length}</strong></span>
              <span className="text-emerald-700">جاهزة للتنزيل: <strong>{successCount}</strong></span>
            </div>
            {receipts.some((r) => r.status === 'error') && (
              <span className="text-red-600">
                أخطاء: {receipts.filter((r) => r.status === 'error').length}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 4. محتوى الصفحة الرئيسي */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-4 pb-36">
        {/* تنبيه إذا لم تكن هناك مفاتيح */}
        {apiKeys.length === 0 && (
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between text-xs text-amber-900">
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
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-center font-bold text-sm shadow-sm">
            🎉 {successMessage}
          </div>
        )}

        {/* حالة عدم وجود وصولات */}
        {receipts.length === 0 ? (
          <div className="my-10 p-8 text-center bg-white border border-sky-100 rounded-3xl shadow-sm space-y-3">
            <div className="text-5xl">🧾</div>
            <h3 className="text-base font-bold text-slate-800">
              لا توجد وصولات مضافة حالياً
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              اضغط على زر <strong className="text-sky-700">"📷 إضافة صور الوصولات"</strong> في الأعلى لاختيار صور الوصولات من جهازك، وسيقوم الذكاء الاصطناعي بقراءة القوائم وتسلسلها وتنزيل مبالغها تلقائياً.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-bold text-xs text-slate-700">قائمة الوصولات بالتسلسل ({receipts.length}):</h4>
              <span className="text-[11px] text-slate-500">تم تسطير الوصولات حسب التسلسل المنطقي للقوائم</span>
            </div>

            {receipts.map((rc, idx) => {
              const isNameDifferent =
                rc.matchedSubscriber &&
                rc.subscriberName &&
                rc.matchedSubscriber.name.trim() !== rc.subscriberName.trim()

              return (
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
                        className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0 relative active:scale-95 transition-transform"
                        title="اضغط لتكبير الوصل"
                      >
                        <img
                          src={rc.imageUrl}
                          alt="وصل"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-tl font-bold">
                          🔍
                        </span>
                      </button>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-slate-900">
                            وصل {idx + 1}
                          </span>
                          {rc.receiptNumber && (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[11px] font-mono font-bold border border-slate-200">
                              قائمة #{rc.receiptNumber}
                            </span>
                          )}
                          {rc.status === 'success' && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-bold">
                              ✓ جاهز للتنزيل
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
                        <span className="text-[11px] text-slate-400 block truncate max-w-[220px]">
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
                  <div className="space-y-2 mb-2.5">
                    <div className="flex items-start gap-2">
                      {/* رقم المشترك (خلية صغيرة ومحددة) */}
                      <div className="w-24 sm:w-28 flex-shrink-0">
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          رقم المشترك
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={rc.subscriberId || ''}
                          onChange={(e) => handleUpdateSubscriberId(idx, e.target.value)}
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
                          onChange={(e) => handleUpdateSubscriberName(idx, e.target.value)}
                          placeholder="اكتب أو عدل اسم المشترك..."
                          className="w-full h-9 px-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-800 bg-white"
                        />
                      </div>
                    </div>

                    {/* الميزات الذكية للمطابقة والتنبيهات: */}

                    {/* أ) إذا تم العثور على المشترك بالرقم */}
                    {rc.matchedSubscriber && (
                      <div className="p-2 bg-emerald-50/70 border border-emerald-100 rounded-xl text-[11px] text-emerald-900 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">✓ المشترك المسجل بالنظام:</span>
                          <span className="font-semibold text-emerald-800">{rc.matchedSubscriber.name}</span>
                          <span className="text-[10px] text-emerald-600 font-mono">(رقم {rc.matchedSubscriber.id})</span>
                        </div>

                        {/* إذا كان الاسم المكتوب يختلف عن الاسم المسجل بالسجل */}
                        {isNameDifferent && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleApplyMatchedName(idx)}
                              className="px-2 py-0.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-colors"
                              title="استرجاع الاسم الأصلي المسجل بالسجل"
                            >
                              استرجاع اسم السجل
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleInstantUpdateNameInSystem(rc.subscriberId!, rc.subscriberName!, idx)
                              }
                              className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition-colors"
                              title="تعديل وتحديث الاسم في قاعدة بيانات المشتركين"
                            >
                              ✏️ تعديل الاسم بالسجل
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ب) إذا كان الرقم غير مسجل بالنظام */}
                    {!rc.matchedSubscriber && rc.subscriberId && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900">
                        ⚠️ الرقم ({rc.subscriberId}) غير مسجل في قائمة المشتركين. يمكنك التأكد من الرقم أو البحث باسم المشترك.
                      </div>
                    )}

                    {/* ج) مقترحات البحث التلقائي بالاسم إذا كان الاسم مكتوباً ولكن الرقم لم يُطابق بعد */}
                    {rc.suggestedSubscribers && rc.suggestedSubscribers.length > 0 && (
                      <div className="p-2 bg-sky-50 border border-sky-100 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-sky-900 block">
                          💡 مقترحات المشتركين المسجلين في النظام (اضغط لاختيار الرقم فوراً):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {rc.suggestedSubscribers.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() => handleSelectSuggestedSubscriber(idx, sub)}
                              className="px-2.5 py-1 bg-white border border-sky-200 hover:bg-sky-600 hover:text-white rounded-lg text-[11px] font-bold text-slate-800 flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                              <span className="font-mono text-sky-700 font-bold">{sub.id}</span>
                              <span>- {sub.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
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
                          handleUpdateReceiptField(
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
                          handleUpdateReceiptField(idx, 'periodIndex', parseInt(e.target.value, 10))
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
              )
            })}
          </div>
        )}
      </main>

      {/* 5. الشريط السفلي الثابت والواضح جداً (حفظ وتنزيل الإرساليات) */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-6px_25px_rgba(0,0,0,0.12)] p-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-12 px-4 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-2xl text-xs font-bold transition-colors"
          >
            إلغاء ورجوع
          </button>

          {/* زر حفظ وتنزيل الإرساليات الكبير والبارز دائماً */}
          <button
            type="button"
            onClick={handleConfirmAndApply}
            disabled={successCount === 0 || isProcessing}
            className="flex-1 h-12 px-4 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-2xl text-sm font-bold shadow-lg transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <span className="text-lg">💾</span>
            <span>تنزيل وحفظ جميع الإرساليات بالحسابات ({successCount})</span>
          </button>
        </div>
      </footer>

      {/* 6. نافذة تكبير الصورة النظيفة مع زر إغلاق أحمر عملاق وواضح */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-between p-3 select-none"
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
    </div>
  )
}
