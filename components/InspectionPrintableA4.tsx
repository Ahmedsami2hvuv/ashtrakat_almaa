'use client'

import React, { useEffect, useState } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { generateInspectionQRDataUrl } from '@/lib/inspectionStore'
import { Plus, Trash2 } from 'lucide-react'

interface InspectionPrintableA4Props {
  inspection: InspectionRecord
  isEditable?: boolean
  onUpdate?: (updated: InspectionRecord) => void
}

export default function InspectionPrintableA4({
  inspection,
  isEditable = false,
  onUpdate
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
    <div
      className="inspection-print-container bg-white text-black mx-auto shadow-xl print:shadow-none print:m-0 relative"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '12mm',
        boxSizing: 'border-box',
        direction: 'rtl',
        fontFamily: 'Arial, "Traditional Arabic", "Segoe UI", sans-serif'
      }}
    >
      {/* الإطار الأزرق المزدوج المطابق تماماً لنموذج ماء البصرة الورقي */}
      <div
        className="w-full h-full border-[3px] border-[#0c4a8a] p-1.5 flex flex-col justify-between"
        style={{ minHeight: '273mm', boxSizing: 'border-box' }}
      >
        <div
          className="w-full h-full border border-[#0c4a8a] p-6 flex flex-col justify-between"
          style={{ minHeight: '268mm', boxSizing: 'border-box' }}
        >
          {/* الجزء العلوي والبيانات والجدول والتقرير */}
          <div>
            {/* الترويسة العليا: 3 أعمدة (اليمين: الدائرة، الوسط: الشعار، اليسار: الباركود) */}
            <div className="flex items-start justify-between pb-3 mb-2">
              {/* جهة اليمين: مديرية ماء البصرة */}
              <div className="text-right w-1/3 pt-1">
                <h2 className="text-xl font-bold text-slate-900 leading-tight">
                  مديرية ماء البصرة
                </h2>
                <h3 className="text-lg font-bold text-[#b91c1c] mt-1 leading-tight">
                  {inspection.branchName || 'مركز جباية واردات ابي الخصيب'}
                </h3>
              </div>

              {/* المنتصف: شعار مديرية ماء البصرة الرسمي */}
              <div className="flex flex-col items-center justify-center w-1/3">
                <div className="w-20 h-20 flex items-center justify-center">
                  <img
                    src="/icons/directorate-logo.png"
                    alt="شعار مديرية ماء البصرة"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>

              {/* جهة اليسار: الباركود مع كود الكشف */}
              <div className="flex flex-col items-center justify-center w-1/3 text-left">
                {qrCodeUrl ? (
                  <div className="p-0.5 border border-slate-400 bg-white shadow-xs">
                    <img src={qrCodeUrl} alt="QR Code" className="w-[72px] h-[72px]" />
                  </div>
                ) : (
                  <div className="w-[72px] h-[72px] border border-dashed border-slate-300 flex items-center justify-center text-[10px] text-slate-400">
                    باركود
                  </div>
                )}
                <span className="text-[10px] text-slate-700 font-mono font-bold mt-1 tracking-tight">
                  {inspectionCode}
                </span>
              </div>
            </div>

            {/* العنوان في المنتصف: الكشف الفني */}
            <div className="flex justify-center my-4">
              <div className="border border-slate-800 rounded-lg px-12 py-1 shadow-xs bg-white">
                <h1 className="text-2xl font-black text-[#b91c1c] tracking-wide">
                  الكشف الفـني
                </h1>
              </div>
            </div>

            {/* سطر بيانات المواطن المحاط بإطار أحمر رفيع كما في الورقة الرسمية */}
            <div className="border-t-2 border-b-2 border-[#b91c1c] py-2 px-3 my-3">
              <div className="flex items-center text-lg font-bold text-slate-900 leading-normal gap-2">
                <span className="whitespace-nowrap">
                  تم اجراء الكشف الفني على العقار العائد للمواطن /ة
                </span>
                {isEditable ? (
                  <input
                    type="text"
                    value={inspection.citizenName}
                    onChange={(e) => handleFieldChange('citizenName', e.target.value)}
                    placeholder="اسم صاحب العقار..."
                    className="flex-1 bg-transparent border-b border-dashed border-slate-400 hover:border-blue-600 focus:border-blue-700 font-black text-slate-900 text-lg px-1 outline-none"
                  />
                ) : (
                  <span className="font-black text-slate-900 flex-1">
                    {inspection.citizenName || '...................................................'}
                  </span>
                )}
              </div>
            </div>

            {/* سطر التاريخ وعبارة سند الطابو */}
            <div className="flex justify-between items-center my-3 text-base font-bold text-slate-900 px-1">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span>بتاريخ</span>
                {isEditable ? (
                  <input
                    type="text"
                    value={inspection.inspectionDate}
                    onChange={(e) => handleFieldChange('inspectionDate', e.target.value)}
                    className="w-36 bg-transparent border-b border-dashed border-slate-400 font-mono font-bold text-slate-900 text-base px-1 outline-none text-center"
                  />
                ) : (
                  <span className="font-mono">{inspection.inspectionDate || '................'}</span>
                )}
              </div>
              <span className="text-slate-900">
                حسب الجدول ادناه وفق سند الطابو المرفق مع المعاملة
              </span>
            </div>

            {/* جدول بيانات العقار المطابق تماماً لورقة الكشف */}
            <div className="my-4">
              <table className="w-full text-center border-collapse border border-slate-900 text-slate-900 font-bold">
                <thead>
                  <tr className="border-b border-slate-900 text-base">
                    <th className="border-l border-slate-900 py-1.5 px-2 w-12 font-bold">ت</th>
                    <th className="border-l border-slate-900 py-1.5 px-3 font-bold">المحافظة</th>
                    <th className="border-l border-slate-900 py-1.5 px-3 font-bold">القضاء</th>
                    <th className="border-l border-slate-900 py-1.5 px-3 font-bold">المحلة</th>
                    <th className="border-l border-slate-900 py-1.5 px-3 font-bold">رقم القطعة</th>
                    <th className="py-1.5 px-3 font-bold">رقم المقاطعة</th>
                  </tr>
                </thead>
                <tbody className="text-base font-bold">
                  <tr>
                    <td className="border-l border-slate-900 py-2 px-2 font-mono">1</td>

                    {/* المحافظة */}
                    <td className="border-l border-slate-900 py-2 px-2">
                      {isEditable ? (
                        <input
                          type="text"
                          value={inspection.tableData?.governorate || 'البصرة'}
                          onChange={(e) => handleTableChange('governorate', e.target.value)}
                          className="w-full text-center bg-transparent border-none outline-none font-bold text-base"
                        />
                      ) : (
                        inspection.tableData?.governorate || 'البصرة'
                      )}
                    </td>

                    {/* القضاء */}
                    <td className="border-l border-slate-900 py-2 px-2">
                      {isEditable ? (
                        <input
                          type="text"
                          value={inspection.tableData?.district || 'ابي الخصيب'}
                          onChange={(e) => handleTableChange('district', e.target.value)}
                          className="w-full text-center bg-transparent border-none outline-none font-bold text-base"
                        />
                      ) : (
                        inspection.tableData?.district || 'ابي الخصيب'
                      )}
                    </td>

                    {/* المحلة */}
                    <td className="border-l border-slate-900 py-2 px-2">
                      {isEditable ? (
                        <input
                          type="text"
                          value={inspection.tableData?.neighborhood || ''}
                          onChange={(e) => handleTableChange('neighborhood', e.target.value)}
                          placeholder="المحلة / المنطقة"
                          className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none font-bold text-base"
                        />
                      ) : (
                        inspection.tableData?.neighborhood || '...............'
                      )}
                    </td>

                    {/* رقم القطعة */}
                    <td className="border-l border-slate-900 py-2 px-2">
                      {isEditable ? (
                        <input
                          type="text"
                          value={inspection.tableData?.plotNumber || ''}
                          onChange={(e) => handleTableChange('plotNumber', e.target.value)}
                          placeholder="رقم القطعة"
                          className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none font-mono font-bold text-base"
                        />
                      ) : (
                        <span className="font-mono">
                          {inspection.tableData?.plotNumber || '...............'}
                        </span>
                      )}
                    </td>

                    {/* رقم المقاطعة */}
                    <td className="py-2 px-2">
                      {isEditable ? (
                        <input
                          type="text"
                          value={inspection.tableData?.sectorNumber || ''}
                          onChange={(e) => handleTableChange('sectorNumber', e.target.value)}
                          placeholder="المقاطعة"
                          className="w-full text-center bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none font-mono font-bold text-base"
                        />
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

            {/* مستطيل تقرير الكشف */}
            <div className="flex justify-center my-4">
              <div className="border border-slate-800 rounded-lg px-10 py-0.5 bg-white">
                <h3 className="text-xl font-bold text-[#b91c1c]">تقرير الكشف</h3>
              </div>
            </div>

            {/* نقاط التقرير الفني */}
            <div className="space-y-3 px-1 min-h-[160px] text-justify text-base sm:text-lg font-bold text-slate-950 leading-relaxed">
              {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
                inspection.reportPoints.map((point, index) => (
                  <div key={index} className="flex items-start gap-2 group">
                    <span className="font-bold text-slate-900 shrink-0 mt-0.5">
                      {index + 1}-
                    </span>
                    {isEditable ? (
                      <div className="flex-1 flex items-start gap-2">
                        <textarea
                          rows={2}
                          value={point}
                          onChange={(e) => handlePointChange(index, e.target.value)}
                          className="w-full bg-transparent border-b border-dashed border-slate-300 hover:border-slate-400 focus:border-blue-600 p-1 font-bold text-base sm:text-lg text-slate-950 outline-none leading-relaxed resize-y"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePoint(index)}
                          className="print:hidden text-slate-300 hover:text-rose-600 p-1 transition"
                          title="حذف هذا السطر"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="flex-1 text-justify font-bold leading-relaxed">{point}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-justify font-bold leading-relaxed">{inspection.rawReportText}</p>
              )}

              {isEditable && (
                <div className="print:hidden pt-2">
                  <button
                    type="button"
                    onClick={handleAddPoint}
                    className="flex items-center gap-1.5 text-xs font-bold text-[#0c4a8a] hover:underline cursor-pointer py-1"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ إضافة سطر/نقطة جديدة في التقرير</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* التواقيع الرسمية في أسفل الورقة (مطابقة تماماً للورقة) */}
          <div className="mt-8 pt-4">
            <div className="grid grid-cols-3 text-center items-end text-slate-900">
              {/* العمود الأيمن: موظف الكشف */}
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-slate-900 mb-8">موظف الكشف</span>
                {isEditable ? (
                  <input
                    type="text"
                    value={inspection.inspectorEmployeeName || inspection.writerOrCollectorName}
                    onChange={(e) => handleFieldChange('inspectorEmployeeName', e.target.value)}
                    className="w-full text-center bg-transparent border-b border-dashed border-slate-400 outline-none font-bold text-base"
                  />
                ) : (
                  <span className="text-base font-bold">
                    {inspection.inspectorEmployeeName || inspection.writerOrCollectorName || '................................'}
                  </span>
                )}
              </div>

              {/* العمود الأوسط: م. الشبكات */}
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-slate-900 mb-8">م. الشبكات</span>
                {isEditable ? (
                  <input
                    type="text"
                    value={inspection.networksManagerName || ''}
                    onChange={(e) => handleFieldChange('networksManagerName', e.target.value)}
                    placeholder="................................"
                    className="w-full text-center bg-transparent border-b border-dashed border-slate-300 outline-none font-bold text-base"
                  />
                ) : (
                  <span className="text-base font-bold">
                    {inspection.networksManagerName || '................................'}
                  </span>
                )}
              </div>

              {/* العمود الأيسر: م. الواردات */}
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-slate-900 mb-8">م. الواردات</span>
                {isEditable ? (
                  <input
                    type="text"
                    value={inspection.revenuesManagerName || 'حسين علي لفتة جابر'}
                    onChange={(e) => handleFieldChange('revenuesManagerName', e.target.value)}
                    className="w-full text-center bg-transparent border-b border-dashed border-slate-400 outline-none font-bold text-base"
                  />
                ) : (
                  <span className="text-base font-bold">
                    {inspection.revenuesManagerName || 'حسين علي لفتة جابر'}
                  </span>
                )}
              </div>
            </div>

            {/* خط سفلي رفيع واسم الطباع في أقصى اليمين/اليسار */}
            <div className="mt-8 pt-2 border-t border-slate-400 flex justify-between items-center text-xs font-bold text-slate-700">
              <div>
                <span>منظم الكشف: </span>
                {isEditable ? (
                  <input
                    type="text"
                    value={inspection.typistName || inspection.writerOrCollectorName || 'نور جبار'}
                    onChange={(e) => handleFieldChange('typistName', e.target.value)}
                    className="bg-transparent border-none outline-none font-bold text-slate-800"
                  />
                ) : (
                  <span>{inspection.typistName || inspection.writerOrCollectorName || 'نور جبار'}</span>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-mono">
                مركز جباية واردات ابي الخصيب الإلكتروني
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
