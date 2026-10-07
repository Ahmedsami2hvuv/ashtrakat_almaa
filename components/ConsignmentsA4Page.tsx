'use client'

import React, { useState, useEffect } from 'react'
import { DirectorateBranch, Consignment, ConsignmentItem, BranchCollector } from '@/lib/directorateTypes'
import { Subscriber, BillingRecords } from '@/components/MainApp'

interface ConsignmentsA4PageProps {
  branch: DirectorateBranch
  onSaveConsignment: (consignment: Consignment, updatedSubscribers: Subscriber[], updatedBilling: BillingRecords) => void
  onClose: () => void
}

interface RowData {
  subscriberId: string
  subscriberName: string
  amount: string
  receiptNumber: string
  paymentDate: string
}

export default function ConsignmentsA4Page({ branch, onSaveConsignment, onClose }: ConsignmentsA4PageProps) {
  const [selectedCollectorName, setSelectedCollectorName] = useState<string>(
    branch.collectors[0]?.name || ''
  )
  const [consignmentDate, setConsignmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [baseReceiptNumber, setBaseReceiptNumber] = useState<string>('')
  
  // إنشاء 20 صفاً افتراضياً لورقة A4
  const [rows, setRows] = useState<RowData[]>(() => {
    return Array.from({ length: 20 }, () => ({
      subscriberId: '',
      subscriberName: '',
      amount: '',
      receiptNumber: '',
      paymentDate: new Date().toISOString().split('T')[0]
    }))
  })

  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // خريطة سريعة للبحث عن أسماء المشتركين
  const subscriberMap = React.useMemo(() => {
    const map = new Map<number, Subscriber>()
    branch.subscribers.forEach(sub => map.set(sub.id, sub))
    return map
  }, [branch.subscribers])

  // تحديث خانة معينة
  const handleCellChange = (index: number, field: keyof RowData, value: string) => {
    const newRows = [...rows]
    newRows[index] = { ...newRows[index], [field]: value }

    // إذا تم تعديل رقم المشترك، استخرج الاسم تلقائياً فوراً
    if (field === 'subscriberId') {
      const numId = parseInt(value.trim(), 10)
      if (!isNaN(numId) && subscriberMap.has(numId)) {
        newRows[index].subscriberName = subscriberMap.get(numId)!.name
      } else {
        newRows[index].subscriberName = ''
      }
    }

    // إذا تم تعديل رقم الوصل في هذا الصف، يتم إعادة تسلسل باقي الخانات التي تحته تلقائياً!
    if (field === 'receiptNumber') {
      const startNum = parseInt(value.trim(), 10)
      if (!isNaN(startNum)) {
        for (let i = index + 1; i < newRows.length; i++) {
          newRows[i].receiptNumber = String(startNum + (i - index))
        }
      }
    }

    setRows(newRows)
  }

  // تطبيق رقم وصل البداية على كامل الجدول
  const handleApplyBaseReceipt = (base: string) => {
    setBaseReceiptNumber(base)
    const startNum = parseInt(base.trim(), 10)
    if (!isNaN(startNum)) {
      const newRows = rows.map((r, i) => ({
        ...r,
        receiptNumber: String(startNum + i)
      }))
      setRows(newRows)
    }
  }

  // إضافة 10 أسطر إضافية
  const handleAddMoreRows = () => {
    const lastRow = rows[rows.length - 1]
    const lastNum = parseInt(lastRow?.receiptNumber || '0', 10)
    const newAdded = Array.from({ length: 10 }, (_, i) => ({
      subscriberId: '',
      subscriberName: '',
      amount: '',
      receiptNumber: !isNaN(lastNum) && lastNum > 0 ? String(lastNum + i + 1) : '',
      paymentDate: consignmentDate
    }))
    setRows([...rows, ...newAdded])
  }

  // حساب المجموع الكلي
  const totalAmount = rows.reduce((sum, r) => {
    const val = parseFloat(r.amount)
    return !isNaN(val) ? sum + val : sum
  }, 0)

  // ترحيل وحفظ الإرسالية
  const handleSaveAndPost = async () => {
    const validRows = rows.filter(r => r.subscriberId.trim() !== '' && parseFloat(r.amount) > 0)
    if (validRows.length === 0) {
      alert('يرجى إدخال سطر واحد على الأقل يحتوي على رقم مشترك ومبلغ مدفوع صالح.')
      return
    }

    if (!selectedCollectorName) {
      alert('يرجى تحديد أو كتابة اسم المحصل.')
      return
    }

    setIsSaving(true)

    // تجهيز عناصر الإرسالية
    const consignmentItems: ConsignmentItem[] = validRows.map(r => ({
      subscriberId: parseInt(r.subscriberId.trim(), 10),
      subscriberName: r.subscriberName || 'مشترك رقم ' + r.subscriberId,
      amount: parseFloat(r.amount),
      receiptNumber: r.receiptNumber,
      paymentDate: r.paymentDate || consignmentDate
    }))

    const newConsignment: Consignment = {
      id: 'cons_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      branchId: branch.id,
      collectorName: selectedCollectorName,
      date: consignmentDate,
      items: consignmentItems,
      totalAmount,
      createdAt: new Date().toISOString()
    }

    // ترحيل الدفعات تلقائياً وتنزيلها من ديون المشتركين
    const updatedBilling = { ...(branch.billing || {}) }
    const updatedSubscribers = branch.subscribers.map(sub => {
      // فحص إن كان للمشترك دفعة في هذه الإرسالية
      const paymentsForSub = consignmentItems.filter(item => item.subscriberId === sub.id)
      if (paymentsForSub.length === 0) return sub

      const totalPaidInConsignment = paymentsForSub.reduce((s, p) => s + p.amount, 0)

      // خصم من الدين السابق
      const currentPrev = sub.remainingPrev || 0
      const newRemainingPrev = Math.max(0, currentPrev - totalPaidInConsignment)

      // تسجيل الدفعة في سجل الفواتير لأحدث سنة (2026) وفترة
      const currentYear = 2026
      if (!updatedBilling[sub.id]) updatedBilling[sub.id] = {}
      if (!updatedBilling[sub.id][currentYear]) {
        updatedBilling[sub.id][currentYear] = Array.from({ length: 6 }, () => ({
          oldDebtManual: null,
          paid: 0,
          totalManual: null,
          remainingManual: null
        }))
      }
      
      // إضافة المبلغ المدفوع لآخر فترة في السجل
      const periods = updatedBilling[sub.id][currentYear]
      if (periods && periods.length > 0) {
        periods[0].paid = (periods[0].paid || 0) + totalPaidInConsignment
      }

      return {
        ...sub,
        remainingPrev: newRemainingPrev
      }
    })

    // حفظ واستدعاء رد النداء
    onSaveConsignment(newConsignment, updatedSubscribers, updatedBilling)
    setIsSaving(false)
    setSavedSuccessMessage(`تم بنجاح حفظ وترحيل الإرسالية بإجمالي ${totalAmount.toLocaleString('ar-IQ')} دينار لـ (${validRows.length}) مشترك!`)
    setTimeout(() => {
      setSavedSuccessMessage(null)
    }, 4000)
  }

  // تشغيل الطباعة الرسمية
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 print:p-0 print:bg-white text-slate-800 font-sans" dir="rtl">
      {/* شريط الإجراءات العلوي - يُخفى أثناء الطباعة */}
      <div className="max-w-5xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition flex items-center gap-2"
          >
            عودة
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">تنزيل الإرساليات الرسمية</h1>
            <p className="text-xs text-slate-500">{branch.name}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H7a2 2 0 00-2 2v4h10z" />
            </svg>
            طباعة الاستمارة (A4)
          </button>

          <button
            onClick={handleSaveAndPost}
            disabled={isSaving}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            {isSaving ? 'جارِ الترحيل...' : 'حفظ وترحيل المبالغ'}
          </button>
        </div>
      </div>

      {/* رسالة نجاح الحفظ */}
      {savedSuccessMessage && (
        <div className="max-w-5xl mx-auto mb-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-bold text-center shadow-sm">
          {savedSuccessMessage}
        </div>
      )}

      {/* ورقة A4 الرسمية */}
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-slate-200 print:shadow-none print:border-none print:m-0 print:p-6 print:rounded-none">
        {/* الترويسة الرسمية لمديرية ماء محافظة البصرة */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="text-right">
              <h2 className="text-sm font-bold text-slate-700">جمهورية العراق</h2>
              <h3 className="text-sm font-bold text-slate-700">وزارة الإعمار والإسكان والبلديات</h3>
              <h1 className="text-lg font-black text-slate-900 mt-1">مديرية ماء محافظة البصرة</h1>
              <p className="text-xs font-bold text-blue-700">{branch.name}</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 mx-auto rounded-full border-2 border-slate-900 flex items-center justify-center font-black text-slate-900 mb-1">
                ماء البصرة
              </div>
              <span className="text-xs text-slate-500 font-bold">قسم الواردات والجباية</span>
            </div>

            <div className="text-left" dir="ltr">
              <p className="text-xs font-bold text-slate-700">Republic of Iraq</p>
              <p className="text-xs font-bold text-slate-700">Basra Water Directorate</p>
              <p className="text-xs font-bold text-slate-700 mt-1">Revenues Department</p>
            </div>
          </div>

          <div className="text-center mt-3">
            <h2 className="text-xl font-black text-slate-900 tracking-wide underline underline-offset-8">
              قائمة تنزيل الإرساليات والوصولات اليومية
            </h2>
          </div>
        </div>

        {/* معلومات المحصل والتاريخ ورقم الوصل الأولي */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-slate-50 p-4 rounded-xl border border-slate-300 print:bg-transparent print:p-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحصل:</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={selectedCollectorName}
                onChange={(e) => setSelectedCollectorName(e.target.value)}
                placeholder="اكتب أو اختر اسم المحصل"
                className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              />
              {branch.collectors.length > 0 && (
                <select
                  onChange={(e) => setSelectedCollectorName(e.target.value)}
                  className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white print:hidden"
                >
                  <option value="">اختر محصل</option>
                  {branch.collectors.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ الإرسالية:</label>
            <input
              type="date"
              value={consignmentDate}
              onChange={(e) => setConsignmentDate(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="print:hidden">
            <label className="block text-xs font-bold text-slate-700 mb-1">تسلسل رقم أول وصل:</label>
            <input
              type="text"
              value={baseReceiptNumber}
              onChange={(e) => handleApplyBaseReceipt(e.target.value)}
              className="w-full px-3 py-1.5 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
        </div>

        {/* جدول الإرسالية A4 */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border-2 border-slate-900 text-right text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-200 border-b-2 border-slate-900 text-slate-900 font-black text-center">
                <th className="border border-slate-800 p-2 w-12">ت</th>
                <th className="border border-slate-800 p-2 w-28">رقم المشترك</th>
                <th className="border border-slate-800 p-2">اسم المشترك الثلاثي</th>
                <th className="border border-slate-800 p-2 w-32">المبلغ المدفوع (د.ع)</th>
                <th className="border border-slate-800 p-2 w-28">رقم الوصل</th>
                <th className="border border-slate-800 p-2 w-28">تاريخ الدفع</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50 transition border-b border-slate-400">
                  <td className="border border-slate-600 p-1 text-center font-bold text-slate-600 bg-slate-50 print:bg-transparent">
                    {index + 1}
                  </td>
                  <td className="border border-slate-600 p-1">
                    <input
                      type="text"
                      value={row.subscriberId}
                      onChange={(e) => handleCellChange(index, 'subscriberId', e.target.value)}
                      placeholder="رقم المشترك"
                      className="w-full px-2 py-1 text-center font-bold text-slate-900 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                  </td>
                  <td className="border border-slate-600 p-1">
                    <input
                      type="text"
                      value={row.subscriberName}
                      onChange={(e) => handleCellChange(index, 'subscriberName', e.target.value)}
                      placeholder="يظهر تلقائياً أو يكتب"
                      className="w-full px-2 py-1 font-bold text-slate-900 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                  </td>
                  <td className="border border-slate-600 p-1">
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => handleCellChange(index, 'amount', e.target.value)}
                      placeholder="0"
                      className="w-full px-2 py-1 text-center font-black text-emerald-800 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                  </td>
                  <td className="border border-slate-600 p-1">
                    <input
                      type="text"
                      value={row.receiptNumber}
                      onChange={(e) => handleCellChange(index, 'receiptNumber', e.target.value)}
                      placeholder="رقم الوصل"
                      className="w-full px-2 py-1 text-center font-bold text-blue-900 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                  </td>
                  <td className="border border-slate-600 p-1">
                    <input
                      type="date"
                      value={row.paymentDate}
                      onChange={(e) => handleCellChange(index, 'paymentDate', e.target.value)}
                      className="w-full px-1 py-1 text-center text-xs font-bold text-slate-700 bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                <td colSpan={3} className="border border-slate-800 p-3 text-center text-base">
                  المجموع الكلي للإرسالية:
                </td>
                <td className="border border-slate-800 p-3 text-center text-base text-emerald-700">
                  {totalAmount.toLocaleString('ar-IQ')} د.ع
                </td>
                <td colSpan={2} className="border border-slate-800 p-3 text-center text-xs text-slate-600">
                  عدد الوصولات: {rows.filter(r => r.subscriberId.trim() !== '' && parseFloat(r.amount) > 0).length}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* زر إضافة أسطر إضافية */}
        <div className="mt-4 flex justify-between items-center print:hidden">
          <button
            onClick={handleAddMoreRows}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
          >
            إضافة 10 أسطر
          </button>
        </div>

        {/* توقيعات المسؤولين المعتمدة في ورقة A4 */}
        <div className="mt-12 pt-6 border-t border-slate-400 grid grid-cols-3 text-center text-xs sm:text-sm font-black text-slate-800">
          <div>
            <p className="mb-8">توقيع المحصل</p>
            <p className="text-slate-600">{selectedCollectorName || '..........................'}</p>
          </div>
          <div>
            <p className="mb-8">توقيع مسؤول الخزنة / الصندوق</p>
            <p className="text-slate-600">..........................</p>
          </div>
          <div>
            <p className="mb-8">توقيع ومصادقة مسؤول الفرع</p>
            <p className="text-slate-600">{branch.managers[0]?.name || '..........................'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
