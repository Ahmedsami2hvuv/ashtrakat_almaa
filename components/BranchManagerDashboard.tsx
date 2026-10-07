'use client'

import React, { useState } from 'react'
import {
  DirectorateBranch,
  BranchManager,
  BranchCollector,
  BranchWriter,
  TreasuryManager,
  Consignment
} from '@/lib/directorateTypes'
import { generateSecureToken, generateWhatsAppLink } from '@/lib/directorateStore'
import { Area, Subscriber, BillingRecords } from '@/components/MainApp'
import ConsignmentsA4Page from './ConsignmentsA4Page'

interface BranchManagerDashboardProps {
  branch: DirectorateBranch
  currentManager?: BranchManager
  onUpdateBranch: (updatedBranch: DirectorateBranch) => void
  onOpenSubscriberApp: (params: {
    role: 'manager' | 'collector' | 'writer'
    userTitle: string
    canEdit: boolean
    assignedAreaIds?: string[]
    assignedSubscriberIds?: number[]
  }) => void
  onBackToDirector?: () => void
}

type TabType = 'areas' | 'subscribers' | 'collectors' | 'writers' | 'treasury' | 'branch_info' | 'settings'

export default function BranchManagerDashboard({
  branch,
  currentManager,
  onUpdateBranch,
  onOpenSubscriberApp,
  onBackToDirector
}: BranchManagerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('subscribers')
  const [isConsignmentA4Open, setIsConsignmentA4Open] = useState(false)

  // حالات المناطق
  const [newAreaName, setNewAreaName] = useState('')

  // حالات استيراد المشتركين
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')

  // حالات المحصلين
  const [showCollectorModal, setShowCollectorModal] = useState(false)
  const [editingCollector, setEditingCollector] = useState<BranchCollector | null>(null)
  const [collectorName, setCollectorName] = useState('')
  const [collectorPhone, setCollectorPhone] = useState('')
  const [collectorCanEdit, setCollectorCanEdit] = useState(false)
  const [selectedCollectorAreas, setSelectedCollectorAreas] = useState<string[]>([])

  // حالات الكتاب
  const [showWriterModal, setShowWriterModal] = useState(false)
  const [editingWriter, setEditingWriter] = useState<BranchWriter | null>(null)
  const [writerName, setWriterName] = useState('')
  const [writerPhone, setWriterPhone] = useState('')
  const [selectedWriterAreas, setSelectedWriterAreas] = useState<string[]>([])

  // حالات الخزنة
  const [showTreasuryModal, setShowTreasuryModal] = useState(false)
  const [treasuryName, setTreasuryName] = useState('')
  const [treasuryPhone, setTreasuryPhone] = useState('')

  // حالات الذكاء الاصطناعي (الإعدادات)
  const [newApiKey, setNewApiKey] = useState('')

  // ------------------ إدارة المناطق ------------------
  const handleAddArea = () => {
    if (!newAreaName.trim()) return
    const newArea: Area = {
      id: 'area_' + Date.now().toString(36),
      name: newAreaName.trim(),
      branches: []
    }
    const updatedAreas = [...(branch.areas || []), newArea]
    onUpdateBranch({ ...branch, areas: updatedAreas })
    setNewAreaName('')
  }

  const handleDeleteArea = (areaId: string, areaName: string) => {
    if (confirm(`هل أنت متأكد من حذف منطقة (${areaName})؟`)) {
      const updatedAreas = branch.areas.filter(a => a.id !== areaId)
      onUpdateBranch({ ...branch, areas: updatedAreas })
    }
  }

  // ------------------ استيراد المشتركين ------------------
  const handleExecuteImport = () => {
    if (!importText.trim()) {
      alert('يرجى لصق نص المشتركين')
      return
    }

    const lines = importText.split('\n')
    const newSubscribers: Subscriber[] = []
    let addedCount = 0

    const existingIds = new Set(branch.subscribers.map(s => s.id))
    const startOrder = branch.subscribers.length + 1

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed) return

      // البحث عن رقم المشترك واسمه (مثل: 5202 نوري عبد الصمد)
      const match = trimmed.match(/^(\d+)\s*[-–\t\s]\s*(.+)$/) || trimmed.match(/^(\d+)\s+(.+)$/)
      if (match) {
        const id = parseInt(match[1], 10)
        const name = match[2].trim()

        if (!existingIds.has(id)) {
          existingIds.add(id)
          newSubscribers.push({
            id,
            name,
            phone: '',
            areaId: '', // غير منضم لأي منطقة حالياً
            branchId: '',
            propertyType: 'سكني',
            meterType: '4 متر',
            detailedAddress: 'تم الاستيراد حديثاً',
            remainingPrev: 0,
            fee: 0,
            order: startOrder + idx,
            statuses: [],
            createdAt: new Date().toISOString()
          })
          addedCount++
        }
      }
    })

    if (addedCount === 0) {
      alert('لم يتم العثور على أرقام وأسماء جديدة، أو جميع الأرقام مسجلة مسبقاً.')
      return
    }

    const updated = {
      ...branch,
      subscribers: [...branch.subscribers, ...newSubscribers]
    }
    onUpdateBranch(updated)
    setShowImportModal(false)
    setImportText('')
    alert(`تم استيراد ${addedCount} مشترك بنجاح كـ (4 متر - سكني). يمكن الآن تخصيصهم للمناطق والمحصلين.`)
  }

  // ------------------ إدارة المحصلين ------------------
  const handleSaveCollector = () => {
    if (!collectorName.trim() || !collectorPhone.trim()) {
      alert('يرجى ملء الاسم الثلاثي ورقم الهاتف')
      return
    }

    let updatedCollectors = [...(branch.collectors || [])]
    if (editingCollector) {
      updatedCollectors = updatedCollectors.map(c =>
        c.id === editingCollector.id
          ? {
              ...c,
              name: collectorName.trim(),
              phone: collectorPhone.trim(),
              canEdit: collectorCanEdit,
              assignedAreaIds: selectedCollectorAreas
            }
          : c
      )
    } else {
      const newCollector: BranchCollector = {
        id: 'col_' + Date.now().toString(36),
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        token: generateSecureToken('col'),
        assignedAreaIds: selectedCollectorAreas,
        canEdit: collectorCanEdit,
        createdAt: new Date().toISOString()
      }
      updatedCollectors.push(newCollector)
    }

    onUpdateBranch({ ...branch, collectors: updatedCollectors })
    setShowCollectorModal(false)
    setEditingCollector(null)
    setCollectorName('')
    setCollectorPhone('')
    setSelectedCollectorAreas([])
  }

  const handleDeleteCollector = (collectorId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف المحصل (${name})؟`)) {
      const updated = branch.collectors.filter(c => c.id !== collectorId)
      onUpdateBranch({ ...branch, collectors: updated })
    }
  }

  const handleToggleCollectorEdit = (collectorId: string, currentVal: boolean) => {
    const updated = branch.collectors.map(c =>
      c.id === collectorId ? { ...c, canEdit: !currentVal } : c
    )
    onUpdateBranch({ ...branch, collectors: updated })
  }

  const handleShareCollectorWhatsApp = (collector: BranchCollector) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=collector&token=${collector.token}&branch=${branch.id}`
    const msg = `مرحبا ${collector.name}\nمحصل واردات ${branch.name}\nهذا رابط حسابك الخاص لمتابعة المشتركين والتحصيل:\n${directLink}`
    const waUrl = generateWhatsAppLink(collector.phone, msg)
    window.open(waUrl, '_blank')
  }

  // ------------------ إدارة الكتّاب ------------------
  const handleSaveWriter = () => {
    if (!writerName.trim() || !writerPhone.trim()) {
      alert('يرجى إدخال اسم الكاتب ورقم هاتفه')
      return
    }

    let updatedWriters = [...(branch.writers || [])]
    if (editingWriter) {
      updatedWriters = updatedWriters.map(w =>
        w.id === editingWriter.id
          ? {
              ...w,
              name: writerName.trim(),
              phone: writerPhone.trim(),
              assignedAreaIds: selectedWriterAreas
            }
          : w
      )
    } else {
      const newWriter: BranchWriter = {
        id: 'wri_' + Date.now().toString(36),
        name: writerName.trim(),
        phone: writerPhone.trim(),
        token: generateSecureToken('wri'),
        assignedAreaIds: selectedWriterAreas,
        createdAt: new Date().toISOString()
      }
      updatedWriters.push(newWriter)
    }

    onUpdateBranch({ ...branch, writers: updatedWriters })
    setShowWriterModal(false)
    setEditingWriter(null)
    setWriterName('')
    setWriterPhone('')
    setSelectedWriterAreas([])
  }

  const handleDeleteWriter = (writerId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الكاتب (${name})؟`)) {
      const updated = branch.writers.filter(w => w.id !== writerId)
      onUpdateBranch({ ...branch, writers: updated })
    }
  }

  const handleShareWriterWhatsApp = (writer: BranchWriter) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=writer&token=${writer.token}&branch=${branch.id}`
    const msg = `مرحبا ${writer.name}\nكاتب في واردات ${branch.name}\nهذا رابط الحساب الخاص بك لإدخال وتعديل البيانات والديون:\n${directLink}`
    const waUrl = generateWhatsAppLink(writer.phone, msg)
    window.open(waUrl, '_blank')
  }

  // ------------------ إدارة الخزنة ------------------
  const handleSaveTreasury = () => {
    if (!treasuryName.trim() || !treasuryPhone.trim()) return
    const newTreasury: TreasuryManager = {
      id: 'trs_' + Date.now().toString(36),
      name: treasuryName.trim(),
      phone: treasuryPhone.trim(),
      token: generateSecureToken('trs'),
      createdAt: new Date().toISOString()
    }
    const updated = [...(branch.treasuryManagers || []), newTreasury]
    onUpdateBranch({ ...branch, treasuryManagers: updated })
    setShowTreasuryModal(false)
    setTreasuryName('')
    setTreasuryPhone('')
  }

  // ------------------ حفظ وترحيل الإرسالية A4 ------------------
  const handleSaveConsignmentA4 = (
    newConsignment: Consignment,
    updatedSubscribers: Subscriber[],
    updatedBilling: BillingRecords
  ) => {
    const updatedConsignments = [...(branch.consignments || []), newConsignment]
    const updatedBranch: DirectorateBranch = {
      ...branch,
      subscribers: updatedSubscribers,
      billing: updatedBilling,
      consignments: updatedConsignments
    }
    onUpdateBranch(updatedBranch)
  }

  // ------------------ إعدادات الذكاء الاصطناعي ------------------
  const handleAddAiKey = () => {
    if (!newApiKey.trim()) return
    const currentKeys = branch.aiApiKeys || []
    if (currentKeys.includes(newApiKey.trim())) {
      alert('المفتاح مضاف بالفعل')
      return
    }
    const updatedKeys = [...currentKeys, newApiKey.trim()]
    onUpdateBranch({ ...branch, aiApiKeys: updatedKeys })
    setNewApiKey('')
    alert('تم إضافة مفتاح الذكاء الاصطناعي بنجاح')
  }

  const handleDeleteAiKey = (keyToDelete: string) => {
    const updatedKeys = (branch.aiApiKeys || []).filter(k => k !== keyToDelete)
    onUpdateBranch({ ...branch, aiApiKeys: updatedKeys })
  }

  // إذا كانت صفحة الإرساليات A4 مفتوحة، نعرضها كصفحة كاملة كما طلب المستخدم
  if (isConsignmentA4Open) {
    return (
      <ConsignmentsA4Page
        branch={branch}
        onSaveConsignment={handleSaveConsignmentA4}
        onClose={() => setIsConsignmentA4Open(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="rtl">
      {/* الترويسة العلوية لمسؤول الفرع */}
      <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {onBackToDirector && (
              <button
                onClick={onBackToDirector}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1"
              >
                عودة للإدارة العامة
              </button>
            )}
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center font-black text-white text-base">
              فرع
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white">{branch.name}</h1>
                <span className="bg-emerald-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {currentManager ? currentManager.name : 'مسؤول الفرع'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* زر تنزيل الإرساليات البارز */}
            <button
              onClick={() => setIsConsignmentA4Open(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              تنزيل الإرساليات (A4)
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي لمسؤول الفرع */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* القائمة الجانبية لمسؤول الفرع */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">أقسام الفرع</h2>
            <nav className="space-y-1">
              {/* المشتركون */}
              <button
                onClick={() => setActiveTab('subscribers')}
                className={`w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition ${
                  activeTab === 'subscribers'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>المشتركون</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-black">
                  {branch.subscribers?.length || 0}
                </span>
              </button>

              {/* المناطق */}
              <button
                onClick={() => setActiveTab('areas')}
                className={`w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition ${
                  activeTab === 'areas'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>المناطق</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-black">
                  {branch.areas?.length || 0}
                </span>
              </button>

              {/* المحصلون */}
              <button
                onClick={() => setActiveTab('collectors')}
                className={`w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition ${
                  activeTab === 'collectors'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>المحصلون</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-black">
                  {branch.collectors?.length || 0}
                </span>
              </button>

              {/* الكتّاب */}
              <button
                onClick={() => setActiveTab('writers')}
                className={`w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition ${
                  activeTab === 'writers'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>الكتّاب</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-black">
                  {branch.writers?.length || 0}
                </span>
              </button>

              {/* مدير الخزنة */}
              <button
                onClick={() => setActiveTab('treasury')}
                className={`w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition ${
                  activeTab === 'treasury'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>مدير الخزنة</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-black">
                  {branch.treasuryManagers?.length || 0}
                </span>
              </button>

              {/* الأفرع */}
              <button
                onClick={() => setActiveTab('branch_info')}
                className={`w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition ${
                  activeTab === 'branch_info'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>الأفرع</span>
              </button>

              {/* تنزيل الإرساليات في القائمة الجانبية أيضاً */}
              <button
                onClick={() => setIsConsignmentA4Open(true)}
                className="w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between text-amber-800 bg-amber-50 hover:bg-amber-100 transition border border-amber-200 mt-2"
              >
                <span>تنزيل الإرساليات (A4)</span>
              </button>

              {/* الإعدادات */}
              <button
                onClick={() => setActiveTab('settings')}
                className={`w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition mt-2 ${
                  activeTab === 'settings'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>الإعدادات</span>
                <span className="text-[10px] font-bold">API</span>
              </button>
            </nav>
          </div>
        </aside>

        {/* جسم الشاشة الرئيسي */}
        <main className="lg:col-span-3 space-y-6">
          {/* تبويب المشتركين */}
          {activeTab === 'subscribers' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">مشتركو {branch.name}</h3>
                  <p className="text-xs text-slate-500">
                    إجمالي المشتركين المسجلين: {branch.subscribers?.length || 0} مشترك
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* زر إضافة مشترك - يفتح تطبيق المشتركين لإضافة مشترك مباشرة */}
                  <button
                    onClick={() =>
                      onOpenSubscriberApp({
                        role: 'manager',
                        userTitle: `مسؤول فرع (${branch.name})`,
                        canEdit: true
                      })
                    }
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    فتح نظام المشتركين الكامل
                  </button>

                  {/* زر استيراد مشتركين */}
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    استيراد مشتركين
                  </button>
                </div>
              </div>

              {/* عينة المشتركين وجدول سريع */}
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black">
                      <th className="p-3">رقم المشترك</th>
                      <th className="p-3">اسم المشترك</th>
                      <th className="p-3">المنطقة</th>
                      <th className="p-3">النوع والعداد</th>
                      <th className="p-3">الدين السابق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {branch.subscribers.slice(0, 15).map(sub => {
                      const areaName = branch.areas.find(a => a.id === sub.areaId)?.name || 'غير محدد'
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 font-bold">
                          <td className="p-3 font-mono text-blue-700">{sub.id}</td>
                          <td className="p-3 text-slate-900">{sub.name}</td>
                          <td className="p-3 text-slate-600">{areaName}</td>
                          <td className="p-3 text-slate-600">{sub.propertyType} - {sub.meterType}</td>
                          <td className="p-3 text-rose-600">{(sub.remainingPrev || 0).toLocaleString('ar-IQ')} د.ع</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {branch.subscribers.length > 15 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() =>
                      onOpenSubscriberApp({
                        role: 'manager',
                        userTitle: `مسؤول فرع (${branch.name})`,
                        canEdit: true
                      })
                    }
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow"
                  >
                    فتح نظام المشتركين الكامل
                  </button>
                </div>
              )}
            </div>
          )}

          {/* تبويب المناطق */}
          {activeTab === 'areas' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">المناطق التابعة لـ {branch.name}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="اسم المنطقة"
                    className="px-3 py-2 border border-slate-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={handleAddArea}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition"
                  >
                    إضافة منطقة
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branch.areas.map(area => {
                  const subsInArea = branch.subscribers.filter(s => s.areaId === area.id).length
                  return (
                    <div
                      key={area.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">{area.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">{subsInArea} مشترك في هذه المنطقة</p>
                      </div>
                      <button
                        onClick={() => handleDeleteArea(area.id, area.name)}
                        className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-100 rounded-lg transition"
                      >
                        حذف
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* تبويب المحصلين */}
          {activeTab === 'collectors' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">محصلو {branch.name}</h3>
                </div>

                <button
                  onClick={() => {
                    setEditingCollector(null)
                    setCollectorName('')
                    setCollectorPhone('')
                    setCollectorCanEdit(false)
                    setSelectedCollectorAreas([])
                    setShowCollectorModal(true)
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  إضافة محصل جديد
                </button>
              </div>

              {branch.collectors.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-sm font-bold text-slate-600">لا يوجد محصلون مسجلون حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branch.collectors.map(collector => (
                    <div
                      key={collector.id}
                      className="bg-slate-50 hover:bg-slate-100/70 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-black text-slate-900 text-base">{collector.name}</h4>
                          <p className="text-xs font-semibold text-slate-500 dir-ltr">{collector.phone}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                collector.canEdit
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {collector.canEdit ? 'مسموح بالتعديل' : 'للقراءة فقط (ممنوع التعديل)'}
                            </span>
                          </div>
                        </div>

                        {/* زر تبديل صلاحية التعديل */}
                        <button
                          onClick={() => handleToggleCollectorEdit(collector.id, collector.canEdit)}
                          className={`text-[10px] px-2 py-1 rounded-xl font-bold transition border ${
                            collector.canEdit
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {collector.canEdit ? 'إيقاف التعديل' : 'السماح بالتعديل'}
                        </button>
                      </div>

                      {/* إجراءات المحصل */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        {/* 1. فتح صفحة المحصل */}
                        <button
                          onClick={() =>
                            onOpenSubscriberApp({
                              role: 'collector',
                              userTitle: `محصل: ${collector.name}`,
                              canEdit: collector.canEdit,
                              assignedAreaIds: collector.assignedAreaIds,
                              assignedSubscriberIds: collector.assignedSubscriberIds
                            })
                          }
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          فتح صفحة المحصل
                        </button>

                        {/* 2. مشاركة رابط المحصل */}
                        <button
                          onClick={() => handleShareCollectorWhatsApp(collector)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          مشاركة بالواتساب
                        </button>

                        {/* 3. تعديل المحصل وتخصيص المناطق */}
                        <button
                          onClick={() => {
                            setEditingCollector(collector)
                            setCollectorName(collector.name)
                            setCollectorPhone(collector.phone)
                            setCollectorCanEdit(collector.canEdit)
                            setSelectedCollectorAreas(collector.assignedAreaIds || [])
                            setShowCollectorModal(true)
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition text-center"
                        >
                          تخصيص وتعديل
                        </button>

                        {/* 4. مسح المحصل */}
                        <button
                          onClick={() => handleDeleteCollector(collector.id, collector.name)}
                          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold transition text-center"
                        >
                          مسح
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* تبويب الكتّاب */}
          {activeTab === 'writers' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">كتّاب {branch.name}</h3>
                </div>

                <button
                  onClick={() => {
                    setEditingWriter(null)
                    setWriterName('')
                    setWriterPhone('')
                    setSelectedWriterAreas([])
                    setShowWriterModal(true)
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  إضافة كاتب جديد
                </button>
              </div>

              {branch.writers.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                  <p className="text-sm font-bold text-slate-600">لا يوجد كتاب مسجلون حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branch.writers.map(writer => (
                    <div
                      key={writer.id}
                      className="bg-slate-50 hover:bg-slate-100/70 p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-black text-slate-900 text-base">{writer.name}</h4>
                          <p className="text-xs font-semibold text-slate-500 dir-ltr">{writer.phone}</p>
                          <span className="text-[10px] bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full font-bold mt-1 inline-block">
                            صلاحية تعديل ديون كاملة
                          </span>
                        </div>
                      </div>

                      {/* إجراءات الكاتب */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        {/* 1. فتح موقع الكاتب */}
                        <button
                          onClick={() =>
                            onOpenSubscriberApp({
                              role: 'writer',
                              userTitle: `كاتب: ${writer.name}`,
                              canEdit: true,
                              assignedAreaIds: writer.assignedAreaIds,
                              assignedSubscriberIds: writer.assignedSubscriberIds
                            })
                          }
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          فتح موقع الكاتب
                        </button>

                        {/* 2. مشاركة رابط الكاتب */}
                        <button
                          onClick={() => handleShareWriterWhatsApp(writer)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          مشاركة بالواتساب
                        </button>

                        {/* 3. تعديل الكاتب وتخصيص المناطق */}
                        <button
                          onClick={() => {
                            setEditingWriter(writer)
                            setWriterName(writer.name)
                            setWriterPhone(writer.phone)
                            setSelectedWriterAreas(writer.assignedAreaIds || [])
                            setShowWriterModal(true)
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition text-center"
                        >
                          تخصيص وتعديل
                        </button>

                        {/* 4. مسح الكاتب */}
                        <button
                          onClick={() => handleDeleteWriter(writer.id, writer.name)}
                          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl text-xs font-bold transition text-center"
                        >
                          مسح
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* تبويب مدير الخزنة */}
          {activeTab === 'treasury' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900">مسؤولو الخزنة والصندوق</h3>
                </div>

                <button
                  onClick={() => setShowTreasuryModal(true)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition"
                >
                  إضافة مسؤول خزنة
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branch.treasuryManagers.map(tr => (
                  <div key={tr.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                    <h4 className="font-black text-slate-900">{tr.name}</h4>
                    <p className="text-xs text-slate-500 dir-ltr">{tr.phone}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تبويب الأفرع */}
          {activeTab === 'branch_info' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
              <h3 className="text-lg font-black text-slate-900">بيانات الفرع</h3>
              <p className="text-xs text-slate-600">اسم الفرع: <strong>{branch.name}</strong></p>
              <p className="text-xs text-slate-600">تاريخ الإنشاء: {new Date(branch.createdAt).toLocaleDateString('ar-IQ')}</p>
              <p className="text-xs text-slate-600">عدد المشتركين: {branch.subscribers?.length || 0}</p>
              <p className="text-xs text-slate-600">عدد المناطق: {branch.areas?.length || 0}</p>
            </div>
          )}

          {/* تبويب الإعدادات والذكاء الاصطناعي */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
              <h3 className="text-lg font-black text-slate-900">إعدادات الفرع والذكاء الاصطناعي</h3>
              
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-black text-slate-800">مفاتيح الذكاء الاصطناعي (API Keys) لقراءة الوصولات</h4>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="ألصق مفتاح Gemini API Key هنا"
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    onClick={handleAddAiKey}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow"
                  >
                    حفظ المفتاح
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  {(branch.aiApiKeys || []).map((key, i) => (
                    <div key={i} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="font-mono text-slate-600">{key.substring(0, 8)}...{key.substring(key.length - 4)}</span>
                      <button
                        onClick={() => handleDeleteAiKey(key)}
                        className="text-rose-600 font-bold hover:underline"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* نافذة استيراد المشتركين */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl space-y-4 animate-in fade-in">
            <h3 className="text-lg font-black text-slate-900">استيراد مشتركين</h3>

            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                بدء الاستيراد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل محصل */}
      {showCollectorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in">
            <h3 className="text-lg font-black text-slate-900">
              {editingCollector ? 'تعديل بيانات المحصل' : 'إضافة محصل جديد'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الثلاثي:</label>
                <input
                  type="text"
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={collectorPhone}
                  onChange={(e) => setCollectorPhone(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>

              {/* صلاحية التعديل */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectorCanEdit}
                    onChange={(e) => setCollectorCanEdit(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    السماح للمحصل بالتعديل على المشتركين والديون
                  </span>
                </label>
              </div>

              {/* تخصيص المناطق */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تخصيص المناطق للمحصل:</label>
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  {branch.areas.map(area => (
                    <label key={area.id} className="flex items-center gap-2 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={selectedCollectorAreas.includes(area.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCollectorAreas([...selectedCollectorAreas, area.id])
                          } else {
                            setSelectedCollectorAreas(selectedCollectorAreas.filter(id => id !== area.id))
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                      <span>{area.name}</span>
                    </label>
                  ))}
                  {branch.areas.length === 0 && (
                    <span className="text-slate-400">لا توجد مناطق بعد (يمكن تخصيصها لاحقاً)</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowCollectorModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCollector}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                حفظ المحصل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل كاتب */}
      {showWriterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in">
            <h3 className="text-lg font-black text-slate-900">
              {editingWriter ? 'تعديل بيانات الكاتب' : 'إضافة كاتب جديد'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم:</label>
                <input
                  type="text"
                  value={writerName}
                  onChange={(e) => setWriterName(e.target.value)}
                  placeholder="اسم الكاتب"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={writerPhone}
                  onChange={(e) => setWriterPhone(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>

              {/* تخصيص المناطق */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">تخصيص المناطق للكاتب:</label>
                <div className="max-h-32 overflow-y-auto space-y-1 p-2 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  {branch.areas.map(area => (
                    <label key={area.id} className="flex items-center gap-2 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={selectedWriterAreas.includes(area.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWriterAreas([...selectedWriterAreas, area.id])
                          } else {
                            setSelectedWriterAreas(selectedWriterAreas.filter(id => id !== area.id))
                          }
                        }}
                        className="rounded text-blue-600"
                      />
                      <span>{area.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowWriterModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveWriter}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                حفظ الكاتب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة مسؤول خزنة */}
      {showTreasuryModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in">
            <h3 className="text-lg font-black text-slate-900">إضافة مسؤول خزنة</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم:</label>
                <input
                  type="text"
                  value={treasuryName}
                  onChange={(e) => setTreasuryName(e.target.value)}
                  placeholder="اسم مسؤول الخزنة"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={treasuryPhone}
                  onChange={(e) => setTreasuryPhone(e.target.value)}
                  placeholder="رقم الهاتف"
                  className="w-full px-4 py-2 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowTreasuryModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveTreasury}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
