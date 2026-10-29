'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { loadInspectionsFromCloud, deleteInspectionRecord } from '@/lib/inspectionStore'
import { DirectorateBranch } from '@/lib/directorateTypes'
import {
  FileText,
  Eye,
  Trash2,
  Copy,
  Camera,
  CheckCircle2,
  Clock,
  Search,
  Pencil,
  Download,
  X,
  Coins
} from 'lucide-react'

interface BranchInspectionsTabProps {
  branch: DirectorateBranch
  managerName?: string
  onOpenInspectionModal: (record?: InspectionRecord) => void
  /** يزيده الأب لتشغيل التحديث من هيدر الصفحة */
  refreshNonce?: number
  onLoadingChange?: (loading: boolean) => void
}

type StatusFilter = 'all' | 'pending' | 'done'

function cleanBranchLabel(name?: string): string {
  if (!name) return 'أبي الخصيب'
  return (
    name
      .replace(/مديرية\s+ماء\s+البصرة/gi, '')
      .replace(/مركز\s+جباية\s+واردات/gi, '')
      .replace(/مركز\s+واردات/gi, '')
      .replace(/فرع\s+واردات/gi, '')
      .replace(/\bفرع\b/gi, '')
      .replace(/^\s*واردات\s+/gi, '')
      .trim() || name
  )
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
  onOpenInspectionModal,
  refreshNonce = 0,
  onLoadingChange
}: BranchInspectionsTabProps) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const branchShort = cleanBranchLabel(branch.name)

  const setBusy = (value: boolean) => {
    setLoading(value)
    onLoadingChange?.(value)
  }

  const fetchInspections = async (force = true) => {
    setBusy(true)
    try {
      if (force) {
        const cached = await loadInspectionsFromCloud({ forceRefresh: false, full: false })
        if (cached.length > 0) {
          setInspections(cached)
          setBusy(false)
        }
      }
      const data = await loadInspectionsFromCloud({ forceRefresh: true, full: false })
      setInspections(data)
    } catch (err) {
      console.error('Failed to load inspections:', err)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    fetchInspections(true)
    const interval = setInterval(() => {
      loadInspectionsFromCloud({ forceRefresh: true, full: false }).then((latest) => {
        setInspections(latest)
        setBusy(false)
      })
    }, 20000)
    return () => clearInterval(interval)
  }, [branch.id])

  useEffect(() => {
    if (refreshNonce > 0) fetchInspections(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshNonce])

  const branchInspections = useMemo(() => {
    return inspections.filter((item) => {
      if (!branch.id) return true
      if (!item.branchId) {
        return (
          !item.branchName ||
          item.branchName.includes(branchShort) ||
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
    <div dir="rtl" className="insp-root space-y-4">
      <style>{`
        .insp-root {
          font-weight: 800;
          -webkit-font-smoothing: antialiased;
          color: #0f172a;
        }
        .insp-root, .insp-root button, .insp-root input, .insp-root select, .insp-root th, .insp-root td {
          font-family: var(--font-cairo), Cairo, Tahoma, sans-serif;
        }
        .insp-glass {
          background: rgba(255,255,255,0.82);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid rgba(255,255,255,0.95);
          box-shadow: 0 8px 32px rgba(15,23,42,0.06);
        }
        .insp-stat {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          padding: 16px 16px 14px;
          min-height: 118px;
        }
        .insp-stat-icon {
          position: absolute;
          left: 14px;
          top: 14px;
          width: 34px;
          height: 34px;
          border-radius: 999px;
          display: grid;
          place-items: center;
        }
        .insp-bar {
          height: 6px;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 14px;
        }
        .insp-bar > span {
          display: block;
          height: 100%;
          border-radius: 999px;
        }
        .insp-action {
          width: 32px;
          height: 32px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          transition: transform .15s ease, background .15s ease;
        }
        .insp-action:active { transform: scale(.94); }
      `}</style>

      {/* الإحصائيات بنفس ترتيب وتصميم الصورة المطلوبة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* بانتظار المعالجة */}
        <div className="insp-glass insp-stat" style={{ background: 'rgba(255,251,235,0.92)' }}>
          <div className="insp-stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Coins className="w-4 h-4" />
          </div>
          <div className="text-[13px] font-black text-amber-950 pl-10">بانتظار المعالجة الفنية</div>
          <div className="text-[36px] leading-none font-black text-amber-950 mt-2">{stats.pending}</div>
          <div className="insp-bar" style={{ background: '#fde68a' }}>
            <span
              style={{
                width: `${stats.total ? Math.min(100, (stats.pending / stats.total) * 100) : 0}%`,
                background: 'linear-gradient(90deg,#fbbf24,#f59e0b)'
              }}
            />
          </div>
        </div>

        {/* الإجمالي */}
        <div className="insp-glass insp-stat">
          <div className="text-[13px] font-black text-slate-700">إجمالي الكشوفات</div>
          <div className="text-[36px] leading-none font-black text-slate-900 mt-2">{stats.total}</div>
          <div className="text-[13px] font-black text-sky-700 mt-3">+{stats.weekNew} هذا الأسبوع</div>
        </div>

        {/* المصورة */}
        <div className="insp-glass insp-stat" style={{ background: 'rgba(240,249,255,0.95)' }}>
          <div className="insp-stat-icon" style={{ background: '#e0f2fe', color: '#0284c7' }}>
            <Camera className="w-4 h-4" />
          </div>
          <div className="text-[13px] font-black text-sky-950 pl-10">الكشوفات المصورة</div>
          <div className="text-[36px] leading-none font-black text-sky-950 mt-2">{stats.photographed}</div>
          <div className="text-[13px] font-black text-sky-800 mt-3">{stats.photoPct}% مرفق بصور</div>
        </div>

        {/* المعتمدة */}
        <div className="insp-glass insp-stat" style={{ background: 'rgba(236,253,245,0.95)' }}>
          <div className="insp-stat-icon" style={{ background: '#d1fae5', color: '#059669' }}>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-[13px] font-black text-emerald-950 pl-10">تمت المعالجة والاعتماد</div>
          <div className="text-[36px] leading-none font-black text-emerald-950 mt-2">{stats.approved}</div>
          <div className="insp-bar" style={{ background: '#a7f3d0' }}>
            <span
              style={{
                width: `${stats.total ? Math.min(100, (stats.approved / stats.total) * 100) : 0}%`,
                background: 'linear-gradient(90deg,#34d399,#10b981)'
              }}
            />
          </div>
        </div>
      </div>

      {/* بحث + فلاتر بنفس السطر */}
      <div className="insp-glass rounded-[22px] p-3 flex flex-col lg:flex-row lg:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Search className="w-5 h-5 text-slate-500 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم المواطن، الكاتب/المحصل، المحلة / نص التقرير..."
            className="w-full h-12 rounded-full bg-white border border-slate-200 pr-11 pl-4 text-[15px] font-extrabold text-slate-900 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="h-12 px-3.5 rounded-full bg-slate-900 text-white text-[14px] font-black whitespace-nowrap inline-flex items-center">
            النتائج: {filtered.length} كشف
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="h-12 rounded-full bg-white border border-slate-300 px-4 text-[14px] font-black text-slate-900 outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="pending">قيد التدقيق</option>
            <option value="done">تمت المعالجة / معتمد</option>
          </select>
          <button
            type="button"
            onClick={clearFilters}
            className="h-12 px-4 rounded-full bg-white border border-slate-300 text-[14px] font-black text-slate-900 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <X className="w-4 h-4" />
            مسح
          </button>
        </div>
      </div>

      {/* الجدول */}
      <div className="insp-glass rounded-[22px] overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-100/90 flex items-center justify-between gap-2 bg-white/55">
          <h2 className="text-[16px] font-black text-slate-900">سجل الكشوفات الميدانية</h2>
          <button
            type="button"
            onClick={handleExportCsv}
            className="h-10 px-4 rounded-full bg-white border border-slate-300 text-[13px] font-black text-slate-900 hover:bg-slate-50 inline-flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            تصدير
          </button>
        </div>

        {loading && branchInspections.length === 0 ? (
          <div className="p-14 text-center text-slate-500 text-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-[3px] border-sky-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span className="font-bold">جاري جلب الكشوفات الفنية من السحابة...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-bold text-slate-600">لا توجد كشوفات مطابقة</p>
            <p className="text-xs text-slate-400 mt-1">جرّب تغيير البحث أو الفلتر</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-[14px] min-w-[920px]">
              <thead className="bg-slate-50/90 text-slate-700 font-black">
                <tr>
                  <th className="py-3.5 px-3 font-black text-[13px]">ت</th>
                  <th className="py-3.5 px-3 font-black text-[13px]">القائم بالكشف</th>
                  <th className="py-3.5 px-3 font-black text-[13px]">اسم المواطن / صاحب العقار</th>
                  <th className="py-3.5 px-3 font-black text-[13px]">المحلة / المنطقة</th>
                  <th className="py-3.5 px-3 font-black text-[13px]">تاريخ الكشف</th>
                  <th className="py-3.5 px-3 font-black text-[13px]">الصور المرفقة</th>
                  <th className="py-3.5 px-3 font-black text-[13px]">الحالة</th>
                  <th className="py-3.5 px-3 font-black text-[13px] text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const done = isDoneStatus(item.status)
                  const roleLabel =
                    item.userRole === 'writer' ? 'كاتب' : item.userRole === 'collector' ? 'محصل' : 'مدير'
                  const initial = (item.writerOrCollectorName || '?').trim().charAt(0)
                  return (
                    <tr key={item.id} className="border-t border-slate-100 hover:bg-white/75 transition-colors">
                      <td className="py-4 px-3 font-mono text-slate-400 font-bold">{idx + 1}</td>

                      <td className="py-4 px-3">
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-9 h-9 rounded-full text-white text-[13px] font-black grid place-items-center shadow-sm shrink-0"
                            style={{ background: 'linear-gradient(135deg,#38bdf8,#2563eb)' }}
                          >
                            {initial}
                          </span>
                          <div className="min-w-0">
                            <div className="font-black text-slate-900 truncate leading-tight">
                              {item.writerOrCollectorName}
                            </div>
                            <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                              {roleLabel}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-3 font-black text-slate-900">
                        {item.citizenName || (
                          <span className="text-slate-400 italic font-normal">
                            {(item.rawReportText || '').substring(0, 35)}
                            {(item.rawReportText || '').length > 35 ? '...' : ''}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-3">
                        <span className="inline-flex items-center gap-1.5 text-[#0ea5e9] font-black">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9]" />
                          {item.tableData?.neighborhood || 'غير محدد'}
                        </span>
                      </td>

                      <td className="py-4 px-3 font-mono text-[13px] text-slate-800 font-black">
                        {item.inspectionDate || item.createdAt?.substring(0, 10) || '—'}
                      </td>

                      <td className="py-4 px-3">
                        <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full text-[13px] font-black">
                          <Camera className="w-3.5 h-3.5" />
                          {item.images?.length || 0} صور
                        </span>
                      </td>

                      <td className="py-4 px-3">
                        {done ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2.5 py-1 rounded-full text-[12px] font-black">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {statusLabel(item.status)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-800 px-2.5 py-1 rounded-full text-[12px] font-black">
                            <Clock className="w-3.5 h-3.5" />
                            {statusLabel(item.status)}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenInspectionModal(item)}
                            className="insp-action bg-sky-500 hover:bg-sky-600 text-white shadow-sm shadow-sky-200"
                            title="معاينة الكشف"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="insp-action bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            title={copiedId === item.id ? 'تم النسخ' : 'نسخ رابط المواطن'}
                          >
                            <Copy className={`w-3.5 h-3.5 ${copiedId === item.id ? 'text-emerald-600' : ''}`} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenInspectionModal(item)}
                            className="insp-action bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
                            title="تعديل الكشف"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            className="insp-action bg-white border border-slate-200 text-rose-600 hover:bg-rose-50"
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
