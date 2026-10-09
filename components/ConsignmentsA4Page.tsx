'use client'

import React, { useState, useMemo } from 'react'
import { Printer, Save, ArrowRight, Plus, RefreshCw, Hash, Percent } from 'lucide-react'
import { DirectorateBranch, Consignment, ConsignmentItem } from '@/lib/directorateTypes'
import { Subscriber, BillingRecords } from '@/components/MainApp'

interface ConsignmentsA4PageProps {
  branch: DirectorateBranch
  onSaveConsignment: (consignment: Consignment, updatedSubscribers: Subscriber[], updatedBilling: BillingRecords) => void
  onClose: () => void
}

interface RowData {
  subscriberId: string
  subscriberName: string
  areaName: string
  amount: string
  waterAmount: string
  municipalityAmount: string
  receiptNumber: string
  paymentDate: string
  paymentTime: string
}

// دالة تفقيط الأرقام إلى كلمات عربية فصيحة لسطر "فقط"
function tafqeet(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'صفر'

  const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر']
  const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون']
  const hundreds = ['', 'مائة', 'مئتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة']

  function convertGroup(n: number): string {
    let res = ''
    const h = Math.floor(n / 100)
    const rem = n % 100
    if (h > 0) res += hundreds[h]
    if (rem > 0) {
      if (res) res += ' و'
      if (rem < 20) {
        res += ones[rem]
      } else {
        const o = rem % 10
        const t = Math.floor(rem / 10)
        if (o > 0) res += ones[o] + ' و'
        res += tens[t]
      }
    }
    return res
  }

  const millions = Math.floor(num / 1000000)
  const thousands = Math.floor((num % 1000000) / 1000)
  const remainder = Math.floor(num % 1000)

  const parts: string[] = []
  if (millions > 0) {
    if (millions === 1) parts.push('مليون')
    else if (millions === 2) parts.push('مليونان')
    else if (millions >= 3 && millions <= 10) parts.push(convertGroup(millions) + ' ملايين')
    else parts.push(convertGroup(millions) + ' مليون')
  }
  if (thousands > 0) {
    if (thousands === 1) parts.push('ألف')
    else if (thousands === 2) parts.push('ألفان')
    else if (thousands >= 3 && thousands <= 10) parts.push(convertGroup(thousands) + ' آلاف')
    else parts.push(convertGroup(thousands) + ' ألف')
  }
  if (remainder > 0) {
    parts.push(convertGroup(remainder))
  }

  return parts.join(' و')
}

export default function ConsignmentsA4Page({ branch, onSaveConsignment, onClose }: ConsignmentsA4PageProps) {
  // الرقم التسلسلي المطبوع في أعلى الورقة
  const [serialNumber, setSerialNumber] = useState<string>('02951')
  const [paperRefNumber, setPaperRefNumber] = useState<string>('')
  const [branchNameDisplay, setBranchNameDisplay] = useState<string>(branch.name.replace(/^فرع\s*/, ''))
  
  // اسم المحصل وتاريخ الإرسالية
  const [selectedCollectorName, setSelectedCollectorName] = useState<string>(
    branch.collectors[0]?.name || ''
  )
  const [consignmentDate, setConsignmentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [baseReceiptNumber, setBaseReceiptNumber] = useState<string>('')

  // نسبة البلدية الافتراضية المأخوذة من المبلغ (بالنسبة المئوية %)
  const [municipalityRatio, setMunicipalityRatio] = useState<number>(20)

  // إنشاء 23 صفاً افتراضياً لورقة A4 الرسمية كما طلب المستخدم
  const [rows, setRows] = useState<RowData[]>(() => {
    const today = new Date().toISOString().split('T')[0]
    return Array.from({ length: 23 }, () => ({
      subscriberId: '',
      subscriberName: '',
      areaName: '',
      amount: '',
      waterAmount: '',
      municipalityAmount: '',
      receiptNumber: '',
      paymentDate: today,
      paymentTime: ''
    }))
  })

  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // خريطة سريعة للمناطق
  const areasMap = useMemo(() => {
    const map = new Map<string, string>()
    ;(branch.areas || []).forEach(a => map.set(a.id, a.name))
    return map
  }, [branch.areas])

  // خريطة سريعة للبحث عن بيانات المشتركين
  const subscriberMap = useMemo(() => {
    const map = new Map<number, Subscriber>()
    ;(branch.subscribers || []).forEach(sub => map.set(sub.id, sub))
    return map
  }, [branch.subscribers])

  // تحديث خانة معينة
  const handleCellChange = (index: number, field: keyof RowData, value: string) => {
    const newRows = [...rows]
    newRows[index] = { ...newRows[index], [field]: value }

    // 1. إذا تم تعديل رقم المشترك، استخرج الاسم والمنطقة تلقائياً فوراً
    if (field === 'subscriberId') {
      const numId = parseInt(value.trim(), 10)
      if (!isNaN(numId) && subscriberMap.has(numId)) {
        const foundSub = subscriberMap.get(numId)!
        newRows[index].subscriberName = foundSub.name || ''
        
        let areaFound = ''
        // أ. فحص الربط الصريح برقم المنطقة areaId
        if (foundSub.areaId && areasMap.has(foundSub.areaId)) {
          areaFound = areasMap.get(foundSub.areaId)!
        }
        
        // ب. إذا لم توجد، فحص العنوان التفصيلي detailedAddress
        if (!areaFound && foundSub.detailedAddress && foundSub.detailedAddress.trim()) {
          const cleanAddr = foundSub.detailedAddress.trim()
          for (const area of (branch.areas || [])) {
            if (cleanAddr.includes(area.name)) {
              areaFound = area.name
              break
            }
          }
          if (!areaFound && cleanAddr !== 'قرب') {
            areaFound = cleanAddr
          }
        }

        // ج. إذا كانت لا تزال فارغة، خذ منطقة الصف السابق إن وجدت
        if (!areaFound && index > 0 && newRows[index - 1]?.areaName) {
          areaFound = newRows[index - 1].areaName
        }

        newRows[index].areaName = areaFound
      } else if (value.trim() === '') {
        newRows[index].subscriberName = ''
        newRows[index].areaName = ''
      }
    }

    // 2. إذا تم تعديل المبلغ الإجمالي، وزّع المبلغ تلقائياً بين الماء والبلدية حسب النسبة
    if (field === 'amount') {
      const totalVal = parseFloat(value.trim())
      if (!isNaN(totalVal) && totalVal > 0) {
        const muni = Math.round(totalVal * (municipalityRatio / 100))
        const water = totalVal - muni
        newRows[index].municipalityAmount = String(muni)
        newRows[index].waterAmount = String(water)
      } else {
        newRows[index].municipalityAmount = ''
        newRows[index].waterAmount = ''
      }
    }

    // 3. إذا تم تعديل رقم الوصل في هذا الصف، تسلسل باقي الخانات تحته تلقائياً
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

  // إعادة احتساب تقسيم الماء والبلدية لجميع الصفوف عند تغيير نسبة البلدية
  const handleUpdateRatio = (newRatio: number) => {
    setMunicipalityRatio(newRatio)
    const updated = rows.map(r => {
      const totalVal = parseFloat(r.amount.trim())
      if (!isNaN(totalVal) && totalVal > 0) {
        const muni = Math.round(totalVal * (newRatio / 100))
        const water = totalVal - muni
        return {
          ...r,
          municipalityAmount: String(muni),
          waterAmount: String(water)
        }
      }
      return r
    })
    setRows(updated)
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

  // إضافة سطر واحد إضافي بنقرة زر
  const handleAddSingleRow = () => {
    const lastRow = rows[rows.length - 1]
    const lastNum = parseInt(lastRow?.receiptNumber || '0', 10)
    const newRow: RowData = {
      subscriberId: '',
      subscriberName: '',
      areaName: lastRow?.areaName || '',
      amount: '',
      waterAmount: '',
      municipalityAmount: '',
      receiptNumber: !isNaN(lastNum) && lastNum > 0 ? String(lastNum + 1) : '',
      paymentDate: consignmentDate,
      paymentTime: ''
    }
    setRows([...rows, newRow])
  }

  // توليد رقم تسلسلي جديد للورقة
  const handleGenerateNewSerial = () => {
    const nextNum = Math.floor(1000 + Math.random() * 90000).toString().padStart(5, '0')
    setSerialNumber(nextNum)
  }

  // حساب المجاميع
  const totalAmount = rows.reduce((sum, r) => {
    const val = parseFloat(r.amount)
    return !isNaN(val) ? sum + val : sum
  }, 0)

  const totalWater = rows.reduce((sum, r) => {
    const val = parseFloat(r.waterAmount)
    return !isNaN(val) ? sum + val : sum
  }, 0)

  const totalMunicipality = rows.reduce((sum, r) => {
    const val = parseFloat(r.municipalityAmount)
    return !isNaN(val) ? sum + val : sum
  }, 0)

  const validRowsCount = rows.filter(r => r.subscriberId.trim() !== '' && parseFloat(r.amount) > 0).length

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
      areaName: r.areaName,
      amount: parseFloat(r.amount),
      waterAmount: parseFloat(r.waterAmount) || 0,
      municipalityAmount: parseFloat(r.municipalityAmount) || 0,
      receiptNumber: r.receiptNumber,
      paymentDate: r.paymentDate || consignmentDate
    }))

    const newConsignment: Consignment = {
      id: 'cons_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      serialNumber,
      paperRefNumber,
      branchId: branch.id,
      collectorName: selectedCollectorName,
      date: consignmentDate,
      items: consignmentItems,
      totalAmount,
      totalWaterAmount: totalWater,
      totalMunicipalityAmount: totalMunicipality,
      createdAt: new Date().toISOString()
    }

    // ترحيل الدفعات وتحديث ديون المشتركين ومناطقهم المسجلة
    const updatedBilling = { ...(branch.billing || {}) }
    const updatedSubscribers = branch.subscribers.map(sub => {
      const paymentsForSub = consignmentItems.filter(item => item.subscriberId === sub.id)
      if (paymentsForSub.length === 0) return sub

      const totalPaidInConsignment = paymentsForSub.reduce((s, p) => s + p.amount, 0)
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
      
      const periods = updatedBilling[sub.id][currentYear]
      if (periods && periods.length > 0) {
        periods[0].paid = (periods[0].paid || 0) + totalPaidInConsignment
      }

      // إذا كانت المنطقة مدخلة ولم تكن مسجلة للمشترك سابقاً، نربطها به
      let updatedAreaId = sub.areaId
      const itemRow = paymentsForSub[0]
      if (!updatedAreaId && itemRow.areaName) {
        const matchedArea = (branch.areas || []).find(a => a.name === itemRow.areaName)
        if (matchedArea) {
          updatedAreaId = matchedArea.id
        }
      }

      return {
        ...sub,
        areaId: updatedAreaId,
        remainingPrev: newRemainingPrev
      }
    })

    onSaveConsignment(newConsignment, updatedSubscribers, updatedBilling)
    setIsSaving(false)
    setSavedSuccessMessage(`تم بنجاح حفظ وترحيل الإرسالية رقم (${serialNumber}) بإجمالي ${totalAmount.toLocaleString('ar-IQ')} دينار لـ (${validRows.length}) مشترك!`)
    setTimeout(() => {
      setSavedSuccessMessage(null)
    }, 4500)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-slate-100 p-2 sm:p-6 print:p-0 print:bg-white text-slate-800 font-sans" dir="rtl">
      
      {/* قائمة اقتراحات المناطق */}
      <datalist id="branch-areas-list">
        {(branch.areas || []).map(a => (
          <option key={a.id} value={a.name} />
        ))}
      </datalist>

      {/* ========================================================
          شريط الإجراءات والتحكم العلوي (يُخفى بالكامل أثناء الطباعة)
          ======================================================== */}
      <div className="no-print print:hidden max-w-6xl mx-auto mb-5 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderColor: '#cbd5e1' }}
              className="px-4 py-2 hover:bg-slate-200 border rounded-xl font-bold transition flex items-center gap-2 shadow-sm cursor-pointer active:scale-95 text-xs sm:text-sm"
            >
              <ArrowRight className="w-4 h-4 text-slate-700" />
              <span>رجوع للوحة التحكم</span>
            </button>
            <div>
              <h1 className="text-lg sm:text-xl font-black text-slate-900">استمارة تنزيل الإرساليات الرسمية</h1>
              <p className="text-xs text-slate-500 font-bold">ورقة A4 الرسمية لمديرية ماء البصرة</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handlePrint}
              style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
              className="px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-md hover:bg-blue-700 transition flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4 text-white" />
              <span>طباعة الاستمارة (A4)</span>
            </button>

            <button
              onClick={handleSaveAndPost}
              disabled={isSaving}
              style={{ backgroundColor: '#059669', color: '#ffffff' }}
              className="px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm shadow-md hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4 text-white" />
              <span>{isSaving ? 'جارِ الترحيل...' : 'حفظ وترحيل المبالغ'}</span>
            </button>
          </div>
        </div>

        {/* أدوات الإعدادات السريعة (رقم الوصل المتسلسل + نسبة البلدية + الرقم التسلسلي) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs font-bold text-slate-700">
          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <Hash className="w-4 h-4 text-blue-600" />
            <span className="whitespace-nowrap">رقم أول وصل:</span>
            <input
              type="text"
              value={baseReceiptNumber}
              onChange={(e) => handleApplyBaseReceipt(e.target.value)}
              placeholder="مثال: 4575068"
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-bold text-blue-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <Percent className="w-4 h-4 text-amber-600" />
            <span className="whitespace-nowrap">نسبة البلدية:</span>
            <input
              type="number"
              min="0"
              max="100"
              value={municipalityRatio}
              onChange={(e) => handleUpdateRatio(Number(e.target.value) || 0)}
              className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-black text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <span className="text-[11px] text-slate-500">% من المبلغ المستلم</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200 justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-red-600 font-mono font-black text-sm">تسلسل الورقة:</span>
              <input
                type="text"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                className="w-24 px-2 py-1 bg-white border border-red-300 rounded-lg text-center font-mono font-black text-red-600 text-sm focus:outline-none"
              />
            </div>
            <button
              onClick={handleGenerateNewSerial}
              title="توليد رقم تسلسلي جديد للورقة التالية"
              className="p-1.5 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* رسالة نجاح الحفظ */}
      {savedSuccessMessage && (
        <div className="no-print print:hidden max-w-6xl mx-auto mb-4 p-4 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-2xl font-bold text-center shadow-sm">
          {savedSuccessMessage}
        </div>
      )}

      {/* ========================================================
          ورقة A4 الرسمية المطابقة تماماً للاستمارة
          ======================================================== */}
      <div 
        className="max-w-5xl mx-auto bg-white p-4 sm:p-8 rounded-2xl shadow-xl border border-slate-300 print:shadow-none print:border-none print:m-0 print:p-2 print:rounded-none"
        style={{ minHeight: '297mm' }}
      >
        
        {/* الترويسة الرسمية لورقة الإرسالية */}
        <div className="flex justify-between items-start mb-2">
          {/* الجانب الأيمن */}
          <div className="text-right">
            <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">محافظة البصرة</h2>
            <h3 className="text-sm sm:text-base font-black text-slate-800 leading-tight mt-0.5">مديرية ماء البصرة</h3>
            <div className="flex items-center gap-1.5 text-xs sm:text-sm font-black text-slate-900 mt-1">
              <span>واردات /</span>
              <input
                type="text"
                value={branchNameDisplay}
                onChange={(e) => setBranchNameDisplay(e.target.value)}
                className="border-b border-dotted border-slate-700 bg-transparent px-1 font-black text-slate-900 focus:outline-none w-36 sm:w-48"
              />
            </div>
          </div>

          {/* الجانب الأيسر (الرقم التسلسلي + الرقم + إرسالية جباية) */}
          <div className="text-left" dir="ltr">
            <div className="text-right font-mono text-base sm:text-lg font-black tracking-widest text-slate-900 print:text-black mb-1">
              {serialNumber}
            </div>
            <div className="text-right space-y-1 text-xs sm:text-sm font-bold text-slate-900" dir="rtl">
              <div className="flex items-center justify-end gap-1.5">
                <span>الرقم :</span>
                <input
                  type="text"
                  value={paperRefNumber}
                  onChange={(e) => setPaperRefNumber(e.target.value)}
                  placeholder="..................."
                  className="border-b border-dotted border-slate-700 bg-transparent px-1 text-center font-bold text-slate-900 focus:outline-none w-32 sm:w-44"
                />
              </div>

              <div className="flex items-center justify-end gap-1.5">
                <span>ارسالـيـة جبـايـة :</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={selectedCollectorName}
                    onChange={(e) => setSelectedCollectorName(e.target.value)}
                    placeholder="اسم المحصل..."
                    className="border-b border-dotted border-slate-700 bg-transparent px-1 font-bold text-slate-900 focus:outline-none w-28 sm:w-36"
                  />
                  {branch.collectors.length > 0 && (
                    <select
                      onChange={(e) => setSelectedCollectorName(e.target.value)}
                      className="no-print print:hidden text-[11px] p-0.5 border border-slate-300 rounded bg-white"
                    >
                      <option value="">اختر</option>
                      {branch.collectors.map(c => (
                        <option key={c.id} value={c.name}>{c.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* تاريخ الإرسالية في الهامش (بدون إظهار نسبة البلدية بالطباعة) */}
        <div className="flex justify-between items-center text-[11px] text-slate-600 mb-2 border-b border-slate-300 pb-1">
          <div className="flex items-center gap-2">
            <span>تاريخ الإرسالية:</span>
            <input
              type="date"
              value={consignmentDate}
              onChange={(e) => setConsignmentDate(e.target.value)}
              className="font-bold text-slate-800 bg-transparent border-0 focus:outline-none"
            />
          </div>
        </div>

        {/* ========================================================
            جدول استمارة الإرساليات الرسمي (23 سطراً)
            ======================================================== */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-900 text-right text-[11px] sm:text-xs">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-black text-center border-b border-slate-900">
                <th className="border border-slate-900 p-1 w-10 sm:w-12" rowSpan={2}>ت</th>
                <th className="border border-slate-900 p-1 w-32 sm:w-44" rowSpan={2}>أسم المشترك</th>
                <th className="border border-slate-900 p-1 w-24 sm:w-32" rowSpan={2}>المنطقة</th>
                <th className="border border-slate-900 p-1 w-24 sm:w-28" rowSpan={2}>المبلغ المستلم</th>
                <th className="border border-slate-900 p-1" colSpan={2}>تقسيم المبالغ</th>
                <th className="border border-slate-900 p-1 w-24 sm:w-28" rowSpan={2}>رقم الوصل</th>
                <th className="border border-slate-900 p-1 w-20 sm:w-24" rowSpan={2}>وقت / تاريخ الوصل</th>
              </tr>
              <tr className="bg-slate-100 text-slate-900 font-bold text-center border-b border-slate-900">
                <th className="border border-slate-900 p-1 w-20 sm:w-24 text-blue-900">مـاء</th>
                <th className="border border-slate-900 p-1 w-20 sm:w-24 text-amber-900">البلدية</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-slate-50 border-b border-slate-800 h-7">
                  {/* رقم المشترك */}
                  <td className="border border-slate-800 p-0 text-center font-bold">
                    <input
                      type="text"
                      value={row.subscriberId}
                      onChange={(e) => handleCellChange(index, 'subscriberId', e.target.value)}
                      className="w-full h-full text-center font-black text-slate-900 bg-transparent focus:bg-amber-50 focus:outline-none"
                    />
                  </td>

                  {/* اسم المشترك */}
                  <td className="border border-slate-800 p-0">
                    <input
                      type="text"
                      value={row.subscriberName}
                      onChange={(e) => handleCellChange(index, 'subscriberName', e.target.value)}
                      className="w-full h-full px-1 font-bold text-slate-900 bg-transparent focus:bg-amber-50 focus:outline-none"
                    />
                  </td>

                  {/* المنطقة (تلقائية وقابلة للاختيار والتعديل) */}
                  <td className="border border-slate-800 p-0">
                    <input
                      type="text"
                      list="branch-areas-list"
                      value={row.areaName}
                      onChange={(e) => handleCellChange(index, 'areaName', e.target.value)}
                      className="w-full h-full px-1 text-center font-bold text-slate-800 bg-transparent focus:bg-amber-50 focus:outline-none"
                    />
                  </td>

                  {/* المبلغ الإجمالي المستلم */}
                  <td className="border border-slate-800 p-0">
                    <input
                      type="number"
                      value={row.amount}
                      onChange={(e) => handleCellChange(index, 'amount', e.target.value)}
                      placeholder=""
                      className="w-full h-full px-1 text-center font-black text-slate-900 bg-transparent focus:bg-amber-50 focus:outline-none"
                    />
                  </td>

                  {/* حصة الماء */}
                  <td className="border border-slate-800 p-0">
                    <input
                      type="number"
                      value={row.waterAmount}
                      onChange={(e) => handleCellChange(index, 'waterAmount', e.target.value)}
                      placeholder=""
                      className="w-full h-full px-1 text-center font-bold text-blue-900 bg-transparent focus:bg-blue-50 focus:outline-none"
                    />
                  </td>

                  {/* حصة البلدية */}
                  <td className="border border-slate-800 p-0">
                    <input
                      type="number"
                      value={row.municipalityAmount}
                      onChange={(e) => handleCellChange(index, 'municipalityAmount', e.target.value)}
                      placeholder=""
                      className="w-full h-full px-1 text-center font-bold text-amber-900 bg-transparent focus:bg-amber-50 focus:outline-none"
                    />
                  </td>

                  {/* رقم الوصل */}
                  <td className="border border-slate-800 p-0">
                    <input
                      type="text"
                      value={row.receiptNumber}
                      onChange={(e) => handleCellChange(index, 'receiptNumber', e.target.value)}
                      placeholder=""
                      className="w-full h-full px-1 text-center font-mono font-bold text-slate-900 bg-transparent focus:bg-amber-50 focus:outline-none"
                    />
                  </td>

                  {/* وقت / تاريخ الوصل */}
                  <td className="border border-slate-800 p-0">
                    <input
                      type="text"
                      value={row.paymentTime || row.paymentDate}
                      onChange={(e) => handleCellChange(index, 'paymentTime', e.target.value)}
                      placeholder=""
                      className="w-full h-full px-1 text-center text-[10px] font-bold text-slate-600 bg-transparent focus:bg-amber-50 focus:outline-none"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              {/* صف المجاميع الكلية */}
              <tr className="bg-slate-100 font-black text-slate-900 border-t-2 border-slate-900">
                <td colSpan={3} className="border border-slate-900 p-1.5 text-center text-xs sm:text-sm">
                  المجموع الكلي ({validRowsCount} وصل):
                </td>
                <td className="border border-slate-900 p-1.5 text-center text-xs sm:text-sm font-black">
                  {totalAmount > 0 ? totalAmount.toLocaleString('ar-IQ') : '—'}
                </td>
                <td className="border border-slate-900 p-1.5 text-center text-xs font-black text-blue-900">
                  {totalWater > 0 ? totalWater.toLocaleString('ar-IQ') : '—'}
                </td>
                <td className="border border-slate-900 p-1.5 text-center text-xs font-black text-amber-900">
                  {totalMunicipality > 0 ? totalMunicipality.toLocaleString('ar-IQ') : '—'}
                </td>
                <td colSpan={2} className="border border-slate-900 p-1 text-center text-[11px] text-slate-600">
                  مديرية ماء البصرة
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* زر إضافة سطر إضافي واحد (مخفي تماماً في الطباعة) */}
        <div className="no-print print:hidden mt-3 flex justify-between items-center">
          <button
            onClick={handleAddSingleRow}
            style={{ backgroundColor: '#f1f5f9', color: '#1e293b', borderColor: '#cbd5e1' }}
            className="px-4 py-2 border rounded-xl font-bold text-xs hover:bg-slate-200 transition flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-sm"
          >
            <Plus className="w-4 h-4 text-slate-700" />
            <span>إضافة سطر</span>
          </button>

          <span className="text-xs text-slate-500 font-bold">
            عدد الأسطر الحالية في الورقة: {rows.length}
          </span>
        </div>

        {/* سطر التفقيط الرسمي (فقط) */}
        <div className="mt-5 pt-3 border-t-2 border-slate-900 flex items-center gap-2 text-xs sm:text-sm font-black text-slate-900">
          <span className="whitespace-nowrap underline underline-offset-4">فـقـط :</span>
          <span className="flex-1 border-b border-dotted border-slate-700 pb-1 font-bold text-slate-800">
            {totalAmount > 0 ? `${tafqeet(totalAmount)} دينار عراقي لا غير.` : '.......................................................................................................................................................................'}
          </span>
        </div>

        {/* ========================================================
            التواقيع الرسمية الأربعة المعتمدة كما في الاستمارة
            ======================================================== */}
        <div className="mt-7 pt-4 grid grid-cols-4 text-center text-[11px] sm:text-xs font-black text-slate-900 gap-2">
          {/* 1. الجابي */}
          <div>
            <p className="font-black text-slate-900 mb-8 sm:mb-10">الـجـابـي</p>
            <p className="text-slate-600 font-bold text-[10px] sm:text-[11px]">
              {selectedCollectorName || '..........................'}
            </p>
          </div>

          {/* 2. المدقق */}
          <div>
            <p className="font-black text-slate-900 mb-8 sm:mb-10">الـمـدقـق</p>
            <p className="text-slate-600 font-bold text-[10px] sm:text-[11px]">
              ..........................
            </p>
          </div>

          {/* 3. مسؤول الواردات */}
          <div>
            <p className="font-black text-slate-900 mb-2">مسؤول الواردات</p>
            <p className="text-[10px] text-slate-700 mb-4 sm:mb-6">
              الاسم: {branch.managers[0]?.name || '...................'}
            </p>
            <p className="text-[10px] text-slate-700">
              التوقيع: ...................
            </p>
          </div>

          {/* 4. أمين الصندوق */}
          <div>
            <p className="font-black text-slate-900 mb-2">أمين الصندوق</p>
            <p className="text-[10px] text-slate-700 mb-4 sm:mb-6">
              توقيع أمين الصندوق باستلام المبلغ
            </p>
            <p className="text-slate-600 font-bold text-[10px] sm:text-[11px]">
              ..........................
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
