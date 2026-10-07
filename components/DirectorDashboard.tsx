'use client'

import React, { useState, useMemo } from 'react'
import { DirectorateData, DirectorateBranch, BranchManager } from '@/lib/directorateTypes'
import { generateSecureToken, generateWhatsAppLink } from '@/lib/directorateStore'

interface DirectorDashboardProps {
  directorateData: DirectorateData
  onUpdateDirectorate: (updatedData: DirectorateData) => void
  onVisitBranchManager: (branch: DirectorateBranch, manager: BranchManager) => void
  onLogout: () => void
}

type TabType = 'overview' | 'branches' | 'reports'
type ViewMode = 'table' | 'cards'

export default function DirectorDashboard({
  directorateData,
  onUpdateDirectorate,
  onVisitBranchManager,
  onLogout
}: DirectorDashboardProps) {
  // حالة التبويب النشط
  const [activeTab, setActiveTab] = useState<TabType>('branches')

  // حالة فتح / طي القائمة الجانبية
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // طريقة العرض في دليل الأفرع (جدول رسمي منظم أو كروت راقية)
  const [branchViewMode, setBranchViewMode] = useState<ViewMode>('table')

  // الفرع المختار لفتح صفحته المستقلة
  const [activeBranchDetailId, setActiveBranchDetailId] = useState<string | null>(null)

  // البحث الموحد والذكي
  const [searchQuery, setSearchQuery] = useState('')

  // حالات النسخ المؤقت
  const [copiedManagerId, setCopiedManagerId] = useState<string | null>(null)

  // نافذة إضافة فرع
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  // نافذة إضافة وتعديل مسؤول
  const [showAddManagerModal, setShowAddManagerModal] = useState(false)
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')

  // فلترة تقارير السنوات
  const [reportYear, setReportYear] = useState<number>(2026)

  // الفرع النشط حالياً
  const activeBranch = useMemo(() => {
    if (!activeBranchDetailId) return null
    return directorateData.branches.find(b => b.id === activeBranchDetailId) || null
  }, [activeBranchDetailId, directorateData.branches])

  // إضافة فرع جديد
  const handleAddBranch = () => {
    if (!newBranchName.trim()) {
      alert('يرجى كتابة اسم الفرع')
      return
    }
    const newBranch: DirectorateBranch = {
      id: 'branch_' + Date.now().toString(36),
      name: newBranchName.trim(),
      createdAt: new Date().toISOString(),
      managers: [],
      collectors: [],
      writers: [],
      treasuryManagers: [],
      areas: [],
      subscribers: [],
      billing: {},
      consignments: []
    }
    const updated = {
      ...directorateData,
      branches: [...directorateData.branches, newBranch]
    }
    onUpdateDirectorate(updated)
    setNewBranchName('')
    setShowAddBranchModal(false)
    setActiveBranchDetailId(newBranch.id)
  }

  // حذف فرع
  const handleDeleteBranch = (branchId: string, branchName: string) => {
    if (directorateData.branches.length <= 1) {
      alert('لا يمكن حذف الفرع الأخير في المديرية')
      return
    }
    if (confirm(`هل أنت متأكد من حذف (${branchName}) نهائياً مع كافة السجلات؟`)) {
      const updatedBranches = directorateData.branches.filter(b => b.id !== branchId)
      onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
      setActiveBranchDetailId(null)
    }
  }

  // حفظ أو تعديل مسؤول
  const handleSaveManager = () => {
    if (!managerName.trim() || !managerPhone.trim()) {
      alert('يرجى إدخال اسم ورقم هاتف المسؤول')
      return
    }
    if (!activeBranch) return

    let updatedManagers = [...(activeBranch.managers || [])]
    if (editingManager) {
      updatedManagers = updatedManagers.map(m =>
        m.id === editingManager.id
          ? { ...m, name: managerName.trim(), phone: managerPhone.trim() }
          : m
      )
    } else {
      const newManager: BranchManager = {
        id: 'mgr_' + Date.now().toString(36),
        name: managerName.trim(),
        phone: managerPhone.trim(),
        token: generateSecureToken('mgr'),
        createdAt: new Date().toISOString()
      }
      updatedManagers.push(newManager)
    }

    const updatedBranches = directorateData.branches.map(b =>
      b.id === activeBranch.id ? { ...b, managers: updatedManagers } : b
    )

    onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    setShowAddManagerModal(false)
    setEditingManager(null)
    setManagerName('')
    setManagerPhone('')
  }

  // حذف مسؤول
  const handleDeleteManager = (managerId: string, name: string) => {
    if (!activeBranch) return
    if (confirm(`هل أنت متأكد من إزالة المسؤول (${name}) من هذا الفرع؟`)) {
      const updatedManagers = (activeBranch.managers || []).filter(m => m.id !== managerId)
      const updatedBranches = directorateData.branches.map(b =>
        b.id === activeBranch.id ? { ...b, managers: updatedManagers } : b
      )
      onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    }
  }

  // واتساب المسؤول
  const handleShareManagerWhatsApp = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    const msg = `السلام عليكم ورحمة الله وبركاته\nالأستاذ ${manager.name} المحترم\nمسؤول فرع: ${branch.name}\n\nرابط تسجيل الدخول المباشر إلى منصتكم الإدارية:\n${directLink}`
    const waUrl = generateWhatsAppLink(manager.phone, msg)
    window.open(waUrl, '_blank')
  }

  // نسخ رابط المسؤول
  const handleCopyManagerLink = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(directLink).then(() => {
        setCopiedManagerId(manager.id)
        setTimeout(() => setCopiedManagerId(null), 2500)
      })
    }
  }

  // الإحصائيات المجمعة
  const totalSubscribersAllBranches = directorateData.branches.reduce(
    (sum, b) => sum + (b.subscribers?.length || 0),
    0
  )
  const totalCollectorsAllBranches = directorateData.branches.reduce(
    (sum, b) => sum + (b.collectors?.length || 0),
    0
  )
  const totalManagersAllBranches = directorateData.branches.reduce(
    (sum, b) => sum + (b.managers?.length || 0),
    0
  )
  const totalAreasAllBranches = directorateData.branches.reduce(
    (sum, b) => sum + (b.areas?.length || 0),
    0
  )

  // حساب المبالغ
  const branchStats = directorateData.branches.map(b => {
    let collectedAmount = 0
    if (b.billing) {
      Object.values(b.billing).forEach((yearObj: any) => {
        if (yearObj && typeof yearObj === 'object') {
          Object.values(yearObj).forEach((periods: any) => {
            if (Array.isArray(periods)) {
              periods.forEach((p: any) => {
                if (p && p.paid) collectedAmount += Number(p.paid)
              })
            }
          })
        }
      })
    }
    if (b.consignments) {
      b.consignments.forEach(c => {
        if (c.totalAmount) collectedAmount += c.totalAmount
      })
    }
    return {
      branchId: b.id,
      name: b.name,
      subscribersCount: b.subscribers?.length || 0,
      areasCount: b.areas?.length || 0,
      managersCount: b.managers?.length || 0,
      collectorsCount: b.collectors?.length || 0,
      collectedAmount
    }
  })

  const totalCollectedAllBranches = branchStats.reduce((s, b) => s + b.collectedAmount, 0)

  // التصفية بالبحث
  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return directorateData.branches
    return directorateData.branches.filter(b => b.name.toLowerCase().includes(q))
  }, [searchQuery, directorateData.branches])

  const filteredManagers = useMemo(() => {
    if (!activeBranch) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return activeBranch.managers || []
    return (activeBranch.managers || []).filter(
      m => m.name.toLowerCase().includes(q) || m.phone.includes(q)
    )
  }, [activeBranch, searchQuery])

  const filteredReportStats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return branchStats
    return branchStats.filter(s => s.name.toLowerCase().includes(q))
  }, [searchQuery, branchStats])

  return (
    <div
      className="min-h-screen flex flex-row font-sans text-slate-800 antialiased"
      dir="rtl"
      style={{ backgroundColor: '#f8fafc' }}
    >
      {/* ======================================================== */}
      {/* 1. القائمة الجانبية المؤسساتية الرسمية                     */}
      {/* ======================================================== */}
      {isSidebarOpen && (
        <aside
          className="flex flex-col justify-between shrink-0 shadow-sm"
          style={{
            width: '260px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            borderLeft: '1px solid #1e293b',
            minHeight: '100vh',
            position: 'sticky',
            top: 0,
            zIndex: 40
          }}
        >
          {/* الجزء العلوي: هوية المؤسسة + التنقل */}
          <div>
            {/* الشعار والترويسة */}
            <div
              className="p-5 flex items-center justify-between"
              style={{ borderBottom: '1px solid #1e293b' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-sm"
                  style={{ backgroundColor: '#1d4ed8' }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-sm font-black text-white tracking-tight">مديرية ماء البصرة</h1>
                  <span className="text-[11px] font-bold text-sky-400">إدارة الواردات المركزية</span>
                </div>
              </div>

              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg transition"
                style={{ backgroundColor: '#1e293b', color: '#94a3b8' }}
                title="إخفاء القائمة الجانبية"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* بطاقة المستخدم المعتمدة */}
            <div
              className="mx-4 my-4 p-3 rounded-xl"
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">مدير عام الواردات</span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ backgroundColor: '#064e3b', color: '#34d399' }}
                >
                  حساب معتمد
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-1">
                محافظة البصرة • المقر العام
              </div>
            </div>

            {/* روابط التنقل الرئيسية */}
            <nav className="px-3 space-y-1.5">
              <div className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                أقسام المنظومة
              </div>

              {/* 1. الرئيسية */}
              <button
                onClick={() => {
                  setActiveTab('overview')
                  setActiveBranchDetailId(null)
                  setSearchQuery('')
                }}
                className="w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-3 transition"
                style={{
                  backgroundColor: activeTab === 'overview' ? '#1d4ed8' : 'transparent',
                  color: activeTab === 'overview' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span>الرئيسية (لوحة المتابعة)</span>
              </button>

              {/* 2. الأفرع وإدارتها */}
              <button
                onClick={() => {
                  setActiveTab('branches')
                  setActiveBranchDetailId(null)
                  setSearchQuery('')
                }}
                className="w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center justify-between transition"
                style={{
                  backgroundColor: activeTab === 'branches' ? '#1d4ed8' : 'transparent',
                  color: activeTab === 'branches' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>الأفرع وإدارتها</span>
                </div>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-md font-black"
                  style={{
                    backgroundColor: activeTab === 'branches' ? '#1e40af' : '#334155',
                    color: '#ffffff'
                  }}
                >
                  {directorateData.branches.length}
                </span>
              </button>

              {/* 3. التقارير المالية */}
              <button
                onClick={() => {
                  setActiveTab('reports')
                  setActiveBranchDetailId(null)
                  setSearchQuery('')
                }}
                className="w-full text-right px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-3 transition"
                style={{
                  backgroundColor: activeTab === 'reports' ? '#1d4ed8' : 'transparent',
                  color: activeTab === 'reports' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>التقارير المالية الموحدة</span>
              </button>
            </nav>
          </div>

          {/* الجزء السفلي: المبالغ الكلية + زر الخروج */}
          <div className="p-4 space-y-3" style={{ borderTop: '1px solid #1e293b' }}>
            <div
              className="p-3.5 rounded-xl"
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            >
              <span className="text-[11px] text-slate-400 font-bold block">إجمالي الجباية العامة:</span>
              <span className="text-base font-black text-emerald-400 mt-0.5 block">
                {totalCollectedAllBranches.toLocaleString('ar-IQ')} <small className="text-[10px] text-slate-400">د.ع</small>
              </span>
            </div>

            <button
              onClick={onLogout}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 shadow-sm"
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff'
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>تسجيل الخروج من المنظومة</span>
            </button>
          </div>
        </aside>
      )}

      {/* ======================================================== */}
      {/* 2. منطقة العمل الرئيسية (Header + Content)                */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* الترويسة العلوية الفخمة والموحدة */}
        <header
          className="sticky top-0 z-30 px-6 py-3.5 bg-white flex items-center justify-between gap-4 shadow-xs"
          style={{
            borderBottom: '1px solid #e2e8f0',
            minHeight: '64px'
          }}
        >
          {/* الجانب الأيمن: زر طي القائمة + مسار التنقل (Breadcrumbs) */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="px-3 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 shadow-xs"
              style={{
                backgroundColor: '#f1f5f9',
                color: '#1e293b',
                border: '1px solid #cbd5e1'
              }}
              title="طي / إظهار القائمة"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>{isSidebarOpen ? 'طي القائمة' : 'القائمة'}</span>
            </button>

            {/* مسار الصفحة (Breadcrumbs) */}
            <div className="hidden md:flex items-center gap-2 text-xs font-bold text-slate-500">
              <span
                onClick={() => {
                  setActiveTab('overview')
                  setActiveBranchDetailId(null)
                }}
                className="cursor-pointer hover:text-slate-900 transition"
              >
                المديرية
              </span>
              <span>/</span>
              <span
                onClick={() => {
                  if (activeBranchDetailId) setActiveBranchDetailId(null)
                }}
                className={`transition ${activeBranchDetailId ? 'cursor-pointer hover:text-slate-900' : 'text-slate-900 font-black'}`}
              >
                {activeTab === 'overview' && 'لوحة المتابعة'}
                {activeTab === 'branches' && 'دليل الأفرع'}
                {activeTab === 'reports' && 'التقارير المالية'}
              </span>
              {activeBranch && (
                <>
                  <span>/</span>
                  <span className="text-blue-700 font-black">{activeBranch.name}</span>
                </>
              )}
            </div>
          </div>

          {/* الجانب الأيسر: شريط البحث المركزي الموحد + الإجراءات */}
          <div className="flex items-center gap-3">
            {/* محرك البحث المركزي الوحيد في الصفحة */}
            <div
              className="flex items-center rounded-xl px-3 py-1.5 border"
              style={{
                backgroundColor: '#f8fafc',
                borderColor: '#cbd5e1',
                width: '280px'
              }}
            >
              <svg className="w-4 h-4 text-slate-400 shrink-0 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder={
                  activeBranch
                    ? `بحث في مسؤولي ${activeBranch.name}...`
                    : activeTab === 'reports'
                    ? 'بحث في تقارير الأفرع...'
                    : 'بحث في أفرع المديرية...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* زر إضافة فرع إذا كان في قسم الأفرع */}
            {activeTab === 'branches' && !activeBranch && (
              <button
                onClick={() => setShowAddBranchModal(true)}
                className="px-4 py-2 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-xs"
                style={{
                  backgroundColor: '#1d4ed8',
                  color: '#ffffff'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>إضافة فرع جديد</span>
              </button>
            )}

            {/* زر خروج سريع في الترويسة */}
            <button
              onClick={onLogout}
              className="px-3 py-2 rounded-xl text-xs font-black transition shadow-xs"
              style={{
                backgroundColor: '#fee2e2',
                color: '#b91c1c',
                border: '1px solid #fca5a5'
              }}
              title="تسجيل الخروج"
            >
              خروج
            </button>
          </div>
        </header>

        {/* جسم الصفحة الرئيسي المنظم */}
        <main className="p-6 md:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {/* ======================================================== */}
          {/* تبويب 1: لوحة المتابعة المركزية (Overview)               */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* ترويسة ترحيبية رسمية */}
              <div
                className="p-6 rounded-2xl bg-white shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    نظام المتابعة الإدارية والمالية المركزي
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold mt-1">
                    مديرية ماء محافظة البصرة • تقرير مؤشرات الأداء وجباية الاشتراكات
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="px-3 py-1.5 rounded-lg text-xs font-black"
                    style={{ backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}
                  >
                    العام المالي: 2026
                  </span>
                </div>
              </div>

              {/* بطاقات المؤشرات الأربعة المتناسقة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div
                  className="p-5 rounded-2xl bg-white shadow-xs space-y-2"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">إجمالي المشتركين</span>
                    <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {totalSubscribersAllBranches.toLocaleString('ar-IQ')}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    موزعين على {directorateData.branches.length} فروع
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl bg-white shadow-xs space-y-2"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">المبالغ المستحصلة</span>
                    <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700">
                    {totalCollectedAllBranches.toLocaleString('ar-IQ')} <small className="text-xs font-bold text-slate-500">د.ع</small>
                  </div>
                  <div className="text-[11px] text-emerald-600 font-bold">إجمالي إيرادات الجباية المودعة</div>
                </div>

                <div
                  className="p-5 rounded-2xl bg-white shadow-xs space-y-2"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">عدد أفرع المديرية</span>
                    <span className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {directorateData.branches.length} <span className="text-xs font-bold text-slate-500">فرع</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    تغطي {totalAreasAllBranches} منطقة مائية
                  </div>
                </div>

                <div
                  className="p-5 rounded-2xl bg-white shadow-xs space-y-2"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="text-xs font-bold">الكوادر الإدارية والميدانية</span>
                    <span className="p-1.5 rounded-lg bg-amber-50 text-amber-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {totalManagersAllBranches + totalCollectorsAllBranches} <span className="text-xs font-bold text-slate-500">موظف</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">
                    {totalManagersAllBranches} مسؤولين • {totalCollectorsAllBranches} محصلين
                  </div>
                </div>
              </div>

              {/* بطاقات التنقل السريع */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div
                  className="p-6 rounded-2xl bg-white shadow-xs flex flex-col justify-between space-y-4"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  <div>
                    <h3 className="text-base font-black text-slate-900">دليل الأفرع والمسؤولين</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                      استعراض فروع المحافظة في سجلات مخصصة، تعيين مسؤولي الأفرع، وإنشاء روابط الحسابات المباشرة.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setActiveTab('branches')
                        setActiveBranchDetailId(null)
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-black text-white transition flex items-center gap-2 shadow-xs"
                      style={{ backgroundColor: '#1d4ed8' }}
                    >
                      <span>الانتقال إلى دليل الأفرع</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div
                  className="p-6 rounded-2xl bg-white shadow-xs flex flex-col justify-between space-y-4"
                  style={{ border: '1px solid #e2e8f0' }}
                >
                  <div>
                    <h3 className="text-base font-black text-slate-900">التقارير والإحصائيات المالية</h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                      مقارنة تحصيل الإيرادات بين الأفرع المختلفة ومتابعة حركة الجباية الشهرية والسنوية.
                    </p>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setActiveTab('reports')
                        setActiveBranchDetailId(null)
                      }}
                      className="px-4 py-2.5 rounded-xl text-xs font-black text-white transition flex items-center gap-2 shadow-xs"
                      style={{ backgroundColor: '#0f172a' }}
                    >
                      <span>عرض التقارير الموحدة</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* تبويب 2: دليل وإدارة الأفرع (Branches Directory)          */}
          {/* ======================================================== */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* ---------------------------------------------------- */}
              {/* الحالة أ: عرض دليل كافة الأفرع                        */}
              {/* ---------------------------------------------------- */}
              {!activeBranch ? (
                <div className="space-y-4">
                  {/* شريط التحكم (Control Bar) */}
                  <div
                    className="p-4 md:p-5 rounded-2xl bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    style={{ border: '1px solid #e2e8f0' }}
                  >
                    <div>
                      <h2 className="text-base font-black text-slate-900">
                        فروع مديرية ماء البصرة ({filteredBranches.length})
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        اختر أي فرع لفتح سجله الإداري المستقل وإدارة كوادره ومناطق عمله
                      </p>
                    </div>

                    {/* خيارات العرض: جدول رسمي أو بطاقات */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">طريقة العرض:</span>
                      <div
                        className="flex items-center rounded-xl p-1"
                        style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                      >
                        <button
                          onClick={() => setBranchViewMode('table')}
                          className="px-3 py-1.5 rounded-lg text-xs font-black transition"
                          style={{
                            backgroundColor: branchViewMode === 'table' ? '#ffffff' : 'transparent',
                            color: branchViewMode === 'table' ? '#1d4ed8' : '#64748b',
                            boxShadow: branchViewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                          }}
                        >
                          جدول رسمي
                        </button>
                        <button
                          onClick={() => setBranchViewMode('cards')}
                          className="px-3 py-1.5 rounded-lg text-xs font-black transition"
                          style={{
                            backgroundColor: branchViewMode === 'cards' ? '#ffffff' : 'transparent',
                            color: branchViewMode === 'cards' ? '#1d4ed8' : '#64748b',
                            boxShadow: branchViewMode === 'cards' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                          }}
                        >
                          بطاقات
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 1. نمط الجدول الرسمي (Table View) - مفضل للمدراء للتنظيم السريع */}
                  {branchViewMode === 'table' ? (
                    <div
                      className="rounded-2xl bg-white shadow-xs overflow-hidden"
                      style={{ border: '1px solid #e2e8f0' }}
                    >
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr
                              style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
                              className="text-slate-700 font-black"
                            >
                              <th className="p-4">اسم الفرع</th>
                              <th className="p-4">المشتركون</th>
                              <th className="p-4">المناطق المائية</th>
                              <th className="p-4">مسؤولو الفرع</th>
                              <th className="p-4">المحصلون</th>
                              <th className="p-4 text-center">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-bold">
                            {filteredBranches.map(branch => (
                              <tr
                                key={branch.id}
                                className="hover:bg-slate-50 transition cursor-pointer"
                                onClick={() => setActiveBranchDetailId(branch.id)}
                              >
                                <td className="p-4">
                                  <div className="font-black text-slate-900 text-sm">{branch.name}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">
                                    كود: {branch.id.replace('branch_', '')}
                                  </div>
                                </td>
                                <td className="p-4 text-slate-700">
                                  {(branch.subscribers?.length || 0).toLocaleString('ar-IQ')} مشترك
                                </td>
                                <td className="p-4 text-slate-700">
                                  {branch.areas?.length || 0} منطقة
                                </td>
                                <td className="p-4">
                                  <span
                                    className="px-2.5 py-1 rounded-md text-[11px] font-black"
                                    style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}
                                  >
                                    {branch.managers?.length || 0} مسؤول
                                  </span>
                                </td>
                                <td className="p-4 text-slate-700">
                                  {branch.collectors?.length || 0} محصل
                                </td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setActiveBranchDetailId(branch.id)
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-white font-black text-xs transition shadow-xs"
                                    style={{ backgroundColor: '#1d4ed8' }}
                                  >
                                    إدارة الفرع ←
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* 2. نمط البطاقات المتقن (Cards View) */
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '16px'
                      }}
                    >
                      {filteredBranches.map(branch => (
                        <div
                          key={branch.id}
                          onClick={() => setActiveBranchDetailId(branch.id)}
                          className="p-5 rounded-2xl bg-white transition cursor-pointer flex flex-col justify-between hover:shadow-md"
                          style={{
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                          }}
                        >
                          <div className="space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="text-base font-black text-slate-900">{branch.name}</h3>
                                <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                                  كود الفرع: {branch.id.replace('branch_', '')}
                                </p>
                              </div>
                              <span
                                className="px-2.5 py-1 rounded-full text-xs font-black shrink-0"
                                style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}
                              >
                                {branch.subscribers?.length || 0} مشترك
                              </span>
                            </div>

                            {/* الإحصائيات */}
                            <div
                              className="grid grid-cols-3 gap-2 p-3 rounded-xl text-center"
                              style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}
                            >
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold block">المناطق</span>
                                <span className="text-xs font-black text-slate-900 mt-0.5 block">{branch.areas?.length || 0}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold block">المحصلون</span>
                                <span className="text-xs font-black text-slate-900 mt-0.5 block">{branch.collectors?.length || 0}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-500 font-bold block">المسؤولون</span>
                                <span className="text-xs font-black text-blue-700 mt-0.5 block">{branch.managers?.length || 0}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            className="w-full mt-4 py-2.5 rounded-xl text-xs font-black text-white transition flex items-center justify-center gap-2 shadow-xs"
                            style={{ backgroundColor: '#1d4ed8' }}
                          >
                            <span>فتح سجل الفرع</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredBranches.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                      <p className="text-sm font-bold text-slate-600">لا يوجد أي فرع يطابق معايير البحث</p>
                    </div>
                  )}
                </div>
              ) : (
                /* ---------------------------------------------------- */
                /* الحالة ب: صفحة الفرع المستقلة الكاملة                */
                /* ---------------------------------------------------- */
                <div className="space-y-6">
                  {/* شريط الإجراءات والعودة */}
                  <div className="flex items-center justify-between gap-4">
                    <button
                      onClick={() => setActiveBranchDetailId(null)}
                      className="px-4 py-2.5 rounded-xl text-white font-black text-xs transition flex items-center gap-2 shadow-xs"
                      style={{ backgroundColor: '#0f172a' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                      <span>← العودة إلى دليل كافة الأفرع</span>
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingManager(null)
                          setManagerName('')
                          setManagerPhone('')
                          setShowAddManagerModal(true)
                        }}
                        className="px-4 py-2.5 rounded-xl text-white font-black text-xs transition flex items-center gap-2 shadow-xs"
                        style={{ backgroundColor: '#16a34a' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>+ إضافة مسؤول للفرع</span>
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(activeBranch.id, activeBranch.name)}
                        className="px-3.5 py-2.5 rounded-xl text-white font-black text-xs transition flex items-center gap-1.5 shadow-xs"
                        style={{ backgroundColor: '#dc2626' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>حذف الفرع</span>
                      </button>
                    </div>
                  </div>

                  {/* بطاقة هوية الفرع ومؤشراته */}
                  <div
                    className="p-6 rounded-2xl bg-white shadow-xs space-y-6"
                    style={{ border: '1px solid #e2e8f0' }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-2xl font-black text-slate-900">{activeBranch.name}</h3>
                          <span
                            className="px-3 py-1 rounded-full text-xs font-black"
                            style={{ backgroundColor: '#e0f2fe', color: '#0369a1' }}
                          >
                            {activeBranch.subscribers?.length || 0} مشترك
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                          تاريخ الإنشاء: {new Date(activeBranch.createdAt).toLocaleDateString('ar-IQ')} • كود النظام: {activeBranch.id}
                        </p>
                      </div>
                    </div>

                    {/* المؤشرات الأربعة للفرع */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">عدد المناطق</div>
                        <div className="text-xl font-black text-slate-900 mt-1">{activeBranch.areas?.length || 0}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">عدد المحصلين</div>
                        <div className="text-xl font-black text-slate-900 mt-1">{activeBranch.collectors?.length || 0}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">عدد الكتاب</div>
                        <div className="text-xl font-black text-slate-900 mt-1">{activeBranch.writers?.length || 0}</div>
                      </div>
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">مسؤولو الفرع</div>
                        <div className="text-xl font-black text-blue-700 mt-1">{activeBranch.managers?.length || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* جدول مسؤولي الفرع المنظم والاحترافي */}
                  <div
                    className="rounded-2xl bg-white shadow-xs overflow-hidden"
                    style={{ border: '1px solid #e2e8f0' }}
                  >
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          قائمة مسؤولي الفرع ({filteredManagers.length})
                        </h4>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                          لكل مسؤول حساب وصلاحيات إدارة هذا الفرع
                        </p>
                      </div>
                    </div>

                    {filteredManagers.length === 0 ? (
                      <div className="text-center py-12 bg-slate-50">
                        <p className="text-xs font-bold text-slate-600">لا يوجد مسؤولون مسجلون في هذا الفرع حالياً</p>
                        <button
                          onClick={() => {
                            setEditingManager(null)
                            setManagerName('')
                            setManagerPhone('')
                            setShowAddManagerModal(true)
                          }}
                          className="mt-3 px-4 py-2 rounded-xl text-xs font-black text-white transition shadow-xs"
                          style={{ backgroundColor: '#16a34a' }}
                        >
                          + إضافة مسؤول الآن
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr
                              style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
                              className="text-slate-700 font-black"
                            >
                              <th className="p-4">اسم المسؤول</th>
                              <th className="p-4">رقم الهاتف</th>
                              <th className="p-4">تاريخ التعيين</th>
                              <th className="p-4 text-center">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-bold">
                            {filteredManagers.map(manager => (
                              <tr key={manager.id} className="hover:bg-slate-50 transition">
                                <td className="p-4">
                                  <div className="font-black text-slate-900 text-sm">{manager.name}</div>
                                  <div className="text-[10px] text-slate-400 font-medium">معرّف: {manager.id}</div>
                                </td>
                                <td className="p-4 text-slate-700 dir-ltr text-right font-black">
                                  {manager.phone}
                                </td>
                                <td className="p-4 text-slate-500">
                                  {manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('ar-IQ') : '—'}
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                    {/* 1. دخول لصفحته */}
                                    <button
                                      onClick={() => onVisitBranchManager(activeBranch, manager)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-black text-white transition shadow-xs flex items-center gap-1"
                                      style={{ backgroundColor: '#1d4ed8' }}
                                      title="دخول لحساب المسؤول"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                      </svg>
                                      <span>دخول</span>
                                    </button>

                                    {/* 2. واتساب */}
                                    <button
                                      onClick={() => handleShareManagerWhatsApp(manager, activeBranch)}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-black text-white transition shadow-xs flex items-center gap-1"
                                      style={{ backgroundColor: '#15803d' }}
                                      title="إرسال الرابط عبر الواتساب"
                                    >
                                      <span>واتساب</span>
                                    </button>

                                    {/* 3. نسخ الرابط */}
                                    <button
                                      onClick={() => handleCopyManagerLink(manager, activeBranch)}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-black text-white transition shadow-xs"
                                      style={{ backgroundColor: '#334155' }}
                                      title="نسخ رابط الدخول المباشر"
                                    >
                                      {copiedManagerId === manager.id ? '✓ تم النسخ' : 'نسخ'}
                                    </button>

                                    {/* 4. تعديل */}
                                    <button
                                      onClick={() => {
                                        setEditingManager(manager)
                                        setManagerName(manager.name)
                                        setManagerPhone(manager.phone)
                                        setShowAddManagerModal(true)
                                      }}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-black transition"
                                      style={{ backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #cbd5e1' }}
                                      title="تعديل البيانات"
                                    >
                                      تعديل
                                    </button>

                                    {/* 5. حذف */}
                                    <button
                                      onClick={() => handleDeleteManager(manager.id, manager.name)}
                                      className="px-2.5 py-1.5 rounded-lg text-xs font-black text-white transition"
                                      style={{ backgroundColor: '#dc2626' }}
                                      title="إزالة المسؤول"
                                    >
                                      حذف
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* تبويب 3: التقارير المالية والإحصائيات (Financial Reports)  */}
          {/* ======================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* شريط فلترة السنوات والتقارير */}
              <div
                className="p-5 rounded-2xl bg-white shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تقرير الجباية والتحصيل المالي الموحد
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    إحصائيات إيرادات الاشتراكات لمديرية ماء البصرة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">السنة المالية:</span>
                  <div
                    className="flex items-center gap-1 p-1 rounded-xl"
                    style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1' }}
                  >
                    {[2026, 2027, 2028].map(yr => (
                      <button
                        key={yr}
                        onClick={() => setReportYear(yr)}
                        className="px-3 py-1 rounded-lg text-xs font-black transition shadow-xs"
                        style={{
                          backgroundColor: reportYear === yr ? '#1d4ed8' : 'transparent',
                          color: reportYear === yr ? '#ffffff' : '#475569'
                        }}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* مقارنة مبالغ التحصيل بالرسم البياني النظيف */}
              <div
                className="p-6 rounded-2xl bg-white shadow-xs space-y-4"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-black text-slate-900">مقارنة أداء الفروع في التحصيل</h4>
                  <span className="text-xs font-black text-emerald-700">
                    الإجمالي: {totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>

                <div className="space-y-3.5 pt-1">
                  {filteredReportStats.map(stat => {
                    const maxVal = Math.max(...filteredReportStats.map(s => s.collectedAmount), 1)
                    const percent = Math.min(100, Math.round((stat.collectedAmount / maxVal) * 100))
                    return (
                      <div key={stat.branchId} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-black text-slate-900">{stat.name}</span>
                          <span className="font-black text-emerald-700">
                            {stat.collectedAmount.toLocaleString('ar-IQ')} د.ع
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: '#1d4ed8' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* جدول البيانات المالية الموحدة */}
              <div
                className="rounded-2xl bg-white shadow-xs overflow-hidden"
                style={{ border: '1px solid #e2e8f0' }}
              >
                <div className="p-4 border-b border-slate-100">
                  <h4 className="text-sm font-black text-slate-900">جدول البيانات المالية المفصلة</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr
                        style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
                        className="text-slate-700 font-black"
                      >
                        <th className="p-4">اسم الفرع</th>
                        <th className="p-4">المشتركون</th>
                        <th className="p-4">المسؤولون</th>
                        <th className="p-4">المحصلون</th>
                        <th className="p-4">المبالغ المستحصلة</th>
                        <th className="p-4 text-center">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {filteredReportStats.map(s => (
                        <tr key={s.branchId} className="hover:bg-slate-50 transition">
                          <td className="p-4 text-slate-900 font-black">{s.name}</td>
                          <td className="p-4 text-slate-700">{s.subscribersCount.toLocaleString('ar-IQ')}</td>
                          <td className="p-4 text-slate-700">{s.managersCount}</td>
                          <td className="p-4 text-slate-700">{s.collectorsCount}</td>
                          <td className="p-4 text-emerald-700 font-black">
                            {s.collectedAmount.toLocaleString('ar-IQ')} د.ع
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                setActiveTab('branches')
                                setActiveBranchDetailId(s.branchId)
                              }}
                              className="px-3 py-1.5 rounded-lg text-white font-black text-xs transition shadow-xs"
                              style={{ backgroundColor: '#1d4ed8' }}
                            >
                              عرض الفرع ←
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ======================================================== */}
      {/* 3. النوافذ المنبثقة الرسمية (Modals)                       */}
      {/* ======================================================== */}

      {/* نافذة إضافة فرع جديد */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div
            className="p-6 max-w-md w-full rounded-2xl bg-white space-y-4 shadow-2xl animate-in fade-in"
            style={{ border: '1px solid #e2e8f0' }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                إضافة فرع واردات جديد
              </h3>
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-black"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                اسم الفرع (مثال: فرع واردات القرنة):
              </label>
              <input
                type="text"
                placeholder="اكتب اسم الفرع الجديد..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border outline-none"
                style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-black transition"
                style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleAddBranch}
                className="px-5 py-2 rounded-xl text-xs font-black text-white transition shadow-xs"
                style={{ backgroundColor: '#1d4ed8' }}
              >
                تأكيد الإضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل مسؤول فرع */}
      {showAddManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div
            className="p-6 max-w-md w-full rounded-2xl bg-white space-y-4 shadow-2xl animate-in fade-in"
            style={{ border: '1px solid #e2e8f0' }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ (${activeBranch?.name})`}
              </h3>
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className="text-slate-400 hover:text-slate-600 text-sm font-black"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  الاسم الثلاثي:
                </label>
                <input
                  type="text"
                  placeholder="مثال: أحمد عبد الحسين علي"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border outline-none"
                  style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1.5">
                  رقم الهاتف:
                </label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border outline-none dir-ltr text-right"
                  style={{ borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className="px-4 py-2 rounded-xl text-xs font-black transition"
                style={{ backgroundColor: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManager}
                className="px-5 py-2 rounded-xl text-xs font-black text-white transition shadow-xs"
                style={{ backgroundColor: '#16a34a' }}
              >
                حفظ البيانات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
