'use client'

import React, { useState, useMemo } from 'react'
import {
  FileText,
  Printer,
  Trash2,
  Eye,
  Plus,
  Search,
  Calendar,
  Wallet,
  Users,
  CheckCircle2,
  X,
  Layers,
  ArrowUpDown,
  Building2,
  Hash
} from 'lucide-react'
import { DirectorateBranch, Consignment, ConsignmentItem } from '@/lib/directorateTypes'

interface BranchConsignmentsStoreProps {
  branch: DirectorateBranch
  onOpenNewConsignment: () => void
  onViewConsignmentA4: (consignment: Consignment) => void
  onDeleteConsignment: (consignmentId: string) => void
}

export default function BranchConsignmentsStore({
  branch,
  onOpenNewConsignment,
  onViewConsignmentA4,
  onDeleteConsignment
}: BranchConsignmentsStoreProps) {
  const consignments = branch.consignments || []

  // حالات البحث والفلترة
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCollectorFilter, setSelectedCollectorFilter] = useState('')
  const [selectedDateFilter, setSelectedDateFilter] = useState('')

  // الإرسالية المحددة لعرض تفاصيل وصولاتها في النافذة المنبثقة
  const [viewingDetailsConsignment, setViewingDetailsConsignment] = useState<Consignment | null>(null)

  // الإحصائيات العامة للمخزن
  const stats = useMemo(() => {
    const totalCount = consignments.length
    const totalAmount = consignments.reduce((sum, c) => sum + (c.totalAmount || 0), 0)
    const totalWater = consignments.reduce((sum, c) => sum + (c.totalWaterAmount || 0), 0)
    const totalMunicipality = consignments.reduce((sum, c) => sum + (c.totalMunicipalityAmount || 0), 0)
    const totalReceipts = consignments.reduce((sum, c) => sum + (c.items ? c.items.length : 0), 0)

    return {
      totalCount,
      totalAmount,
      totalWater,
      totalMunicipality,
      totalReceipts
    }
  }, [consignments])

  // تصفية الإرساليات حسب البحث والفلتر
  const filteredConsignments = useMemo(() => {
    return consignments.filter(c => {
      // بحث بالرقم التسلسلي أو اسم المحصل أو رقم المرجع
      const matchesSearch =
        !searchQuery.trim() ||
        (c.serialNumber && c.serialNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.collectorName && c.collectorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.paperRefNumber && c.paperRefNumber.toLowerCase().includes(searchQuery.toLowerCase()))

      // تصفية حسب المحصل
      const matchesCollector =
        !selectedCollectorFilter || c.collectorName === selectedCollectorFilter

      // تصفية حسب التاريخ
      const matchesDate = !selectedDateFilter || (c.date && c.date.startsWith(selectedDateFilter))

      return matchesSearch && matchesCollector && matchesDate
    }).sort((a, b) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime())
  }, [consignments, searchQuery, selectedCollectorFilter, selectedDateFilter])

  return (
    <div className="space-y-6">
      {/* ========================================================
          بطاقات إحصائيات مخزن الإرساليات الفخمة
          ======================================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* إجمالي الإرساليات */}
        <div className="bg-gradient-to-br from-blue-50/60 via-white to-white p-4 sm:p-5 rounded-2xl border border-blue-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">إجمالي الإرساليات</span>
            <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-mono">
              {stats.totalCount}
              <span className="text-xs text-slate-400 font-bold mr-1.5 font-sans">إرسالية</span>
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-blue-700 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              <span>{stats.totalReceipts} وصل مسجل ومدفوع</span>
            </div>
          </div>
        </div>

        {/* إجمالي المبالغ */}
        <div className="bg-gradient-to-br from-emerald-50/60 via-white to-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">إجمالي مبالغ الإرساليات</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-emerald-800 tracking-tight truncate font-mono">
              {stats.totalAmount.toLocaleString('ar-IQ')}
              <span className="text-xs text-emerald-600 font-bold mr-1 font-sans">د.ع</span>
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>مجموع كل وصولات القبض</span>
            </div>
          </div>
        </div>

        {/* حصة الماء */}
        <div className="bg-gradient-to-br from-sky-50/60 via-white to-white p-4 sm:p-5 rounded-2xl border border-sky-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">حصة الماء المحصلة</span>
            <div className="w-10 h-10 rounded-xl bg-sky-100/80 text-sky-600 flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-sky-800 tracking-tight truncate font-mono">
              {stats.totalWater.toLocaleString('ar-IQ')}
              <span className="text-xs text-sky-600 font-bold mr-1 font-sans">د.ع</span>
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-sky-700 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span>
              <span>مديرية ماء البصرة</span>
            </div>
          </div>
        </div>

        {/* حصة البلدية */}
        <div className="bg-gradient-to-br from-amber-50/60 via-white to-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-xs hover:shadow-md transition-all duration-200 group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">حصة البلدية المحصلة</span>
            <div className="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-600 flex items-center justify-center transition-transform group-hover:scale-105 shadow-xs">
              <Hash className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2.5">
            <h3 className="text-xl sm:text-2xl font-black text-amber-800 tracking-tight truncate font-mono">
              {stats.totalMunicipality.toLocaleString('ar-IQ')}
              <span className="text-xs text-amber-600 font-bold mr-1 font-sans">د.ع</span>
            </h3>
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-amber-700 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>مبالغ البلدية المقتطعة</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================
          شريط الإجراءات والبحث والفلترة
          ======================================================== */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <span>أرشيف ومخزن الإرساليات الرسمية</span>
            </h2>
            <p className="text-xs text-slate-500 font-bold mt-1">
              سجل كامل بجميع الإرساليات المحفوظة مع إمكانية استعراضها وطباعتها كاستمارة A4
            </p>
          </div>

          <button
            onClick={onOpenNewConsignment}
            className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>إنشاء إرسالية جديدة (A4)</span>
          </button>
        </div>

        {/* أدوات البحث والتصفية */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* البحث بالرقم أو الاسم */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الورقة (مثال: 02951) أو اسم المحصل..."
              className="w-full pr-10 pl-3 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </div>

          {/* تصفية حسب المحصل */}
          <div>
            <select
              value={selectedCollectorFilter}
              onChange={(e) => setSelectedCollectorFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            >
              <option value="">جميع المحصلين (الجباة)</option>
              {branch.collectors.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* تصفية حسب التاريخ */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all cursor-pointer"
            />
            {selectedDateFilter && (
              <button
                onClick={() => setSelectedDateFilter('')}
                className="p-2.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 text-xs font-bold transition"
                title="إلغاء فلتر التاريخ"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================
          جدول الإرساليات المحفوظة
          ======================================================== */}
      {filteredConsignments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-100">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-base sm:text-lg font-black text-slate-800">لا توجد إرساليات في المخزن</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 font-bold">
            {consignments.length === 0
              ? 'لم تقم بحفظ أي إرسالية حتى الآن. يمكنك النقر على الزر أدناه لبدء تسجيل أول إرسالية رسمية.'
              : 'لا توجد نتائج مطابقة لشروط البحث والفلترة المحددة.'}
          </p>
          {consignments.length === 0 && (
            <button
              onClick={onOpenNewConsignment}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="mt-4 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm hover:bg-blue-700 transition inline-flex items-center gap-2 shadow-md cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-white" />
              <span>إنشاء أول إرسالية الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-700 font-black border-b border-slate-200">
                <tr>
                  <th className="p-3 sm:p-3.5">تسلسل الورقة</th>
                  <th className="p-3 sm:p-3.5">تاريخ الإرسالية</th>
                  <th className="p-3 sm:p-3.5">المحصل (الجابي)</th>
                  <th className="p-3 sm:p-3.5 text-center">عدد الوصولات</th>
                  <th className="p-3 sm:p-3.5">المبلغ الإجمالي</th>
                  <th className="p-3 sm:p-3.5">حصة الماء</th>
                  <th className="p-3 sm:p-3.5">حصة البلدية</th>
                  <th className="p-3 sm:p-3.5 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                {filteredConsignments.map((consignment) => {
                  const itemsCount = consignment.items ? consignment.items.length : 0
                  return (
                    <tr key={consignment.id} className="hover:bg-slate-50/80 transition">
                      {/* تسلسل الورقة */}
                      <td className="p-3 sm:p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                            {consignment.serialNumber || '—'}
                          </span>
                          {consignment.paperRefNumber && (
                            <span className="text-[10px] text-slate-400 font-bold">
                              رقم: {consignment.paperRefNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* تاريخ الإرسالية */}
                      <td className="p-3 sm:p-3.5 font-bold text-slate-700">
                        {consignment.date || '—'}
                      </td>

                      {/* اسم المحصل */}
                      <td className="p-3 sm:p-3.5 font-bold text-slate-900">
                        {consignment.collectorName || 'غير محدد'}
                      </td>

                      {/* عدد الوصولات */}
                      <td className="p-3 sm:p-3.5 text-center">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px] font-black">
                          {itemsCount} وصل
                        </span>
                      </td>

                      {/* المبلغ الإجمالي */}
                      <td className="p-3 sm:p-3.5 font-black text-emerald-700">
                        {(consignment.totalAmount || 0).toLocaleString('ar-IQ')} د.ع
                      </td>

                      {/* حصة الماء */}
                      <td className="p-3 sm:p-3.5 font-bold text-blue-800">
                        {(consignment.totalWaterAmount || 0).toLocaleString('ar-IQ')} د.ع
                      </td>

                      {/* حصة البلدية */}
                      <td className="p-3 sm:p-3.5 font-bold text-amber-800">
                        {(consignment.totalMunicipalityAmount || 0).toLocaleString('ar-IQ')} د.ع
                      </td>

                      {/* أزرار الإجراءات */}
                      <td className="p-3 sm:p-3.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* زر عرض وطباعة الاستمارة الرسمية A4 */}
                          <button
                            onClick={() => onViewConsignmentA4(consignment)}
                            style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                            title="عرض وطباعة الاستمارة الرسمية A4"
                          >
                            <Printer className="w-3.5 h-3.5 text-white" />
                            <span>عرض وطباعة A4</span>
                          </button>

                          {/* زر تفاصيل المشتركين */}
                          <button
                            onClick={() => setViewingDetailsConsignment(consignment)}
                            style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderColor: '#cbd5e1' }}
                            className="p-1.5 border rounded-lg hover:bg-slate-200 transition cursor-pointer active:scale-95"
                            title="استعراض قائمة المشتركين والوصولات"
                          >
                            <Eye className="w-4 h-4 text-slate-700" />
                          </button>

                          {/* زر الحذف */}
                          <button
                            onClick={() => onDeleteConsignment(consignment.id)}
                            style={{ backgroundColor: '#fee2e2', color: '#b91c1c' }}
                            className="p-1.5 rounded-lg hover:bg-red-200 transition cursor-pointer active:scale-95"
                            title="حذف هذه الإرسالية من المخزن"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          نافذة منبثقة: تفاصيل الوصولات والمشتركين داخل الإرسالية
          ======================================================== */}
      {viewingDetailsConsignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* ترويسة النافذة */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">
                    تفاصيل وصولات الإرسالية (رقم {viewingDetailsConsignment.serialNumber})
                  </h3>
                  <p className="text-xs text-slate-500 font-bold">
                    المحصل: {viewingDetailsConsignment.collectorName} | التاريخ: {viewingDetailsConsignment.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const c = viewingDetailsConsignment
                    setViewingDetailsConsignment(null)
                    onViewConsignmentA4(c)
                  }}
                  style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-white" />
                  <span>فتح في ورقة A4</span>
                </button>

                <button
                  onClick={() => setViewingDetailsConsignment(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* محتوى الجدول */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-3 gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl mb-4 text-xs font-bold text-center">
                <div>
                  <span className="text-slate-500 block text-[10px]">المبلغ الكلي</span>
                  <span className="text-sm font-black text-emerald-700">
                    {(viewingDetailsConsignment.totalAmount || 0).toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">حصة الماء</span>
                  <span className="text-sm font-black text-blue-700">
                    {(viewingDetailsConsignment.totalWaterAmount || 0).toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">حصة البلدية</span>
                  <span className="text-sm font-black text-amber-700">
                    {(viewingDetailsConsignment.totalMunicipalityAmount || 0).toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
                    <tr>
                      <th className="p-2.5 text-center">#</th>
                      <th className="p-2.5">رقم المشترك</th>
                      <th className="p-2.5">اسم المشترك</th>
                      <th className="p-2.5">المنطقة</th>
                      <th className="p-2.5 text-center">المبلغ المستلم</th>
                      <th className="p-2.5 text-center text-blue-800">الماء</th>
                      <th className="p-2.5 text-center text-amber-800">البلدية</th>
                      <th className="p-2.5 text-center">رقم الوصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                    {(viewingDetailsConsignment.items || []).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-center text-slate-400 font-normal">{idx + 1}</td>
                        <td className="p-2 font-mono font-black text-blue-900">{item.subscriberId}</td>
                        <td className="p-2 font-bold text-slate-900">{item.subscriberName}</td>
                        <td className="p-2 text-slate-700">{item.areaName || '—'}</td>
                        <td className="p-2 text-center font-black text-emerald-700">
                          {item.amount.toLocaleString('ar-IQ')}
                        </td>
                        <td className="p-2 text-center font-bold text-blue-700">
                          {(item.waterAmount || 0).toLocaleString('ar-IQ')}
                        </td>
                        <td className="p-2 text-center font-bold text-amber-700">
                          {(item.municipalityAmount || 0).toLocaleString('ar-IQ')}
                        </td>
                        <td className="p-2 text-center font-mono font-black text-slate-900 bg-slate-50">
                          {item.receiptNumber || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* تذييل النافذة */}
            <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setViewingDetailsConsignment(null)}
                style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderColor: '#cbd5e1' }}
                className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-slate-200 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
