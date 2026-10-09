'use client'

import React, { useState, useMemo } from 'react'
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
import {
  Users,
  MapPin,
  Wallet,
  BookOpen,
  Vault,
  Building2,
  Settings,
  Plus,
  Upload,
  Share2,
  Edit3,
  Trash2,
  FileText,
  Search,
  CheckCircle2,
  XCircle,
  Key,
  ExternalLink,
  ChevronLeft
} from 'lucide-react'

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
}

type TabType = 'subscribers' | 'areas' | 'collectors' | 'writers' | 'treasury' | 'branch_info' | 'settings'

export default function BranchManagerDashboard({
  branch,
  currentManager,
  onUpdateBranch,
  onOpenSubscriberApp
}: BranchManagerDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabType>('subscribers')
  const [isConsignmentA4Open, setIsConsignmentA4Open] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

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

  // حالات الذكاء الاصطناعي
  const [newApiKey, setNewApiKey] = useState('')

  // حساب الإحصائيات
  const stats = useMemo(() => {
    const totalSubscribers = branch.subscribers?.length || 0
    const totalDebt = branch.subscribers?.reduce((sum, s) => sum + (s.remainingPrev || 0), 0) || 0
    const totalAreas = branch.areas?.length || 0
    const totalCollectors = branch.collectors?.length || 0
    const totalWriters = branch.writers?.length || 0
    return { totalSubscribers, totalDebt, totalAreas, totalCollectors, totalWriters }
  }, [branch])

  // فلترة المشتركين
  const filteredSubscribers = useMemo(() => {
    if (!searchQuery.trim()) return branch.subscribers || []
    const q = searchQuery.toLowerCase()
    return (branch.subscribers || []).filter(
      s => s.name.toLowerCase().includes(q) || s.id.toString().includes(q)
    )
  }, [branch.subscribers, searchQuery])

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
            areaId: '',
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

    onUpdateBranch({
      ...branch,
      subscribers: [...branch.subscribers, ...newSubscribers]
    })
    setShowImportModal(false)
    setImportText('')
    alert(`تم استيراد ${addedCount} مشترك بنجاح.`)
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
    const msg = `مرحبا ${collector.name}\nمحصل واردات ${branch.name}\nرابط حسابك المباشر:\n${directLink}`
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
    const msg = `مرحبا ${writer.name}\nكاتب واردات ${branch.name}\nرابط حسابك المباشر:\n${directLink}`
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
    alert('تم إضافة المفتاح بنجاح')
  }

  const handleDeleteAiKey = (keyToDelete: string) => {
    const updatedKeys = (branch.aiApiKeys || []).filter(k => k !== keyToDelete)
    onUpdateBranch({ ...branch, aiApiKeys: updatedKeys })
  }

  if (isConsignmentA4Open) {
    return (
      <ConsignmentsA4Page
        branch={branch}
        onSaveConsignment={handleSaveConsignmentA4}
        onClose={() => setIsConsignmentA4Open(false)}
      />
    )
  }

  const navItems = [
    { id: 'subscribers', label: 'المشتركون', icon: Users, count: stats.totalSubscribers },
    { id: 'areas', label: 'المناطق', icon: MapPin, count: stats.totalAreas },
    { id: 'collectors', label: 'المحصلون', icon: Wallet, count: stats.totalCollectors },
    { id: 'writers', label: 'الكتّاب', icon: BookOpen, count: stats.totalWriters },
    { id: 'treasury', label: 'الخزنة', icon: Vault, count: branch.treasuryManagers?.length || 0 },
    { id: 'branch_info', label: 'بيانات الفرع', icon: Building2 },
    { id: 'settings', label: 'الإعدادات AI', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" dir="rtl">
      {/* الترويسة العلوية الفاتحة الواضحة */}
      <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-slate-900">{branch.name}</h1>
                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold px-2.5 py-0.5 rounded-md">
                  {currentManager ? currentManager.name : 'مسؤول الفرع'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500">لوحة التحكم التنفيذية للجباية والكوادر</p>
            </div>
          </div>

          <button
            onClick={() => setIsConsignmentA4Open(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
          >
            <FileText className="w-4 h-4" />
            <span>تنزيل الإرساليات (A4)</span>
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 space-y-6">
        
        {/* بطاقات الإحصائيات الفاتحة الناصعة */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">إجمالي المشتركين</p>
              <p className="text-base md:text-lg font-black text-slate-900">{stats.totalSubscribers.toLocaleString('ar-IQ')}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">مجموع الديون والذمم</p>
              <p className="text-sm md:text-base font-black text-rose-600">{stats.totalDebt.toLocaleString('ar-IQ')} <span className="text-[10px]">د.ع</span></p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">المناطق المشمولة</p>
              <p className="text-base md:text-lg font-black text-slate-900">{stats.totalAreas}</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500">الكوادر (محصلين وكتاب)</p>
              <p className="text-base md:text-lg font-black text-slate-900">{stats.totalCollectors + stats.totalWriters}</p>
            </div>
          </div>
        </div>

        {/* شريط الأقسام (Tabs) أبيض واضح وبأيقونات وأرقام بارزة */}
        <div className="bg-white rounded-2xl p-2 border border-slate-200 shadow-sm overflow-x-auto flex items-center gap-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* جسم الشاشة الرئيسي */}
        <main className="space-y-6">
          {/* تبويب المشتركين */}
          {activeTab === 'subscribers' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">مشتركو {branch.name}</h3>
                  <p className="text-xs text-slate-500">قاعدة بيانات المشتركين المسجلين في هذا الفرع</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() =>
                      onOpenSubscriberApp({
                        role: 'manager',
                        userTitle: `مسؤول فرع (${branch.name})`,
                        canEdit: true
                      })
                    }
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>تطبيق المشتركين</span>
                  </button>

                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>استيراد</span>
                  </button>
                </div>
              </div>

              {/* شريط البحث */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث برقم المشترك أو اسمه..."
                  className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                />
              </div>

              {/* جدول المشتركين النظيف والمقروء */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <th className="p-3">رقم المشترك</th>
                      <th className="p-3">اسم المشترك</th>
                      <th className="p-3">المنطقة</th>
                      <th className="p-3">النوع/العداد</th>
                      <th className="p-3">الدين السابق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubscribers.slice(0, 15).map((sub) => {
                      const areaName = branch.areas?.find(a => a.id === sub.areaId)?.name || 'غير محدد'
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 font-bold transition">
                          <td className="p-3 font-mono text-blue-700 bg-blue-50/50">{sub.id}</td>
                          <td className="p-3 text-slate-900">{sub.name}</td>
                          <td className="p-3 text-slate-600">{areaName}</td>
                          <td className="p-3 text-slate-500">{sub.propertyType} - {sub.meterType}</td>
                          <td className="p-3 text-rose-600 font-mono">{(sub.remainingPrev || 0).toLocaleString('ar-IQ')} د.ع</td>
                        </tr>
                      )
                    })}
                    {filteredSubscribers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-slate-400 font-bold">
                          لا توجد نتائج مطابقة للبحث
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredSubscribers.length > 15 && (
                <div className="text-center pt-2">
                  <button
                    onClick={() =>
                      onOpenSubscriberApp({
                        role: 'manager',
                        userTitle: `مسؤول فرع (${branch.name})`,
                        canEdit: true
                      })
                    }
                    className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-2"
                  >
                    <span>عرض باقي المشتركين ({filteredSubscribers.length - 15}+)</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* تبويب المناطق */}
          {activeTab === 'areas' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">المناطق المشمولة بالفرع</h3>
                  <p className="text-xs text-slate-500">إدارة وتقسيم مناطق الجباية</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    placeholder="اسم المنطقة الجديد..."
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddArea}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(branch.areas || []).map((area) => {
                  const subsInArea = (branch.subscribers || []).filter(s => s.areaId === area.id).length
                  return (
                    <div
                      key={area.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">{area.name}</h4>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5">{subsInArea} مشترك مسجل</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteArea(area.id, area.name)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="حذف المنطقة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* تبويب المحصلين */}
          {activeTab === 'collectors' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">كادر المحصلين</h3>
                  <p className="text-xs text-slate-500">إدارة وتخصيص صلاحيات المحصلين الميدانيين</p>
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
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>محصل جديد</span>
                </button>
              </div>

              {(!branch.collectors || branch.collectors.length === 0) ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Wallet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">لا يوجد محصلون مسجلون حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branch.collectors.map((collector) => (
                    <div
                      key={collector.id}
                      className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-900 text-sm">{collector.name}</h4>
                          <p className="text-xs font-mono text-slate-500 dir-ltr text-right">{collector.phone}</p>
                          <div className="flex items-center gap-1.5 pt-1">
                            {collector.canEdit ? (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                <CheckCircle2 className="w-3 h-3" /> مسموح بالتعديل
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                                <XCircle className="w-3 h-3" /> للقراءة فقط
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleCollectorEdit(collector.id, collector.canEdit)}
                          className={`text-[10px] px-2.5 py-1 rounded-xl font-bold transition border ${
                            collector.canEdit
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {collector.canEdit ? 'إيقاف التعديل' : 'سماح بالتعديل'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
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
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح الحساب</span>
                        </button>

                        <button
                          onClick={() => handleShareCollectorWhatsApp(collector)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>مشاركة</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingCollector(collector)
                            setCollectorName(collector.name)
                            setCollectorPhone(collector.phone)
                            setCollectorCanEdit(collector.canEdit)
                            setSelectedCollectorAreas(collector.assignedAreaIds || [])
                            setShowCollectorModal(true)
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => handleDeleteCollector(collector.id, collector.name)}
                          className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
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
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">كادر الكتّاب</h3>
                  <p className="text-xs text-slate-500">إدارة صلاحيات إدخال وتحديث بيانات القراءات</p>
                </div>

                <button
                  onClick={() => {
                    setEditingWriter(null)
                    setWriterName('')
                    setWriterPhone('')
                    setSelectedWriterAreas([])
                    setShowWriterModal(true)
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>كاتب جديد</span>
                </button>
              </div>

              {(!branch.writers || branch.writers.length === 0) ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">لا يوجد كتاب مسجلون حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branch.writers.map((writer) => (
                    <div
                      key={writer.id}
                      className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-4"
                    >
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 text-sm">{writer.name}</h4>
                        <p className="text-xs font-mono text-slate-500 dir-ltr text-right">{writer.phone}</p>
                        <span className="inline-block text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                          صلاحية تعديل الديون
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
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
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح الحساب</span>
                        </button>

                        <button
                          onClick={() => handleShareWriterWhatsApp(writer)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>مشاركة</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingWriter(writer)
                            setWriterName(writer.name)
                            setWriterPhone(writer.phone)
                            setSelectedWriterAreas(writer.assignedAreaIds || [])
                            setShowWriterModal(true)
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => handleDeleteWriter(writer.id, writer.name)}
                          className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
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
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">مسؤولو الخزنة والصندوق</h3>
                  <p className="text-xs text-slate-500">إدارة وتدقيق السجلات المالية</p>
                </div>

                <button
                  onClick={() => setShowTreasuryModal(true)}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>مسؤول خزنة</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(branch.treasuryManagers || []).map((tr) => (
                  <div key={tr.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                    <div className="p-3 bg-amber-100 text-amber-700 rounded-xl">
                      <Vault className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">{tr.name}</h4>
                      <p className="text-xs font-mono text-slate-500 dir-ltr text-right">{tr.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* تبويب بيانات الفرع */}
          {activeTab === 'branch_info' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base md:text-lg font-black text-slate-900">بيانات الفرع التفصيلية</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-1">اسم الفرع</span>
                  <span className="font-black text-slate-900 text-sm">{branch.name}</span>
                </div>
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-slate-500 font-bold block mb-1">تاريخ الإنشاء</span>
                  <span className="font-bold text-slate-900">{new Date(branch.createdAt).toLocaleDateString('ar-IQ')}</span>
                </div>
              </div>
            </div>
          )}

          {/* تبويب الإعدادات والذكاء الاصطناعي */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div>
                <h3 className="text-base md:text-lg font-black text-slate-900">إعدادات الذكاء الاصطناعي (AI)</h3>
                <p className="text-xs text-slate-500">إدارة مفاتيح Gemini API لاستخراج بيانات الوصولات إلكترونياً</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="ألصق مفتاح Gemini API Key هنا..."
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddAiKey}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1"
                  >
                    <Key className="w-4 h-4" />
                    <span>حفظ المفتاح</span>
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  {(branch.aiApiKeys || []).map((key, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="font-mono text-slate-600">{key.substring(0, 10)}...{key.substring(key.length - 6)}</span>
                      <button
                        onClick={() => handleDeleteAiKey(key)}
                        className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* النوافذ المنبثقة (Modals) */}
      {/* نافذة استيراد المشتركين */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-xl">
            <h3 className="text-base font-black text-slate-900">استيراد مشتركين جدد</h3>
            <p className="text-xs text-slate-500">الصق قائمة الأسماء مع أرقام المشتركين (مثال: 5202 نوري عبد الصمد):</p>

            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="5202 نوري عبد الصمد&#10;5203 أحمد علي..."
              className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
              >
                بدء الاستيراد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل محصل */}
      {showCollectorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-black text-slate-900">
              {editingCollector ? 'تعديل بيانات المحصل' : 'إضافة محصل جديد'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الثلاثي:</label>
                <input
                  type="text"
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={collectorPhone}
                  onChange={(e) => setCollectorPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectorCanEdit}
                    onChange={(e) => setCollectorCanEdit(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded bg-white border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    السماح بالتعديل على المشتركين والديون
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المناطق المخصصة:</label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  {(branch.areas || []).map(area => (
                    <label key={area.id} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
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
                        className="rounded text-blue-600 bg-white border-slate-300"
                      />
                      <span>{area.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowCollectorModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCollector}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                حفظ المحصل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل كاتب */}
      {showWriterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-black text-slate-900">
              {editingWriter ? 'تعديل بيانات الكاتب' : 'إضافة كاتب جديد'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الكاتب:</label>
                <input
                  type="text"
                  value={writerName}
                  onChange={(e) => setWriterName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={writerPhone}
                  onChange={(e) => setWriterPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المناطق المخصصة:</label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  {(branch.areas || []).map(area => (
                    <label key={area.id} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
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
                        className="rounded text-blue-600 bg-white border-slate-300"
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
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveWriter}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                حفظ الكاتب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة مسؤول خزنة */}
      {showTreasuryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-black text-slate-900">إضافة مسؤول خزنة جديد</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم:</label>
                <input
                  type="text"
                  value={treasuryName}
                  onChange={(e) => setTreasuryName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={treasuryPhone}
                  onChange={(e) => setTreasuryPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowTreasuryModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveTreasury}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
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
