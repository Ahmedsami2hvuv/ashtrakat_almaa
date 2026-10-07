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

export default function DirectorDashboard({
  directorateData,
  onUpdateDirectorate,
  onVisitBranchManager,
  onLogout
}: DirectorDashboardProps) {
  // التبويب النشط
  const [activeTab, setActiveTab] = useState<TabType>('branches')

  // حالة القائمة الجانبية
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // عرض صفحة الفرع المستقلة (null تعني عرض قائمة الأفرع، وإذا تم اختيار فرع يُعرض في صفحة كاملة مستقلة)
  const [activeBranchDetailId, setActiveBranchDetailId] = useState<string | null>(null)

  // حقول البحث في كل مكان
  const [globalSearch, setGlobalSearch] = useState('')
  const [branchListSearch, setBranchListSearch] = useState('')
  const [managerSearch, setManagerSearch] = useState('')
  const [reportsSearch, setReportsSearch] = useState('')

  // حالات النسخ
  const [copiedManagerId, setCopiedManagerId] = useState<string | null>(null)

  // حالات إضافة فرع
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  // حالات إضافة وتعديل مسؤول
  const [showAddManagerModal, setShowAddManagerModal] = useState(false)
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')

  // فلترة تقارير السنوات
  const [reportYear, setReportYear] = useState<number>(2026)

  // الفرع المعروض حالياً في شاشة التفاصيل المستقلة
  const activeBranch = useMemo(() => {
    if (!activeBranchDetailId) return null
    return directorateData.branches.find(b => b.id === activeBranchDetailId) || null
  }, [activeBranchDetailId, directorateData.branches])

  // دالة إضافة فرع جديد
  const handleAddBranch = () => {
    if (!newBranchName.trim()) {
      alert('يرجى إدخال اسم الفرع')
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
    // فتح صفحة الفرع الجديد مباشرة
    setActiveBranchDetailId(newBranch.id)
  }

  // حذف فرع
  const handleDeleteBranch = (branchId: string, branchName: string) => {
    if (directorateData.branches.length <= 1) {
      alert('لا يمكن حذف الفرع الأخير في المديرية')
      return
    }
    if (confirm(`هل أنت متأكد من حذف ${branchName} نهائياً مع كافة بياناته؟`)) {
      const updatedBranches = directorateData.branches.filter(b => b.id !== branchId)
      const updated = {
        ...directorateData,
        branches: updatedBranches
      }
      onUpdateDirectorate(updated)
      setActiveBranchDetailId(null)
    }
  }

  // حفظ مسؤول
  const handleSaveManager = () => {
    if (!managerName.trim() || !managerPhone.trim()) {
      alert('يرجى إدخال الاسم ورقم الهاتف للمسؤول')
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
    if (confirm(`هل أنت متأكد من حذف المسؤول (${name})؟`)) {
      const updatedManagers = (activeBranch.managers || []).filter(m => m.id !== managerId)
      const updatedBranches = directorateData.branches.map(b =>
        b.id === activeBranch.id ? { ...b, managers: updatedManagers } : b
      )
      onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    }
  }

  // مشاركة رابط المسؤول بالواتساب
  const handleShareManagerWhatsApp = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    const msg = `السلام عليكم ${manager.name}\nمسؤول ${branch.name}\nرابط الدخول المباشر إلى حسابك في النظام:\n${directLink}`
    const waUrl = generateWhatsAppLink(manager.phone, msg)
    window.open(waUrl, '_blank')
  }

  // نسخ الرابط المباشر
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

  // الإحصائيات العامة
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

  // حساب المبالغ المستحصلة
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

  // تصفية الأفرع حسب البحث
  const filteredBranches = useMemo(() => {
    const q = (branchListSearch || globalSearch).trim().toLowerCase()
    if (!q) return directorateData.branches
    return directorateData.branches.filter(b => b.name.toLowerCase().includes(q))
  }, [branchListSearch, globalSearch, directorateData.branches])

  // تصفية المسؤولين داخل الفرع المختار
  const filteredManagers = useMemo(() => {
    if (!activeBranch) return []
    const q = managerSearch.trim().toLowerCase()
    if (!q) return activeBranch.managers || []
    return (activeBranch.managers || []).filter(
      m => m.name.toLowerCase().includes(q) || m.phone.includes(q)
    )
  }, [activeBranch, managerSearch])

  // تصفية التقارير
  const filteredReportStats = useMemo(() => {
    const q = reportsSearch.trim().toLowerCase()
    if (!q) return branchStats
    return branchStats.filter(s => s.name.toLowerCase().includes(q))
  }, [reportsSearch, branchStats])

  return (
    <div
      className="min-h-screen flex flex-row font-sans text-slate-900"
      dir="rtl"
      style={{ backgroundColor: '#f1f5f9' }}
    >
      {/* ======================================================== */}
      {/* 1. القائمة الجانبية (قابلة للإغلاق والفتح تماماً)             */}
      {/* ======================================================== */}
      {isSidebarOpen && (
        <aside
          className="flex flex-col justify-between shrink-0 shadow-lg"
          style={{
            width: '280px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            borderLeft: '1px solid #1e293b',
            minHeight: '100vh',
            position: 'sticky',
            top: 0,
            zIndex: 40
          }}
        >
          {/* الجزء العلوي */}
          <div>
            {/* الترويسة مع زر إغلاق القائمة */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #1e293b' }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-sm text-white"
                  style={{ backgroundColor: '#0284c7' }}
                >
                  ماء
                </div>
                <div>
                  <h1 className="text-sm font-black text-white">مديرية ماء البصرة</h1>
                  <p className="text-[11px] text-sky-400 font-bold">لوحة مدير الواردات</p>
                </div>
              </div>

              {/* زر الإغلاق */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="إغلاق القائمة"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* بطاقة المستخدم */}
            <div
              className="mx-3 my-3 p-3 rounded-lg"
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-white">مدير الواردات العام</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-black bg-emerald-950 text-emerald-400 border border-emerald-800">
                  متصل
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1 font-medium">محافظة البصرة - المقر العام</p>
            </div>

            {/* روابط التنقل */}
            <nav className="px-2 space-y-1 mt-2">
              <div className="px-3 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                القائمة الرئيسية
              </div>

              {/* 1. الرئيسية */}
              <button
                onClick={() => {
                  setActiveTab('overview')
                  setActiveBranchDetailId(null)
                }}
                className="w-full text-right px-3 py-2.5 rounded-lg text-xs font-black flex items-center gap-2.5 transition"
                style={{
                  backgroundColor: activeTab === 'overview' ? '#0284c7' : 'transparent',
                  color: activeTab === 'overview' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span>الرئيسية (لوحة المؤشرات)</span>
              </button>

              {/* 2. الأفرع وإدارتها */}
              <button
                onClick={() => {
                  setActiveTab('branches')
                  setActiveBranchDetailId(null)
                }}
                className="w-full text-right px-3 py-2.5 rounded-lg text-xs font-black flex items-center justify-between transition"
                style={{
                  backgroundColor: activeTab === 'branches' ? '#0284c7' : 'transparent',
                  color: activeTab === 'branches' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>الأفرع وإدارتها</span>
                </div>
                <span
                  className="text-[11px] px-2 py-0.5 rounded font-black text-white"
                  style={{ backgroundColor: activeTab === 'branches' ? '#0369a1' : '#334155' }}
                >
                  {directorateData.branches.length}
                </span>
              </button>

              {/* 3. التقارير المالية */}
              <button
                onClick={() => {
                  setActiveTab('reports')
                  setActiveBranchDetailId(null)
                }}
                className="w-full text-right px-3 py-2.5 rounded-lg text-xs font-black flex items-center gap-2.5 transition"
                style={{
                  backgroundColor: activeTab === 'reports' ? '#0284c7' : 'transparent',
                  color: activeTab === 'reports' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>التقارير والإحصائيات</span>
              </button>
            </nav>
          </div>

          {/* الجزء السفلي */}
          <div className="p-3 space-y-2.5" style={{ borderTop: '1px solid #1e293b' }}>
            <div
              className="p-3 rounded-lg"
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            >
              <div className="text-[10px] text-slate-400 font-bold">إجمالي المبالغ المستحصلة:</div>
              <div className="text-sm font-black text-emerald-400 mt-0.5">
                {totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full px-3 py-2 rounded-lg text-xs font-black text-rose-300 hover:text-white bg-rose-950/40 hover:bg-rose-900 border border-rose-800/60 transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>
      )}

      {/* ======================================================== */}
      {/* 2. منطقة العمل الرئيسية                                   */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* الشريط العلوي مع محرك البحث الشامل وزر القائمة */}
        <header
          className="sticky top-0 z-30 px-4 md:px-8 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shadow-sm"
        >
          <div className="flex items-center gap-3 flex-1 max-w-xl">
            {/* زر إظهار/إخفاء القائمة */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition flex items-center gap-1.5 text-xs font-black shrink-0 shadow-sm"
              title="القائمة الجانبية"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>{isSidebarOpen ? 'إخفاء' : 'القائمة'}</span>
            </button>

            {/* محرك بحث شامل في كل مكان */}
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="ابحث عن أي فرع من هنا مباشرة..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value)
                  if (activeTab !== 'branches') setActiveTab('branches')
                  if (activeBranchDetailId) setActiveBranchDetailId(null)
                }}
                className="w-full pr-9 pl-4 py-2 rounded-lg bg-slate-100 border border-slate-300 text-xs font-bold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600 outline-none transition"
              />
              <svg className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'branches' && (
              <button
                onClick={() => setShowAddBranchModal(true)}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-black text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span>إضافة فرع جديد</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="px-3.5 py-2 rounded-lg text-xs font-black text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
            >
              خروج
            </button>
          </div>
        </header>

        {/* جسم الصفحة الرئيسي */}
        <main className="p-4 md:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {/* ======================================================== */}
          {/* تبويب 1: الصفحة الرئيسية (مؤشرات عامة فقط ونظيفة)        */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* ترويسة هادئة */}
              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-900">
                  لوحة المتابعة المركزية - مديرية ماء محافظة البصرة
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-1">
                  نظرة عامة على اشتراكات الماء، المبالغ المستحصلة، وإدارة الكوادر في المحافظة.
                </p>
              </div>

              {/* بطاقات المؤشرات الأربعة */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 mb-1">إجمالي مشتركي المحافظة</div>
                  <div className="text-2xl font-black text-slate-900">
                    {totalSubscribersAllBranches.toLocaleString('ar-IQ')}
                  </div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1">
                    عبر {directorateData.branches.length} فروع رسمية
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 mb-1">المبالغ المستحصلة</div>
                  <div className="text-2xl font-black text-emerald-700">
                    {totalCollectedAllBranches.toLocaleString('ar-IQ')}{' '}
                    <span className="text-xs font-bold text-slate-500">د.ع</span>
                  </div>
                  <div className="text-[11px] text-emerald-600 font-bold mt-1">إجمالي إيرادات الجباية</div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 mb-1">عدد أفرع المديرية</div>
                  <div className="text-2xl font-black text-slate-900">
                    {directorateData.branches.length}{' '}
                    <span className="text-xs font-bold text-slate-500">فرع</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1">
                    تغطي {totalAreasAllBranches} منطقة مائية
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-500 mb-1">إجمالي الكوادر</div>
                  <div className="text-2xl font-black text-slate-900">
                    {totalManagersAllBranches + totalCollectorsAllBranches}{' '}
                    <span className="text-xs font-bold text-slate-500">موظف</span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-bold mt-1">
                    {totalManagersAllBranches} مسؤولين | {totalCollectorsAllBranches} محصلين
                  </div>
                </div>
              </div>

              {/* أزرار الانتقال المباشر */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <h4 className="text-sm font-black text-slate-900">إدارة أفرع المديرية ومسؤوليها</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    افتح دليل الأفرع لاستعراض كل فرع في صفحة مستقلة وإدارته وتعيين المسؤولين ومشاركة روابطهم.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('branches')
                      setActiveBranchDetailId(null)
                    }}
                    className="px-4 py-2.5 rounded-lg text-xs font-black bg-blue-600 hover:bg-blue-700 text-white transition inline-flex items-center gap-2 shadow-sm"
                  >
                    <span>الانتقال إلى دليل الأفرع</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <h4 className="text-sm font-black text-slate-900">التقارير والإحصائيات المالية</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-semibold">
                    مقارنة حركة التحصيل بين الأفرع ومتابعة الجباية السنوية والشهرية للمحافظة.
                  </p>
                  <button
                    onClick={() => {
                      setActiveTab('reports')
                      setActiveBranchDetailId(null)
                    }}
                    className="px-4 py-2.5 rounded-lg text-xs font-black bg-slate-900 hover:bg-slate-800 text-white transition inline-flex items-center gap-2 shadow-sm"
                  >
                    <span>عرض التقارير المالية</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* تبويب 2: خانة الأفرع (عرض قائمة أو صفحة فرع مستقلة)       */}
          {/* ======================================================== */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* ---------------------------------------------------- */}
              {/* الحالة أ: لم يتم اختيار فرع -> عرض قائمة الأفرع كاملة */}
              {/* ---------------------------------------------------- */}
              {!activeBranch ? (
                <div className="space-y-4">
                  {/* شريط أدوات قائمة الأفرع مع البحث البارز */}
                  <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-black text-slate-900">
                        دليل أفرع مديرية ماء محافظة البصرة ({filteredBranches.length})
                      </h3>
                      <p className="text-xs text-slate-500 font-semibold mt-0.5">
                        انقر على أي فرع لفتح صفحته المستقلة وإدارته بالكامل.
                      </p>
                    </div>

                    {/* مربع بحث الأفرع */}
                    <div className="relative w-full sm:w-72">
                      <input
                        type="text"
                        placeholder="ابحث عن اسم الفرع..."
                        value={branchListSearch}
                        onChange={(e) => setBranchListSearch(e.target.value)}
                        className="w-full pr-9 pl-4 py-2 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 outline-none"
                      />
                      <svg className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  {/* بطاقات الأفرع: واضحة وأنيقة وسهلة النقر */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredBranches.map(branch => (
                      <div
                        key={branch.id}
                        onClick={() => {
                          setActiveBranchDetailId(branch.id)
                          setManagerSearch('')
                        }}
                        className="p-5 rounded-xl bg-white border-2 border-slate-200 hover:border-blue-500 shadow-sm hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-4 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-base font-black text-slate-900 group-hover:text-blue-600 transition">
                              {branch.name}
                            </h4>
                            <p className="text-xs text-slate-500 font-bold mt-1">
                              المناطق: {branch.areas?.length || 0} | المحصلون: {branch.collectors?.length || 0}
                            </p>
                          </div>
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                            {branch.subscribers?.length || 0} مشترك
                          </span>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-600">
                            المسؤولون: <strong className="text-slate-900">{branch.managers?.length || 0}</strong>
                          </span>
                          <span className="text-xs font-black text-blue-600 group-hover:underline flex items-center gap-1">
                            <span>فتح صفحة الفرع</span>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                            </svg>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {filteredBranches.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                      <p className="text-sm font-bold text-slate-600">لم يتم العثور على أفرع مطابقة للبحث</p>
                    </div>
                  )}
                </div>
              ) : (
                /* ---------------------------------------------------- */
                /* الحالة ب: تم اختيار فرع -> فتح صفحته المستقلة بالكامل */
                /* ---------------------------------------------------- */
                <div className="space-y-6">
                  {/* زر العودة البارز */}
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => setActiveBranchDetailId(null)}
                      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition flex items-center gap-2 shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                      </svg>
                      <span>← العودة إلى قائمة كافة الأفرع</span>
                    </button>

                    <span className="text-xs font-bold text-slate-500">
                      أنت الآن داخل صفحة: <strong className="text-slate-900">{activeBranch.name}</strong>
                    </span>
                  </div>

                  {/* بطاقة رأس الفرع المستقلة */}
                  <div className="p-6 md:p-8 rounded-xl bg-white border border-slate-200 shadow-sm space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="text-2xl font-black text-slate-900">{activeBranch.name}</h3>
                          <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
                            {activeBranch.subscribers?.length || 0} مشترك
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                          تاريخ الإنشاء: {new Date(activeBranch.createdAt).toLocaleDateString('ar-IQ')}
                        </p>
                      </div>

                      {/* أزرار الإجراءات للفرع */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setEditingManager(null)
                            setManagerName('')
                            setManagerPhone('')
                            setShowAddManagerModal(true)
                          }}
                          className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition flex items-center gap-2 shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                          </svg>
                          <span>إضافة مسؤول للفرع</span>
                        </button>

                        <button
                          onClick={() => handleDeleteBranch(activeBranch.id, activeBranch.name)}
                          className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-black text-xs transition flex items-center gap-1.5 shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span>حذف الفرع</span>
                        </button>
                      </div>
                    </div>

                    {/* إحصائيات الفرع السريعة */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">عدد المناطق</div>
                        <div className="text-xl font-black text-slate-900 mt-1">{activeBranch.areas?.length || 0}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">عدد المحصلين</div>
                        <div className="text-xl font-black text-slate-900 mt-1">{activeBranch.collectors?.length || 0}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">عدد الكتاب</div>
                        <div className="text-xl font-black text-slate-900 mt-1">{activeBranch.writers?.length || 0}</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="text-xs font-bold text-slate-500">مسؤولو الفرع</div>
                        <div className="text-xl font-black text-blue-600 mt-1">{activeBranch.managers?.length || 0}</div>
                      </div>
                    </div>
                  </div>

                  {/* قسم مسؤولي الفرع مع محرك بحث خاص بهم */}
                  <div className="p-6 md:p-8 rounded-xl bg-white border border-slate-200 shadow-sm space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          قائمة مسؤولي ({activeBranch.name})
                        </h4>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                          لكل مسؤول رابط تسجيل دخول مباشر خاص به
                        </p>
                      </div>

                      {/* بحث المسؤولين */}
                      <div className="relative w-full sm:w-64">
                        <input
                          type="text"
                          placeholder="ابحث عن مسؤول بالاسم أو الهاتف..."
                          value={managerSearch}
                          onChange={(e) => setManagerSearch(e.target.value)}
                          className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 outline-none"
                        />
                        <svg className="w-4 h-4 text-slate-400 absolute right-2.5 top-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                    </div>

                    {/* شبكة كروت المسؤولين بأزرار واضحة وألوان صلبة غير باهتة إطلاقاً */}
                    {filteredManagers.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                        <p className="text-xs font-bold text-slate-600">لا يوجد مسؤول مسجل مطابق للبحث</p>
                        <button
                          onClick={() => {
                            setEditingManager(null)
                            setManagerName('')
                            setManagerPhone('')
                            setShowAddManagerModal(true)
                          }}
                          className="mt-3 px-4 py-2 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 transition"
                        >
                          + إضافة مسؤول للفرع
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredManagers.map(manager => (
                          <div
                            key={manager.id}
                            className="p-5 rounded-xl border-2 border-slate-200 bg-white shadow-sm flex flex-col justify-between space-y-4"
                          >
                            {/* بيانات المسؤول */}
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-black text-slate-900 text-base">{manager.name}</h5>
                                <p className="text-xs font-black text-blue-700 dir-ltr text-right mt-1">
                                  {manager.phone}
                                </p>
                              </div>
                              <span className="text-[10px] font-black bg-slate-100 text-slate-800 px-2.5 py-1 rounded-md border border-slate-200">
                                مسؤول
                              </span>
                            </div>

                            {/* الأزرار الخمسة بألوان صلبة وواضحة جداً */}
                            <div className="space-y-2 pt-3 border-t border-slate-200">
                              {/* الصف الأول: زيارة صفحته + واتساب */}
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => onVisitBranchManager(activeBranch, manager)}
                                  className="px-3 py-2 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  <span>دخول لصفحته</span>
                                </button>

                                <button
                                  onClick={() => handleShareManagerWhatsApp(manager, activeBranch)}
                                  className="px-3 py-2 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.941-.708-1.792s.446-1.27.605-1.444c.159-.175.347-.219.462-.219.116 0 .232.001.332.006.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.101-.179.21-.077.385.101.174.453.748.971 1.209.667.593 1.229.776 1.403.863.174.087.275.072.376-.044.101-.116.433-.505.549-.679.116-.174.232-.145.39-.087s1.011.477 1.185.564c.174.087.289.13.332.203.043.072.043.419-.101.824z"/>
                                  </svg>
                                  <span>واتساب</span>
                                </button>
                              </div>

                              {/* الصف الثاني: نسخ الرابط + تعديل + حذف بألوان صلبة بارزة */}
                              <div className="grid grid-cols-3 gap-2 pt-1">
                                <button
                                  onClick={() => handleCopyManagerLink(manager, activeBranch)}
                                  className="px-2 py-1.5 rounded-lg text-xs font-black text-slate-800 bg-slate-200 hover:bg-slate-300 transition text-center"
                                  title="نسخ الرابط المباشر"
                                >
                                  {copiedManagerId === manager.id ? '✓ تم النسخ' : 'نسخ الرابط'}
                                </button>

                                <button
                                  onClick={() => {
                                    setEditingManager(manager)
                                    setManagerName(manager.name)
                                    setManagerPhone(manager.phone)
                                    setShowAddManagerModal(true)
                                  }}
                                  className="px-2 py-1.5 rounded-lg text-xs font-black text-slate-800 bg-slate-200 hover:bg-slate-300 transition text-center"
                                >
                                  تعديل
                                </button>

                                <button
                                  onClick={() => handleDeleteManager(manager.id, manager.name)}
                                  className="px-2 py-1.5 rounded-lg text-xs font-black text-white bg-rose-600 hover:bg-rose-700 transition text-center shadow-sm"
                                >
                                  حذف
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* تبويب 3: التقارير المالية (مع محرك بحث الأفرع وفلترة السنوات) */}
          {/* ======================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* شريط أدوات التقارير مع البحث وفلترة السنوات */}
              <div className="p-5 rounded-xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    تقارير التحصيل المالي ومقارنة الأفرع
                  </h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    متابعة أداء الجباية لمديرية ماء محافظة البصرة
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* بحث في التقارير */}
                  <div className="relative w-48">
                    <input
                      type="text"
                      placeholder="ابحث في الأفرع..."
                      value={reportsSearch}
                      onChange={(e) => setReportsSearch(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-600 outline-none"
                    />
                    <svg className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  {/* اختيار السنة */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-300">
                    <span className="text-xs font-bold text-slate-600 px-1.5">السنة:</span>
                    {[2026, 2027, 2028].map(yr => (
                      <button
                        key={yr}
                        onClick={() => setReportYear(yr)}
                        className={`px-3 py-1 rounded text-xs font-black transition ${
                          reportYear === yr
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* مقارنة مبالغ التحصيل */}
              <div className="p-6 rounded-xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h4 className="text-sm font-black text-slate-900">
                    المبالغ المستحصلة لكل فرع
                  </h4>
                  <span className="text-xs font-black text-emerald-700">
                    الإجمالي: {totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {filteredReportStats.map(stat => {
                    const maxVal = Math.max(...filteredReportStats.map(s => s.collectedAmount), 1)
                    const percent = Math.min(100, Math.round((stat.collectedAmount / maxVal) * 100))
                    return (
                      <div key={stat.branchId} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-black text-slate-900">{stat.name}</span>
                          <span className="font-black text-emerald-700">
                            {stat.collectedAmount.toLocaleString('ar-IQ')} د.ع
                          </span>
                        </div>
                        <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300"
                            style={{ width: `${Math.max(percent, 2)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* جدول البيانات التفصيلي */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <h4 className="text-sm font-black text-slate-900">جدول البيانات المالية الموحدة</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-800 font-black border-b border-slate-200">
                        <th className="p-3">اسم الفرع</th>
                        <th className="p-3">المشتركون</th>
                        <th className="p-3">المسؤولون</th>
                        <th className="p-3">المحصلون</th>
                        <th className="p-3">المبالغ المستحصلة</th>
                        <th className="p-3">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {filteredReportStats.map(s => (
                        <tr key={s.branchId} className="hover:bg-slate-50 transition">
                          <td className="p-3 text-slate-900 font-black">{s.name}</td>
                          <td className="p-3 text-slate-700">{s.subscribersCount.toLocaleString('ar-IQ')}</td>
                          <td className="p-3 text-slate-700">{s.managersCount}</td>
                          <td className="p-3 text-slate-700">{s.collectorsCount}</td>
                          <td className="p-3 text-emerald-700 font-black">
                            {s.collectedAmount.toLocaleString('ar-IQ')} د.ع
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                setActiveTab('branches')
                                setActiveBranchDetailId(s.branchId)
                              }}
                              className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-black text-xs transition"
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
      {/* 3. النوافذ المنبثقة (Modals)                               */}
      {/* ======================================================== */}

      {/* نافذة إضافة فرع جديد */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="p-6 max-w-md w-full rounded-2xl bg-white space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-2">
              إضافة فرع واردات جديد
            </h3>

            <div>
              <label className="block text-xs font-black text-slate-700 mb-1.5">
                اسم الفرع (مثال: فرع واردات القرنة):
              </label>
              <input
                type="text"
                placeholder="اكتب اسم الفرع..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg text-xs font-bold border border-slate-300 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddBranch}
                className="px-5 py-2 rounded-lg text-xs font-black text-white bg-blue-600 hover:bg-blue-700 transition shadow-sm"
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
          <div className="p-6 max-w-md w-full rounded-2xl bg-white space-y-4 shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-2">
              {editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ (${activeBranch?.name})`}
            </h3>

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
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs font-bold border border-slate-300 outline-none focus:border-blue-600"
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
                  className="w-full px-3.5 py-2.5 rounded-lg text-xs font-bold border border-slate-300 outline-none dir-ltr text-right focus:border-blue-600"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className="px-4 py-2 rounded-lg text-xs font-black bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManager}
                className="px-5 py-2 rounded-lg text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-sm"
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
