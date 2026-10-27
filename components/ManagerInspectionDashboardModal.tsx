'use client'

import React, { useState, useEffect } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { loadInspectionsFromCloud, updateInspectionRecord, deleteInspectionRecord } from '@/lib/inspectionStore'
import { processInspectionReportWithAI } from '@/lib/aiInspectionProcessor'
import InspectionPrintableA4 from './InspectionPrintableA4'
import {
  FileText,
  Sparkles,
  Printer,
  Trash2,
  CheckCircle,
  ExternalLink,
  Copy,
  X,
  Key,
  Camera,
  RefreshCw,
  Eye,
  Info,
  CheckCircle2,
  ChevronRight,
  ChevronLeft
} from 'lucide-react'

interface ManagerInspectionDashboardModalProps {
  isOpen: boolean
  onClose: () => void
  branchId?: string
  branchName?: string
}

export default function ManagerInspectionDashboardModal({
  isOpen,
  onClose,
  branchId,
  branchName
}: ManagerInspectionDashboardModalProps) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentInspection, setCurrentInspection] = useState<InspectionRecord | null>(null)

  // حالات الذكاء الاصطناعي والحفظ
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showImagesDrawer, setShowImagesDrawer] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // تحميل الكشوفات
  const loadData = async () => {
    setLoading(true)
    const list = await loadInspectionsFromCloud()
    setInspections(list)
    if (list.length > 0) {
      setCurrentInspection(list[0])
      setSelectedIndex(0)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
    }
  }, [isOpen])

  // التبديل بين الكشوفات
  const handleSelectInspection = (item: InspectionRecord, index: number) => {
    setCurrentInspection(JSON.parse(JSON.stringify(item)))
    setSelectedIndex(index)
    setAiNotice(null)
    setSaveSuccess(false)
  }

  // تشغيل الذكاء الاصطناعي لاستخلاص وترتيب الورقة فوراً
  const handleRunAI = async () => {
    if (!currentInspection) return

    setIsAiProcessing(true)
    setAiNotice(null)

    try {
      const storedKey =
        typeof window !== 'undefined'
          ? localStorage.getItem('gemini_api_key') || localStorage.getItem('ashtrakat_gemini_key') || ''
          : ''

      const extracted = await processInspectionReportWithAI(
        currentInspection.rawReportText,
        storedKey ? [storedKey] : [],
        currentInspection.writerOrCollectorName,
        currentInspection.branchName || branchName
      )

      const updated: InspectionRecord = {
        ...currentInspection,
        citizenName: extracted.citizenName || currentInspection.citizenName,
        inspectionDate: extracted.inspectionDate || currentInspection.inspectionDate,
        tableData: {
          sequence: 1,
          governorate: extracted.tableData.governorate || currentInspection.tableData?.governorate || 'البصرة',
          district: extracted.tableData.district || currentInspection.tableData?.district || 'ابي الخصيب',
          neighborhood: extracted.tableData.neighborhood || currentInspection.tableData?.neighborhood || '',
          plotNumber: extracted.tableData.plotNumber || currentInspection.tableData?.plotNumber || '',
          sectorNumber: extracted.tableData.sectorNumber || currentInspection.tableData?.sectorNumber || ''
        },
        reportPoints: extracted.reportPoints && extracted.reportPoints.length > 0 ? extracted.reportPoints : currentInspection.reportPoints,
        inspectorEmployeeName: extracted.inspectorEmployeeName || currentInspection.inspectorEmployeeName,
        networksManagerName: extracted.networksManagerName || currentInspection.networksManagerName,
        revenuesManagerName: extracted.revenuesManagerName || currentInspection.revenuesManagerName,
        typistName: extracted.typistName || currentInspection.typistName,
        status: 'reviewed',
        updatedAt: new Date().toISOString()
      }

      setCurrentInspection(updated)
      // حفظ تلقائي فوري
      await updateInspectionRecord(updated)
      setInspections((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))

      // إظهار رسالة تأكيد صريحة للمدير توضح ما الذي قام به الذكاء الاصطناعي
      setAiNotice(`✨ نجح الذكاء الاصطناعي في ترتيب الكشف: ${extracted.aiSummary}`)
      setTimeout(() => setAiNotice(null), 7000)
    } catch (err: unknown) {
      setAiNotice('حدث خطأ أثناء معالجة التقرير بالذكاء الاصطناعي')
    } finally {
      setIsAiProcessing(false)
    }
  }

  // حفظ التعديلات المباشرة في السحابة
  const handleSave = async () => {
    if (!currentInspection) return
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await updateInspectionRecord(currentInspection)
      setInspections((prev) => prev.map((item) => (item.id === currentInspection.id ? currentInspection : item)))
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3500)
    } catch (e) {
      alert('حدث خطأ أثناء حفظ التعديلات في السحابة')
    } finally {
      setIsSaving(false)
    }
  }

  // نسخ رابط المواطن
  const handleCopyLink = () => {
    if (!currentInspection) return
    const url = `${window.location.origin}/inspection/${currentInspection.id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // حذف الكشف
  const handleDelete = async () => {
    if (!currentInspection) return
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الكشف الفني نهائياً؟')) return
    await deleteInspectionRecord(currentInspection.id)
    const remaining = inspections.filter((i) => i.id !== currentInspection.id)
    setInspections(remaining)
    if (remaining.length > 0) {
      setCurrentInspection(remaining[0])
      setSelectedIndex(0)
    } else {
      setCurrentInspection(null)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-6xl max-h-[96vh] rounded-3xl shadow-[0_20px_70px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden my-auto border border-white/20 bg-slate-900 text-white"
      >
        {/* شريط الأدوات العلوي الفاخر المباشر فوق ورقة الـ A4 */}
        <div className="bg-slate-950/90 border-b border-white/15 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/30 text-sky-400 border border-sky-400/40 flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white">
                  معاينة وتعديل ورقة الكشف الفني (A4)
                </h1>
                {currentInspection && (
                  <span className="text-[10px] bg-sky-500/20 text-sky-300 border border-sky-400/30 px-2 py-0.5 rounded-md font-mono">
                    #{currentInspection.id.substring(currentInspection.id.length - 6)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                يمكنك التعديل والكتابة مباشرة داخل خلايا وسطور الورقة أدناه، والطباعة فوراً
              </p>
            </div>
          </div>

          {/* أزرار الإجراءات الرئيسية فوق الورقة */}
          <div className="flex flex-wrap items-center gap-2">
            {/* زر تشغيل وترتيب الذكاء الاصطناعي مع إيضاح صريح */}
            <button
              type="button"
              onClick={handleRunAI}
              disabled={isAiProcessing || !currentInspection}
              className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
              title="يستخلص اسم المواطن والمحلة ويرتب النقاط تلقائياً"
            >
              <Sparkles className={`w-4 h-4 text-amber-300 ${isAiProcessing ? 'animate-spin' : ''}`} />
              <span>{isAiProcessing ? 'جاري التنسيق الذكي...' : 'ترتيب وصياغة بالذكاء الاصطناعي'}</span>
            </button>

            {/* زر حفظ التعديلات في السحابة */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !currentInspection}
              className={`flex items-center gap-1.5 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50 ${
                saveSuccess
                  ? 'bg-emerald-500 border border-emerald-300'
                  : 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-400'
              }`}
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>تم الحفظ في السحابة ✓</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>

            {/* زر الطباعة الفورية A4 */}
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!currentInspection}
              className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فورية (A4)</span>
            </button>

            {/* زر عرض صور العقار المرفوعة */}
            {currentInspection && currentInspection.images && currentInspection.images.length > 0 && (
              <button
                type="button"
                onClick={() => setShowImagesDrawer(!showImagesDrawer)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border ${
                  showImagesDrawer
                    ? 'bg-amber-600 text-white border-amber-400'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700'
                }`}
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                <span>صور العقار ({currentInspection.images.length})</span>
              </button>
            )}

            {/* رابط الباركود للمواطن */}
            {currentInspection && (
              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
                title="نسخ الرابط الذي يفتحه الباركود"
              >
                <Copy className="w-3.5 h-3.5 text-blue-400" />
                <span>{copiedLink ? 'تم النسخ!' : 'رابط الباركود'}</span>
              </button>
            )}

            {/* زر إغلاق النافذة البارز والصريح باللون الأحمر */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-black shadow-lg transition active:scale-95 cursor-pointer border border-rose-400/50"
            >
              <X className="w-4 h-4" />
              <span>إغلاق النافذة ✕</span>
            </button>
          </div>
        </div>

        {/* إشعار تأكيد عمل الذكاء الاصطناعي وما قام به */}
        {aiNotice && (
          <div className="bg-indigo-950/90 border-b border-indigo-500/50 p-3 text-xs sm:text-sm font-bold text-indigo-200 flex items-center justify-between gap-3 animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{aiNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setAiNotice(null)}
              className="text-indigo-400 hover:text-white text-xs"
            >
              إخفاء
            </button>
          </div>
        )}

        {/* شريط اختيار الكشف والتبديل السريع بين الكشوفات الواردة */}
        {inspections.length > 1 && (
          <div className="bg-slate-950/60 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs overflow-x-auto shrink-0 gap-2">
            <div className="flex items-center gap-1.5 text-slate-400 font-bold whitespace-nowrap">
              <span>الكشوفات الواردة ({inspections.length}):</span>
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {inspections.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => handleSelectInspection(item, idx)}
                  className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap ${
                    selectedIndex === idx
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <span>{item.citizenName || `كشف ${idx + 1}`}</span>
                  <span className="text-[10px] opacity-75 mr-1 font-mono">({item.writerOrCollectorName})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* جسم النافذة: ورقة الـ A4 الرسمية في المنتصف مع إمكانية التعديل المباشر */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-950 flex flex-col items-center">
          {loading ? (
            <div className="py-20 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
              <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
              <span>جاري تحميل ورقة الكشف الفني...</span>
            </div>
          ) : currentInspection ? (
            <div className="w-full flex flex-col items-center space-y-4">
              {/* التقرير الأصلي للكاتب كمرجع سريع فوق الورقة للمقارنة */}
              <div className="w-full max-w-[210mm] bg-slate-900 border border-slate-800 p-3.5 rounded-2xl text-xs text-slate-300 print:hidden shadow-md">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-black text-sky-400 flex items-center gap-1.5">
                    <Info className="w-4 h-4" />
                    <span>النص الميداني الأصلي المرفوع من: {currentInspection.writerOrCollectorName}</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">{currentInspection.inspectionDate}</span>
                </div>
                <p className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed font-mono text-slate-300">
                  {currentInspection.rawReportText}
                </p>
              </div>

              {/* معرض صور العقار المرفوعة - يفتح عند النقر */}
              {showImagesDrawer && currentInspection.images && currentInspection.images.length > 0 && (
                <div className="w-full max-w-[210mm] bg-slate-900 border border-slate-800 p-4 rounded-2xl print:hidden animate-fade-in shadow-xl">
                  <h4 className="text-xs font-black text-emerald-400 mb-3 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    <span>صور العقار المرفقة بهذا الكشف ({currentInspection.images.length} صورة WebP)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {currentInspection.images.map((img, idx) => (
                      <div
                        key={img.id || idx}
                        className="rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video relative group shadow"
                      >
                        <img src={img.dataUrl} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/80 text-[9px] text-white px-1.5 py-0.5 rounded font-mono">
                          {Math.round((img.sizeBytes || 0) / 1024)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ورقة الـ A4 الرسمية الحقيقية - تعديل مباشر داخلها وطباعة مباشرة */}
              <div className="p-1 sm:p-3 bg-slate-800/60 rounded-2xl border border-slate-700 shadow-2xl overflow-x-auto max-w-full">
                <InspectionPrintableA4
                  inspection={currentInspection}
                  isEditable={true}
                  onUpdate={(updated) => setCurrentInspection(updated)}
                />
              </div>
            </div>
          ) : (
            <div className="py-24 text-center text-slate-500 text-sm">
              <FileText className="w-16 h-16 text-slate-700 mx-auto mb-3" />
              <p className="font-bold text-slate-400 text-base">لا توجد كشوفات فنية لعرضها</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
