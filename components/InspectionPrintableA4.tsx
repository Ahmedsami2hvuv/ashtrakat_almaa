'use client'

import React, { useEffect, useState } from 'react'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { generateInspectionQRDataUrl } from '@/lib/inspectionStore'
import {
  InspectionLayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  loadSavedLayoutConfig
} from '@/lib/inspectionLayoutStore'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  Sliders
} from 'lucide-react'

interface InspectionPrintableA4Props {
  inspection: InspectionRecord
  isEditable?: boolean
  isDesignMode?: boolean
  layoutConfig?: InspectionLayoutConfig
  onUpdateLayout?: (updated: InspectionLayoutConfig) => void
  onUpdate?: (updated: InspectionRecord) => void
  branchManagerName?: string
}

// أسماء العناصر بالعربي لسهولة الاختيار والتحكم
const ELEMENT_LABELS: Record<keyof InspectionLayoutConfig, string> = {
  version: 'الإصدار',
  logo: 'شعار مديرية ماء البصرة',
  qrCode: 'رمز الباركود (QR)',
  headerText: 'نص الترويسة (اسم الدائرة والفرع)',
  titleBadge: 'مستطيل الكشف الفني',
  citizenRow: 'سطر بيانات المواطن',
  dateRow: 'سطر التاريخ ورقم السند',
  table: 'جدول بيانات العقار',
  reportBadge: 'مستطيل تقرير الكشف',
  reportPoints: 'نقاط وسطور تقرير الكشف',
  signatures: 'كتلة التواقيع بالكامل',
  inspectorSign: 'خانة موظف الكشف',
  networksSign: 'خانة م. الشبكات',
  revenuesSign: 'خانة م. الواردات'
}

export default function InspectionPrintableA4({
  inspection,
  isEditable = false,
  isDesignMode = false,
  layoutConfig: propLayoutConfig,
  onUpdateLayout,
  onUpdate,
  branchManagerName
}: InspectionPrintableA4Props) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [activeElementId, setActiveElementId] = useState<keyof InspectionLayoutConfig | null>(null)
  const [layout, setLayout] = useState<InspectionLayoutConfig>(
    propLayoutConfig || DEFAULT_LAYOUT_CONFIG
  )

  useEffect(() => {
    if (propLayoutConfig) {
      setLayout(propLayoutConfig)
    } else {
      setLayout(loadSavedLayoutConfig())
    }
  }, [propLayoutConfig])

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
  const cleanBranch =
    rawBranch
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

  // تحديث إعدادات موضع/حجم عنصر في التصميم
  const updateElementLayout = (
    key: keyof InspectionLayoutConfig,
    delta: { dx?: number; dy?: number; dScale?: number; dFont?: number }
  ) => {
    const current = (layout[key] as any) || { x: 0, y: 0, scale: 1, fontSize: 16 }
    const updatedElement = {
      ...current,
      x: (current.x || 0) + (delta.dx || 0),
      y: (current.y || 0) + (delta.dy || 0),
      scale: Math.max(0.4, Math.min(2.5, (current.scale ?? 1) + (delta.dScale || 0))),
      fontSize: current.fontSize ? Math.max(10, Math.min(32, current.fontSize + (delta.dFont || 0))) : undefined
    }

    const newLayout = {
      ...layout,
      [key]: updatedElement
    }
    setLayout(newLayout)
    if (onUpdateLayout) {
      onUpdateLayout(newLayout)
    }
  }

  // إعادة ضبط عنصر للموضع الافتراضي
  const resetElementLayout = (key: keyof InspectionLayoutConfig) => {
    const defaultVal = DEFAULT_LAYOUT_CONFIG[key]
    const newLayout = {
      ...layout,
      [key]: defaultVal
    }
    setLayout(newLayout)
    if (onUpdateLayout) {
      onUpdateLayout(newLayout)
    }
  }

  // دعم تحريك العنصر النشط عبر مفاتيح الأسهم في الكيبورد
  useEffect(() => {
    if (!isDesignMode || !activeElementId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 10 : 2
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        updateElementLayout(activeElementId, { dy: -step })
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        updateElementLayout(activeElementId, { dy: step })
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        updateElementLayout(activeElementId, { dx: step })
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        updateElementLayout(activeElementId, { dx: -step })
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        updateElementLayout(activeElementId, { dScale: 0.05, dFont: 1 })
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        updateElementLayout(activeElementId, { dScale: -0.05, dFont: -1 })
      } else if (e.key === 'Escape') {
        setActiveElementId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isDesignMode, activeElementId, layout])

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

  // كلاس الغلاف عند تفعيل وضع التصميم للعنصر
  const getElementWrapperClass = (elementKey: keyof InspectionLayoutConfig) => {
    if (!isDesignMode) return 'relative'
    const isActive = activeElementId === elementKey
    return `relative transition-all cursor-pointer ${
      isActive
        ? 'ring-2 ring-blue-600 ring-offset-2 rounded-lg bg-blue-50/40 shadow-sm z-10'
        : 'hover:ring-2 hover:ring-blue-400 hover:bg-blue-50/20'
    }`
  }

  // دالة النقر على العنصر في وضع التصميم
  const handleElementClick = (e: React.MouseEvent, key: keyof InspectionLayoutConfig) => {
    if (!isDesignMode) return
    e.stopPropagation()
    setActiveElementId(key)
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

      {/* لوحة تحكم سفلية بتصميم زجاجي شفاف فاخر مع خطوط وأيقونات سوداء نقية */}
      {isDesignMode && activeElementId && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-white/85 backdrop-blur-2xl text-slate-900 px-4 py-2.5 rounded-2xl shadow-[0_15px_45px_rgba(0,0,0,0.18)] border border-white/80 ring-1 ring-slate-900/10 flex flex-wrap items-center gap-3 select-none print:hidden"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* اسم العنصر المحدد حالياً باللون الأسود */}
          <div className="flex items-center gap-1.5 pl-3 border-l border-slate-300">
            <Sliders className="w-4 h-4 text-slate-900 shrink-0" />
            <span className="text-xs font-black text-slate-950 whitespace-nowrap">
              {ELEMENT_LABELS[activeElementId] || 'العنصر المحدد'}
            </span>
          </div>

          {/* أزرار التحريك الأربعة - خلفية زجاجية مع أيقونات وخطوط سوداء واضحة جداً */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200" dir="ltr">
            <button
              type="button"
              onClick={() => updateElementLayout(activeElementId, { dy: -3 })}
              className="p-1.5 hover:bg-white active:scale-95 text-slate-950 rounded-lg transition cursor-pointer flex items-center justify-center shadow-2xs hover:shadow-xs"
              title="تحريك لأعلى ⬆️"
            >
              <ArrowUp className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => updateElementLayout(activeElementId, { dy: 3 })}
              className="p-1.5 hover:bg-white active:scale-95 text-slate-950 rounded-lg transition cursor-pointer flex items-center justify-center shadow-2xs hover:shadow-xs"
              title="تحريك لأسفل ⬇️"
            >
              <ArrowDown className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => updateElementLayout(activeElementId, { dx: 3 })}
              className="p-1.5 hover:bg-white active:scale-95 text-slate-950 rounded-lg transition cursor-pointer flex items-center justify-center shadow-2xs hover:shadow-xs"
              title="تحريك لليمين ➡️"
            >
              <ArrowRight className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </button>
            <button
              type="button"
              onClick={() => updateElementLayout(activeElementId, { dx: -3 })}
              className="p-1.5 hover:bg-white active:scale-95 text-slate-950 rounded-lg transition cursor-pointer flex items-center justify-center shadow-2xs hover:shadow-xs"
              title="تحريك لليسار ⬅️"
            >
              <ArrowLeft className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </button>
          </div>

          {/* أزرار التكبير والتصغير - زجاجي شفاف مع خط أسود عريض */}
          <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => updateElementLayout(activeElementId, { dScale: 0.08, dFont: 1 })}
              className="px-2.5 py-1 hover:bg-white active:scale-95 text-slate-950 rounded-lg transition cursor-pointer text-xs font-black flex items-center gap-1 shadow-2xs hover:shadow-xs"
              title="تكبير الحجم والخط ➕"
            >
              <Maximize2 className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              <span>تكبير</span>
            </button>
            <button
              type="button"
              onClick={() => updateElementLayout(activeElementId, { dScale: -0.08, dFont: -1 })}
              className="px-2.5 py-1 hover:bg-white active:scale-95 text-slate-950 rounded-lg transition cursor-pointer text-xs font-black flex items-center gap-1 shadow-2xs hover:shadow-xs"
              title="تصغير الحجم والخط ➖"
            >
              <Minimize2 className="w-3.5 h-3.5 text-slate-950 stroke-[2.5]" />
              <span>تصغير</span>
            </button>
          </div>

          {/* استعادة الوضع الافتراضي للعنصر */}
          <button
            type="button"
            onClick={() => resetElementLayout(activeElementId)}
            className="p-2 hover:bg-slate-100 active:scale-95 text-slate-900 rounded-xl transition cursor-pointer border border-slate-200 flex items-center gap-1 text-xs font-bold"
            title="استعادة الموضع الأصلي الافتراضي لهذا العنصر"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-950 stroke-[2]" />
            <span className="hidden sm:inline">استعادة</span>
          </button>

          {/* زر إغلاق التحديد */}
          <button
            type="button"
            onClick={() => setActiveElementId(null)}
            className="p-1.5 hover:bg-rose-100 text-slate-800 hover:text-rose-700 rounded-xl transition cursor-pointer"
            title="إلغاء التحديد"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>
      )}

      <div
        className="inspection-print-container bg-white text-black mx-auto shadow-xl print:shadow-none print:m-0 relative select-none"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '10mm',
          boxSizing: 'border-box',
          direction: 'rtl',
          fontFamily: 'Arial, "Traditional Arabic", "Segoe UI", sans-serif'
        }}
        onClick={() => {
          if (isDesignMode && activeElementId) {
            setActiveElementId(null)
          }
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
              {/* الترويسة العليا: الشعار، الباركود، ونصوص الدائرة والفرع */}
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-300">
                {/* 1. نصوص الدائرة والفرع */}
                <div
                  className={getElementWrapperClass('headerText')}
                  onClick={(e) => handleElementClick(e, 'headerText')}
                  style={{
                    transform: `translate(${layout.headerText.x}px, ${layout.headerText.y}px)`,
                    fontSize: layout.headerText.fontSize ? `${layout.headerText.fontSize}px` : undefined
                  }}
                >
                  <div className="text-right leading-tight flex flex-col justify-center">
                    <h2 className="text-lg font-bold text-slate-900 whitespace-nowrap">
                      مديرية ماء البصرة
                    </h2>
                    <h3 className="text-base font-bold text-[#b91c1c] whitespace-nowrap mt-1">
                      مركز جباية واردات {cleanBranch}
                    </h3>
                  </div>
                </div>

                {/* 2. الشعار الدائري الرسمي */}
                <div
                  className={getElementWrapperClass('logo')}
                  onClick={(e) => handleElementClick(e, 'logo')}
                  style={{
                    transform: `translate(${layout.logo.x}px, ${layout.logo.y}px) scale(${layout.logo.scale ?? 1})`
                  }}
                >
                  <div className="flex items-center justify-center">
                    <img
                      src="/icons/directorate-logo.png"
                      alt="شعار مديرية ماء البصرة"
                      className="h-14 w-14 object-contain"
                    />
                  </div>
                </div>

                {/* 3. الباركود QR Code */}
                <div
                  className={getElementWrapperClass('qrCode')}
                  onClick={(e) => handleElementClick(e, 'qrCode')}
                  style={{
                    transform: `translate(${layout.qrCode.x}px, ${layout.qrCode.y}px) scale(${layout.qrCode.scale ?? 1})`
                  }}
                >
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
              </div>

              {/* بلوك الكشف الفني */}
              <div className="flex justify-center my-3">
                <div
                  className={getElementWrapperClass('titleBadge')}
                  onClick={(e) => handleElementClick(e, 'titleBadge')}
                  style={{
                    transform: `translate(${layout.titleBadge.x}px, ${layout.titleBadge.y}px) scale(${layout.titleBadge.scale ?? 1})`
                  }}
                >
                  <div className="border border-slate-800 rounded px-6 py-0.5 h-7 flex items-center justify-center bg-white shadow-2xs">
                    <h1
                      className="text-base font-black text-[#b91c1c] tracking-wide leading-none"
                      style={{ fontSize: layout.titleBadge.fontSize ? `${layout.titleBadge.fontSize}px` : undefined }}
                    >
                      الكشف الفـني
                    </h1>
                  </div>
                </div>
              </div>

              {/* سطر بيانات المواطن */}
              <div
                className={getElementWrapperClass('citizenRow')}
                onClick={(e) => handleElementClick(e, 'citizenRow')}
                style={{
                  transform: `translate(${layout.citizenRow.x}px, ${layout.citizenRow.y}px)`
                }}
              >
                <div className="border-t-2 border-b-2 border-[#b91c1c] py-1.5 px-3 my-3">
                  <div
                    className="flex items-center text-base sm:text-lg font-bold text-slate-900 leading-normal gap-2"
                    style={{ fontSize: layout.citizenRow.fontSize ? `${layout.citizenRow.fontSize}px` : undefined }}
                  >
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
              </div>

              {/* سطر التاريخ وعبارة سند الطابو */}
              <div
                className={getElementWrapperClass('dateRow')}
                onClick={(e) => handleElementClick(e, 'dateRow')}
                style={{
                  transform: `translate(${layout.dateRow.x}px, ${layout.dateRow.y}px)`
                }}
              >
                <div
                  className="flex justify-between items-center my-2 text-sm sm:text-base font-bold text-slate-900 px-1"
                  style={{ fontSize: layout.dateRow.fontSize ? `${layout.dateRow.fontSize}px` : undefined }}
                >
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
              </div>

              {/* جدول بيانات العقار */}
              <div
                className={getElementWrapperClass('table')}
                onClick={(e) => handleElementClick(e, 'table')}
                style={{
                  transform: `translate(${layout.table.x}px, ${layout.table.y}px)`
                }}
              >
                <div className="my-2.5">
                  <table
                    className="w-full text-center border-collapse border border-slate-900 text-slate-900 font-bold"
                    style={{ fontSize: layout.table.fontSize ? `${layout.table.fontSize}px` : undefined }}
                  >
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
              </div>

              {/* جملة تقرير الكشف في أقصى اليمين */}
              <div className="flex justify-start mt-3 mb-2.5">
                <div
                  className={getElementWrapperClass('reportBadge')}
                  onClick={(e) => handleElementClick(e, 'reportBadge')}
                  style={{
                    transform: `translate(${layout.reportBadge.x}px, ${layout.reportBadge.y}px) scale(${layout.reportBadge.scale ?? 1})`
                  }}
                >
                  <div className="border border-slate-800 rounded px-3 py-0.5 h-6 flex items-center justify-center bg-white shadow-2xs">
                    <h3
                      className="text-xs sm:text-sm font-bold text-[#b91c1c] leading-none"
                      style={{ fontSize: layout.reportBadge.fontSize ? `${layout.reportBadge.fontSize}px` : undefined }}
                    >
                      تقرير الكشف
                    </h3>
                  </div>
                </div>
              </div>

              {/* نقاط تقرير الكشف */}
              <div
                className={getElementWrapperClass('reportPoints')}
                onClick={(e) => handleElementClick(e, 'reportPoints')}
                style={{
                  transform: `translate(${layout.reportPoints.x}px, ${layout.reportPoints.y}px)`
                }}
              >
                <div
                  className="space-y-3 px-1 min-h-[140px] text-base sm:text-lg font-bold text-slate-950 leading-relaxed"
                  style={{ fontSize: layout.reportPoints.fontSize ? `${layout.reportPoints.fontSize}px` : undefined }}
                >
                  {inspection.reportPoints && inspection.reportPoints.length > 0 ? (
                    inspection.reportPoints.map((point, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="font-bold text-slate-900 shrink-0 select-none pt-0.5 whitespace-nowrap">
                          {index + 1}-
                        </span>
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
            </div>

            {/* التواقيع الرسمية */}
            <div
              className={`mt-6 pt-2 ${getElementWrapperClass('signatures')}`}
              onClick={(e) => handleElementClick(e, 'signatures')}
              style={{
                transform: `translate(${layout.signatures.x}px, ${layout.signatures.y}px)`
              }}
            >
              <div
                className="grid grid-cols-3 text-center items-start text-slate-900"
                style={{ fontSize: layout.signatures.fontSize ? `${layout.signatures.fontSize}px` : undefined }}
              >
                {/* 1. موظف الكشف */}
                <div
                  className={getElementWrapperClass('inspectorSign')}
                  onClick={(e) => handleElementClick(e, 'inspectorSign')}
                  style={{
                    transform: `translate(${layout.inspectorSign.x}px, ${layout.inspectorSign.y}px)`
                  }}
                >
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
                </div>

                {/* 2. م. الشبكات */}
                <div
                  className={getElementWrapperClass('networksSign')}
                  onClick={(e) => handleElementClick(e, 'networksSign')}
                  style={{
                    transform: `translate(${layout.networksSign.x}px, ${layout.networksSign.y}px)`
                  }}
                >
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
                </div>

                {/* 3. م. الواردات */}
                <div
                  className={getElementWrapperClass('revenuesSign')}
                  onClick={(e) => handleElementClick(e, 'revenuesSign')}
                  style={{
                    transform: `translate(${layout.revenuesSign.x}px, ${layout.revenuesSign.y}px)`
                  }}
                >
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
      </div>
    </>
  )
}
