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

  useEffect(() => {
    let isMounted = true
    generateInspectionQRDataUrl(inspection.id).then((url) => {
      if (isMounted) setQrCodeUrl(url)
    })
    return () => {
      isMounted = false
    }
  }, [inspection.id])

  // استخلاص اسم الفرع النظيف
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
      {/* تضمين تنسيقات الطباعة الصارمة */}
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
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
              {/* الترويسة العليا: الشعار والباركود بحجم البلوك (مكبرين ومطابقين لارتفاع السطرين) وبدون أي نصوص كود زائدة */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-300">
                {/* اليمين: جملة مديرية ماء البصرة بسطر واحد، وتحتها مركز جباية واردات [اسم الفرع] */}
                <div className="text-right leading-tight flex flex-col justify-center">
                  <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">
                    مديرية ماء البصرة
                  </h2>
                  <h3 className="text-base font-bold text-[#b91c1c] whitespace-nowrap mt-1">
                    مركز جباية واردات {cleanBranch}
                  </h3>
                </div>

                {/* المنتصف: الشعار بحجم البلوك تماماً (مكبر ومطابق لارتفاع الترويسة) */}
                <div className="flex items-center justify-center">
                  <img
                    src="/icons/directorate-logo.png"
                    alt="شعار مديرية ماء البصرة"
                    className="h-14 w-14 object-contain"
                  />
                </div>

                {/* اليسار: الباركود فقط بحجم البلوك تماماً (مكبر بدون أي كتابات كود زائدة) */}
                <div className="flex items-center justify-end">
                  {qrCodeUrl ? (
                    <img
                      src={qrCodeUrl}
                      alt="QR Code"
                      className="w-14 h-14 border border-slate-300 p-0.5 bg-white shadow-xs"
                    />
                  ) : (
                    <div className="w-14 h-14 border border-dashed border-slate-300" />
                  )}
                </div>
              </div>

              {/* بلوك الكشف الفني بارتفاع صغير جداً مع ترك فراغ بينه وبين ما قبله وما بعده */}
              <div className="flex justify-center my-3.5">
                <div className="border border-slate-800 rounded px-6 py-0.5 h-7 flex items-center justify-center bg-white shadow-2xs">
                  <h1 className="text-base font-black text-[#b91c1c] tracking-wide leading-none">
                    الكشف الفـني
                  </h1>
                </div>
              </div>

              {/* سطر بيانات المواطن مع فراغ متناسق */}
              <div className="border-t-2 border-b-2 border-[#b91c1c] py-1.5 px-3 my-3.5">
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
              <div className="flex justify-between items-center my-2.5 text-sm sm:text-base font-bold text-slate-900 px-1">
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

              {/* جدول بيانات العقار */}
              <div className="my-3">
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

              {/* جملة تقرير الكشف في أقصى اليمين وبأقل ارتفاع عمودي مع فراغ بينها وبين التقرير */}
              <div className="flex justify-start mt-3 mb-3">
                <div className="border border-slate-800 rounded px-3 py-0.5 h-6 flex items-center justify-center bg-white shadow-2xs">
                  <h3 className="text-xs sm:text-sm font-bold text-[#b91c1c] leading-none">
                    تقرير الكشف
                  </h3>
                </div>
              </div>

              {/* نقاط تقرير الكشف - النص مقابل رقم النقطة تماماً في نفس السطر */}
              <div className="space-y-3 px-1 min-h-[140px] text-base sm:text-lg font-bold text-slate-950 leading-relaxed">
                {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
                  inspection.reportPoints.map((point, index) => (
                    <div key={index} className="flex items-start gap-2">
                      {/* رقم النقطة */}
                      <span className="font-bold text-slate-900 shrink-0 select-none pt-0.5 whitespace-nowrap">
                        {index + 1}-
                      </span>

                      {/* نص التقرير مقابل رقم النقطة */}
                      {isEditable ? (
                        <>
                          <div className="screen-only-input flex-1 flex items-start gap-2">
                            <textarea
                              rows={2}
                              value={point}
                              onChange={(e) => handlePointChange(index, e.target.value)}
                              className="w-full bg-slate-50/50 border border-slate-200 hover:border-slate-300 focus:border-blue-600 rounded p-1 font-bold text-base sm:text-lg text-slate-950 outline-none leading-relaxed resize-y m-0"
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
                          {/* في الطباعة: نص رسمي نقي ممتد ومقابل رقم النقطة مباشرة */}
                          <p className="print-only-text flex-1 text-justify font-bold leading-relaxed text-slate-950 m-0 p-0">
                            {point}
                          </p>
                        </>
                      ) : (
                        <p className="flex-1 text-justify font-bold leading-relaxed m-0 p-0">{point}</p>
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

            {/* التواقيع الرسمية - الاسم تحت الكلمة مباشرة بدون مسافات تباعد كبيرة */}
            <div className="mt-6 pt-2">
              <div className="grid grid-cols-3 text-center items-start text-slate-900">
                {/* 1. موظف الكشف */}
                <div className="flex flex-col items-center">
                  <span className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                    موظف الكشف
                  </span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.writerOrCollectorName || inspection.inspectorEmployeeName || ''}
                        onChange={(e) => handleFieldChange('writerOrCollectorName', e.target.value)}
                        placeholder="اسم موظف الكشف"
                        className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-400 outline-none font-bold text-base"
                      />
                      <span className="print-only-text font-bold text-base">
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
                  <span className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                    م. الشبكات
                  </span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.networksManagerName || ''}
                        onChange={(e) => handleFieldChange('networksManagerName', e.target.value)}
                        placeholder="................................"
                        className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-300 outline-none font-bold text-base"
                      />
                      <span className="print-only-text font-bold text-base">
                        {inspection.networksManagerName || '................................'}
                      </span>
                    </>
                  ) : (
                    <span className="text-base font-bold">
                      {inspection.networksManagerName || '................................'}
                    </span>
                  )}
                </div>

                {/* 3. م. الواردات */}
                <div className="flex flex-col items-center">
                  <span className="text-base sm:text-lg font-bold text-slate-900 mb-1">
                    م. الواردات
                  </span>
                  {isEditable ? (
                    <>
                      <input
                        type="text"
                        value={inspection.revenuesManagerName || defaultRevenuesManager}
                        onChange={(e) => handleFieldChange('revenuesManagerName', e.target.value)}
                        placeholder="مسؤول الواردات"
                        className="screen-only-input w-full text-center bg-transparent border-b border-dashed border-slate-400 outline-none font-bold text-base"
                      />
                      <span className="print-only-text font-bold text-base">
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
