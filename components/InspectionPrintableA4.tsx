'use client'

import React, { useEffect, useState } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { generateInspectionQRDataUrl } from '@/lib/inspectionStore'

interface InspectionPrintableA4Props {
  inspection: InspectionRecord
}

export default function InspectionPrintableA4({ inspection }: InspectionPrintableA4Props) {
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

  return (
    <div
      className="inspection-print-container bg-white text-black font-sans mx-auto shadow-2xl print:shadow-none print:m-0"
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '12mm',
        boxSizing: 'border-box',
        direction: 'rtl'
      }}
    >
      {/* الإطار الأزرق الخارجي المماثل للنموذج الرسمي */}
      <div
        className="w-full h-full border-[3px] border-[#0c4a8a] rounded-2xl p-6 flex flex-col justify-between"
        style={{ minHeight: '273mm', boxSizing: 'border-box' }}
      >
        <div>
          {/* الترويسة العليا: اليمين، الشعار في المنتصف، الباركود في اليسار */}
          <div className="flex items-center justify-between border-b-[2px] border-[#0c4a8a] pb-4 mb-6">
            {/* جهة اليمين */}
            <div className="text-right w-1/3">
              <h2 className="text-xl font-black text-[#0c4a8a] leading-tight">مديرية ماء البصرة</h2>
              <h3 className="text-lg font-bold text-[#b91c1c] mt-1">
                {inspection.branchName || 'مركز جباية واردات ابي الخصيب'}
              </h3>
            </div>

            {/* الشعار الدائري في المنتصف */}
            <div className="flex justify-center w-1/3">
              <div className="w-28 h-28 flex items-center justify-center">
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
                <div className="p-1 border border-slate-300 rounded-lg bg-white shadow-sm">
                  <img src={qrCodeUrl} alt="باركود الكشف الإلكتروني" className="w-24 h-24" />
                </div>
              ) : (
                <div className="w-24 h-24 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-xs text-slate-400">
                  باركود الكشف
                </div>
              )}
              <span className="text-[10px] text-slate-500 font-mono mt-1">امسح للتحقق والصور</span>
            </div>
          </div>

          {/* العنوان: الكشف الفني */}
          <div className="flex justify-center my-4">
            <div className="border-2 border-slate-500 rounded-xl px-10 py-1.5 shadow-sm bg-slate-50">
              <h1 className="text-2xl font-black text-[#b91c1c] tracking-wide">الكشف الفـني</h1>
            </div>
          </div>

          {/* سطر بيانات المواطن والتاريخ */}
          <div className="border-t-2 border-b-2 border-[#b91c1c] py-2 my-4 px-2">
            <p className="text-lg font-bold text-slate-900 leading-relaxed">
              تم اجراء الكشف الفني على العقار العائد للمواطن /ة{' '}
              <span className="font-black text-[#0c4a8a] underline decoration-slate-400 underline-offset-4">
                {inspection.citizenName || '...........................................'}
              </span>
            </p>
          </div>

          <div className="flex justify-between items-center mb-4 text-base font-bold text-slate-800 px-2">
            <span>
              بتاريخ: <strong className="font-mono text-lg">{inspection.inspectionDate || '................'}</strong>
            </span>
            <span className="text-slate-700">حسب الجدول ادناه وفق سند الطابو المرفق مع المعاملة</span>
          </div>

          {/* جدول سند الطابو */}
          <div className="overflow-hidden border-2 border-slate-900 rounded-lg my-5">
            <table className="w-full text-center border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-900 text-slate-900 font-black text-base">
                  <th className="border-l-2 border-slate-900 py-2 px-3 w-12">ت</th>
                  <th className="border-l-2 border-slate-900 py-2 px-4">المحافظة</th>
                  <th className="border-l-2 border-slate-900 py-2 px-4">القضاء</th>
                  <th className="border-l-2 border-slate-900 py-2 px-4">المحلة</th>
                  <th className="border-l-2 border-slate-900 py-2 px-4">رقم القطعة</th>
                  <th className="py-2 px-4">رقم المقاطعة</th>
                </tr>
              </thead>
              <tbody className="text-base font-bold text-slate-800">
                <tr>
                  <td className="border-l-2 border-slate-900 py-2.5 px-3 font-mono">{inspection.tableData?.sequence || 1}</td>
                  <td className="border-l-2 border-slate-900 py-2.5 px-4">{inspection.tableData?.governorate || 'البصرة'}</td>
                  <td className="border-l-2 border-slate-900 py-2.5 px-4">{inspection.tableData?.district || 'ابي الخصيب'}</td>
                  <td className="border-l-2 border-slate-900 py-2.5 px-4 font-black">{inspection.tableData?.neighborhood || '...............'}</td>
                  <td className="border-l-2 border-slate-900 py-2.5 px-4 font-mono font-black">{inspection.tableData?.plotNumber || '...............'}</td>
                  <td className="py-2.5 px-4 font-mono font-black">{inspection.tableData?.sectorNumber || '...............'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* عنوان فرعي: تقرير الكشف */}
          <div className="flex justify-center my-6">
            <div className="border-2 border-slate-500 rounded-xl px-8 py-1 bg-slate-50">
              <h2 className="text-xl font-black text-[#b91c1c]">تقرير الكشف</h2>
            </div>
          </div>

          {/* فقرات ونقاط تقرير الكشف */}
          <div className="space-y-4 px-2 min-h-[180px]">
            {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
              inspection.reportPoints.map((point, index) => (
                <div key={index} className="text-base sm:text-lg font-bold text-slate-900 leading-loose flex items-start gap-2">
                  <span className="font-mono font-black text-[#0c4a8a] shrink-0">{index + 1}-</span>
                  <p className="text-justify font-bold">{point}</p>
                </div>
              ))
            ) : (
              <p className="text-base font-bold text-slate-800 leading-loose text-justify">
                {inspection.rawReportText}
              </p>
            )}
          </div>
        </div>

        {/* التواقيع الرسمية في الأسفل */}
        <div className="mt-8 pt-6 border-t border-slate-300">
          <div className="grid grid-cols-3 text-center items-end text-slate-900">
            {/* موظف الكشف */}
            <div className="flex flex-col items-center">
              <span className="text-base font-black text-[#0c4a8a] mb-8">موظف الكشف</span>
              <span className="text-base font-bold text-slate-900">
                {inspection.inspectorEmployeeName || inspection.writerOrCollectorName || '................................'}
              </span>
            </div>

            {/* م. الشبكات */}
            <div className="flex flex-col items-center">
              <span className="text-base font-black text-[#0c4a8a] mb-8">م. الشبكات</span>
              <span className="text-base font-bold text-slate-900">
                {inspection.networksManagerName || '................................'}
              </span>
            </div>

            {/* م. الواردات */}
            <div className="flex flex-col items-center">
              <span className="text-base font-black text-[#0c4a8a] mb-8">م. الواردات</span>
              <span className="text-base font-bold text-slate-900">
                {inspection.revenuesManagerName || 'حسين علي لفتة جابر'}
              </span>
            </div>
          </div>

          {/* اسم منظم أو طابع التقرير في أسفل الصفحة */}
          <div className="flex justify-between items-center mt-6 pt-2 border-t border-slate-200 text-xs text-slate-500 font-semibold">
            <span>وثيقة رسمية صادرة إلكترونياً ومزودة بباركود فحص موثق</span>
            <span>منظم التقرير: {inspection.typistName || inspection.writerOrCollectorName || 'نور جبار'}</span>
          </div>
        </div>
      </div>

      {/* قواعد الطباعة بالـ CSS لضمان الدقة العالية لورقة A4 */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .inspection-print-container,
          .inspection-print-container * {
            visibility: visible;
          }
          .inspection-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 10mm !important;
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
