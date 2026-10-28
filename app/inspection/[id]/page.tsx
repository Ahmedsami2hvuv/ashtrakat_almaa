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
  const [showSecurityToast, setShowSecurityToast] = useState(false)

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
      setShowSecurityToast(true)
      setTimeout(() => setShowSecurityToast(false), 2000)
    }
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.ctrlKey && ['p', 's', 'u'].includes(e.key.toLowerCase()))
      ) {
        e.preventDefault()
        setShowSecurityToast(true)
        setTimeout(() => setShowSecurityToast(false), 2500)
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
        style={{ background: 'radial-gradient(800px 400px at 20% 0%, #e0f2fe, #fff 60%)' }}
      >
        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl text-center shadow-xl border border-sky-100">
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
        style={{ background: 'radial-gradient(800px 400px at 20% 0%, #fef2f2, #fff 60%)' }}
      >
        <div className="bg-white/90 backdrop-blur-xl p-8 rounded-3xl text-center shadow-xl border border-rose-100 max-w-sm">
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;800;900&display=swap');
        * { font-family: 'Tajawal', sans-serif; }
        .glass {
          background: rgba(255, 255, 255, 0.78);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 8px 32px rgba(15, 23, 42, 0.05);
        }
        .glass-block {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 4px 16px rgba(14, 165, 233, 0.04);
        }
        .glass-strong {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(22px);
          border: 1px solid #ffffff;
        }
      `}</style>

      <div
        dir="rtl"
        className={`min-h-screen pb-12 select-none relative transition-all duration-300 ${
          isWindowBlurred ? 'filter blur-md' : ''
        }`}
        style={{
          background:
            'radial-gradient(1200px 600px at 15% -5%, #e0f2fe 0%, transparent 60%), radial-gradient(800px 400px at 85% 10%, #bae6fd 0%, transparent 55%), #ffffff'
        }}
      >
        {showSecurityToast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white text-xs font-black px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-700 animate-fade-in">
            محتوى الكشف محمي
          </div>
        )}

        {/* هيدر بنصوص بسطر واحد بدون كشف معتمد وبدون تكرار الكاشف */}
        <header className="sticky top-0 z-30 py-3 glass-strong border-b border-white/80 px-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white border-2 border-sky-300 shadow-sm grid place-items-center shrink-0">
              <Droplets className="w-6 h-6 text-sky-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-[#0c4a8a] leading-tight whitespace-nowrap">
                مديرية ماء البصرة
              </h1>
              <p className="text-xs font-bold text-slate-500 whitespace-nowrap mt-0.5">
                {inspection.branchName || 'مركز جباية واردات أبي الخصيب'}
              </p>
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 mt-5 space-y-5">
          {/* بيانات الكشف الفني الموقعي */}
          <div className="glass rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 mb-4">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#0c4a8a]" />
                <span>بيانات الكشف الفني الموقعي</span>
              </h2>
              <span className="text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1 rounded-full shrink-0">
                سند الطابو
              </span>
            </div>

            {/* البلوكات الزجاجية - الاسم والتاريخ بسطر واحد لكل منهما */}
            <div className="space-y-2.5">
              <div className="glass-block p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">اسم المواطن:</span>
                <span className="text-sm font-black text-[#0c4a8a] text-left truncate">
                  {inspection.citizenName || 'غير محدد'}
                </span>
              </div>

              <div className="glass-block p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">تاريخ الكشف:</span>
                <span className="text-sm font-black text-slate-800 font-mono text-left">
                  {inspection.inspectionDate || 'غير محدد'}
                </span>
              </div>

              <div className="glass-block p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">المحافظة:</span>
                <span className="text-sm font-black text-slate-900 text-left">
                  {inspection.tableData?.governorate || 'البصرة'}
                </span>
              </div>

              <div className="glass-block p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">المحلة:</span>
                <span className="text-sm font-black text-[#0c4a8a] text-left">
                  {inspection.tableData?.neighborhood || '-'}
                </span>
              </div>

              <div className="glass-block p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">رقم القطعة:</span>
                <span className="text-sm font-black font-mono text-slate-900 text-left">
                  {inspection.tableData?.plotNumber || '-'}
                </span>
              </div>

              <div className="glass-block p-3.5 rounded-2xl flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-slate-500 shrink-0">رقم المقاطعة:</span>
                <span className="text-sm font-black font-mono text-slate-900 text-left">
                  {inspection.tableData?.sectorNumber || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* تقرير الكشف */}
          <div className="glass rounded-3xl p-5 shadow-sm">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4 border-b border-slate-200/80 pb-3">
              <Shield className="w-5 h-5 text-sky-600" />
              <span>تقرير الكشف</span>
            </h3>

            <div className="space-y-3">
              {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
                inspection.reportPoints.map((p, i) => (
                  <div
                    key={i}
                    className="glass-block p-3.5 rounded-2xl flex items-start gap-3"
                  >
                    <span className="w-7 h-7 rounded-full bg-blue-100 border border-blue-300 grid place-items-center text-xs font-black text-[#0c4a8a] shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <p className="font-bold text-sm text-slate-800 leading-relaxed">{p}</p>
                  </div>
                ))
              ) : (
                <div className="glass-block p-3.5 rounded-2xl">
                  <p className="font-bold text-sm text-slate-800 leading-relaxed">
                    {inspection.rawReportText || 'لا يوجد تقرير مكتوب'}
                  </p>
                </div>
              )}
            </div>

            {/* الكاشف والمسؤول بأسفل التقرير فقط وفي بلوك زجاجي موحد */}
            <div className="glass-block p-3.5 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-700 mt-4">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">الكاشف:</span>
                <span className="text-slate-900 font-black">
                  {inspection.inspectorEmployeeName || inspection.writerOrCollectorName || 'غير محدد'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">المسؤول:</span>
                <span className="text-slate-900 font-black">
                  {inspection.revenuesManagerName || 'حسين علي لفتة جابر'}
                </span>
              </div>
            </div>
          </div>

          {/* صور الكشف */}
          <div className="glass rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-200/80">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-emerald-600" />
                <span>صور الكشف</span>
              </h3>
              <span className="bg-slate-900 text-white text-xs px-3 py-1 rounded-full font-black">
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
                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Eye className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs font-bold glass-block rounded-2xl border border-dashed border-slate-300">
                لا توجد صور مرفقة في هذا الكشف
              </div>
            )}
          </div>
        </main>

        {/* نافذة معاينة الصور المحسنة للهواتف بشكل كامل وخالي من التعليق */}
        {selectedImage && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-2xl flex flex-col justify-between p-4 animate-fade-in"
            onClick={() => setSelectedImage(null)}
          >
            <div className="w-full max-w-2xl mx-auto flex items-center justify-between pt-2 px-1">
              <span className="text-xs font-bold text-slate-200 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10">
                معاينة الصورة
              </span>
              <button
                onClick={() => setSelectedImage(null)}
                className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white px-4 py-2 rounded-full text-xs font-black shadow-lg transition"
              >
                إغلاق ✕
              </button>
            </div>

            <div
              className="my-auto max-w-full max-h-[80vh] flex items-center justify-center p-2"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={selectedImage}
                alt="صورة مكبرة"
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-white/20 select-none"
              />
            </div>

            <div className="pb-2 text-center">
              <span className="text-[11px] text-slate-300 font-bold bg-white/10 px-4 py-1.5 rounded-full border border-white/10">
                انقر في أي مكان للإغلاق
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
