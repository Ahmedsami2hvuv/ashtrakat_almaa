'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { loadInspectionsFromCloud, updateInspectionRecord, deleteInspectionRecord } from '@/lib/inspectionStore'
import { processInspectionReportWithAI } from '@/lib/aiInspectionProcessor'
import InspectionPrintableA4 from './InspectionPrintableA4'
import {
  FileText,
  Sparkles,
  Printer,
  Edit3,
  Trash2,
  CheckCircle,
  ExternalLink,
  Copy,
  Plus,
  X,
  Search,
  Key,
  Calendar,
  User,
  Shield,
  Layers,
  Camera,
  Eye,
  RefreshCw
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
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedInspection, setSelectedInspection] = useState<InspectionRecord | null>(null)

  // حالة تعديل المدير للحقول
  const [isEditing, setIsEditing] = useState(false)
  const [editedRecord, setEditedRecord] = useState<InspectionRecord | null>(null)

  // الذكاء الاصطناعي
  const [apiKey, setApiKey] = useState('')
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // الطباعة
  const [showPrintPreview, setShowPrintPreview] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  // تحميل الكشوفات ومفتاح الـ API
  useEffect(() => {
    if (!isOpen) return
    async function loadData() {
      setLoading(true)
      const list = await loadInspectionsFromCloud()
      // إذا تم تحديد فرع معين، يمكننا فلترة الكشوفات أو إتاحة رؤية كشوفات الفرع
      setInspections(list)
      if (list.length > 0 && !selectedInspection) {
        setSelectedInspection(list[0])
        setEditedRecord(list[0])
      }
      setLoading(false)

      // استرجاع مفتاح Gemini المحفوظ سابقاً في المتصفح إن وُجد
      if (typeof window !== 'undefined') {
        const storedKey =
          localStorage.getItem('gemini_api_key') ||
          localStorage.getItem('ashtrakat_gemini_key') ||
          ''
        if (storedKey) setApiKey(storedKey)
      }
    }
    loadData()
  }, [isOpen])

  // فلترة الكشوفات
  const filteredInspections = useMemo(() => {
    return inspections.filter((item) => {
      const q = searchQuery.toLowerCase().trim()
      if (!q) return true
      return (
        item.citizenName?.toLowerCase().includes(q) ||
        item.writerOrCollectorName?.toLowerCase().includes(q) ||
        item.tableData?.neighborhood?.toLowerCase().includes(q) ||
        item.tableData?.plotNumber?.toLowerCase().includes(q) ||
        item.rawReportText?.toLowerCase().includes(q)
      )
    })
  }, [inspections, searchQuery])

  // عند اختيار كشف
  const handleSelectInspection = (item: InspectionRecord) => {
    setSelectedInspection(item)
    setEditedRecord(JSON.parse(JSON.stringify(item)))
    setIsEditing(false)
    setShowPrintPreview(false)
    setAiError(null)
  }

  // تشغيل المعالجة بالذكاء الاصطناعي
  const handleRunAI = async () => {
    if (!editedRecord) return
    if (!apiKey.trim()) {
      setAiError('يرجى إدخال مفتاح Google Gemini أولاً لاستخدام الذكاء الاصطناعي')
      return
    }

    setIsAiProcessing(true)
    setAiError(null)

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('gemini_api_key', apiKey.trim())
      }

      const extracted = await processInspectionReportWithAI(
        editedRecord.rawReportText,
        [apiKey.trim()],
        editedRecord.writerOrCollectorName,
        editedRecord.branchName
      )

      const updated: InspectionRecord = {
        ...editedRecord,
        citizenName: extracted.citizenName || editedRecord.citizenName,
        inspectionDate: extracted.inspectionDate || editedRecord.inspectionDate,
        tableData: {
          sequence: 1,
          governorate: extracted.tableData.governorate || editedRecord.tableData?.governorate || 'البصرة',
          district: extracted.tableData.district || editedRecord.tableData?.district || 'ابي الخصيب',
          neighborhood: extracted.tableData.neighborhood || editedRecord.tableData?.neighborhood || '',
          plotNumber: extracted.tableData.plotNumber || editedRecord.tableData?.plotNumber || '',
          sectorNumber: extracted.tableData.sectorNumber || editedRecord.tableData?.sectorNumber || ''
        },
        reportPoints: extracted.reportPoints && extracted.reportPoints.length > 0 ? extracted.reportPoints : editedRecord.reportPoints,
        inspectorEmployeeName: extracted.inspectorEmployeeName || editedRecord.inspectorEmployeeName,
        networksManagerName: extracted.networksManagerName || editedRecord.networksManagerName,
        revenuesManagerName: extracted.revenuesManagerName || editedRecord.revenuesManagerName,
        typistName: extracted.typistName || editedRecord.typistName,
        status: 'reviewed',
        updatedAt: new Date().toISOString()
      }

      setEditedRecord(updated)
      setSelectedInspection(updated)
      await updateInspectionRecord(updated)
      setInspections((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشلت معالجة التقرير بالذكاء الاصطناعي'
      setAiError(msg)
    } finally {
      setIsAiProcessing(false)
    }
  }

  // حفظ التعديلات اليدوية للمدير
  const handleSaveEdits = async () => {
    if (!editedRecord) return
    await updateInspectionRecord(editedRecord)
    setSelectedInspection(editedRecord)
    setInspections((prev) => prev.map((item) => (item.id === editedRecord.id ? editedRecord : item)))
    setIsEditing(false)
  }

  // حذف الكشف
  const handleDeleteInspection = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الكشف الفني؟ لا يمكن التراجع عن هذه الخطوة.')) return
    await deleteInspectionRecord(id)
    const updated = inspections.filter((item) => item.id !== id)
    setInspections(updated)
    if (selectedInspection?.id === id) {
      setSelectedInspection(updated[0] || null)
      setEditedRecord(updated[0] || null)
    }
  }

  // نسخ رابط المواطن
  const handleCopyLink = () => {
    if (!selectedInspection) return
    const url = `${window.location.origin}/inspection/${selectedInspection.id}`
    navigator.clipboard.writeText(url)
    setCopiedLink(true)
    setTimeout(() => setCopiedLink(false), 2500)
  }

  // إضافة نقطة جديدة في التقرير
  const handleAddReportPoint = () => {
    if (!editedRecord) return
    const currentPoints = editedRecord.reportPoints || []
    setEditedRecord({
      ...editedRecord,
      reportPoints: [...currentPoints, '']
    })
  }

  // تعديل نقطة
  const handleUpdateReportPoint = (index: number, val: string) => {
    if (!editedRecord) return
    const currentPoints = [...(editedRecord.reportPoints || [])]
    currentPoints[index] = val
    setEditedRecord({
      ...editedRecord,
      reportPoints: currentPoints
    })
  }

  // حذف نقطة
  const handleRemoveReportPoint = (index: number) => {
    if (!editedRecord) return
    const currentPoints = (editedRecord.reportPoints || []).filter((_, idx) => idx !== index)
    setEditedRecord({
      ...editedRecord,
      reportPoints: currentPoints
    })
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
      style={{
        backgroundColor: 'rgba(5, 10, 25, 0.5)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
      dir="rtl"
    >
      <div
        className="relative w-full max-w-7xl max-h-[94vh] rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden my-auto border border-white/20"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.85) 100%)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)'
        }}
      >
        {/* شريط العنوان العلوي */}
        <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 p-4 sm:p-5 border-b border-blue-900/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-white">
                نظام وإدارة الكشوفات الفنية الرسمية
              </h1>
              <p className="text-xs text-blue-300 font-semibold">
                مديرية ماء البصرة - قسم الكشوفات الفنية لمسؤول الواردات والإدارة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-800 hover:bg-rose-600/80 text-slate-300 hover:text-white flex items-center justify-center transition-colors shadow-md"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* جسم النافذة: عمود القائمة يميناً + لوحة التحكم والمعاينة يساراً */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* عمود الكشوفات الواردة (يمين) */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-l border-slate-800 bg-slate-950/70 flex flex-col shrink-0">
            {/* مربع البحث */}
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="بحث باسم المواطن، الكاتب، المحلة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pr-9 pl-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex justify-between items-center mt-2 text-[11px] text-slate-400 font-bold px-1">
                <span>إجمالي الكشوفات: {filteredInspections.length}</span>
                <button
                  type="button"
                  onClick={async () => {
                    setLoading(true)
                    const data = await loadInspectionsFromCloud()
                    setInspections(data)
                    setLoading(false)
                  }}
                  className="flex items-center gap-1 text-sky-400 hover:text-sky-300 transition"
                  title="تحديث من السحابة الآن"
                >
                  <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                  <span>تحديث السحابة</span>
                </button>
              </div>
            </div>

            {/* قائمة الكشوفات */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
              {loading ? (
                <div className="p-8 text-center text-slate-400 text-xs">جاري جلب الكشوفات...</div>
              ) : filteredInspections.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">لا توجد كشوفات واردة مطابقة</div>
              ) : (
                filteredInspections.map((item) => {
                  const isSelected = selectedInspection?.id === item.id
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelectInspection(item)}
                      className={`p-3 rounded-2xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600/20 border border-blue-500/50 shadow-md'
                          : 'hover:bg-slate-900 border border-transparent'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-black text-white">
                          {item.citizenName || 'مواطن غير مسمى'}
                        </span>
                        <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                          {item.inspectionDate || item.createdAt.substring(0, 10)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1 mb-2">
                        {item.tableData?.neighborhood ? `محلة: ${item.tableData.neighborhood}` : item.rawReportText}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-sky-400 font-semibold">
                          <User className="w-3 h-3" />
                          <span>{item.writerOrCollectorName}</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Camera className="w-3 h-3 text-emerald-400" />
                          <span>{item.images?.length || 0} صور</span>
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* لوحة التفاصيل والذكاء الاصطناعي والمعاينة (يسار) */}
          <div className="flex-1 flex flex-col bg-slate-900 overflow-y-auto p-4 sm:p-6 space-y-5">
            {selectedInspection && editedRecord ? (
              <>
                {/* شريط الإجراءات السريعة للمدير */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-bold">حالة الكشف:</span>
                    <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-lg font-bold">
                      {editedRecord.status === 'reviewed' ? 'تمت المعالجة الفنية' : 'بانتظار المعالجة'}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* زر المعاينة والطباعة */}
                    <button
                      onClick={() => setShowPrintPreview(!showPrintPreview)}
                      className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-500 text-white px-3.5 py-2 rounded-xl text-xs font-black transition shadow"
                    >
                      <Printer className="w-4 h-4" />
                      <span>{showPrintPreview ? 'العودة للبيانات' : 'معاينة وطباعة الورقة الرسمية (A4)'}</span>
                    </button>

                    {/* زر نسخ رابط المواطن */}
                    <button
                      onClick={handleCopyLink}
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-slate-700"
                    >
                      <Copy className="w-4 h-4 text-blue-400" />
                      <span>{copiedLink ? 'تم نسخ الرابط!' : 'رابط الباركود'}</span>
                    </button>

                    {/* فتح صفحة المواطن */}
                    <a
                      href={`/inspection/${selectedInspection.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition border border-slate-700"
                      title="فتح صفحة المواطن للمعاينة"
                    >
                      <ExternalLink className="w-4 h-4 text-emerald-400" />
                      <span>صفحة المواطن</span>
                    </a>

                    {/* حذف الكشف */}
                    <button
                      onClick={() => handleDeleteInspection(selectedInspection.id)}
                      className="p-2 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl transition"
                      title="حذف الكشف"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* عرض معاينة الورقة الرسمية A4 للطباعة المباشرة */}
                {showPrintPreview ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center bg-blue-950/40 border border-blue-800/40 p-4 rounded-2xl text-xs sm:text-sm text-blue-300">
                      <span>📄 ورقة الكشف الفني الرسمية جاهزة ومطابقة لنموذج مديرية ماء البصرة.</span>
                      <button
                        onClick={() => window.print()}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-xl font-black shadow-lg"
                      >
                        <Printer className="w-4 h-4" />
                        <span>طباعة فورية</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto p-4 bg-slate-950 rounded-2xl flex justify-center border border-slate-800">
                      <InspectionPrintableA4 inspection={editedRecord} />
                    </div>
                  </div>
                ) : (
                  <>
                    {/* قسم الذكاء الاصطناعي (AI Extraction) */}
                    <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-blue-950/60 border border-indigo-700/50 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/40">
                            <Sparkles className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-white">الذكاء الاصطناعي لاستخلاص وتنظيم الكشف</h3>
                            <p className="text-[11px] text-indigo-300">
                              يحلل تقرير الكاتب/المحصل ويرتبه على شكل نقاط ويستخلص اسم المواطن والعقار والمحلة
                            </p>
                          </div>
                        </div>

                        {/* زر تشغيل الذكاء الاصطناعي */}
                        <button
                          type="button"
                          onClick={handleRunAI}
                          disabled={isAiProcessing}
                          className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg shadow-indigo-950/50 transition active:scale-95 disabled:opacity-50"
                        >
                          {isAiProcessing ? (
                            <>
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              <span>جاري التحليل والترتيب...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>استخلاص وترتيب بالذكاء الاصطناعي</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* إدخال مفتاح الـ API */}
                      <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5 text-xs">
                        <Key className="w-4 h-4 text-amber-400 shrink-0" />
                        <input
                          type="password"
                          placeholder="مفتاح Google Gemini API (اختياري، أو يتم استخدام المفتاح المحفوظ)..."
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          className="bg-transparent text-white placeholder-slate-500 text-xs flex-1 outline-none font-mono"
                        />
                      </div>

                      {aiError && (
                        <p className="text-rose-400 text-xs font-bold mt-2 bg-rose-950/40 p-2 rounded-lg border border-rose-900/50">
                          {aiError}
                        </p>
                      )}
                    </div>

                    {/* التقرير الأصلي للكاتب أو المحصل */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-black text-slate-300 flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-blue-400" />
                          <span>التقرير الميداني الأصلي (مقدم من: {editedRecord.writerOrCollectorName})</span>
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {editedRecord.createdAt.substring(0, 16).replace('T', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800 leading-relaxed font-mono">
                        {editedRecord.rawReportText}
                      </p>
                    </div>

                    {/* صور العقار المرفوعة */}
                    {editedRecord.images && editedRecord.images.length > 0 && (
                      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
                        <h4 className="text-xs font-black text-slate-300 mb-3 flex items-center gap-1.5">
                          <Camera className="w-4 h-4 text-emerald-400" />
                          <span>الصور الميدانية المرفقة بالعقار ({editedRecord.images.length} صورة WebP)</span>
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          {editedRecord.images.map((img, idx) => (
                            <div
                              key={img.id || idx}
                              className="rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video relative group"
                            >
                              <img
                                src={img.dataUrl}
                                alt={`صورة ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] text-white px-1 py-0.5 rounded font-mono">
                                {Math.round((img.sizeBytes || 0) / 1024)} KB
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* لوحة تحرير بيانات الكشف الفني المنظم (المدير يستطيع تعديل كل شيء) */}
                    <div className="bg-slate-950 border border-blue-900/50 rounded-2xl p-5 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <Edit3 className="w-5 h-5 text-sky-400" />
                          <h3 className="text-sm sm:text-base font-black text-white">
                            بيانات استمارة الكشف الفني الرسمية (قابلة للتعديل بالكامل)
                          </h3>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveEdits}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-black transition shadow"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>حفظ التعديلات</span>
                        </button>
                      </div>

                      {/* اسم المواطن والتاريخ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">
                            اسم المواطن / العائد له العقار:
                          </label>
                          <input
                            type="text"
                            value={editedRecord.citizenName}
                            onChange={(e) =>
                              setEditedRecord({ ...editedRecord, citizenName: e.target.value })
                            }
                            placeholder="مثال: نور اياد اكرم ومنقذ جواد كاظم"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1">
                            تاريخ الكشف (YYYY/MM/DD):
                          </label>
                          <input
                            type="text"
                            value={editedRecord.inspectionDate}
                            onChange={(e) =>
                              setEditedRecord({ ...editedRecord, inspectionDate: e.target.value })
                            }
                            placeholder="مثال: 2026/10/26"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* جدول سند الطابو */}
                      <div className="pt-2">
                        <label className="block text-xs font-bold text-slate-300 mb-2">
                          جدول معلومات العقار (سند الطابو والموقع):
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">المحافظة:</span>
                            <input
                              type="text"
                              value={editedRecord.tableData?.governorate || 'البصرة'}
                              onChange={(e) =>
                                setEditedRecord({
                                  ...editedRecord,
                                  tableData: { ...editedRecord.tableData, governorate: e.target.value }
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">القضاء:</span>
                            <input
                              type="text"
                              value={editedRecord.tableData?.district || 'ابي الخصيب'}
                              onChange={(e) =>
                                setEditedRecord({
                                  ...editedRecord,
                                  tableData: { ...editedRecord.tableData, district: e.target.value }
                                })
                              }
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">المحلة:</span>
                            <input
                              type="text"
                              value={editedRecord.tableData?.neighborhood || ''}
                              onChange={(e) =>
                                setEditedRecord({
                                  ...editedRecord,
                                  tableData: { ...editedRecord.tableData, neighborhood: e.target.value }
                                })
                              }
                              placeholder="مثال: شيخ ابراهيم"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">رقم القطعة:</span>
                            <input
                              type="text"
                              value={editedRecord.tableData?.plotNumber || ''}
                              onChange={(e) =>
                                setEditedRecord({
                                  ...editedRecord,
                                  tableData: { ...editedRecord.tableData, plotNumber: e.target.value }
                                })
                              }
                              placeholder="مثال: 80/185"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                            />
                          </div>

                          <div>
                            <span className="text-[10px] text-slate-400 block mb-1">رقم المقاطعة:</span>
                            <input
                              type="text"
                              value={editedRecord.tableData?.sectorNumber || ''}
                              onChange={(e) =>
                                setEditedRecord({
                                  ...editedRecord,
                                  tableData: { ...editedRecord.tableData, sectorNumber: e.target.value }
                                })
                              }
                              placeholder="مثال: 20"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>

                      {/* نقاط تقرير الكشف المرتبة */}
                      <div className="pt-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-300">
                            فقرات ونتائج تقرير الكشف الفني (مرتبة كنقاط رسمية):
                          </label>
                          <button
                            type="button"
                            onClick={handleAddReportPoint}
                            className="flex items-center gap-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-blue-300 px-2.5 py-1 rounded-lg border border-slate-700 transition"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>إضافة نقطة</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(editedRecord.reportPoints || []).map((pt, index) => (
                            <div key={index} className="flex items-start gap-2">
                              <span className="w-6 h-6 rounded-lg bg-blue-900/60 text-blue-300 text-xs font-black flex items-center justify-center shrink-0 mt-1">
                                {index + 1}
                              </span>
                              <textarea
                                rows={2}
                                value={pt}
                                onChange={(e) => handleUpdateReportPoint(index, e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl p-2 text-xs text-white focus:outline-none focus:border-blue-500 leading-relaxed resize-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveReportPoint(index)}
                                className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition"
                                title="حذف النقطة"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* أسماء الموقعين والتواقيع */}
                      <div className="pt-2 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">موظف الكشف:</label>
                          <input
                            type="text"
                            value={editedRecord.inspectorEmployeeName}
                            onChange={(e) =>
                              setEditedRecord({
                                ...editedRecord,
                                inspectorEmployeeName: e.target.value
                              })
                            }
                            placeholder="مثال: رضا سلمان فياض"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">م. الشبكات:</label>
                          <input
                            type="text"
                            value={editedRecord.networksManagerName}
                            onChange={(e) =>
                              setEditedRecord({
                                ...editedRecord,
                                networksManagerName: e.target.value
                              })
                            }
                            placeholder="مسؤول الشبكات"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">م. الواردات:</label>
                          <input
                            type="text"
                            value={editedRecord.revenuesManagerName}
                            onChange={(e) =>
                              setEditedRecord({
                                ...editedRecord,
                                revenuesManagerName: e.target.value
                              })
                            }
                            placeholder="مثال: حسين علي لفتة جابر"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1">منظم / طابع التقرير:</label>
                          <input
                            type="text"
                            value={editedRecord.typistName}
                            onChange={(e) =>
                              setEditedRecord({
                                ...editedRecord,
                                typistName: e.target.value
                              })
                            }
                            placeholder="مثال: نور جبار"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                          />
                        </div>
                      </div>

                      {/* زر الحفظ السفلي */}
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={handleSaveEdits}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-xl text-xs font-black shadow-lg transition active:scale-95"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>حفظ جميع التعديلات في السحابة</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                <FileText className="w-16 h-16 text-slate-700 mb-3" />
                <h3 className="text-base font-bold text-slate-400">اختر كشفاً من القائمة الجانبية</h3>
                <p className="text-xs text-slate-500 mt-1">
                  يمكنك مراجعة تقرير الكشف، استخلاصه بالذكاء الاصطناعي، وتعديله وطباعته كوثيقة A4
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
