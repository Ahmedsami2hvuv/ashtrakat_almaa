'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { InspectionRecord } from '@/lib/inspectionTypes'
import {
  loadInspectionsFromCloud,
  loadFullInspectionById,
  updateInspectionRecord,
  deleteInspectionRecord
} from '@/lib/inspectionStore'
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
  /** عند الفتح من صف كشف معيّن: يعرض هذا الكشف فقط بدون شريط القائمة */
  initialInspection?: InspectionRecord | null
}

export default function ManagerInspectionDashboardModal({
  isOpen,
  onClose,
  branchId,
  branchName,
  branchManagerName,
  initialInspection = null
}: ManagerInspectionDashboardModalProps) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [currentInspection, setCurrentInspection] = useState<InspectionRecord | null>(null)
  const focusSingleOnly = !!initialInspection?.id

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
  const [portalReady, setPortalReady] = useState(false)

  useEffect(() => {
    setPortalReady(true)
  }, [])

  // تحميل قائمة خفيفة أولاً، ثم تعبئة الكشف الحالي بصوره الكاملة عند الحاجة
  const hydrateInspection = async (item: InspectionRecord) => {
    const needsImages =
      Array.isArray(item.images) &&
      item.images.length > 0 &&
      item.images.some((img) => !(img.dataUrl && img.dataUrl.length > 32))

    if (!needsImages) {
      setCurrentInspection(JSON.parse(JSON.stringify(item)))
      return
    }

    setCurrentInspection(JSON.parse(JSON.stringify(item)))
    const full = await loadFullInspectionById(item.id)
    if (full) {
      setCurrentInspection(full)
      setInspections((prev) => prev.map((row) => (row.id === full.id ? { ...row, images: full.images } : row)))
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // فتح كشف محدد فقط من زر المعاينة/التعديل
      if (initialInspection?.id) {
        setInspections([initialInspection])
        setSelectedIndex(0)
        await hydrateInspection(initialInspection)
        setLoading(false)
        const full = await loadFullInspectionById(initialInspection.id)
        if (full) {
          setCurrentInspection(full)
          setInspections([full])
        }
        return
      }

      const cached = await loadInspectionsFromCloud({ forceRefresh: false, full: false })
      if (cached.length > 0) {
        setInspections(cached)
        await hydrateInspection(cached[0])
        setSelectedIndex(0)
        setLoading(false)
      }

      const list = await loadInspectionsFromCloud({ forceRefresh: true, full: false })
      setInspections(list)
      if (list.length > 0) {
        await hydrateInspection(list[0])
        setSelectedIndex(0)
      } else {
        setCurrentInspection(null)
      }
    } finally {
      setLayoutConfig(loadSavedLayoutConfig())
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData()
      if (focusSingleOnly) return
      const interval = setInterval(() => {
        loadInspectionsFromCloud({ forceRefresh: true, full: false }).then((latest) => {
          setInspections(latest)
          setLoading(false)
        })
      }, 20000)
      return () => clearInterval(interval)
    }
  }, [isOpen, initialInspection?.id])

  // التبديل بين الكشوفات
  const handleSelectInspection = (item: InspectionRecord, index: number) => {
    setSelectedIndex(index)
    setAiNotice(null)
    setSaveSuccess(false)
    void hydrateInspection(item)
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

      const officialBranchName = branchName || currentInspection.branchName || 'مركز جباية واردات أبي الخصيب'

      const extracted = await processInspectionReportWithAI(
        currentInspection.rawReportText,
        storedKey ? [storedKey] : [],
        currentInspection.writerOrCollectorName,
        officialBranchName
      )

      const updated: InspectionRecord = {
        ...currentInspection,
        branchName: officialBranchName,
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

  if (!isOpen || !portalReady) return null

  // زجاج أبيض واضح فوق شريط أبيض صلب
  const glassBtnStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.78)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    border: '1.5px solid rgba(186, 230, 253, 0.95)',
    boxShadow:
      'inset 0 1px 0 #ffffff, 0 6px 18px rgba(14, 165, 233, 0.12), 0 1px 2px rgba(15, 23, 42, 0.05)'
  }

  const glassBtnClass =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-black text-slate-900 transition active:scale-95 cursor-pointer disabled:opacity-45 shrink-0 hover:bg-white'

  const modal = (
    <div
      className="fixed inset-0 flex flex-col print:bg-white print:p-0"
      dir="rtl"
      style={{ background: '#e0f2fe', zIndex: 999999 }}
    >
      {/* شريط علوي بنفس شكل هيدر النظام: يمين العنوان — يسار الأزرار بصف مسئول الفرع */}
      <div
        className="inspection-no-print print-hide relative shrink-0"
        style={{
          height: 'auto',
          minHeight: 65,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.9)',
          boxShadow: '0 1px 20px rgba(14,165,233,0.08)',
          zIndex: 2
        }}
      >
        <div className="w-full max-w-[1600px] mx-auto px-3 sm:px-4 py-2 flex items-center justify-between gap-2">
          {/* يمين: استمارة الكشف + اسم المواطن */}
          <div className="flex items-center gap-2 min-w-0 shrink">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white font-black"
              style={{ background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', boxShadow: '0 4px 10px rgba(14,165,233,.25)' }}
            >
              <FileText className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-black text-slate-900 whitespace-nowrap leading-tight">
                استمارة الكشف
              </div>
              {currentInspection && (
                <div className="text-[11px] font-bold text-sky-700 truncate max-w-[28vw] sm:max-w-[220px]">
                  {currentInspection.citizenName || 'كشف رسمي'}
                </div>
              )}
            </div>
          </div>

          {/* يسار: بصف مسئول الفرع — الأزرار الزجاجية ظاهرة دائماً */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end max-w-[70%] sm:max-w-none">
            <div
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-white border border-sky-100 px-2.5 py-1 shadow-sm shrink-0"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,.6)]" />
              <small className="text-[10px] font-bold text-slate-400">مسئول الفرع:</small>
              <span className="text-xs font-black text-slate-800 whitespace-nowrap">
                {branchManagerName || '—'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsDesignMode(!isDesignMode)}
              className={glassBtnClass}
              style={{
                ...glassBtnStyle,
                ...(isDesignMode
                  ? {
                      background: 'rgba(254, 243, 199, 0.95)',
                      border: '1.5px solid #fbbf24'
                    }
                  : {})
              }}
              title="تفعيل أو تعطيل تحريك عناصر الورقة"
            >
              <Move className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isDesignMode ? 'تعطيل العناصر' : 'تفعيل العناصر'}</span>
            </button>

            {isDesignMode && (
              <>
                <button type="button" onClick={handleSaveLayout} className={glassBtnClass} style={glassBtnStyle}>
                  <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>حفظ التصميم</span>
                </button>
                <button type="button" onClick={handleResetLayout} className={glassBtnClass} style={glassBtnStyle}>
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>الافتراضي</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleRunAI}
              disabled={isAiProcessing || !currentInspection}
              className={glassBtnClass}
              style={glassBtnStyle}
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-500 stroke-[2.5] ${isAiProcessing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline sm:inline">{isAiProcessing ? 'جاري...' : 'ذكاء'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !currentInspection}
              className={glassBtnClass}
              style={{
                ...glassBtnStyle,
                ...(saveSuccess ? { background: 'rgba(167,243,208,0.95)', border: '1.5px solid #34d399' } : {})
              }}
            >
              {isSaving ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin stroke-[2.5]" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              )}
              <span>{isSaving ? '...' : saveSuccess ? 'تم' : 'حفظ'}</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={!currentInspection}
              className={glassBtnClass}
              style={glassBtnStyle}
            >
              <Printer className="w-3.5 h-3.5 text-sky-700 stroke-[2.5]" />
              <span>طباعة</span>
            </button>

            {currentInspection && currentInspection.images && currentInspection.images.length > 0 && (
              <button
                type="button"
                onClick={() => setShowImagesDrawer(!showImagesDrawer)}
                className={glassBtnClass}
                style={glassBtnStyle}
              >
                <Camera className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                <span>صور ({currentInspection.images.length})</span>
              </button>
            )}

            {currentInspection && (
              <button type="button" onClick={handleCopyLink} className={glassBtnClass} style={glassBtnStyle}>
                <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{copiedLink ? 'تم' : 'رابط'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black text-white shrink-0 transition active:scale-95 cursor-pointer"
              style={{
                background: '#f43f5e',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 6px 16px rgba(244, 63, 94, 0.3)'
              }}
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>إغلاق</span>
            </button>
          </div>
        </div>
      </div>

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

      {/* شريط الكشوفات المتعددة — يُخفى عند فتح كشف محدد من المعاينة */}
      {!focusSingleOnly && inspections.length > 1 && (
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

      {/* منطقة عرض الورقة — ملتصقة من أعلى الشريط مباشرة */}
      <main className="relative flex-1 overflow-y-auto overflow-x-auto pt-3 pb-8 px-2 sm:px-4 print:bg-white print:p-0 flex flex-col items-center">
        {loading ? (
          <div className="py-24 text-center text-slate-600 flex flex-col items-center justify-center">
            <div className="w-10 h-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-bold">جاري تحميل استمارة الكشف الفني...</span>
          </div>
        ) : currentInspection ? (
          <div className="w-full flex flex-col items-center space-y-3 print:space-y-0">
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

  return createPortal(modal, document.body)
}
