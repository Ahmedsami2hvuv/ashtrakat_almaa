'use client'

import React, { useState } from 'react'
import { InspectionRecord, InspectionImage } from '@/lib/inspectionTypes'
import { compressAndConvertToWebP } from '@/lib/imageCompressor'
import { addInspectionRecord } from '@/lib/inspectionStore'
import { Camera, Upload, Trash2, CheckCircle2, AlertCircle, FileText, X, Sparkles, XCircle, Send } from 'lucide-react'

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
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reportText.trim()) {
      setErrorMessage('يرجى كتابة نص التقرير الخاص بالعقار أولاً')
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
        typistName: userName,
        status: 'pending',
        updatedAt: now.toISOString()
      }

      await addInspectionRecord(newRecord)

      setSuccessMessage('تم إرسال تقرير الكشف والصور بنجاح للمدير ومسؤول الواردات!')
      setTimeout(() => {
        setReportText('')
        setImages([])
        setSuccessMessage(null)
        onClose()
      }, 2000)
    } catch (err: unknown) {
      setErrorMessage('حدث خطأ أثناء رفع التقرير، يرجى المحاولة مرة أخرى')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      style={{
        backgroundColor: 'rgba(5, 10, 25, 0.45)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}
      dir="rtl"
    >
      {/* الحاوية الزجاجية الشفافة الفخمة (Glassmorphism Container) */}
      <div
        className="relative max-w-2xl w-full rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.5)] overflow-hidden my-auto border border-white/30"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%)',
          backdropFilter: 'blur(25px)',
          WebkitBackdropFilter: 'blur(25px)'
        }}
      >
        {/* شريط الإضاءة العلوي المنعكس على الزجاج */}
        <div className="absolute top-0 right-0 left-0 h-[2px] bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-80" />

        {/* رأس النافذة الزجاجي */}
        <div
          className="p-5 border-b border-white/15 flex items-center justify-between"
          style={{ background: 'rgba(15, 23, 42, 0.4)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-sky-500/20 text-sky-300 border border-sky-400/40 rounded-2xl flex items-center justify-center shadow-inner">
              <FileText className="w-6 h-6 text-sky-300" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white drop-shadow-md">
                إجراء ورفع كشف موقعي جديد
              </h2>
              <p className="text-xs text-sky-200/90 font-bold mt-0.5">
                القائم بالكشف: <span className="text-white bg-white/20 px-2 py-0.5 rounded-md">{userName}</span> ({userRole === 'writer' ? 'كاتب' : 'محصل'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-rose-600 text-white flex items-center justify-center transition-all border border-white/20 hover:scale-105 active:scale-95 shadow-md"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جسم النموذج */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-6">
          {successMessage && (
            <div className="bg-emerald-500/30 border border-emerald-400/60 text-emerald-100 p-4 rounded-2xl flex items-center gap-3 animate-fade-in text-sm font-black shadow-lg backdrop-blur-md">
              <CheckCircle2 className="w-6 h-6 text-emerald-300 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-500/30 border border-rose-400/60 text-rose-100 p-4 rounded-2xl flex items-center gap-3 text-sm font-black shadow-lg backdrop-blur-md">
              <AlertCircle className="w-6 h-6 text-rose-300 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* نص التقرير - مع تباين فائق 100% وخلفية داكنة واضحة ومستقرة تماماً */}
          <div>
            <label className="block text-sm sm:text-base font-black text-white drop-shadow mb-2 flex items-center gap-2">
              <span>📝 نص تقرير الكشف الموقعي:</span>
              <span className="text-xs font-normal text-sky-200">(اكتب التقرير بوضوح)</span>
            </label>
            <textarea
              rows={6}
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="اكتب تفاصيل الكشف هنا... (مثال: بناءً على طلب الكشف المقدم بخصوص الدار العائدة للمواطن حسين قدوري الكائنة في منطقة العوجة مقاطعة شيخ إبراهيم، قمنا بإجراء الكشف وتبين أنها مغلقة وقابلة للسقوط ولا يوجد ماء...)"
              style={{
                backgroundColor: 'rgba(11, 18, 38, 0.92)',
                color: '#ffffff',
                caretColor: '#38bdf8'
              }}
              className="w-full border-2 border-sky-400/60 focus:border-sky-300 focus:ring-4 focus:ring-sky-400/20 rounded-2xl p-4 text-base font-bold leading-relaxed placeholder:text-slate-400 placeholder:font-normal resize-none outline-none shadow-2xl transition-all"
              required
            />
            <p className="text-xs text-sky-100 font-bold mt-2 bg-sky-950/40 p-2.5 rounded-xl border border-sky-400/30 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
              <span>اكتب التقرير بأسلوبك العادي، وسيقوم الذكاء الاصطناعي في لوحة المدير باستخلاص وتنسيق الأسماء والمناطق والنقاط بدقة تامة.</span>
            </p>
          </div>

          {/* رفع صور العقار مع التحويل التلقائي لـ WebP */}
          <div>
            <label className="block text-sm sm:text-base font-black text-white drop-shadow mb-2">
              📸 صور العقار الملتقطة:
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white px-5 py-3 rounded-2xl text-sm font-black cursor-pointer transition-all shadow-lg shadow-sky-500/20 border border-sky-300/40 active:scale-95">
                <Camera className="w-5 h-5 text-white" />
                <span>التقاط أو اختيار صور من الهاتف / الحاسوب</span>
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
                <div className="flex items-center gap-2 text-xs text-amber-200 font-black bg-amber-950/60 px-3 py-2 rounded-xl border border-amber-400/40 animate-pulse">
                  <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                  <span>جاري تحويل وضغط الصور بصيغة WebP فائقة الخفة...</span>
                </div>
              )}
            </div>

            {/* معاينة الصور المرفوعة */}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    className="relative group rounded-2xl overflow-hidden border-2 border-white/30 bg-slate-950/80 aspect-video flex items-center justify-center shadow-xl"
                  >
                    <img
                      src={img.dataUrl}
                      alt={`صورة ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="bg-rose-600 text-white p-2 rounded-xl text-xs font-bold hover:bg-rose-700 transition shadow-lg"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1 right-1 bg-black/85 text-[10px] text-sky-300 font-mono px-2 py-0.5 rounded-lg border border-white/20">
                      WebP {Math.round((img.sizeBytes || 0) / 1024)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* أزرار الإجراءات - ألوان فائقة الوضوح والتباين والجمال */}
          <div
            className="pt-5 border-t border-white/20 flex flex-wrap items-center justify-between gap-4"
            style={{ background: 'rgba(15, 23, 42, 0.3)', margin: '-0.5rem -1.25rem -1.25rem', padding: '1.25rem 1.5rem' }}
          >
            {/* زر الإلغاء الواضح والصريح */}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-rose-600/90 hover:bg-rose-600 text-white font-black px-6 py-3 rounded-2xl text-sm shadow-lg shadow-rose-950/40 border border-rose-400/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <XCircle className="w-5 h-5 text-white" />
              <span>إلغاء وتراجع</span>
            </button>

            {/* زر رفع التقرير للمدير البارز والمضيء */}
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="flex items-center gap-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white font-black px-8 py-3 rounded-2xl text-sm sm:text-base shadow-xl shadow-emerald-900/50 border border-emerald-300/60 hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري رفع التقرير الآن...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 text-white" />
                  <span>رفع التقرير للمدير</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
