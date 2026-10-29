'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { loadInspectionsFromCloud, deleteInspectionRecord } from '@/lib/inspectionStore'
import { DirectorateBranch } from '@/lib/directorateTypes'
import {
  FileText,
  Eye,
  Trash2,
  RefreshCw,
  Copy,
  Camera,
  CheckCircle2,
  Clock,
  Search,
  Pencil,
  Download,
  Droplets,
  X
} from 'lucide-react'

interface BranchInspectionsTabProps {
  branch: DirectorateBranch
  managerName?: string
  onOpenInspectionModal: (record?: InspectionRecord) => void
}

type StatusFilter = 'all' | 'pending' | 'done'

function cleanBranchLabel(name?: string): string {
  if (!name) return 'أبي الخصيب'
  return name
    .replace(/مديرية\s+ماء\s+البصرة/gi, '')
    .replace(/مركز\s+جباية\s+واردات/gi, '')
    .replace(/مركز\s+واردات/gi, '')
    .replace(/فرع\s+واردات/gi, '')
    .replace(/\bفرع\b/gi, '')
    .replace(/^\s*واردات\s+/gi, '')
    .trim() || name
}

function statusLabel(status: InspectionRecord['status']): string {
  if (status === 'approved') return 'معتمد'
  if (status === 'reviewed') return 'تمت المعالجة'
  if (status === 'rejected') return 'مرفوض'
  return 'قيد التدقيق'
}

function isDoneStatus(status: InspectionRecord['status']) {
  return status === 'reviewed' || status === 'approved'
}

function isThisWeek(isoOrDate: string | undefined): boolean {
  if (!isoOrDate) return false
  const d = new Date(isoOrDate)
  if (Number.isNaN(d.getTime())) return false
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  return d >= weekAgo && d <= now
}

export default function BranchInspectionsTab({
  branch,
  managerName,
  onOpenInspectionModal
}: BranchInspectionsTabProps) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const branchShort = cleanBranchLabel(branch.name)
  const managerLabel = managerName || branch.managers?.[0]?.name || 'مسؤول الفرع'

  const fetchInspections = async (force = true) => {
    setLoading(true)
    try {
      if (force) {
        const cached = await loadInspectionsFromCloud({ forceRefresh: false, full: false })
        if (cached.length > 0) {
          setInspections(cached)
          setLoading(false)
        }
      }
      const data = await loadInspectionsFromCloud({ forceRefresh: true, full: false })
      setInspections(data)
    } catch (err) {
      console.error('Failed to load inspections:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInspections(true)
    const interval = setInterval(() => {
      loadInspectionsFromCloud({ forceRefresh: true, full: false }).then((latest) => {
        setInspections(latest)
        setLoading(false)
      })
    }, 20000)
    return () => clearInterval(interval)
  }, [branch.id])

  const branchInspections = useMemo(() => {
    return inspections.filter((item) => {
      if (!branch.id) return true
      if (!item.branchId) {
        const shortName = branchShort
        return (
          !item.branchName ||
          item.branchName.includes(shortName) ||
          item.branchName.includes(branch.name)
        )
      }
      return item.branchId === branch.id
    })
  }, [inspections, branch.id, branch.name, branchShort])

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return branchInspections.filter((item) => {
      const matchesSearch =
        !q ||
        item.citizenName?.toLowerCase().includes(q) ||
        item.writerOrCollectorName?.toLowerCase().includes(q) ||
        item.tableData?.neighborhood?.toLowerCase().includes(q) ||
        item.rawReportText?.toLowerCase().includes(q)

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'pending' && item.status === 'pending') ||
        (statusFilter === 'done' && isDoneStatus(item.status))

      return matchesSearch && matchesStatus
    })
  }, [branchInspections, searchQuery, statusFilter])

  const stats = useMemo(() => {
    const pending = branchInspections.filter((i) => i.status === 'pending').length
    const total = branchInspections.length
    const photographed = branchInspections.filter((i) => i.images && i.images.length > 0).length
    const approved = branchInspections.filter((i) => isDoneStatus(i.status)).length
    const weekNew = branchInspections.filter((i) => isThisWeek(i.createdAt)).length
    const photoPct = total > 0 ? Math.round((photographed / total) * 100) : 0
    return { pending, total, photographed, approved, weekNew, photoPct }
  }, [branchInspections])

  const handleCopyLink = (item: InspectionRecord) => {
    const url = `${window.location.origin}/inspection/${item.id}`
    navigator.clipboard.writeText(url)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الكشف الفني؟')) return
    await deleteInspectionRecord(id)
    setInspections((prev) => prev.filter((i) => i.id !== id))
  }

  const handleExportCsv = () => {
    const rows = [
      ['ت', 'القائم بالكشف', 'الدور', 'المواطن', 'المحلة', 'التاريخ', 'الصور', 'الحالة'],
      ...filtered.map((item, idx) => [
        String(idx + 1),
        item.writerOrCollectorName || '',
        item.userRole === 'writer' ? 'كاتب' : 'محصل',
        item.citizenName || '',
        item.tableData?.neighborhood || '',
        item.inspectionDate || item.createdAt?.substring(0, 10) || '',
        String(item.images?.length || 0),
        statusLabel(item.status)
      ])
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kushufat_${branchShort}_${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
  }

  return (
    <div
      dir="rtl"
      className="min-h-[70vh] -mx-1 sm:-mx-2 rounded-[28px] p-3 sm:p-4"
      style={{
        background:
          'radial-gradient(1200px 600px at 15% -5%, #e0f2fe 0%, transparent 60%), radial-gradient(800px 400px at 85% 10%, #bae6fd 0%, transparent 55%), linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)'
      }}
    >
      <style>{`
        .insp-glass {
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.95);
          box-shadow: 0 8px 32px rgba(15,23,42,0.06);
        }
        .insp-glass-strong {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid #fff;
          box-shadow: 0 10px 36px rgba(15,23,42,0.07);
        }
      `}</style>

      {/* هيدر */}
      <header className="insp-glass-strong h-[65px] rounded-2xl px-4 flex items-center justify-between mb-4 sticky top-2 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[12px] sm:text-[13px] font-bold bg-white border border-slate-200/80 px-3 py-1.5 rounded-full text-slate-800 shadow-sm truncate">
            مسؤول الفرع: {managerLabel}
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-2 align-middle shadow-[0_0_0_3px_rgba(16,185,129,0.25)]" />
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-black text-[14px] sm:text-[15px] text-slate-900">
            <span className="text-[#0ea5e9]">واردات</span> {branchShort}
          </span>
          <div className="w-9 h-9 rounded-xl bg-[#0ea5e9] text-white grid place-items-center shadow-md shadow-sky-200">
            <Droplets className="w-5 h-5" />
          </div>
        </div>
      </header>

      {/* عنوان */}
      <div className="insp-glass rounded-2xl p-4 flex items-center justify-between mb-4 gap-3">
        <button
          type="button"
          onClick={() => fetchInspections(true)}
          className="h-9 px-4 rounded-full bg-white border border-slate-200 text-[12px] font-bold text-slate-800 hover:bg-slate-50 active:scale-95 transition inline-flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg sm:text-xl font-black text-slate-900">الكشوفات</h1>
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white grid place-items-center shadow-md">
            <FileText className="w-4.5 h-4.5" />
          </div>
        </div>
      </div>

      {/* إحصائيات */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="insp-glass rounded-2xl p-3.5 bg-amber-50/70 relative overflow-hidden">
          <div className="text-[11px] text-amber-800/80 font-bold">بانتظار المعالجة الفنية</div>
          <div className="text-2xl font-black text-amber-950 mt-1">{stats.pending}</div>
          <div className="mt-2 h-1.5 rounded-full bg-amber-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400"
              style={{ width: `${stats.total ? Math.min(100, (stats.pending / stats.total) * 100) : 0}%` }}
            />
          </div>
          <div className="absolute left-3 top-3 w-7 h-7 rounded-full bg-amber-100 text-amber-600 grid place-items-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="insp-glass rounded-2xl p-3.5 relative overflow-hidden">
          <div className="text-[11px] text-slate-500 font-bold">إجمالي الكشوفات</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[11px] font-bold text-sky-600 mt-2">+{stats.weekNew} هذا الأسبوع</div>
        </div>

        <div className="insp-glass rounded-2xl p-3.5 bg-sky-50/70 relative overflow-hidden">
          <div className="text-[11px] text-sky-800/80 font-bold">الكشوفات المصورة</div>
          <div className="text-2xl font-black text-sky-950 mt-1">{stats.photographed}</div>
          <div className="text-[11px] font-bold text-sky-700 mt-2">{stats.photoPct}% مرفق بصور</div>
          <div className="absolute left-3 top-3 w-7 h-7 rounded-full bg-sky-100 text-sky-600 grid place-items-center">
            <Camera className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="insp-glass rounded-2xl p-3.5 bg-emerald-50/70 relative overflow-hidden">
          <div className="text-[11px] text-emerald-800/80 font-bold">تمت المعالجة والاعتماد</div>
          <div className="text-2xl font-black text-emerald-950 mt-1">{stats.approved}</div>
          <div className="mt-2 h-1.5 rounded-full bg-emerald-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${stats.total ? Math.min(100, (stats.approved / stats.total) * 100) : 0}%` }}
            />
          </div>
          <div className="absolute left-3 top-3 w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 grid place-items-center">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* بحث وفلاتر */}
      <div className="insp-glass rounded-2xl p-3 flex flex-col sm:flex-row gap-3 mb-4 items-stretch sm:items-center">
        <div className="flex items-center gap-2 order-2 sm:order-1 shrink-0">
          <div className="text-[12px] font-bold text-slate-700 whitespace-nowrap py-2">
            النتائج: {filtered.length} كشف
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-9 rounded-full bg-white border border-slate-200 px-3 text-[12px] font-bold text-slate-700 outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="pending">قيد التدقيق</option>
            <option value="done">تمت المعالجة / معتمد</option>
          </select>
          {(searchQuery || statusFilter !== 'all') && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-9 px-3 rounded-full bg-white border border-slate-200 text-[12px] font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              مسح
            </button>
          )}
        </div>
        <div className="relative flex-1 order-1 sm:order-2">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المواطن، الكاتب/المحصل، المحلة / نص التقرير..."
            className="w-full h-10 rounded-full bg-white border border-slate-200 pr-10 pl-4 text-[12px] font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
          />
        </div>
      </div>

      {/* جدول */}
      <div className="insp-glass rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100/80 flex items-center justify-between gap-2 bg-white/50">
          <h2 className="text-[13px] font-black text-slate-800">سجل الكشوفات الميدانية</h2>
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-8 px-3 rounded-full bg-white border border-slate-200 text-[11px] font-bold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير
          </button>
        </div>

        {loading && branchInspections.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-bold">جاري جلب الكشوفات الفنية من السحابة...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-bold text-slate-600">لا توجد كشوفات مطابقة</p>
            <p className="text-xs text-slate-400 mt-1">جرّب تغيير البحث أو الفلتر، أو انتظر رفع كشف جديد من الكاتب/المحصل</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[12px] min-w-[860px]">
              <thead className="bg-slate-50/80 text-slate-600 font-bold">
                <tr>
                  <th className="py-3 px-3">ت</th>
                  <th className="py-3 px-3">القائم بالكشف</th>
                  <th className="py-3 px-3">اسم المواطن / صاحب العقار</th>
                  <th className="py-3 px-3">المحلة / المنطقة</th>
                  <th className="py-3 px-3">تاريخ الكشف</th>
                  <th className="py-3 px-3">الصور المرفقة</th>
                  <th className="py-3 px-3">الحالة</th>
                  <th className="py-3 px-3 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const done = isDoneStatus(item.status)
                  const roleLabel = item.userRole === 'writer' ? 'كاتب' : item.userRole === 'collector' ? 'محصل' : 'مدير'
                  const initial = (item.writerOrCollectorName || '?').trim().charAt(0)
                  return (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-white/70 transition-colors">
                      <td className="py-3.5 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-white text-[12px] font-black grid place-items-center shadow-sm">
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 truncate">{item.writerOrCollectorName}</div>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                              {roleLabel}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-bold text-slate-900">
                        {item.citizenName || (
                          <span className="text-slate-400 italic font-normal">
                            {(item.rawReportText || '').substring(0, 35)}
                            {(item.rawReportText || '').length > 35 ? '...' : ''}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1.5 text-[#0ea5e9] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9]" />
                          {item.tableData?.neighborhood || 'غير محدد'}
                        </span>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 font-semibold">
                        {item.inspectionDate || item.createdAt?.substring(0, 10) || '—'}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[11px] font-bold">
                          <Camera className="w-3 h-3" />
                          {item.images?.length || 0} صور
                        </span>
                      </td>

                      <td className="py-3.5 px-3">
                        {done ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" />
                            {statusLabel(item.status)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-bold">
                            <Clock className="w-3 h-3" />
                            {statusLabel(item.status)}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenInspectionModal(item)}
                            className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-600 text-white grid place-items-center shadow-sm shadow-sky-200 transition active:scale-95"
                            title="معاينة الكشف"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 grid place-items-center transition active:scale-95"
                            title={copiedId === item.id ? 'تم النسخ' : 'نسخ رابط المواطن'}
                          >
                            <Copy className={`w-3.5 h-3.5 ${copiedId === item.id ? 'text-emerald-600' : 'text-slate-600'}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenInspectionModal(item)}
                            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 grid place-items-center transition active:scale-95"
                            title="تعديل الكشف"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="w-8 h-8 rounded-full bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 grid place-items-center transition active:scale-95"
                            title="حذف الكشف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
