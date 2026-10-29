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

  // أزرار زجاجية بيضاء شفافة حقيقية فوق خلفية سماوية
  const glassBtnStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.42)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
    border: '1px solid rgba(255, 255, 255, 0.85)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.95), 0 8px 22px rgba(14, 165, 233, 0.14), 0 1px 2px rgba(15, 23, 42, 0.06)'
  }

  const glassBtnClass =
    'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black text-slate-900 transition active:scale-95 cursor-pointer disabled:opacity-45 hover:brightness-110'

  const modal = (
    <div
      className="fixed inset-0 z-[2147483000] flex flex-col print:bg-white print:p-0"
      dir="rtl"
      style={{ background: '#dbeafe' }}
    >
      {/* طبقة تغطية كاملة — ما تبين أي صفحة خلفها */}
      <div className="print-hide absolute inset-0" style={{ background: 'linear-gradient(180deg, #e0f2fe 0%, #dbeafe 40%, #e2e8f0 100%)' }} aria-hidden />

      {/* شريط زجاجي مضغوط فوق خلفية سماوية */}
      <header
        className="print-hide relative shrink-0 z-20"
        style={{
          background: 'linear-gradient(135deg, rgba(14,165,233,0.35) 0%, rgba(56,189,248,0.22) 45%, rgba(255,255,255,0.35) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(255,255,255,0.65)',
          boxShadow: '0 10px 40px rgba(14,165,233,0.12)'
        }}
      >
        <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={glassBtnStyle}
            >
              <FileText className="w-4 h-4 text-slate-900 stroke-[2.2]" />
            </div>
            <h1 className="text-sm sm:text-base font-black text-slate-950 whitespace-nowrap drop-shadow-sm">
              استمارة الكشف
            </h1>
            {currentInspection && (
              <span
                className="text-xs sm:text-sm font-black text-slate-900 px-3 py-1.5 rounded-full truncate max-w-[42vw] sm:max-w-xs"
                style={glassBtnStyle}
              >
                {currentInspection.citizenName || 'كشف رسمي'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setIsDesignMode(!isDesignMode)}
              className={glassBtnClass}
              style={{
                ...glassBtnStyle,
                ...(isDesignMode
                  ? {
                      background: 'rgba(253, 230, 138, 0.55)',
                      border: '1px solid rgba(251, 191, 36, 0.7)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 2px rgba(251,191,36,0.35)'
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
                <button type="button" onClick={handleSaveLayout} className={glassBtnClass} style={glassBtnStyle} title="حفظ التصميم">
                  <Save className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>حفظ التصميم</span>
                </button>
                <button type="button" onClick={handleResetLayout} className={glassBtnClass} style={glassBtnStyle} title="الافتراضي">
                  <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>الافتراضي</span>
                </button>
              </>
            )}

            <div className={`${glassBtnClass} hidden md:inline-flex !gap-0 !px-1`} style={glassBtnStyle}>
              <button type="button" onClick={() => setZoomLevel((p) => Math.max(70, p - 10))} className="p-1.5 rounded-lg hover:bg-white/50" title="تصغير">
                <ZoomOut className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
              <span className="text-[11px] font-mono font-black px-1.5">{zoomLevel}%</span>
              <button type="button" onClick={() => setZoomLevel((p) => Math.min(130, p + 10))} className="p-1.5 rounded-lg hover:bg-white/50" title="تكبير">
                <ZoomIn className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleRunAI}
              disabled={isAiProcessing || !currentInspection}
              className={glassBtnClass}
              style={glassBtnStyle}
              title="ترتيب بالذكاء الاصطناعي"
            >
              <Sparkles className={`w-3.5 h-3.5 text-amber-500 stroke-[2.5] ${isAiProcessing ? 'animate-spin' : ''}`} />
              <span>{isAiProcessing ? 'جاري...' : 'ذكاء اصطناعي'}</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !currentInspection}
              className={glassBtnClass}
              style={{
                ...glassBtnStyle,
                ...(saveSuccess
                  ? {
                      background: 'rgba(167, 243, 208, 0.55)',
                      border: '1px solid rgba(52, 211, 153, 0.7)'
                    }
                  : {})
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
              title="طباعة"
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
              <button type="button" onClick={handleCopyLink} className={glassBtnClass} style={glassBtnStyle} title="رابط الباركود">
                <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{copiedLink ? 'تم النسخ' : 'رابط'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-2xl text-xs font-black text-white transition active:scale-95 cursor-pointer"
              style={{
                background: 'rgba(244, 63, 94, 0.88)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.35)',
                boxShadow: '0 8px 22px rgba(244, 63, 94, 0.28)'
              }}
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>إغلاق</span>
            </button>
          </div>
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
