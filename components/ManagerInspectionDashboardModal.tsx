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
  Copy,
  X,
  Camera,
  RefreshCw,
  Info,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react'

interface ManagerInspectionDashboardModalProps {
  isOpen: boolean
  onClose: () => void
  branchId?: string
  branchName?: string
  branchManagerName?: string
}

export default function ManagerInspectionDashboardModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  branchManagerName
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
  const [zoomLevel, setZoomLevel] = useState<number>(100) // نسبة التكبير 100%

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
        revenuesManagerName: extracted.revenuesManagerName || currentInspection.revenuesManagerName || branchManagerName || '',
        typistName: extracted.typistName || currentInspection.typistName,
        status: 'reviewed',
        updatedAt: new Date().toISOString()
      }

      setCurrentInspection(updated)
      await updateInspectionRecord(updated)
      setInspections((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))

      setAiNotice(`✨ قام الذكاء الاصطناعي بترتيب الكشف: ${extracted.aiSummary}`)
      setTimeout(() => setAiNotice(null), 8000)
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
      alert('حدث خطأ أثناء حفظ التعديلات')
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

  // طباعة الورقة فقط مع ضمان إخفاء النوافذ الخارجية
  const handlePrint = () => {
    window.print()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-md print:bg-white print:p-0"
      dir="rtl"
    >
      {/* شريط الأدوات العلوي الثابت - يختفي تلقائياً عند الطباعة print-hide */}
      <header className="print-hide bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md shrink-0 z-20">
        {/* القسم الأيمن: عنوان الكشف وبياناته */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0c4a8a] border border-blue-200 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-900">
                استمارة الكشف الفني الموقعي (A4)
              </h1>
              {currentInspection && (
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-300">
                  {currentInspection.citizenName || 'كشف رسمي'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
              تعديل مباشر على الورقة + طباعة فورية رسمية للورقة فقط
            </p>
          </div>
        </div>

        {/* القسم الأوسط/الأيسر: أزرار العمليات الرئيسية مرتبة وواضحة جداً */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* التحكم في حجم الورقة وزووم الرؤية */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200 text-slate-700 hidden md:flex">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(70, prev - 10))}
              className="p-1.5 hover:bg-white rounded-lg transition"
              title="تصغير العرض"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold px-2">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(130, prev + 10))}
              className="p-1.5 hover:bg-white rounded-lg transition"
              title="تكبير العرض"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1.5 hover:bg-white rounded-lg transition text-[11px] font-bold"
              title="الحجم الافتراضي"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* زر الترتيب بالذكاء الاصطناعي */}
          <button
            type="button"
            onClick={handleRunAI}
            disabled={isAiProcessing || !currentInspection}
            className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50"
            title="إعادة استخلاص وترتيب البيانات بالذكاء الاصطناعي"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isAiProcessing ? 'animate-spin' : ''}`} />
            <span>{isAiProcessing ? 'جاري التنسيق...' : 'ترتيب بالذكاء الاصطناعي'}</span>
          </button>

          {/* زر حفظ التعديلات في السحابة */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !currentInspection}
            className={`flex items-center gap-1.5 text-white px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-50 ${
              saveSuccess
                ? 'bg-emerald-600 ring-2 ring-emerald-300'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>تم الحفظ في السحابة ✓</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                <span>حفظ التعديلات</span>
              </>
            )}
          </button>

          {/* زر الطباعة الفورية A4 - يطبع الورقة فقط */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={!currentInspection}
            className="flex items-center gap-1.5 bg-[#0c4a8a] hover:bg-blue-800 text-white px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition active:scale-95 cursor-pointer"
            title="طباعة ورقة الكشف الفني فقط"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الاستمارة (A4)</span>
          </button>

          {/* زر صور العقار */}
          {currentInspection && currentInspection.images && currentInspection.images.length > 0 && (
            <button
              type="button"
              onClick={() => setShowImagesDrawer(!showImagesDrawer)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition border cursor-pointer ${
                showImagesDrawer
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600" />
              <span>الصور ({currentInspection.images.length})</span>
            </button>
          )}

          {/* زر نسخ رابط المواطن */}
          {currentInspection && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold border border-slate-300 cursor-pointer transition"
              title="نسخ رابط صفحة المواطن"
            >
              <Copy className="w-3 h-3 text-blue-600" />
              <span>{copiedLink ? 'تم النسخ!' : 'رابط الباركود'}</span>
            </button>
          )}

          {/* زر إغلاق النافذة البارز */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-sm transition active:scale-95 cursor-pointer ml-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>إغلاق</span>
          </button>
        </div>
      </header>

      {/* شريط إشعار الذكاء الاصطناعي - يختفي عند الطباعة */}
      {aiNotice && (
        <div className="print-hide bg-indigo-50 border-b border-indigo-200 px-4 py-2 text-xs sm:text-sm font-bold text-indigo-900 flex items-center justify-between gap-3 shadow-xs shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{aiNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setAiNotice(null)}
            className="text-indigo-600 hover:text-indigo-900 text-xs font-bold"
          >
            إغلاق الإشعار ✕
          </button>
        </div>
      )}

      {/* قائمة الكشوفات المتعددة - تختفي عند الطباعة */}
      {inspections.length > 1 && (
        <div className="print-hide bg-slate-100 border-b border-slate-200 px-4 py-1.5 flex items-center gap-2 overflow-x-auto shrink-0 text-xs">
          <span className="font-bold text-slate-600 whitespace-nowrap">الكشوفات الواردة ({inspections.length}):</span>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {inspections.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => handleSelectInspection(item, idx)}
                className={`px-3 py-1 rounded-lg font-bold text-xs transition cursor-pointer whitespace-nowrap border ${
                  selectedIndex === idx
                    ? 'bg-[#0c4a8a] text-white border-[#0c4a8a] shadow-xs'
                    : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                }`}
              >
                <span>{item.citizenName || `كشف ${idx + 1}`}</span>
                <span className="text-[10px] opacity-75 mr-1 font-mono">({item.writerOrCollectorName})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* منطقة عرض الورقة - في الطباعة تظهر الورقة فقط */}
      <main className="flex-1 overflow-y-auto overflow-x-auto p-3 sm:p-6 bg-slate-200 print:bg-white print:p-0 flex flex-col items-center">
        {loading ? (
          <div className="py-24 text-center text-slate-600 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-bold">جاري تحميل استمارة الكشف الفني...</span>
          </div>
        ) : currentInspection ? (
          <div className="w-full flex flex-col items-center space-y-4 print:space-y-0">
            {/* معرض الصور المرفقة - يختفي عند الطباعة */}
            {showImagesDrawer && currentInspection.images && currentInspection.images.length > 0 && (
              <div className="print-hide w-full max-w-[210mm] bg-white border border-slate-300 p-4 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span>صور العقار المرفوعة ({currentInspection.images.length} صورة)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowImagesDrawer(false)}
                    className="text-slate-400 hover:text-slate-700 text-xs"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {currentInspection.images.map((img, idx) => (
                    <div
                      key={img.id || idx}
                      className="rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video relative shadow-xs"
                    >
                      <img src={img.dataUrl} alt={`صورة ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] text-white px-1.5 py-0.5 rounded font-mono">
                        {Math.round((img.sizeBytes || 0) / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* الحاوية الرسمية لورقة الـ A4 مع إمكانية التكبير والتصغير وتعديل الحقول مباشرة */}
            <div
              className="transition-transform duration-150 origin-top flex justify-center w-full print:transform-none print:m-0 print:p-0"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                marginBottom: zoomLevel > 100 ? `${(zoomLevel - 100) * 2.8}mm` : '0px'
              }}
            >
              <InspectionPrintableA4
                inspection={currentInspection}
                isEditable={true}
                onUpdate={(updated) => setCurrentInspection(updated)}
                branchManagerName={branchManagerName}
              />
            </div>
          </div>
        ) : (
          <div className="py-24 text-center text-slate-600">
            <FileText className="w-14 h-14 text-slate-400 mx-auto mb-2" />
            <p className="font-bold text-base">لا توجد كشوفات فنية حالياً</p>
          </div>
        )}
      </main>
    </div>
  )
}
