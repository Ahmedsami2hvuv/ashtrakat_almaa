'use client'

import React, { useState } from 'react'
import { InspectionRecord, InspectionImage } from '@/lib/inspectionTypes'
import { compressAndConvertToWebP } from '@/lib/imageCompressor'
import { addInspectionRecord } from '@/lib/inspectionStore'
import { Camera, Upload, Trash2, CheckCircle2, AlertCircle, FileText, X, Sparkles } from 'lucide-react'

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-slate-900 border border-blue-900/60 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6">
        {/* رأس النافذة */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 p-5 border-b border-blue-900/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white">إجراء ورفع كشف موقعي جديد</h2>
              <p className="text-xs text-slate-400">
                القائم بالكشف: <span className="text-blue-300 font-bold">{userName}</span> ({userRole === 'writer' ? 'كاتب' : 'محصل'})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* جسم النموذج */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {successMessage && (
            <div className="bg-emerald-950/80 border border-emerald-600/60 text-emerald-200 p-4 rounded-2xl flex items-center gap-3 animate-fade-in text-sm font-bold">
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="bg-rose-950/80 border border-rose-600/60 text-rose-200 p-4 rounded-2xl flex items-center gap-3 text-sm font-bold">
              <AlertCircle className="w-6 h-6 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* نص التقرير */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">
              📝 نص تقرير الكشف الموقعي:
            </label>
            <textarea
              rows={5}
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="اكتب تفاصيل الكشف (مثال: تم إجراء الكشف على الدار العائدة للمواطن ... الكائنة في منطقة ... وتبين أن العقار ...)"
              className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-2xl p-4 text-white text-sm leading-relaxed placeholder-slate-500 resize-none outline-none transition-all"
              required
            />
            <p className="text-xs text-slate-400 mt-1.5">
              💡 ملاحظة: اكتب التقرير بأسلوبك وسيقوم الذكاء الاصطناعي في لوحة المدير بترتيبه واستخلاص الأسماء والتفاصيل بدقة.
            </p>
          </div>

          {/* رفع صور العقار مع التحويل إلى WebP */}
          <div>
            <label className="block text-sm font-bold text-slate-200 mb-2">
              📸 صور العقار الملتقطة:
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-all shadow-md active:scale-95">
                <Camera className="w-4 h-4" />
                <span>التقاط أو اختيار صور</span>
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
                <div className="flex items-center gap-2 text-xs text-sky-400 font-bold animate-pulse">
                  <div className="w-4 h-4 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
                  <span>جاري تحويل وضغط الصور بصيغة WebP خفيفة...</span>
                </div>
              )}
            </div>

            {/* معاينة الصور المرفوعة */}
            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, idx) => (
                  <div
                    key={img.id || idx}
                    className="relative group rounded-xl overflow-hidden border border-slate-700 bg-slate-950 aspect-video flex items-center justify-center shadow"
                  >
                    <img
                      src={img.dataUrl}
                      alt={`صورة ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="bg-rose-600 text-white p-1.5 rounded-lg text-xs font-bold hover:bg-rose-700 transition"
                        title="حذف الصورة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <span className="absolute bottom-1 right-1 bg-black/70 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">
                      WebP {Math.round((img.sizeBytes || 0) / 1024)} KB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* أزرار الإجراءات */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-bold transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isCompressing}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-blue-900/30 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>جاري رفع الكشف...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
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
