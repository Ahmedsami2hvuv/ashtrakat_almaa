'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { Shield, FileText, Camera, Droplets, AlertTriangle, Eye } from 'lucide-react'

export default function InspectionCitizenViewPage() {
  const params = useParams()
  const id = params?.id as string

  const [inspection, setInspection] = useState<InspectionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isWindowBlurred, setIsWindowBlurred] = useState(false)

  useEffect(() => {
    async function fetchInspection() {
      if (!id) return
      setLoading(true)
      try {
        const res = await fetch(`/api/inspections/${id}`)
        const json = await res.json()
        if (json.success && json.data) {
          setInspection(json.data)
        } else {
          setError(json.error || 'لم يتم العثور على وثيقة الكشف المطلوبة')
        }
      } catch {
        setError('تعذر الاتصال بالخادم لجلب بيانات الكشف')
      } finally {
        setLoading(false)
      }
    }
    fetchInspection()
  }, [id])

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      e.preventDefault()
    }
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.ctrlKey && ['p', 's', 'u'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault()
      }
    }
    window.addEventListener('contextmenu', onContext)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', () => setIsWindowBlurred(true))
    window.addEventListener('focus', () => setIsWindowBlurred(false))
    return () => {
      window.removeEventListener('contextmenu', onContext)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', () => setIsWindowBlurred(true))
      window.removeEventListener('focus', () => setIsWindowBlurred(false))
    }
  }, [])

  if (loading) {
    return (
      <div
        className="min-h-screen grid place-items-center p-4"
        dir="rtl"
        style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #dbeafe 100%)' }}
      >
        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl text-center shadow-xl border border-sky-100">
          <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="font-black text-slate-800 text-base">جاري تحميل وثيقة الكشف...</p>
        </div>
      </div>
    )
  }

  if (error || !inspection) {
    return (
      <div
        className="min-h-screen grid place-items-center p-4"
        dir="rtl"
        style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' }}
      >
        <div className="bg-white p-8 rounded-3xl text-center shadow-xl border border-rose-100 max-w-sm">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <p className="font-black text-rose-700 text-lg mb-2">تعذر فتح الكشف</p>
          <p className="text-sm text-slate-600 mb-4">{error || 'الكشف غير متوفر'}</p>
          <a
            href="/"
            className="inline-block bg-sky-600 hover:bg-sky-700 text-white font-black px-6 py-2.5 rounded-xl text-sm shadow-md transition"
          >
            العودة للرئيسية
          </a>
        </div>
      </div>
    )
  }

  const branchTitle =
    inspection.branchName && inspection.branchName.trim() !== ''
      ? inspection.branchName
      : 'مركز جباية واردات أبي الخصيب'

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        * { font-family: 'Tajawal', sans-serif; }
      `}</style>

      <div
        dir="rtl"
        className={`min-h-screen pb-12 select-none relative transition-all duration-300 ${
          isWindowBlurred ? 'filter blur-md' : ''
        }`}
        style={{
          background:
            'radial-gradient(1200px 600px at 15% -5%, #e0f2fe 0%, transparent 60%), radial-gradient(800px 400px at 85% 10%, #bae6fd 0%, transparent 55%), #f8fafc'
        }}
      >
        {/* هيدر بنصوص واضحة ومستقرة بدون انكسار */}
        <header className="sticky top-0 z-30 py-3.5 bg-white/90 backdrop-blur-xl border-b border-sky-100 px-4 shadow-xs">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-sky-50 border border-sky-200 shadow-xs grid place-items-center shrink-0">
                <Droplets className="w-6 h-6 text-sky-600" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-black text-[#0c4a8a] leading-tight whitespace-nowrap">
                  مديرية ماء البصرة
                </h1>
                <p className="text-xs font-bold text-slate-600 whitespace-nowrap mt-0.5">
                  {branchTitle}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
          {/* كارت بيانات الكشف */}
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 shadow-xl border border-white/80">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0c4a8a]" />
                <span>بيانات الكشف</span>
              </h2>
              <span className="text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3.5 py-1 rounded-full shrink-0">
                سند الطابو
              </span>
            </div>

            {/* صفوف مريحة وواسعة مع عدم خروج أي نص خارج الحدود */}
            <div className="space-y-3">
              <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors">
                <span className="text-xs font-bold text-slate-500 shrink-0">اسم المواطن:</span>
                <span className="text-sm font-black text-[#0c4a8a] text-left leading-normal">
                  {inspection.citizenName || 'غير محدد'}
                </span>
              </div>

              <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors">
                <span className="text-xs font-bold text-slate-500 shrink-0">تاريخ الكشف:</span>
                <span className="text-sm font-black text-slate-800 font-mono text-left leading-normal">
                  {inspection.inspectionDate || 'غير محدد'}
                </span>
              </div>

              <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors">
                <span className="text-xs font-bold text-slate-500 shrink-0">المحافظة:</span>
                <span className="text-sm font-black text-slate-900 text-left leading-normal">
                  {inspection.tableData?.governorate || 'البصرة'}
                </span>
              </div>

              <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors">
                <span className="text-xs font-bold text-slate-500 shrink-0">المحلة:</span>
                <span className="text-sm font-black text-[#0c4a8a] text-left leading-normal">
                  {inspection.tableData?.neighborhood || '-'}
                </span>
              </div>

              <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors">
                <span className="text-xs font-bold text-slate-500 shrink-0">رقم القطعة:</span>
                <span className="text-sm font-black font-mono text-slate-900 text-left leading-normal">
                  {inspection.tableData?.plotNumber || '-'}
                </span>
              </div>

              <div className="bg-slate-50/80 hover:bg-slate-50 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between gap-4 transition-colors">
                <span className="text-xs font-bold text-slate-500 shrink-0">رقم المقاطعة:</span>
                <span className="text-sm font-black font-mono text-slate-900 text-left leading-normal">
                  {inspection.tableData?.sectorNumber || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* كارت تقرير الكشف */}
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 shadow-xl border border-white/80">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4 border-b border-slate-100 pb-3.5">
              <Shield className="w-5 h-5 text-sky-600" />
              <span>تقرير الكشف</span>
            </h3>

            {/* نقاط التقرير مع أرقام الفقرات بداخل كارتات محاطة بالكامل دون أي خروج خارج الحدود */}
            <div className="space-y-3">
              {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
                inspection.reportPoints.map((p, i) => (
                  <div
                    key={i}
                    className="bg-slate-50/80 border border-slate-200/70 p-4 rounded-2xl flex items-start gap-3"
                  >
                    <div className="w-7 h-7 rounded-full bg-sky-100 border border-sky-200 flex items-center justify-center text-xs font-black text-[#0c4a8a] shrink-0 mt-0.5">
                      {i + 1}
                    </div>
                    <p className="font-bold text-sm text-slate-800 leading-relaxed flex-1 my-0">{p}</p>
                  </div>
                ))
              ) : (
                <div className="bg-slate-50/80 border border-slate-200/70 p-4 rounded-2xl">
                  <p className="font-bold text-sm text-slate-800 leading-relaxed my-0">
                    {inspection.rawReportText || 'لا يوجد تقرير مكتوب'}
                  </p>
                </div>
              )}
            </div>

            {/* الكاشف والمسؤول في بلوكات منفصلة واسعة ومتناسقة */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100">
              <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">الكاشف:</span>
                <span className="text-sm font-black text-slate-900">
                  {inspection.inspectorEmployeeName || inspection.writerOrCollectorName || 'ساره محمد جاسم'}
                </span>
              </div>

              <div className="bg-slate-50/80 border border-slate-200/70 rounded-2xl p-4 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">المسؤول:</span>
                <span className="text-sm font-black text-slate-900">
                  {inspection.revenuesManagerName || 'حسين علي لفتة جابر'}
                </span>
              </div>
            </div>
          </div>

          {/* كارت صور الكشف */}
          <div className="bg-white/90 backdrop-blur-2xl rounded-3xl p-5 sm:p-6 shadow-xl border border-white/80">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                <span>صور الكشف</span>
              </h3>
              <span className="bg-slate-900 text-white text-xs px-3.5 py-1 rounded-full font-black">
                {inspection.images?.length || 0} صور
              </span>
            </div>

            {inspection.images && inspection.images.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {inspection.images.map((img, i) => (
                  <div
                    key={img.id || i}
                    className="aspect-[4/3] rounded-2xl bg-slate-900 border border-slate-200 overflow-hidden relative group shadow-xs cursor-pointer active:scale-95 transition-transform"
                    onClick={() => setSelectedImage(img.dataUrl)}
                  >
                    <img
                      src={img.dataUrl}
                      alt={`صورة الكشف ${i + 1}`}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 pointer-events-none select-none"
                    />
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                لا توجد صور مرفقة في هذا الكشف
              </div>
            )}
          </div>
        </main>

        {/* نافذة معاينة الصورة المحسنة بالكامل للهواتف */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-between p-4 overflow-y-auto"
            onClick={() => setSelectedImage(null)}
          >
            {/* شريط علوي بارز يضمن ظهور زر الإغلاق 100% */}
            <div className="w-full max-w-lg flex items-center justify-between shrink-0 py-2 px-1">
              <span className="text-xs font-black text-white bg-white/20 px-3.5 py-1.5 rounded-full border border-white/20">
                معاينة الصورة
              </span>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-5 py-2 rounded-full text-xs font-black shadow-2xl border border-rose-400 cursor-pointer shrink-0"
              >
                إغلاق ✕
              </button>
            </div>

            {/* الصورة مكبرة ومحصورة داخل ارتفاع الهاتف تماماً */}
            <div
              className="my-auto w-full max-w-lg flex items-center justify-center p-2 shrink-1"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage}
                alt="صورة الكشف المكبرة"
                className="max-w-full max-h-[65vh] sm:max-h-[75vh] w-auto h-auto object-contain rounded-2xl shadow-2xl border-2 border-white/30 select-none"
              />
            </div>

            {/* زر سفلي لإغلاق الصورة */}
            <div className="shrink-0 pt-2 pb-1 text-center">
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-[11px] text-white/80 font-bold bg-white/10 px-4 py-1.5 rounded-full border border-white/15"
              >
                انقر في أي مكان للإغلاق
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
