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

  // توليد كود رسمي تسلسلي للكشف يطبع فوق الورقة
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

  // تحديث حقل معين
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

  // تحديث نقطة في التقرير
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
      className="inspection-print-container bg-white text-black font-sans mx-auto shadow-2xl print:shadow-none print:m-0 rounded-xl relative"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '10mm',
        boxSizing: 'border-box',
        direction: 'rtl'
      }}
    >
      {/* الإطار الأزرق الخارجي المماثل للنموذج الرسمي لمديرية ماء البصرة */}
      <div
        className="w-full h-full border-[3px] border-[#0c4a8a] rounded-2xl p-6 flex flex-col justify-between"
        style={{ minHeight: '277mm', boxSizing: 'border-box' }}
      >
        <div>
          {/* كود الكشف الرسمي المطبوع في أقصى أعلى الورقة */}
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-200 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500">كود الكشف المعتمد:</span>
              <span className="bg-[#0c4a8a] text-white px-2.5 py-0.5 rounded font-black tracking-widest text-xs">
                {inspectionCode}
              </span>
            </div>
            <span className="text-slate-400 font-semibold text-[11px]">
              استمارة الكشف الفني الموقعي الموحدة
            </span>
          </div>

          {/* الترويسة العليا: اليمين، الشعار في المنتصف، الباركود في اليسار */}
          <div className="flex items-center justify-between border-b-[2px] border-[#0c4a8a] pb-4 mb-5">
            {/* جهة اليمين */}
            <div className="text-right w-1/3">
              <h2 className="text-xl font-black text-[#0c4a8a] leading-tight">مديرية ماء البصرة</h2>
              <h3 className="text-base font-bold text-[#b91c1c] mt-1">
                {inspection.branchName || 'مركز جباية واردات ابي الخصيب'}
              </h3>
            </div>

            {/* الشعار الدائري في المنتصف */}
            <div className="flex justify-center w-1/3">
              <div className="w-24 h-24 flex items-center justify-center">
                <img
                  src="/icons/directorate-logo.png"
                  alt="شعار مديرية ماء البصرة"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>

            {/* رمز الباركود QR Code في جهة اليسار */}
            <div className="flex flex-col items-center justify-center w-1/3 text-left">
              {qrCodeUrl ? (
                <div className="p-1 border border-slate-300 rounded-lg bg-white shadow-xs">
                  <img src={qrCodeUrl} alt="باركود الكشف الإلكتروني" className="w-20 h-20" />
                </div>
              ) : (
                <div className="w-20 h-20 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  باركود
                </div>
              )}
              <span className="text-[10px] text-slate-600 font-mono mt-0.5 font-bold">امسح للتحقق والصور</span>
            </div>
          </div>

          {/* العنوان: الكشف الفني */}
          <div className="flex justify-center my-3">
            <div className="border-2 border-slate-500 rounded-xl px-10 py-1 shadow-xs bg-slate-50">
              <h1 className="text-2xl font-black text-[#b91c1c] tracking-wide">الكشف الفـني</h1>
            </div>
          </div>

          {/* سطر بيانات المواطن والتاريخ - قابل للتعديل المباشر */}
          <div className="border-t-2 border-b-2 border-[#b91c1c] py-2 my-3 px-2 bg-slate-50/50">
            <div className="flex items-center text-base sm:text-lg font-bold text-slate-900 leading-relaxed gap-2">
              <span className="whitespace-nowrap">تم اجراء الكشف الفني على العقار العائد للمواطن /ة</span>
              {isEditable ? (
                <input
                  type="text"
                  value={inspection.citizenName}
                  onChange={(e) => handleFieldChange('citizenName', e.target.value)}
                  placeholder="اكتب اسم المواطن / صاحب العقار هنا..."
                  className="flex-1 bg-white border border-sky-400 focus:border-blue-600 rounded px-2 py-1 text-base font-black text-[#0c4a8a] outline-none shadow-inner"
                />
              ) : (
                <span className="font-black text-[#0c4a8a] underline decoration-slate-400 underline-offset-4 flex-1">
                  {inspection.citizenName || '...........................................'}
                </span>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-4 text-base font-bold text-slate-800 px-2 gap-4">
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>بتاريخ:</span>
              {isEditable ? (
                <input
                  type="text"
                  value={inspection.inspectionDate}
                  onChange={(e) => handleFieldChange('inspectionDate', e.target.value)}
                  className="w-32 bg-white border border-sky-400 focus:border-blue-600 rounded px-2 py-0.5 font-mono text-base font-bold text-slate-900 outline-none"
                />
              ) : (
                <strong className="font-mono text-lg">{inspection.inspectionDate || '................'}</strong>
              )}
            </div>
            <span className="text-slate-700 text-sm sm:text-base">حسب الجدول ادناه وفق سند الطابو المرفق مع المعاملة</span>
          </div>

          {/* جدول سند الطابو الرسمي - قابل للتعديل المباشر في خلاياه */}
          <div className="overflow-hidden border-2 border-slate-900 rounded-lg my-4">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-900 text-slate-900 font-black text-sm sm:text-base">
                  <th className="border-l-2 border-slate-900 py-2 px-2 w-12">ت</th>
                  <th className="border-l-2 border-slate-900 py-2 px-3">المحافظة</th>
                  <th className="border-l-2 border-slate-900 py-2 px-3">القضاء</th>
                  <th className="border-l-2 border-slate-900 py-2 px-3">المحلة</th>
                  <th className="border-l-2 border-slate-900 py-2 px-3">رقم القطعة</th>
                  <th className="py-2 px-3">رقم المقاطعة</th>
                </tr>
              </thead>
              <tbody className="text-sm sm:text-base font-bold text-slate-800">
                <tr>
                  <td className="border-l-2 border-slate-900 py-2.5 px-2 font-mono">1</td>
                  
                  {/* المحافظة */}
                  <td className="border-l-2 border-slate-900 py-1.5 px-2">
                    {isEditable ? (
                      <input
                        type="text"
                        value={inspection.tableData?.governorate || 'البصرة'}
                        onChange={(e) => handleTableChange('governorate', e.target.value)}
                        className="w-full text-center bg-white border border-slate-300 rounded p-1 text-sm font-bold"
                      />
                    ) : (
                      inspection.tableData?.governorate || 'البصرة'
                    )}
                  </td>

                  {/* القضاء */}
                  <td className="border-l-2 border-slate-900 py-1.5 px-2">
                    {isEditable ? (
                      <input
                        type="text"
                        value={inspection.tableData?.district || 'ابي الخصيب'}
                        onChange={(e) => handleTableChange('district', e.target.value)}
                        className="w-full text-center bg-white border border-slate-300 rounded p-1 text-sm font-bold"
                      />
                    ) : (
                      inspection.tableData?.district || 'ابي الخصيب'
                    )}
                  </td>

                  {/* المحلة */}
                  <td className="border-l-2 border-slate-900 py-1.5 px-2">
                    {isEditable ? (
                      <input
                        type="text"
                        value={inspection.tableData?.neighborhood || ''}
                        onChange={(e) => handleTableChange('neighborhood', e.target.value)}
                        placeholder="شيخ ابراهيم"
                        className="w-full text-center bg-white border border-sky-400 rounded p-1 text-sm font-black text-[#0c4a8a]"
                      />
                    ) : (
                      <span className="font-black">{inspection.tableData?.neighborhood || '...............'}</span>
                    )}
                  </td>

                  {/* رقم القطعة */}
                  <td className="border-l-2 border-slate-900 py-1.5 px-2">
                    {isEditable ? (
                      <input
                        type="text"
                        value={inspection.tableData?.plotNumber || ''}
                        onChange={(e) => handleTableChange('plotNumber', e.target.value)}
                        placeholder="80/185"
                        className="w-full text-center bg-white border border-sky-400 rounded p-1 text-sm font-mono font-black"
                      />
                    ) : (
                      <span className="font-mono font-black">{inspection.tableData?.plotNumber || '...............'}</span>
                    )}
                  </td>

                  {/* رقم المقاطعة */}
                  <td className="py-1.5 px-2">
                    {isEditable ? (
                      <input
                        type="text"
                        value={inspection.tableData?.sectorNumber || ''}
                        onChange={(e) => handleTableChange('sectorNumber', e.target.value)}
                        placeholder="20"
                        className="w-full text-center bg-white border border-sky-400 rounded p-1 text-sm font-mono font-black"
                      />
                    ) : (
                      <span className="font-mono font-black">{inspection.tableData?.sectorNumber || '...............'}</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* عنوان فرعي: تقرير الكشف */}
          <div className="flex justify-center my-4">
            <div className="border-2 border-slate-500 rounded-xl px-8 py-0.5 bg-slate-50">
              <h2 className="text-xl font-black text-[#b91c1c]">تقرير الكشف</h2>
            </div>
          </div>

          {/* فقرات ونقاط تقرير الكشف - قابلة للتعديل والزيادة والحذف المباشر */}
          <div className="space-y-3 px-2 min-h-[170px]">
            {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
              inspection.reportPoints.map((point, index) => (
                <div key={index} className="text-base sm:text-lg font-bold text-slate-900 leading-relaxed flex items-start gap-2 group">
                  <span className="font-mono font-black text-[#0c4a8a] shrink-0 mt-1">{index + 1}-</span>
                  {isEditable ? (
                    <div className="flex-1 flex items-start gap-2">
                      <textarea
                        rows={2}
                        value={point}
                        onChange={(e) => handlePointChange(index, e.target.value)}
                        className="flex-1 bg-white border border-sky-400 focus:border-blue-600 rounded-lg p-2 text-sm sm:text-base font-bold text-slate-900 outline-none leading-relaxed shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePoint(index)}
                        className="print:hidden text-slate-400 hover:text-rose-600 p-1.5 transition"
                        title="حذف هذه النقطة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-justify font-bold flex-1">{point}</p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-base font-bold text-slate-800 leading-loose text-justify">
                {inspection.rawReportText}
              </p>
            )}

            {isEditable && (
              <div className="print:hidden pt-2">
                <button
                  type="button"
                  onClick={handleAddPoint}
                  className="flex items-center gap-1.5 text-xs font-black text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة نقطة جديدة في التقرير</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* التواقيع الرسمية في الأسفل - قابلة للتعديل أيضاً */}
        <div className="mt-6 pt-4 border-t border-slate-300">
          <div className="grid grid-cols-3 text-center items-end text-slate-900">
            {/* موظف الكشف */}
            <div className="flex flex-col items-center">
              <span className="text-base font-black text-[#0c4a8a] mb-6">موظف الكشف</span>
              {isEditable ? (
                <input
                  type="text"
                  value={inspection.inspectorEmployeeName || inspection.writerOrCollectorName}
                  onChange={(e) => handleFieldChange('inspectorEmployeeName', e.target.value)}
                  className="w-4/5 text-center bg-white border border-slate-300 rounded p-1 text-sm font-bold"
                />
              ) : (
                <span className="text-base font-bold text-slate-900">
                  {inspection.inspectorEmployeeName || inspection.writerOrCollectorName || '................................'}
                </span>
              )}
            </div>

            {/* م. الشبكات */}
            <div className="flex flex-col items-center">
              <span className="text-base font-black text-[#0c4a8a] mb-6">م. الشبكات</span>
              {isEditable ? (
                <input
                  type="text"
                  value={inspection.networksManagerName || ''}
                  onChange={(e) => handleFieldChange('networksManagerName', e.target.value)}
                  placeholder="مسؤول الشبكات"
                  className="w-4/5 text-center bg-white border border-slate-300 rounded p-1 text-sm font-bold"
                />
              ) : (
                <span className="text-base font-bold text-slate-900">
                  {inspection.networksManagerName || '................................'}
                </span>
              )}
            </div>

            {/* م. الواردات */}
            <div className="flex flex-col items-center">
              <span className="text-base font-black text-[#0c4a8a] mb-6">م. الواردات</span>
              {isEditable ? (
                <input
                  type="text"
                  value={inspection.revenuesManagerName || 'حسين علي لفتة جابر'}
                  onChange={(e) => handleFieldChange('revenuesManagerName', e.target.value)}
                  className="w-4/5 text-center bg-white border border-slate-300 rounded p-1 text-sm font-bold"
                />
              ) : (
                <span className="text-base font-bold text-slate-900">
                  {inspection.revenuesManagerName || 'حسين علي لفتة جابر'}
                </span>
              )}
            </div>
          </div>

          {/* اسم منظم أو طابع التقرير في أسفل الصفحة */}
          <div className="flex justify-between items-center mt-5 pt-2 border-t border-slate-200 text-xs text-slate-500 font-semibold">
            <span>وثيقة رسمية صادرة إلكترونياً ومزودة بباركود فحص موثق</span>
            <div className="flex items-center gap-1">
              <span>منظم التقرير:</span>
              {isEditable ? (
                <input
                  type="text"
                  value={inspection.typistName || inspection.writerOrCollectorName || 'نور جبار'}
                  onChange={(e) => handleFieldChange('typistName', e.target.value)}
                  className="w-28 text-center bg-white border border-slate-300 rounded px-1.5 py-0.5 text-xs font-bold"
                />
              ) : (
                <span>{inspection.typistName || inspection.writerOrCollectorName || 'نور جبار'}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* قواعد الطباعة المتقدمة بالـ CSS لضمان دقة A4 الرسمية */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .inspection-print-container,
          .inspection-print-container * {
            visibility: visible !important;
          }
          .inspection-print-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 8mm !important;
            box-shadow: none !important;
            background: white !important;
            color: black !important;
          }
          @page {
            size: A4 portrait;
            margin: 0;
          }
        }
      `}</style>
    </div>
  )
}
