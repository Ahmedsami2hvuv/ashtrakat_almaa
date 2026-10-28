'use client'

import React, { useState, useEffect } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { loadInspectionsFromCloud, deleteInspectionRecord } from '@/lib/inspectionStore'
import { DirectorateBranch } from '@/lib/directorateTypes'
import {
  FileText,
  Sparkles,
  Printer,
  Eye,
  Trash2,
  RefreshCw,
  ExternalLink,
  Copy,
  Calendar,
  User,
  MapPin,
  Camera,
  CheckCircle2,
  Clock,
  Search
} from 'lucide-react'

interface BranchInspectionsTabProps {
  branch: DirectorateBranch
  onOpenInspectionModal: (record?: InspectionRecord) => void
}

export default function BranchInspectionsTab({
  branch,
  onOpenInspectionModal
}: BranchInspectionsTabProps) {
  const [inspections, setInspections] = useState<InspectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // تحميل الكشوفات عند فتح التبويب فقط — من الكاش إن وُجد، والسحابة عند أول مرة أو تحديث صريح
  const fetchInspections = async (force = false) => {
    setLoading(true)
    try {
      const data = await loadInspectionsFromCloud(force)
      setInspections(data)
    } catch (err) {
      console.error('Failed to load inspections:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInspections(false)
  }, [branch.id])

  // فلترة الكشوفات للفرع أو البحث
  const filtered = inspections.filter((item) => {
    const q = searchQuery.toLowerCase().trim()
    const matchesSearch =
      !q ||
      item.citizenName?.toLowerCase().includes(q) ||
      item.writerOrCollectorName?.toLowerCase().includes(q) ||
      item.tableData?.neighborhood?.toLowerCase().includes(q) ||
      item.rawReportText?.toLowerCase().includes(q)
    return matchesSearch
  })

  // نسخ الرابط
  const handleCopyLink = (item: InspectionRecord) => {
    const url = `${window.location.origin}/inspection/${item.id}`
    navigator.clipboard.writeText(url)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // حذف كشف
  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذا الكشف الفني؟')) return
    await deleteInspectionRecord(id)
    setInspections((prev) => prev.filter((i) => i.id !== id))
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* الرأسية والإحصائيات الخاصة بالكشوفات الفنية */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shadow-xs">
              <FileText className="w-6 h-6 text-[#0284c7]" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-800">
                الكشوفات الفنية والتقارير الميدانية للفرع
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {branch.name} - إدارة ومراجعة الكشوفات المرفوعة من الكُتّاب والمحصلين
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchInspections(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-black text-slate-950 bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              title="تحديث البيانات من السحابة"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-950 stroke-[2.2] ${loading ? 'animate-spin' : ''}`} />
              <span>تحديث</span>
            </button>

            <button
              onClick={() => onOpenInspectionModal()}
              className="px-4 py-2 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95 border border-blue-700"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>فتح لوحة الكشوفات والذكاء الاصطناعي والطباعة</span>
            </button>
          </div>
        </div>

        {/* بطاقات المؤشرات السريعة للكشوفات */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span className="text-[11px] text-slate-500 font-bold block mb-1">إجمالي الكشوفات</span>
            <p className="text-xl font-black text-slate-800">{inspections.length}</p>
          </div>

          <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
            <span className="text-[11px] text-amber-700 font-bold block mb-1">بانتظار المعالجة الفنية</span>
            <p className="text-xl font-black text-amber-800">
              {inspections.filter((i) => i.status === 'pending').length}
            </p>
          </div>

          <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
            <span className="text-[11px] text-emerald-700 font-bold block mb-1">تمت المعالجة والاعتماد</span>
            <p className="text-xl font-black text-emerald-800">
              {inspections.filter((i) => i.status === 'reviewed' || i.status === 'approved').length}
            </p>
          </div>

          <div className="bg-sky-50 p-3 rounded-xl border border-sky-200">
            <span className="text-[11px] text-sky-700 font-bold block mb-1">الكشوفات المصورة</span>
            <p className="text-xl font-black text-sky-800">
              {inspections.filter((i) => i.images && i.images.length > 0).length}
            </p>
          </div>
        </div>
      </div>

      {/* شريط البحث */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
          <input
            type="text"
            placeholder="بحث باسم المواطن، الكاتب/المحصل، المحلة، أو نص التقرير..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pr-9 pl-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
          />
        </div>
        <span className="text-xs text-slate-500 font-bold whitespace-nowrap">
          النتائج: {filtered.length} كشف
        </span>
      </div>

      {/* قائمة وجدول الكشوفات الفنية الواردة */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
            <span>جاري جلب الكشوفات الفنية من السحابة...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center justify-center">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-bold text-slate-600">لا توجد كشوفات مرفوعة حتى الآن</p>
            <p className="text-xs text-slate-400 mt-1">
              عندما يرفع الكاتب أو المحصل كشفاً موقعياً من حسابه سيظهر مباشرة هنا لمسؤول الفرع
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black">
                <tr>
                  <th className="py-3 px-4">ت</th>
                  <th className="py-3 px-4">القائم بالكشف (الكاتب/المحصل)</th>
                  <th className="py-3 px-4">اسم المواطن / صاحب العقار</th>
                  <th className="py-3 px-4">المحلة / المنطقة</th>
                  <th className="py-3 px-4">تاريخ الكشف</th>
                  <th className="py-3 px-4">الصور المرفقة</th>
                  <th className="py-3 px-4">الحالة</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 font-semibold">
                {filtered.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400">{idx + 1}</td>
                    
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <strong className="text-slate-900 font-black">{item.writerOrCollectorName}</strong>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                          {item.userRole === 'writer' ? 'كاتب' : 'محصل'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {item.citizenName || (
                        <span className="text-slate-400 italic font-normal">
                          {item.rawReportText.substring(0, 35)}...
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="text-sky-700 font-bold">
                        {item.tableData?.neighborhood || 'غير محدد'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {item.inspectionDate || item.createdAt.substring(0, 10)}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[11px] font-bold">
                        <Camera className="w-3 h-3 text-emerald-600" />
                        <span>{item.images?.length || 0} صور</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      {item.status === 'reviewed' || item.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>معتمد فنياً</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                          <Clock className="w-3 h-3" />
                          <span>قيد التدقيق</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* زر فتح الكشف للذكاء الاصطناعي والتعديل والطباعة */}
                        <button
                          onClick={() => onOpenInspectionModal(item)}
                          className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-lg transition font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          title="فتح وتعديل الكشف بالذكاء الاصطناعي والطباعة"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>معاينة وتعديل</span>
                        </button>

                        {/* نسخ رابط المواطن */}
                        <button
                          onClick={() => handleCopyLink(item)}
                          className="p-1.5 bg-white hover:bg-blue-50 text-slate-900 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs"
                          title="نسخ رابط الباركود للمواطن"
                        >
                          <Copy className="w-3.5 h-3.5 text-blue-600 stroke-[2.2]" />
                        </button>

                        {/* صفحة المواطن */}
                        <a
                          href={`/inspection/${item.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 bg-white hover:bg-emerald-50 text-slate-900 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs"
                          title="فتح صفحة المواطن"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-600 stroke-[2.2]" />
                        </a>

                        {/* حذف */}
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 bg-white hover:bg-rose-50 text-slate-900 hover:text-rose-600 border border-slate-300 rounded-lg transition cursor-pointer shadow-2xs"
                          title="حذف الكشف"
                        >
                          <Trash2 className="w-3.5 h-3.5 stroke-[2.2]" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
