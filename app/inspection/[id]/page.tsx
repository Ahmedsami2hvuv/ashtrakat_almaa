'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { Shield, AlertTriangle, Eye, CheckCircle2, MapPin, Calendar, FileText, Camera, Lock, Check } from 'lucide-react'

export default function InspectionCitizenViewPage() {
  const params = useParams()
  const id = params?.id as string

  const [inspection, setInspection] = useState<InspectionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [screenshotAttempted, setScreenshotAttempted] = useState(false)
  const [isWindowBlurred, setIsWindowBlurred] = useState(false)

  // جلب تفاصيل الكشف
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
      } catch (err: unknown) {
        setError('تعذر الاتصال بالخادم لجلب تفاصيل الكشف')
      } finally {
        setLoading(false)
      }
    }
    fetchInspection()
  }, [id])

  // آليات الحماية ومنع لقطة الشاشة وحفظ الصور
  useEffect(() => {
    // 1. منع النقر الأيمن
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }

    // 2. منع اختصارات لوحة المفاتيح المخصصة للنسخ والتقاط الشاشة
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault()
        setScreenshotAttempted(true)
        setTimeout(() => setScreenshotAttempted(false), 3000)
        return false
      }
      if (
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'c' || e.key === 'C')) ||
        e.key === 'F12'
      ) {
        e.preventDefault()
        return false
      }
    }

    // 3. مراقبة فقدان التركيز
    const handleBlur = () => {
      setIsWindowBlurred(true)
    }
    const handleFocus = () => {
      setIsWindowBlurred(false)
    }

    window.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  // توليد كود الكشف الرسمي
  const inspectionCode = inspection
    ? `BAS-WAT-${inspection.inspectionDate?.replace(/\//g, '') || '2026'}-${inspection.id.substring(inspection.id.length - 4).toUpperCase()}`
    : ''

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #dbeafe 100%)'
        }}
        dir="rtl"
      >
        <div className="w-16 h-16 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-black text-slate-800">جاري تحميل وثيقة الكشف الفني...</h2>
        <p className="text-sm text-sky-700 font-bold mt-1">مديرية ماء البصرة - نظام التحقق الإلكتروني الموحد</p>
      </div>
    )
  }

  if (error || !inspection) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4"
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
        }}
        dir="rtl"
      >
        <div className="bg-white/80 backdrop-blur-xl border border-rose-200 text-slate-800 p-8 rounded-3xl max-w-md text-center shadow-2xl">
          <AlertTriangle className="w-14 h-14 text-rose-500 mx-auto mb-3" />
          <h2 className="text-xl font-black mb-2 text-rose-700">تعذر فتح الكشف الفني</h2>
          <p className="text-sm text-slate-600 mb-5">{error || 'التقرير غير متوفر أو تم حذفه'}</p>
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
    <div
      className={`min-h-screen select-none pb-14 transition-all duration-300 relative ${
        isWindowBlurred ? 'filter blur-md' : ''
      }`}
      style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 40%, #eef2ff 100%)',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
      dir="rtl"
    >
      {/* عناصر جمالية في الخلفية لإعطاء تأثير الزجاج المائي */}
      <div className="fixed top-[-100px] right-[-100px] w-96 h-96 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
      <div className="fixed bottom-[-100px] left-[-100px] w-96 h-96 rounded-full bg-blue-300/25 blur-3xl pointer-events-none" />

      {/* تنبيه محاولة لقطة الشاشة */}
      {screenshotAttempted && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 bg-rose-600/20 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-500">
            <Shield className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-rose-400 mb-2">تنبيه أمني محمي</h2>
          <p className="text-slate-300 max-w-sm text-sm">
            التقاط الشاشة محظور للحفاظ على سرية وخصوصية البيانات الرسمية لمديرية ماء البصرة.
          </p>
        </div>
      )}

      {/* الترويسة الزجاجية الشفافة المشرقة */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b border-white/60 px-4 py-3 shadow-sm"
        style={{
          background: 'rgba(255, 255, 255, 0.75)'
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl p-1 border-2 border-sky-400 shadow-md flex items-center justify-center overflow-hidden">
              <img
                src="/icons/directorate-logo.png"
                alt="شعار مديرية ماء البصرة"
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-[#0c4a8a] leading-tight">
                مديرية ماء البصرة
              </h1>
              <p className="text-xs text-slate-600 font-bold">
                {inspection.branchName || 'مركز جباية واردات أبي الخصيب'} - وثيقة كشف رسمي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-800 px-3.5 py-1.5 rounded-full text-xs font-black shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>كشف معتمد وموثق</span>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي الزجاجي الشفاف الفاخر */}
      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {/* شريط كود الكشف المعتمد في أقصى أعلى الصفحة */}
        <div
          className="p-4 rounded-3xl border border-white/80 shadow-md flex flex-wrap items-center justify-between gap-3"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)'
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-[#0c4a8a] flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 block">كود الكشف التسلسلي المعتمد:</span>
              <span className="text-sm sm:text-base font-black font-mono text-[#0c4a8a] tracking-wider">
                {inspectionCode}
              </span>
            </div>
          </div>

          <span className="text-xs bg-sky-100 text-sky-800 border border-sky-300 px-3 py-1 rounded-xl font-bold font-mono">
            بتاريخ: {inspection.inspectionDate}
          </span>
        </div>

        {/* بطاقة معلومات العقار والمواطن الزجاجية */}
        <div
          className="rounded-3xl p-6 border border-white/90 shadow-xl relative overflow-hidden"
          style={{
            background: 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(25px)'
          }}
        >
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#0c4a8a]" />
              <h2 className="text-lg font-black text-slate-900">بيانات الكشف الفني الموقعي</h2>
            </div>
            <span className="text-xs font-bold text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1 rounded-xl">
              سند الطابو الرسمي
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-5">
            <div className="bg-white/80 p-3.5 rounded-2xl border border-sky-100 shadow-xs">
              <span className="text-slate-500 text-xs font-bold block mb-1">اسم المواطن / العائد له العقار:</span>
              <p className="font-black text-[#0c4a8a] text-base">{inspection.citizenName || 'غير محدد'}</p>
            </div>

            <div className="bg-white/80 p-3.5 rounded-2xl border border-sky-100 shadow-xs">
              <span className="text-slate-500 text-xs font-bold block mb-1">تاريخ الكشف الموقعي:</span>
              <p className="font-black text-slate-800 text-base font-mono">{inspection.inspectionDate || 'غير محدد'}</p>
            </div>
          </div>

          {/* جدول سند الطابو المصمم بفخامة */}
          <div className="overflow-x-auto rounded-2xl border-2 border-slate-300 shadow-xs bg-white">
            <table className="w-full text-center text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-800 border-b-2 border-slate-300 font-black">
                <tr>
                  <th className="py-2.5 px-3">المحافظة</th>
                  <th className="py-2.5 px-3">القضاء</th>
                  <th className="py-2.5 px-3">المحلة</th>
                  <th className="py-2.5 px-3">رقم القطعة</th>
                  <th className="py-2.5 px-3">رقم المقاطعة</th>
                </tr>
              </thead>
              <tbody className="text-slate-800 font-bold divide-y divide-slate-100">
                <tr>
                  <td className="py-3 px-3">{inspection.tableData?.governorate || 'البصرة'}</td>
                  <td className="py-3 px-3">{inspection.tableData?.district || 'ابي الخصيب'}</td>
                  <td className="py-3 px-3 text-[#0c4a8a] font-black">{inspection.tableData?.neighborhood || '-'}</td>
                  <td className="py-3 px-3 font-mono font-black">{inspection.tableData?.plotNumber || '-'}</td>
                  <td className="py-3 px-3 font-mono font-black">{inspection.tableData?.sectorNumber || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* بطاقة تقرير الكشف الفني المنسقة بالنقاط */}
        <div
          className="rounded-3xl p-6 border border-white/90 shadow-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(25px)'
          }}
        >
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-3">
            <Shield className="w-5 h-5 text-sky-600" />
            <h3 className="text-base sm:text-lg font-black text-slate-900">وقائع ونتائج تقرير الكشف الموقعي</h3>
          </div>

          <div className="space-y-3">
            {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
              inspection.reportPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="bg-white/90 border border-sky-100 p-4 rounded-2xl flex items-start gap-3 shadow-xs"
                >
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-[#0c4a8a] border border-blue-300 flex items-center justify-center text-xs font-black shrink-0 mt-0.5 shadow-xs">
                    {idx + 1}
                  </span>
                  <p className="text-sm sm:text-base text-slate-800 leading-relaxed font-bold">{point}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600 leading-relaxed font-medium bg-white p-3 rounded-xl border border-slate-200">
                {inspection.rawReportText}
              </p>
            )}
          </div>

          {/* التواقيع الرسمية */}
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <span>القائم بالكشف: <strong className="text-slate-900 font-black">{inspection.inspectorEmployeeName || inspection.writerOrCollectorName}</strong></span>
            <span>مسؤول الواردات: <strong className="text-slate-900 font-black">{inspection.revenuesManagerName || 'حسين علي لفتة جابر'}</strong></span>
          </div>
        </div>

        {/* بطاقة صور العقار المرفقة مع درع الحماية الشفاف المطلق */}
        <div
          className="rounded-3xl p-6 border border-white/90 shadow-xl"
          style={{
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(25px)'
          }}
        >
          <div className="flex items-center justify-between mb-4 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base sm:text-lg font-black text-slate-900">صور العقار المرفقة بالكشف</h3>
            </div>
            <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl font-bold">
              {inspection.images?.length || 0} صور موثقة
            </span>
          </div>

          {/* تنبيه أمان الصور */}
          <div className="bg-sky-50 border border-sky-200 p-3 rounded-2xl mb-4 flex items-center gap-2 text-xs text-sky-900 font-semibold">
            <Lock className="w-4 h-4 text-sky-600 shrink-0" />
            <span>الصور محمية بطبقة أمان رقمية للمعاينة الرسمية المعتمدة فقط.</span>
          </div>

          {inspection.images && inspection.images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inspection.images.map((img, idx) => (
                <div
                  key={img.id || idx}
                  className="relative group rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-900 aspect-video flex items-center justify-center shadow-md"
                >
                  {/* الصورة الأصلية المضغوطة بصيغة WebP */}
                  <img
                    src={img.dataUrl}
                    alt={`صورة العقار ${idx + 1}`}
                    className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* طباعة مائية خفيفة */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2.5 z-10 opacity-70">
                    <span className="text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-md self-start font-mono">
                      كود: {inspectionCode}
                    </span>
                    <span className="text-[10px] text-white bg-black/50 px-2 py-0.5 rounded-md self-end font-bold">
                      مديرية ماء البصرة
                    </span>
                  </div>

                  {/* درع الحماية الشفاف المطلق فوق الصورة:
                      أي محاولة للنقر بالزر الأيمن أو حفظ الصورة، يتم حفظ الصورة الشفافة الفارغة فقط! */}
                  <div
                    className="absolute inset-0 z-20 cursor-pointer"
                    onClick={() => setSelectedImage(img.dataUrl)}
                    title="انقر للمعاينة"
                  >
                    <img
                      src="/icons/transparent-shield.png"
                      alt="درع حماية شفاف"
                      className="w-full h-full object-cover opacity-0"
                    />
                  </div>

                  {/* زر التكبير للمعاينة */}
                  <button
                    type="button"
                    onClick={() => setSelectedImage(img.dataUrl)}
                    className="absolute bottom-2.5 left-2.5 z-25 bg-[#0c4a8a]/90 hover:bg-[#0c4a8a] text-white px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1 shadow-md transition"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>تكبير</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              لم تُرفق صور إضافية مع هذا التقرير
            </div>
          )}
        </div>
      </main>

      {/* نافذة التكبير الزجاجية للمعاينة */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4"
          style={{
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(20px)'
          }}
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] w-full rounded-3xl overflow-hidden border-2 border-white/40 bg-black shadow-2xl flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt="معاينة الصورة"
              className="max-w-full max-h-[80vh] object-contain pointer-events-none select-none"
            />

            {/* درع الحماية الشفاف أيضاً فوق المعاينة المكبرة */}
            <div className="absolute inset-0 z-30">
              <img
                src="/icons/transparent-shield.png"
                alt="درع حماية شفاف"
                className="w-full h-full object-cover opacity-0"
              />
            </div>

            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 left-4 z-40 bg-white/20 hover:bg-rose-600 text-white px-4 py-2 rounded-2xl text-xs sm:text-sm font-black shadow-lg backdrop-blur-md transition-colors"
            >
              إغلاق المعاينة ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
