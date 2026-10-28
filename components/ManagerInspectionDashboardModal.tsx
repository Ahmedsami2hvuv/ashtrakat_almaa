'use client'

import React, { useState, useEffect } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { loadInspectionsFromCloud, updateInspectionRecord, deleteInspectionRecord } from '@/lib/inspectionStore'
import { processInspectionReportWithAI } from '@/lib/aiInspectionProcessor'
import {
  InspectionLayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  loadSavedLayoutConfig,
  saveLayoutConfigToStorage
} from '@/lib/inspectionLayoutStore'
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
  Maximize2,
  Move,
  Save,
  RotateCcw
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

  // حالة محرر التصميم التفاعلي
  const [isDesignMode, setIsDesignMode] = useState<boolean>(false)
  const [layoutConfig, setLayoutConfig] = useState<InspectionLayoutConfig>(DEFAULT_LAYOUT_CONFIG)
  const [layoutSavedNotice, setLayoutSavedNotice] = useState<string | null>(null)

  // تحميل الكشوفات وإعدادات التصميم
  const loadData = async (force = true) => {
    setLoading(true)
    const list = await loadInspectionsFromCloud(force)
    setInspections(list)
    if (list.length > 0) {
      setCurrentInspection(list[0])
      setSelectedIndex(0)
    }
    setLayoutConfig(loadSavedLayoutConfig())
    setLoading(false)
  }

  useEffect(() => {
    if (isOpen) {
      loadData(true)
      // تحديث مستمر كل 12 ثانية لجلب الكشوفات الجديدة المرفوعة من الكُتّاب فوراً
      const interval = setInterval(() => {
        loadInspectionsFromCloud(true).then((latest) => {
          setInspections(latest)
        })
      }, 12000)
      return () => clearInterval(interval)
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

  // حفظ إعدادات التصميم (مواضع وأحجام العناصر)
  const handleSaveLayout = async () => {
    const success = await saveLayoutConfigToStorage(layoutConfig)
    if (success) {
      setLayoutSavedNotice('✅ تم حفظ تصميم ومواضع عناصر الورقة بنجاح! سيتم تطبيقها دائماً عند الفتح والطباعة.')
      setTimeout(() => setLayoutSavedNotice(null), 6000)
    } else {
      alert('تعذر حفظ إعدادات التصميم')
    }
  }

  // استعادة التصميم الافتراضي
  const handleResetLayout = () => {
    if (confirm('هل ترغب في إعادة جميع العناصر إلى مواضعها وأحجامها الافتراضية؟')) {
      setLayoutConfig(DEFAULT_LAYOUT_CONFIG)
      saveLayoutConfigToStorage(DEFAULT_LAYOUT_CONFIG)
      setLayoutSavedNotice('↺ تمت استعادة التصميم الأصلي الافتراضي.')
      setTimeout(() => setLayoutSavedNotice(null), 4000)
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

  // طباعة الورقة فقط
  const handlePrint = () => {
    // إيقاف وضع التصميم مؤقتاً لضمان طباعة نقية
    const wasInDesign = isDesignMode
    if (wasInDesign) setIsDesignMode(false)
    setTimeout(() => {
      window.print()
      if (wasInDesign) setIsDesignMode(true)
    }, 100)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-slate-900/80 backdrop-blur-md print:bg-white print:p-0"
      dir="rtl"
    >
      {/* شريط الأدوات العلوي الثابت - تصميم زجاجي شفاف فاخر مع خطوط سوداء واضحة */}
      <header className="print-hide bg-white/80 backdrop-blur-2xl border-b border-slate-200/80 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0 z-20">
        {/* القسم الأيمن: عنوان الكشف وبياناته */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/90 text-slate-950 border border-slate-300/80 flex items-center justify-center shrink-0 shadow-2xs">
            <FileText className="w-5 h-5 text-slate-950 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-black text-slate-950">
                استمارة الكشف الفني الموقعي (A4)
              </h1>
              {currentInspection && (
                <span className="text-xs font-mono font-black bg-white text-slate-900 px-2 py-0.5 rounded-lg border border-slate-300 shadow-2xs">
                  {currentInspection.citizenName || 'كشف رسمي'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600 font-bold hidden sm:block">
              تعديل مباشر على الورقة + تحريك وتكبير وتخصيص أي عنصر بالماوس والكيبورد
            </p>
          </div>
        </div>

        {/* القسم الأوسط/الأيسر: أزرار العمليات الرئيسية مرتبة وواضحة جداً بتصميم زجاجي شفاف وخطوط سوداء */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* زر تفعيل/إلغاء وضع تصميم وتخصيص العناصر المباشر */}
          <button
            type="button"
            onClick={() => setIsDesignMode(!isDesignMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-xs transition active:scale-95 cursor-pointer border ${
              isDesignMode
                ? 'bg-amber-400 text-slate-950 border-amber-500 ring-2 ring-amber-300'
                : 'bg-white/90 hover:bg-white text-slate-950 border-slate-300/80'
            }`}
            title="انقر لتفعيل إمكانية النقر على أي عنصر بالورقة لتحريكه وتكبيره وتصغيره"
          >
            <Move className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            <span>{isDesignMode ? 'إيقاف تعديل المظهر' : 'تعديل مكان وحجم العناصر'}</span>
          </button>

          {/* في حال تفعيل وضع التصميم: أزرار حفظ التصميم واستعادته */}
          {isDesignMode && (
            <>
              <button
                type="button"
                onClick={handleSaveLayout}
                className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-xs transition active:scale-95 cursor-pointer border border-emerald-600"
                title="حفظ موضع وحجم العناصر الحالي كافتراضي دائم"
              >
                <Save className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                <span>حفظ التصميم</span>
              </button>

              <button
                type="button"
                onClick={handleResetLayout}
                className="flex items-center gap-1 bg-white/90 hover:bg-white text-slate-950 px-2.5 py-1.5 rounded-xl text-xs font-black border border-slate-300 cursor-pointer transition shadow-2xs"
                title="استعادة المواضع الافتراضية للورقة"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                <span>الافتراضي</span>
              </button>
            </>
          )}

          {/* التحكم في حجم الورقة وزووم الرؤية */}
          <div className="flex items-center bg-white/90 rounded-xl p-1 border border-slate-300/80 text-slate-950 hidden md:flex shadow-2xs">
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.max(70, prev - 10))}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              title="تصغير العرض"
            >
              <ZoomOut className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
            </button>
            <span className="text-xs font-mono font-black px-2 text-slate-950">{zoomLevel}%</span>
            <button
              type="button"
              onClick={() => setZoomLevel((prev) => Math.min(130, prev + 10))}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              title="تكبير العرض"
            >
              <ZoomIn className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel(100)}
              className="p-1.5 hover:bg-slate-100 rounded-lg transition text-[11px] font-black text-slate-950"
              title="الحجم الافتراضي"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
            </button>
          </div>

          {/* زر الترتيب بالذكاء الاصطناعي */}
          <button
            type="button"
            onClick={handleRunAI}
            disabled={isAiProcessing || !currentInspection}
            className="flex items-center gap-1.5 bg-white/90 hover:bg-white text-slate-950 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-xs transition active:scale-95 cursor-pointer border border-slate-300/80 disabled:opacity-50"
            title="إعادة استخلاص وترتيب البيانات بالذكاء الاصطناعي"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-500 stroke-[2.5] ${isAiProcessing ? 'animate-spin' : ''}`} />
            <span>{isAiProcessing ? 'جاري التنسيق...' : 'ترتيب بالذكاء الاصطناعي'}</span>
          </button>

          {/* زر حفظ تعديلات البيانات في السحابة */}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !currentInspection}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50 border ${
              saveSuccess
                ? 'bg-emerald-400 text-slate-950 border-emerald-500 ring-2 ring-emerald-300'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-600'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-950" />
                <span>جاري الحفظ...</span>
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                <span>تم الحفظ ✓</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
                <span>حفظ البيانات</span>
              </>
            )}
          </button>

          {/* زر الطباعة الفورية A4 - يطبع الورقة فقط */}
          <button
            type="button"
            onClick={handlePrint}
            disabled={!currentInspection}
            className="flex items-center gap-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-xs transition active:scale-95 cursor-pointer border border-sky-600"
            title="طباعة ورقة الكشف الفني فقط"
          >
            <Printer className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
            <span>طباعة الاستمارة</span>
          </button>

          {/* زر صور العقار */}
          {currentInspection && currentInspection.images && currentInspection.images.length > 0 && (
            <button
              type="button"
              onClick={() => setShowImagesDrawer(!showImagesDrawer)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-black transition border cursor-pointer shadow-2xs ${
                showImagesDrawer
                  ? 'bg-amber-100 text-slate-950 border-amber-300'
                  : 'bg-white/90 text-slate-950 hover:bg-white border-slate-300/80'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              <span>الصور ({currentInspection.images.length})</span>
            </button>
          )}

          {/* زر نسخ رابط المواطن */}
          {currentInspection && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex items-center gap-1 bg-white/90 hover:bg-white text-slate-950 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-black border border-slate-300/80 cursor-pointer transition shadow-2xs"
              title="نسخ رابط صفحة المواطن"
            >
              <Copy className="w-3 h-3 text-slate-950 stroke-[2.5]" />
              <span>{copiedLink ? 'تم النسخ!' : 'رابط الباركود'}</span>
            </button>
          )}

          {/* زر إغلاق النافذة البارز */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 bg-rose-500 hover:bg-rose-600 text-white px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-xs transition active:scale-95 cursor-pointer ml-1 border border-rose-600"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>إغلاق</span>
          </button>
        </div>
      </header>

      {/* شريط إشعار حفظ التصميم بنجاح */}
      {layoutSavedNotice && (
        <div className="print-hide bg-emerald-50 border-b border-emerald-300 px-4 py-2 text-xs sm:text-sm font-bold text-emerald-900 flex items-center justify-between gap-3 shadow-xs shrink-0 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{layoutSavedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setLayoutSavedNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

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
                isDesignMode={isDesignMode}
                layoutConfig={layoutConfig}
                onUpdateLayout={(newLayout) => setLayoutConfig(newLayout)}
                onUpdate={(updated) => setCurrentInspection(updated)}
                branchManagerName={branchManagerName}
                branchNameOverride={branchName}
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
