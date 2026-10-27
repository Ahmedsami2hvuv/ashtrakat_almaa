'use client'

import React, { useEffect, useState } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { generateInspectionQRDataUrl } from '@/lib/inspectionStore'
import { Plus, Trash2 } from 'lucide-react'

interface InspectionPrintableA4Props {
  inspection: InspectionRecord
  isEditable?: boolean
  onUpdate?: (updated: InspectionRecord) => void
  branchManagerName?: string
}

export default function InspectionPrintableA4({
  inspection,
  isEditable = false,
  onUpdate,
  branchManagerName
}: InspectionPrintableA4Props) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')

  // توليد كود الكشف التسلسلي
  const inspectionCode = `BAS-WAT-${inspection.inspectionDate?.replace(/\//g, '') || '2026'}-${inspection.id.substring(inspection.id.length - 4).toUpperCase()}`

  useEffect(() => {
    let isMounted = true
    generateInspectionQRDataUrl(inspection.id).then((url) => {
      if (isMounted) setQrCodeUrl(url)
    })
    return () => {
      isMounted = false
    }
  }, [inspection.id])

  // استخلاص اسم الفرع النظيف لمنع تكرار كلمة "مركز جباية واردات"
  const rawBranch = inspection.branchName || 'أبي الخصيب'
  const cleanBranch = rawBranch
    .replace(/مديرية\s+ماء\s+البصرة/gi, '')
    .replace(/مركز\s+جباية\s+واردات/gi, '')
    .replace(/مركز\s+واردات/gi, '')
    .replace(/فرع/gi, '')
    .trim() || 'أبي الخصيب'

  // اسم مسؤول الواردات للفرع المحدد
  const defaultRevenuesManager =
    inspection.revenuesManagerName ||
    branchManagerName ||
    (cleanBranch.includes('خصيب') ? 'حسين علي لفتة جابر' : 'مسؤول الواردات')

  // تحديث حقل رئيسي
  const handleFieldChange = (field: keyof InspectionRecord, value: any) => {
    if (!onUpdate) return
    onUpdate({
      ...inspection,
      [field]: value
    })
  }

  // تحديث خلية في جدول العقار
  const handleTableChange = (field: string, value: string) => {
    if (!onUpdate) return
    onUpdate({
      ...inspection,
      tableData: {
        ...inspection.tableData,
        [field]: value
      }
    })
  }

  // تحديث نقطة تقرير
  const handlePointChange = (index: number, value: string) => {
    if (!onUpdate) return
    const points = [...(inspection.reportPoints || [])]
    points[index] = value
    onUpdate({
      ...inspection,
      reportPoints: points
    })
  }

  // إضافة نقطة
  const handleAddPoint = () => {
    if (!onUpdate) return
    const points = [...(inspection.reportPoints || []), '']
    onUpdate({
      ...inspection,
      reportPoints: points
    })
  }

  // حذف نقطة
  const handleRemovePoint = (index: number) => {
    if (!onUpdate) return
    const points = (inspection.reportPoints || []).filter((_, idx) => idx !== index)
    onUpdate({
      ...inspection,
      reportPoints: points
    })
  }

  return (
    <>
      {/* تضمين تنسيقات الطباعة الصارمة لإخفاء كافة أزرار وتفاصيل النظام الخارجية */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          /* إخفاء كل العناصر ما عدا ورقة الطباعة */
          header, nav, aside, footer, button, .print-hide, [role="dialog"] > div:not(.print-allow) {
            display: none !important;
          }
          .inspection-print-container {
            width: 210mm !important;
            min-height: 297mm !important;
            max-width: 100% !important;
            margin: 0 auto !important;
            padding: 8mm !important;
            box-shadow: none !important;
            border: none !important;
            position: relative !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
          /* إخفاء حقول الإدخال وإظهار النص النظيف فقط في الطباعة */
          .screen-only-input {
            display: none !important;
          }
          .print-only-text {
            display: block !important;
          }
        }
        @media screen {
          .print-only-text {
            display: none;
          }
        }
      `}</style>

      <div
        className="inspection-print-container bg-white text-black mx-auto shadow-xl print:shadow-none print:m-0 relative"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '10mm',
          boxSizing: 'border-box',
          direction: 'rtl',
          fontFamily: 'Arial, "Traditional Arabic", "Segoe UI", sans-serif'
        }}
      >
        {/* الإطار الأزرق المزدوج المطابق لنموذج ماء البصرة الورقي */}
        <div
          className="w-full h-full border-[3px] border-[#0c4a8a] p-1 flex flex-col justify-between"
          style={{ minHeight: '277mm', boxSizing: 'border-box' }}
        >
          <div
            className="w-full h-full border border-[#0c4a8a] p-5 flex flex-col justify-between"
            style={{ minHeight: '273mm', boxSizing: 'border-box' }}
          >
            {/* الجزء العلوي والبيانات والجدول والتقرير */}
            <div>
              {/* أولاً: الترويسة العليا في نفس السطر مدمجة جداً (بارتفاع سطرين فقط) */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-300">
                {/* اليمين: جملة مديرية ماء البصرة بسطر واحد، وتحتها مركز جباية واردات [اسم الفرع] */}
                <div className="text-right leading-tight">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">
                    مديرية ماء البصرة
                  </h2>
                  <h3 className="text-sm sm:text-base font-bold text-[#b91c1c] whitespace-nowrap mt-0.5">
                    مركز جباية واردات {cleanBranch}
                  </h3>
                </div>

                {/* المنتصف: الشعار في نفس السطر ومطابق لارتفاع السطرين فقط (صغير الحجم) */}
                <div className="flex items-center justify-center">
                  <img
                    src="/icons/directorate-logo.png"
                    alt="شعار مديرية ماء البصرة"
                    className="h-11 w-11 object-contain"
                  />
                </div>

                {/* اليسار: الباركود وكود الكشف في نفس السطر */}
                <div className="flex items-center gap-2 text-left">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="w-10 h-10 border border-slate-300 p-0.5 bg-white shadow-xs"
                    />
                  ) : null}
                  <div className="flex flex-col text-left">
                    <span className="text-[10px] text-slate-700 font-mono font-bold leading-tight">
                      {inspectionCode}
                    </span>
                    <span className="text-[9px] text-slate-500 font-medium">كود الكشف الفني</span>
                  </div>
                </div>
              </div>

              {/* ثانياً: بلوك الكشف الفني بارتفاع صغير جداً ولا يأخذ حيزاً كبيراً */}
              <div className="flex justify-center my-1.5">
                <div className="border border-slate-800 rounded px-8 py-0.5 bg-white">
                  <h1 className="text-lg font-black text-[#b91c1c] tracking-wide leading-none">
                    الكشف الفـني
                  </h1>
                </div>
              </div>

              {/* سطر بيانات المواطن المحاط بإطار أحمر رفيع كما في الورقة الرسمية */}
              <div className="border-t-2 border-b-2 border-[#b91c1c] py-1.5 px-3 my-2.5">
                <div className="flex items-center text-base sm:text-lg font-bold text-slate-900 leading-normal gap-2">
                  <span className="whitespace-nowrap">
                    تم اجراء الكشف الفني على العقار العائد للمواطن /ة
                  </span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.citizenName}
                        onChange={(e) => handleFieldChange('citizenName', e.target.value)}
                        placeholder="اسم صاحب العقار..."
                        className="screen-only-input flex-1 bg-transparent border-b border-dashed border-slate-400 hover:border-blue-600 focus:border-blue-700 font-black text-slate-900 text-base sm:text-lg px-1 outline-none"
                      />
                      <span className="print-only-text font-black text-slate-900 flex-1">
                        {inspection.citizenName || '...................................................'}
                      </span>
                    </>
                  ) : (
                    <span className="font-black text-slate-900 flex-1">
                      {inspection.citizenName || '...................................................'}
                    </span>
                  )}
                </div>
              </div>

              {/* سطر التاريخ وعبارة سند الطابو */}
              <div className="flex justify-between items-center my-2 text-sm sm:text-base font-bold text-slate-900 px-1">
                <div className="flex items-center gap-1.5 whitespace-nowrap">
                  <span>بتاريخ</span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.inspectionDate}
                        onChange={(e) => handleFieldChange('inspectionDate', e.target.value)}
                        className="screen-only-input w-32 bg-transparent border-b border-dashed border-slate-400 font-mono font-bold text-slate-900 text-sm sm:text-base px-1 outline-none text-center"
                      />
                      <span className="print-only-text font-mono">
                        {inspection.inspectionDate || '................'}
                      </span>
                    </>
                  ) : (
                    <span className="font-mono">{inspection.inspectionDate || '................'}</span>
                  )}
                </div>
                <span className="text-slate-900">
                  حسب الجدول ادناه وفق سند الطابو المرفق مع المعاملة
                </span>
              </div>

              {/* جدول بيانات العقار المطابق لورقة الكشف الرسمية */}
              <div className="my-2.5">
                <table className="w-full text-center border-collapse border border-slate-900 text-slate-900 font-bold">
                  <thead>
                    <tr className="border-b border-slate-900 text-sm sm:text-base">
                      <th className="border-l border-slate-900 py-1 px-2 w-12 font-bold">ت</th>
                      <th className="border-l border-slate-900 py-1 px-3 font-bold">المحافظة</th>
                      <th className="border-l border-slate-900 py-1 px-3 font-bold">القضاء</th>
                      <th className="border-l border-slate-900 py-1 px-3 font-bold">المحلة</th>
                      <th className="border-l border-slate-900 py-1 px-3 font-bold">رقم القطعة</th>
                      <th className="py-1 px-3 font-bold">رقم المقاطعة</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm sm:text-base font-bold">
                    <tr>
                      <td className="border-l border-slate-900 py-1.5 px-2 font-mono">1</td>

                      {/* المحافظة */}
                      <td className="border-l border-slate-900 py-1.5 px-2">
                        {isEditable ? (
                          <>
                            <input
                              type="text"
                              value={inspection.tableData?.governorate || 'البصرة'}
                              onChange={(e) => handleTableChange('governorate', e.target.value)}
                              className="screen-only-input w-full text-center bg-transparent border-none outline-none font-bold text-sm sm:text-base"
                            />
                            <span className="print-only-text">
                              {inspection.tableData?.governorate || 'البصرة'}
                            </span>
                          </>
                        ) : (
                          inspection.tableData?.governorate || 'البصرة'
                        )}
                      </td>

                      {/* القضاء */}
                      <td className="border-l border-slate-900 py-1.5 px-2">
                        {isEditable ? (
                          <>
                            <input
                              type="text"
                              value={inspection.tableData?.district || 'ابي الخصيب'}
                              onChange={(e) => handleTableChange('district', e.target.value)}
                              className="screen-only-input w-full text-center bg-transparent border-none outline-none font-bold text-sm sm:text-base"
                            />
                            <span className="print-only-text">
                              {inspection.tableData?.district || 'ابي الخصيب'}
                            </span>
                          </>
                        ) : (
                          inspection.tableData?.district || 'ابي الخصيب'
                        )}
                      </td>

                      {/* المحلة */}
                      <td className="border-l border-slate-900 py-1.5 px-2">
                        {isEditable ? (
                          <>
                            <input
                              type="text"
                              value={inspection.tableData?.neighborhood || ''}
                              onChange={(e) => handleTableChange('neighborhood', e.target.value)}
                              placeholder="شيخ ابراهيم"
                              className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none font-bold text-sm sm:text-base"
                            />
                            <span className="print-only-text">
                              {inspection.tableData?.neighborhood || '...............'}
                            </span>
                          </>
                        ) : (
                          inspection.tableData?.neighborhood || '...............'
                        )}
                      </td>

                      {/* رقم القطعة */}
                      <td className="border-l border-slate-900 py-1.5 px-2">
                        {isEditable ? (
                          <>
                            <input
                              type="text"
                              value={inspection.tableData?.plotNumber || ''}
                              onChange={(e) => handleTableChange('plotNumber', e.target.value)}
                              placeholder="80/185"
                              className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none font-mono font-bold text-sm sm:text-base"
                            />
                            <span className="print-only-text font-mono">
                              {inspection.tableData?.plotNumber || '...............'}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono">
                            {inspection.tableData?.plotNumber || '...............'}
                          </span>
                        )}
                      </td>

                      {/* رقم المقاطعة */}
                      <td className="py-1.5 px-2">
                        {isEditable ? (
                          <>
                            <input
                              type="text"
                              value={inspection.tableData?.sectorNumber || ''}
                              onChange={(e) => handleTableChange('sectorNumber', e.target.value)}
                              placeholder="20"
                              className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none font-mono font-bold text-sm sm:text-base"
                            />
                            <span className="print-only-text font-mono">
                              {inspection.tableData?.sectorNumber || '...............'}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono">
                            {inspection.tableData?.sectorNumber || '...............'}
                          </span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* ثالثاً: جملة تقرير الكشف في أقصى اليمين وبأقل ارتفاع ممكن */}
              <div className="flex justify-start my-2">
                <div className="border border-slate-800 rounded px-4 py-0.5 bg-white">
                  <h3 className="text-sm sm:text-base font-bold text-[#b91c1c] leading-none">
                    تقرير الكشف
                  </h3>
                </div>
              </div>

              {/* رابعاً: نقاط تقرير الكشف - في الشاشة خلايا للتعديل، وفي الطباعة تظهر كنص مطبوع رسمي نظيف تماماً */}
              <div className="space-y-2.5 px-1 min-h-[140px] text-justify text-base sm:text-lg font-bold text-slate-950 leading-relaxed">
                {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
                  inspection.reportPoints.map((point, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="font-bold text-slate-900 shrink-0 mt-0.5">
                        {index + 1}-
                      </span>

                      {/* في وضع الشاشة: حقل تعديل سلس */}
                      {isEditable ? (
                        <>
                          <div className="screen-only-input flex-1 flex items-start gap-2">
                            <textarea
                              rows={2}
                              value={point}
                              onChange={(e) => handlePointChange(index, e.target.value)}
                              className="w-full bg-slate-50/50 border border-slate-200 hover:border-slate-300 focus:border-blue-600 rounded p-1.5 font-bold text-base sm:text-lg text-slate-950 outline-none leading-relaxed resize-y"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemovePoint(index)}
                              className="text-slate-300 hover:text-rose-600 p-1 transition"
                              title="حذف هذا السطر"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {/* في وضع الطباعة: نص رسمي نظيف بدون أي إطارات إطلاقاً */}
                          <p className="print-only-text flex-1 text-justify font-bold leading-relaxed text-slate-950">
                            {point}
                          </p>
                        </>
                      ) : (
                        <p className="flex-1 text-justify font-bold leading-relaxed">{point}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-justify font-bold leading-relaxed">{inspection.rawReportText}</p>
                )}

                {isEditable && (
                  <div className="screen-only-input print:hidden pt-1">
                    <button
                      type="button"
                      onClick={handleAddPoint}
                      className="flex items-center gap-1.5 text-xs font-bold text-[#0c4a8a] hover:underline cursor-pointer py-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ إضافة نقطة/سطر جديد في التقرير</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* خامساً: التواقيع الرسمية - سطر واحد فقط فيه (موظف الكشف، م. الشبكات، م. الواردات) بدون سطر مكرر */}
            <div className="mt-6 pt-3">
              <div className="grid grid-cols-3 text-center items-end text-slate-900">
                {/* 1. موظف الكشف: اسم الكاتب أو المحصل الذي قام بالكشف */}
                <div className="flex flex-col items-center">
                  <span className="text-base sm:text-lg font-bold text-slate-900 mb-6 sm:mb-8">
                    موظف الكشف
                  </span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.writerOrCollectorName || inspection.inspectorEmployeeName || ''}
                        onChange={(e) => handleFieldChange('writerOrCollectorName', e.target.value)}
                        placeholder="اسم موظف الكشف"
                        className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-400 outline-none font-bold text-sm sm:text-base"
                      />
                      <span className="print-only-text font-bold text-sm sm:text-base">
                        {inspection.writerOrCollectorName || inspection.inspectorEmployeeName || '................................'}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-bold">
                      {inspection.writerOrCollectorName || inspection.inspectorEmployeeName || '................................'}
                    </span>
                  )}
                </div>

                {/* 2. م. الشبكات */}
                <div className="flex flex-col items-center">
                  <span className="text-base sm:text-lg font-bold text-slate-900 mb-6 sm:mb-8">
                    م. الشبكات
                  </span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.networksManagerName || ''}
                        onChange={(e) => handleFieldChange('networksManagerName', e.target.value)}
                        placeholder="................................"
                        className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-300 outline-none font-bold text-sm sm:text-base"
                      />
                      <span className="print-only-text font-bold text-sm sm:text-base">
                        {inspection.networksManagerName || '................................'}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-bold">
                      {inspection.networksManagerName || '................................'}
                    </span>
                  )}
                </div>

                {/* 3. م. الواردات: حسب مسؤول الفرع وليس اسماً معمماً */}
                <div className="flex flex-col items-center">
                  <span className="text-base sm:text-lg font-bold text-slate-900 mb-6 sm:mb-8">
                    م. الواردات
                  </span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.revenuesManagerName || defaultRevenuesManager}
                        onChange={(e) => handleFieldChange('revenuesManagerName', e.target.value)}
                        placeholder="مسؤول الواردات"
                        className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-400 outline-none font-bold text-sm sm:text-base"
                      />
                      <span className="print-only-text font-bold text-sm sm:text-base">
                        {inspection.revenuesManagerName || defaultRevenuesManager}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-bold">
                      {inspection.revenuesManagerName || defaultRevenuesManager}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
