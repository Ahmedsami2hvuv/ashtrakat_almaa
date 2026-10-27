'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { Shield, AlertTriangle, Eye, CheckCircle2, MapPin, Calendar, FileText, Camera, Lock } from 'lucide-react'

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
          setError(json.error || 'لم يتم العثور على تقرير الكشف')
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
      // PrintScreen
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault()
        setScreenshotAttempted(true)
        setTimeout(() => setScreenshotAttempted(false), 3000)
        return false
      }
      // Ctrl+P (طباعة)، Ctrl+S (حفظ)، Ctrl+Shift+I / F12 (فحص العناصر)
      if (
        (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S' || e.key === 'u' || e.key === 'U')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I' || e.key === 'c' || e.key === 'C')) ||
        e.key === 'F12'
      ) {
        e.preventDefault()
        return false
      }
    }

    // 3. مراقبة فقدان التركيز (غالباً عند فتح أداة لقطة الشاشة في ويندوز Win+Shift+S أو تطبيق خارجي)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4" dir="rtl">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-bold">جاري تحميل وثيقة الكشف الفني...</h2>
        <p className="text-sm text-slate-400 mt-2">مديرية ماء البصرة - التحقق الإلكتروني</p>
      </div>
    )
  }

  if (error || !inspection) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4" dir="rtl">
        <div className="bg-rose-950/50 border border-rose-800 text-rose-300 p-6 rounded-2xl max-w-md text-center shadow-2xl">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-black mb-2">تعذر فتح الكشف</h2>
          <p className="text-sm text-rose-200 mb-4">{error || 'التقرير غير متوفر أو تم حذفه'}</p>
          <a
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl text-sm"
          >
            العودة للرئيسية
          </a>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 select-none pb-12 transition-all duration-200 ${
        isWindowBlurred ? 'filter blur-md' : ''
      }`}
      dir="rtl"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
    >
      {/* تنبيه محاولة لقطة الشاشة */}
      {screenshotAttempted && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="w-20 h-20 bg-rose-600/20 text-rose-500 rounded-full flex items-center justify-center mb-4 border border-rose-500">
            <Shield className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-rose-400 mb-2">تنبيه أمني محمي</h2>
          <p className="text-slate-300 max-w-sm text-sm">
            نظام الكشوفات محمي ومؤمن رقمياً. التقاط الشاشة محظور للحفاظ على سرية وخصوصية البيانات الرسمية لمديرية ماء البصرة.
          </p>
        </div>
      )}

      {/* الترويسة العليا للمواطن */}
      <header className="bg-slate-900/90 border-b border-blue-900/40 sticky top-0 z-30 backdrop-blur-md px-4 py-3 shadow-lg">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-full p-1 border-2 border-blue-500 shadow-md flex items-center justify-center overflow-hidden">
              <img
                src="/icons/directorate-logo.png"
                alt="شعار مديرية ماء البصرة"
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white leading-tight">
                مديرية ماء البصرة
              </h1>
              <p className="text-xs text-blue-400 font-semibold">
                {inspection.branchName || 'مركز جباية واردات أبي الخصيب'} - وثيقة كشف رسمي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-600/50 text-emerald-300 px-3 py-1.5 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>كشف معتمد وموثق</span>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {/* بطاقة معلومات العقار والكشف */}
        <div className="bg-slate-900 border border-blue-900/50 rounded-2xl p-5 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-r from-blue-500 via-sky-400 to-indigo-600" />
          
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-black text-white">بيانات الكشف الفني</h2>
            </div>
            <span className="text-xs bg-blue-950 text-blue-300 border border-blue-800/80 px-2.5 py-1 rounded-lg font-mono">
              رقم الكشف: #{inspection.id.substring(0, 8)}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-xs block mb-1">اسم المواطن / العائد له العقار:</span>
              <p className="font-bold text-white text-base">{inspection.citizenName || 'غير محدد'}</p>
            </div>

            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 text-xs block mb-1">تاريخ الكشف الموقعي:</span>
              <p className="font-bold text-sky-400 text-base font-mono">{inspection.inspectionDate || 'غير محدد'}</p>
            </div>
          </div>

          {/* جدول سند الطابو */}
          <div className="mt-4 overflow-x-auto rounded-xl border border-blue-900/40">
            <table className="w-full text-center text-xs">
              <thead className="bg-blue-950/80 text-blue-200 border-b border-blue-900/60 font-black">
                <tr>
                  <th className="py-2.5 px-3">المحافظة</th>
                  <th className="py-2.5 px-3">القضاء</th>
                  <th className="py-2.5 px-3">المحلة</th>
                  <th className="py-2.5 px-3">رقم القطعة</th>
                  <th className="py-2.5 px-3">رقم المقاطعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-900/90 text-slate-200 font-semibold">
                <tr>
                  <td className="py-2.5 px-3">{inspection.tableData?.governorate || 'البصرة'}</td>
                  <td className="py-2.5 px-3">{inspection.tableData?.district || 'ابي الخصيب'}</td>
                  <td className="py-2.5 px-3 text-sky-300 font-bold">{inspection.tableData?.neighborhood || '-'}</td>
                  <td className="py-2.5 px-3 font-mono">{inspection.tableData?.plotNumber || '-'}</td>
                  <td className="py-2.5 px-3 font-mono">{inspection.tableData?.sectorNumber || '-'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* بطاقة تقرير الكشف الفني */}
        <div className="bg-slate-900 border border-blue-900/50 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center gap-2 mb-4 border-b border-slate-800 pb-3">
            <Shield className="w-5 h-5 text-sky-400" />
            <h3 className="text-base font-black text-white">وقائع ونتائج تقرير الكشف الموقعي</h3>
          </div>

          <div className="space-y-3">
            {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
              inspection.reportPoints.map((point, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/70 border border-slate-800/80 p-3.5 rounded-xl flex items-start gap-3"
                >
                  <span className="w-6 h-6 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50 flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm text-slate-200 leading-relaxed font-medium">{point}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400 italic">لا توجد نقاط مفصلة، التقرير العام: {inspection.rawReportText}</p>
            )}
          </div>

          {/* موظف الكشف */}
          <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>القائم بالكشف: <strong className="text-white">{inspection.inspectorEmployeeName || inspection.writerOrCollectorName}</strong></span>
            <span>مسؤول الواردات: <strong className="text-white">{inspection.revenuesManagerName || 'حسين علي لفتة جابر'}</strong></span>
          </div>
        </div>

        {/* بطاقة صور العقار المرفقة مع درع الحماية الشفاف المطلق */}
        <div className="bg-slate-900 border border-blue-900/50 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-black text-white">صور العقار المرفقة بالكشف</h3>
            </div>
            <span className="text-xs bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2.5 py-1 rounded-lg">
              {inspection.images?.length || 0} صورة موثقة
            </span>
          </div>

          {/* تنبيه أمان الصور */}
          <div className="bg-blue-950/40 border border-blue-800/40 p-3 rounded-xl mb-4 flex items-center gap-2 text-xs text-blue-300">
            <Lock className="w-4 h-4 text-blue-400 shrink-0" />
            <span>الصور محمية بطبقة حماية رقمية مانعة للتحميل والنسخ، وللمعاينة الرسمية فقط.</span>
          </div>

          {inspection.images && inspection.images.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {inspection.images.map((img, idx) => (
                <div
                  key={img.id || idx}
                  className="relative group rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video flex items-center justify-center shadow-lg"
                >
                  {/* الصورة الأصلية المضغوطة بصيغة WebP في الخلفية */}
                  <img
                    src={img.dataUrl}
                    alt={`صورة العقار ${idx + 1}`}
                    className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />

                  {/* طباعة مائية رقمية رسمية خفيفة */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 z-10 opacity-60">
                    <span className="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded self-start font-mono">
                      كشف #{inspection.id.substring(0, 6)}
                    </span>
                    <span className="text-[10px] text-white/80 bg-black/40 px-2 py-0.5 rounded self-end">
                      مديرية ماء البصرة
                    </span>
                  </div>

                  {/* الطبقة الشفافة الواقية المطلقة (درع الحماية):
                      إذا حاول المستخدم النقر بالزر الأيمن أو حفظ الصورة،
                      هو ينقر ويحفظ الصورة الشفافة الفارغة فقط! */}
                  <div
                    className="absolute inset-0 z-20 cursor-pointer"
                    onClick={() => setSelectedImage(img.dataUrl)}
                    title="انقر للمعاينة الرسمية"
                  >
                    <img
                      src="/icons/transparent-shield.png"
                      alt="درع حماية شفاف"
                      className="w-full h-full object-cover opacity-0"
                    />
                  </div>

                  {/* أيقونة المعاينة عند المرور */}
                  <button
                    type="button"
                    onClick={() => setSelectedImage(img.dataUrl)}
                    className="absolute bottom-2 left-2 z-25 bg-blue-600/90 hover:bg-blue-600 text-white p-2 rounded-lg text-xs font-bold flex items-center gap-1 shadow-md opacity-90 group-hover:opacity-100 transition-opacity"
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

      {/* نافذة التكبير للمعاينة المحمية */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] w-full rounded-2xl overflow-hidden border border-slate-700 bg-black shadow-2xl flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImage}
              alt="معاينة الصورة"
              className="max-w-full max-h-[80vh] object-contain pointer-events-none select-none"
            />

            {/* درع الحماية الشفاف فوق المعاينة المكبرة أيضاً */}
            <div className="absolute inset-0 z-30">
              <img
                src="/icons/transparent-shield.png"
                alt="درع حماية شفاف"
                className="w-full h-full object-cover opacity-0"
              />
            </div>

            {/* زر الإغلاق */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 left-4 z-40 bg-slate-800/90 hover:bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg transition-colors"
            >
              إغلاق المعاينة ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
