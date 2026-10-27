'use client'

import React, { useState, useRef, useEffect } from 'react'
import { InspectionRecord, InspectionImage } from '@/lib/inspectionTypes'
import { compressAndConvertToWebP } from '@/lib/imageCompressor'
import { addInspectionRecord } from '@/lib/inspectionStore'
import {
  Camera,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  FileText,
  X,
  Sparkles,
  Send,
  ImagePlus
} from 'lucide-react'

interface WriterCollectorInspectionModalProps {
  isOpen: boolean
  onClose: () => void
  userRole: 'writer' | 'collector' | 'manager'
  userName: string
  branchId?: string
  branchName?: string
}

export default function WriterCollectorInspectionModal({
  isOpen,
  onClose,
  userRole,
  userName,
  branchId,
  branchName
}: WriterCollectorInspectionModalProps) {
  const [reportText, setReportText] = useState('')
  const [images, setImages] = useState<InspectionImage[]>([])
  const [isCompressing, setIsCompressing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // موضع الزر العائم القابل للتحريك
  const [fabPosition, setFabPosition] = useState<{ x: number; y: number }>({ x: 24, y: 24 })
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 24,
    initialY: 24
  })

  // بدء سحب الزر
  const handleDragStart = (clientX: number, clientY: number) => {
    isDraggingRef.current = false
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: fabPosition.x,
      initialY: fabPosition.y
    }

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY

      const deltaX = dragStartRef.current.startX - currentX
      const deltaY = dragStartRef.current.startY - currentY

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        isDraggingRef.current = true
      }

      setFabPosition({
        x: Math.max(10, Math.min(window.innerWidth - 80, dragStartRef.current.initialX + deltaX)),
        y: Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.initialY + deltaY))
      })
    }

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onEnd)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onEnd)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onEnd)
  }

  if (!isOpen) return null

  // معالجة واختيار الصور وضغطها تلقائياً إلى WebP
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return

    setIsCompressing(true)
    setErrorMessage(null)

    try {
      const newImages: InspectionImage[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const compressed = await compressAndConvertToWebP(file, 1280, 0.15)
        newImages.push({
          id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          dataUrl: compressed.dataUrl,
          name: file.name,
          createdAt: new Date().toISOString(),
          sizeBytes: compressed.compressedSize
        })
      }
      setImages((prev) => [...prev, ...newImages])
    } catch (err: unknown) {
      setErrorMessage('حدث خطأ أثناء معالجة وضغط الصور')
    } finally {
      setIsCompressing(false)
    }
  }

  // حذف صورة من القائمة
  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  // إرسال تقرير الكشف
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!reportText.trim()) {
      setErrorMessage('يرجى كتابة نص الكشف أولاً')
      return
    }

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const now = new Date()
      const formattedDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
      const inspectionId = `insp_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`
      const token = `tok_${Math.random().toString(36).substr(2, 12)}`

      const newRecord: InspectionRecord = {
        id: inspectionId,
        token: token,
        branchId: branchId,
        branchName: branchName || 'مركز جباية واردات أبي الخصيب',
        writerOrCollectorName: userName,
        userRole: userRole,
        rawReportText: reportText.trim(),
        images: images,
        createdAt: now.toISOString(),
        citizenName: '',
        inspectionDate: formattedDate,
        tableData: {
          sequence: 1,
          governorate: 'البصرة',
          district: branchName ? branchName.replace('فرع واردات ', '').replace('مركز جباية واردات ', '') : 'ابي الخصيب',
          neighborhood: '',
          plotNumber: '',
          sectorNumber: ''
        },
        reportPoints: [reportText.trim()],
        inspectorEmployeeName: userName,
        networksManagerName: '',
        revenuesManagerName: 'حسين علي لفتة جابر',
        typistName: 'نور جبار',
        status: 'pending',
        updatedAt: now.toISOString()
      }

      await addInspectionRecord(newRecord)

      setSuccessMessage('تم إرسال تقرير الكشف بنجاح للمدير ومسؤول الواردات!')
      setTimeout(() => {
        setReportText('')
        setImages([])
        setSuccessMessage(null)
        onClose()
      }, 1800)
    } catch (err: unknown) {
      setErrorMessage('حدث خطأ أثناء رفع التقرير، يرجى المحاولة مرة أخرى')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
      dir="rtl"
    >
      {/* الحاوية بالكامل بكبر الشاشة وستايل زجاجي أبيض شفاف فاخر */}
      <div
        className="relative w-full max-w-5xl rounded-3xl shadow-[0_25px_80px_rgba(0,0,0,0.18)] overflow-hidden my-auto border border-white/80 bg-white/85 backdrop-blur-3xl text-slate-900 flex flex-col"
        style={{ minHeight: '85vh' }}
      >
        {/* رأس النافذة الزجاجي الأبيض الشفاف */}
        <header className="px-6 py-4 border-b border-slate-200/80 bg-white/70 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-50 text-blue-700 border border-blue-200 rounded-2xl flex items-center justify-center shadow-xs">
              <FileText className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              {/* العنوان: كشف جديد */}
              <h1 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight">
                كشف جديد
              </h1>
              {/* إظهار اسم الشخص فقط مباشرة */}
              <p className="text-xs font-bold text-slate-700 mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-black text-slate-900 text-sm">{userName}</span>
              </p>
            </div>
          </div>

          {/* زر الإغلاق الدائري النظيف */}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 flex items-center justify-center transition-all border border-slate-200 shadow-xs cursor-pointer active:scale-95"
            title="إغلاق"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </header>

        {/* جسم النموذج */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6 flex-1 flex flex-col justify-between">
          <div className="space-y-6">
            {successMessage && (
              <div className="bg-emerald-50 border-2 border-emerald-400 text-emerald-950 p-4 rounded-2xl flex items-center gap-3 animate-fade-in text-sm font-black shadow-sm">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="bg-rose-50 border-2 border-rose-300 text-rose-950 p-4 rounded-2xl flex items-center gap-3 text-sm font-black shadow-sm">
                <AlertCircle className="w-6 h-6 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* نص الكشف */}
            <div>
              <label className="block text-base sm:text-lg font-black text-slate-950 mb-2">
                نص الكشف
              </label>
              <textarea
                rows={7}
                value={reportText}
                onChange={(e) => setReportText(e.target.value)}
                placeholder="اكتب تفاصيل الكشف الميداني هنا... (مثال: بالإشارة إلى الكشف الموقعي للعقار، تبين أن موقع العقار عبارة قطعة ارض فارغة بمساحة ١٥٠ متر وخالية من المشيدات تماماً ولا يوجد ماء...)"
                className="w-full bg-white/95 border-2 border-slate-300 hover:border-blue-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 rounded-2xl p-4 text-base sm:text-lg font-bold text-slate-950 leading-relaxed placeholder:text-slate-400 placeholder:font-normal resize-y outline-none shadow-inner transition-all"
                required
              />
              {/* التوجيه بسطر واحد فقط كما طلب المستخدم */}
              <p className="text-xs sm:text-sm font-bold text-slate-700 mt-2 bg-blue-50/70 p-2.5 rounded-xl border border-blue-200/80 flex items-center gap-2 whitespace-nowrap overflow-x-auto">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                <span>اكتب بأسلوبك الذكاء اصطناعي سيعدل</span>
              </p>
            </div>

            {/* اختيار الصور - شكل عصري جديد وبسيط */}
            <div>
              <label className="block text-base font-black text-slate-950 mb-2.5">
                صور العقار
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2.5 bg-white/95 hover:bg-blue-50 text-slate-900 px-6 py-3.5 rounded-2xl text-sm sm:text-base font-black cursor-pointer transition-all shadow-sm border-2 border-slate-300 hover:border-blue-500 active:scale-95 group">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 group-hover:bg-blue-600 text-blue-700 group-hover:text-white flex items-center justify-center transition-colors">
                    <ImagePlus className="w-5 h-5 stroke-[2.2]" />
                  </div>
                  <span>اختيار الصور</span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={isCompressing || isSubmitting}
                  />
                </label>

                {isCompressing && (
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800 bg-amber-50 px-4 py-2.5 rounded-xl border border-amber-300 animate-pulse">
                    <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                    <span>جاري ضغط وتحويل الصور إلى صيغة WebP...</span>
                  </div>
                )}
              </div>

              {/* معاينة الصور المرفوعة */}
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {images.map((img, idx) => (
                    <div
                      key={img.id || idx}
                      className="relative group rounded-2xl overflow-hidden border-2 border-slate-200 bg-white aspect-video flex items-center justify-center shadow-xs"
                    >
                      <img
                        src={img.dataUrl}
                        alt={`صورة ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-xl text-xs font-bold transition shadow-md active:scale-95"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="absolute bottom-1 right-1 bg-black/80 text-[10px] text-white font-mono px-2 py-0.5 rounded-md">
                        {Math.round((img.sizeBytes || 0) / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="pt-6" />
        </form>

        {/* زر رفع التقرير الدائري / الكبسولة العائمة القابل للتحريك بالسحب والألوان الحية الفائقة الوضوح */}
        <div
          className="fixed z-50 select-none cursor-move touch-none"
          style={{
            bottom: `${fabPosition.y}px`,
            left: `${fabPosition.x}px`
          }}
          onMouseDown={(e) => handleDragStart(e.clientX, e.clientY)}
          onTouchStart={(e) => handleDragStart(e.touches[0].clientX, e.touches[0].clientY)}
        >
          <button
            type="button"
            onClick={() => {
              if (!isDraggingRef.current) {
                handleSubmit()
              }
            }}
            disabled={isSubmitting || isCompressing}
            className="flex items-center gap-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black px-6 py-4 rounded-full shadow-[0_12px_35px_rgba(5,150,105,0.45)] border-2 border-white ring-4 ring-emerald-200/50 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="انقر لرفع التقرير، أو اسحب الزر لتغيير مكانه"
          >
            {isSubmitting ? (
              <>
                <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-base font-black">جاري الرفع...</span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <Send className="w-5 h-5 text-white stroke-[2.5]" />
                </div>
                <span className="text-base sm:text-lg font-black tracking-wide">
                  رفع التقرير للمدير
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
