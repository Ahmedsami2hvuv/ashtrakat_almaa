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

/* ───────────── أيقونات ───────────── */
const ICONS: Record<string, string> = {
  home: 'M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10',
  building:
    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  chart:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 18L18 6M6 6l12 12',
  search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  plus: 'M12 4v16m8-8H4',
  logout:
    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  users:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  trash:
    'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  right: 'M9 5l7 7-7 7',
  left: 'M15 19l-7-7 7-7',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  chat: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
  key: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  check: 'M5 13l4 4L19 7',
  drop: 'M12 3s6 6.5 6 11a6 6 0 11-12 0c0-4.5 6-11 6-11z'
}

function Icon({ name, className = 'w-4 h-4' }: { name: string; className?: string }) {
  return (
    <svg className={`${className} shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={ICONS[name] || ''} />
    </svg>
  )
}

/* ───────────── أنماط مشتركة ───────────── */
const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/20'
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition cursor-pointer'
const btnPrimary = `${btnBase} bg-cyan-800 text-white hover:bg-cyan-900 shadow-sm`
const btnGhost = `${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`
const btnDanger = `${btnBase} bg-rose-600 text-white hover:bg-rose-700 shadow-sm`
const card = 'rounded-xl border border-slate-200 bg-white'
const iqd = (n: number) => n.toLocaleString('ar-IQ')

function Modal({
  title,
  onClose,
  children,
  footer
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div role="dialog" aria-modal="true" className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <button
            onClick={onClose}
            aria-label="إغلاق"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="space-y-4 px-6 py-5">{children}</div>
        <div className="flex justify-end gap-2 rounded-b-2xl bg-slate-50 px-6 py-4">{footer}</div>
      </div>
    </div>
  )
}

export default function DirectorDashboard({
  directorateData,
  onUpdateDirectorate,
  onVisitBranchManager,
  onLogout
}: DirectorDashboardProps) {
  // حالة التبويب النشط
  const [activeTab, setActiveTab] = useState<TabType>('branches')

  // طريقة العرض في دليل الأفرع
  const [branchViewMode, setBranchViewMode] = useState<ViewMode>('table')

  // الفرع المختار لفتح صفحته المستقلة
  const [activeBranchDetailId, setActiveBranchDetailId] = useState<string | null>(null)

  // البحث الموحد
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

  // التنقل بين التبويبات
  const goTo = (tab: TabType) => {
    setActiveTab(tab)
    setActiveBranchDetailId(null)
    setSearchQuery('')
  }

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

  // فتح نافذة مسؤول جديد
  const openAddManager = () => {
    setEditingManager(null)
    setManagerName('')
    setManagerPhone('')
    setShowAddManagerModal(true)
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

  // ترتيب الأفرع حسب الجباية
  const rankedStats = [...branchStats].sort((a, b) => b.collectedAmount - a.collectedAmount)
  const maxCollected = Math.max(...rankedStats.map(s => s.collectedAmount), 1)

  const navItems: { id: TabType; label: string; icon: string; badge?: number }[] = [
    { id: 'overview', label: 'الرئيسية', icon: 'home' },
    { id: 'branches', label: 'الأفرع وإدارتها', icon: 'building', badge: directorateData.branches.length },
    { id: 'reports', label: 'التقارير المالية', icon: 'chart' }
  ]

  const tabTitle =
    activeTab === 'overview' ? 'لوحة المتابعة' : activeTab === 'branches' ? 'دليل الأفرع' : 'التقارير المالية'

  return (
    <div className="dd-root flex min-h-screen flex-row bg-[#f2f6f7] text-slate-800 antialiased" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap');
        .dd-root, .dd-root input, .dd-root button { font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif; }
        .bg-cyan-800 { background-color: #155e75 !important; }
        .hover\\:bg-cyan-900:hover { background-color: #164e63 !important; }
        .bg-cyan-700 { background-color: #0e7490 !important; }
        .bg-cyan-50 { background-color: #ecfeff !important; }
        .text-cyan-800 { color: #155e75 !important; }
        .text-cyan-900 { color: #164e63 !important; }
        .text-cyan-700 { color: #0e7490 !important; }
        .text-cyan-300 { color: #67e8f9 !important; }
        .text-cyan-200 { color: #a5f3fc !important; }
        .text-cyan-100 { color: #cffafe !important; }
        .border-cyan-700 { border-color: #0e7490 !important; }
        .hover\\:border-cyan-700:hover { border-color: #0e7490 !important; }
        .focus\\:border-cyan-700:focus { border-color: #0e7490 !important; }
        @media (prefers-reduced-motion: reduce) { .dd-root * { transition: none !important; } }
      `}</style>

      {/* ───────────── القائمة الجانبية (مفتوحة دائماً وغير قابلة للإغلاق) ───────────── */}
      <aside
        style={{
          width: '270px',
          minWidth: '270px',
          backgroundColor: '#0a3340',
          color: '#f8fafc',
          borderLeft: '1px solid #134e5e'
        }}
        className="sticky top-0 h-screen shrink-0 flex flex-col justify-between z-40 shadow-xl"
      >
        <div>
          {/* ترويسة وهوية المديرية */}
          <div className="flex items-center justify-between px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-cyan-300 shadow-md"
                style={{ backgroundColor: 'rgba(34, 211, 238, 0.15)' }}
              >
                <Icon name="drop" className="w-5 h-5 text-cyan-300" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white tracking-tight">مديرية ماء البصرة</h1>
                <span className="text-xs font-semibold" style={{ color: '#a5f3fc' }}>إدارة الواردات المركزية</span>
              </div>
            </div>
          </div>

          {/* بطاقة هوية المدير العام */}
          <div
            className="mx-4 my-4 rounded-xl px-4 py-3.5"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.07)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-white">مدير عام الواردات</div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: '#064e3b', color: '#34d399', border: '1px solid #059669' }}
              >
                متصل
              </span>
            </div>
            <div className="mt-1 text-xs" style={{ color: '#cbd5e1' }}>محافظة البصرة • المقر العام</div>
          </div>

          {/* روابط التنقل الرئيسية */}
          <nav className="space-y-1.5 px-3">
            {navItems.map(item => {
              const active = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => goTo(item.id)}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-sm font-bold transition-all cursor-pointer"
                  style={{
                    backgroundColor: active ? '#155e75' : 'transparent',
                    color: active ? '#ffffff' : '#cbd5e1',
                    border: active ? '1px solid rgba(34, 211, 238, 0.3)' : '1px solid transparent',
                    boxShadow: active ? '0 4px 12px rgba(21, 94, 117, 0.3)' : 'none'
                  }}
                >
                  <span className="flex items-center gap-3">
                    <Icon name={item.icon} className={active ? 'text-white' : 'text-cyan-200/70'} />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span
                      className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                        color: '#ffffff'
                      }}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        {/* الجزء السفلي: إجمالي الجباية وزر تسجيل الخروج */}
        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            className="mb-3 rounded-xl p-3"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255, 255, 255, 0.05)' }}
          >
            <div className="text-[11px] font-medium" style={{ color: '#94a3b8' }}>إجمالي الجباية العامة</div>
            <div className="mt-0.5 text-base font-bold text-emerald-400">
              {iqd(totalCollectedAllBranches)} <span className="text-xs font-normal" style={{ color: '#94a3b8' }}>د.ع</span>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition cursor-pointer shadow-sm"
            style={{ backgroundColor: '#dc2626', border: '1px solid #ef4444' }}
          >
            <Icon name="logout" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* ───────────── منطقة العمل ───────────── */}
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        {/* الترويسة العلوية */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur md:px-8">
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-2 text-sm text-slate-500" aria-label="مسار الصفحة">
              <button onClick={() => goTo('overview')} className="transition hover:text-slate-900 cursor-pointer font-bold">
                المديرية
              </button>
              <span className="text-slate-300">/</span>
              <button
                onClick={() => activeBranchDetailId && setActiveBranchDetailId(null)}
                className={`cursor-pointer ${activeBranchDetailId ? 'transition hover:text-slate-900' : 'font-bold text-slate-900'}`}
              >
                {tabTitle}
              </button>
              {activeBranch && (
                <>
                  <span className="text-slate-300">/</span>
                  <span className="font-bold text-cyan-800">{activeBranch.name}</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex w-56 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition focus-within:border-cyan-700 focus-within:bg-white sm:w-72">
              <Icon name="search" className="w-4 h-4 text-slate-400" />
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
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-xs font-bold text-slate-800 placeholder-slate-400 outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} aria-label="مسح البحث" className="text-slate-400 hover:text-slate-600">
                  <Icon name="close" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {activeTab === 'branches' && !activeBranch && (
              <button onClick={() => setShowAddBranchModal(true)} className={btnPrimary}>
                <Icon name="plus" />
                <span className="hidden sm:inline">إضافة فرع جديد</span>
              </button>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 md:p-8">
          {/* ═════════ الرئيسية ═════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* اللوحة الرئيسية: الجباية + ترتيب الأفرع */}
              <section
                className="grid gap-px overflow-hidden rounded-2xl text-white shadow-sm lg:grid-cols-5"
                style={{ backgroundColor: '#0a3340' }}
              >
                <div className="p-6 md:p-8 lg:col-span-2">
                  <p className="text-sm font-semibold" style={{ color: '#cffafe' }}>إجمالي الجباية المستحصلة • العام المالي 2026</p>
                  <div className="mt-3 text-3xl font-bold leading-tight md:text-4xl text-white">{iqd(totalCollectedAllBranches)}</div>
                  <div className="mt-1 text-sm font-bold" style={{ color: '#a5f3fc' }}>دينار عراقي</div>
                  <p className="mt-5 max-w-xs text-xs leading-relaxed text-slate-200 font-medium">
                    مجموع ما سُدد من المشتركين وما سُلّم عبر الإرساليات في {directorateData.branches.length} أفرع على مستوى محافظة البصرة.
                  </p>
                </div>

                <div className="p-6 md:p-8 lg:col-span-3" style={{ backgroundColor: 'rgba(0, 0, 0, 0.2)' }}>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-sm font-bold text-white">ترتيب الأفرع حسب الجباية</h2>
                    <button onClick={() => goTo('reports')} className="inline-flex items-center gap-1 text-xs font-bold transition hover:text-white cursor-pointer" style={{ color: '#a5f3fc' }}>
                      التقرير المالي الكامل
                      <Icon name="left" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="space-y-3.5">
                    {rankedStats.slice(0, 6).map(s => (
                      <div key={s.branchId}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="text-slate-100 font-semibold">{s.name}</span>
                          <span className="font-bold text-white">{iqd(s.collectedAmount)} د.ع</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(Math.round((s.collectedAmount / maxCollected) * 100), 2)}%`,
                              backgroundColor: '#67e8f9'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {rankedStats.length === 0 && <p className="text-sm text-slate-300">لا توجد أفرع بعد.</p>}
                  </div>
                </div>
              </section>

              {/* المؤشرات الأربعة */}
              <section className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 shadow-xs lg:grid-cols-4">
                {[
                  { label: 'المشتركون', value: iqd(totalSubscribersAllBranches), note: `في ${directorateData.branches.length} أفرع`, icon: 'users' },
                  { label: 'الأفرع المائية', value: iqd(directorateData.branches.length), note: `تغطي ${totalAreasAllBranches} منطقة مائية`, icon: 'building' },
                  { label: 'مسؤولو الأفرع', value: iqd(totalManagersAllBranches), note: 'حسابات إدارية فعالة', icon: 'key' },
                  { label: 'المحصّلون', value: iqd(totalCollectorsAllBranches), note: 'كادر الجباية الميداني', icon: 'users' }
                ].map(m => (
                  <div key={m.label} className="bg-white p-5">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Icon name={m.icon} className="w-4 h-4 text-cyan-700" />
                      <span className="text-xs font-bold">{m.label}</span>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-slate-900">{m.value}</div>
                    <div className="mt-0.5 text-xs text-slate-500 font-medium">{m.note}</div>
                  </div>
                ))}
              </section>

              {/* الانتقال السريع */}
              <section className="grid gap-4 md:grid-cols-2">
                <button onClick={() => goTo('branches')} className={`${card} group flex items-center justify-between p-6 text-right transition hover:border-cyan-700 hover:shadow-sm cursor-pointer`}>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">دليل الأفرع والمسؤولين</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">استعراض كافة فروع المحافظة، تعيين مسؤولي الأفرع، وإنشاء روابط الحسابات المباشرة عبر واتساب.</p>
                  </div>
                  <Icon name="left" className="w-5 h-5 text-slate-400 transition group-hover:text-cyan-800" />
                </button>
                <button onClick={() => goTo('reports')} className={`${card} group flex items-center justify-between p-6 text-right transition hover:border-cyan-700 hover:shadow-sm cursor-pointer`}>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">التقارير المالية الموحدة</h3>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">مقارنة تحصيل الإيرادات بين الأفرع ومتابعة مؤشرات الجباية الشهرية والسنوية.</p>
                  </div>
                  <Icon name="left" className="w-5 h-5 text-slate-400 transition group-hover:text-cyan-800" />
                </button>
              </section>
            </div>
          )}

          {/* ═════════ دليل الأفرع ═════════ */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {!activeBranch ? (
                <div className="space-y-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">أفرع مديرية ماء البصرة ({filteredBranches.length})</h2>
                      <p className="text-xs text-slate-500 font-medium">اختر فرعاً لفتح سجله الإداري وإدارة مسؤوليه ومناطقه.</p>
                    </div>
                    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
                      {(['table', 'cards'] as ViewMode[]).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setBranchViewMode(mode)}
                          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition cursor-pointer ${
                            branchViewMode === mode ? 'bg-cyan-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {mode === 'table' ? 'جدول رسمي' : 'بطاقات'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {branchViewMode === 'table' ? (
                    <div className={`${card} overflow-hidden shadow-xs`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                              <th className="p-4 font-bold">اسم الفرع</th>
                              <th className="p-4 font-bold">المشتركون</th>
                              <th className="p-4 font-bold">المناطق المائية</th>
                              <th className="p-4 font-bold">المسؤولون</th>
                              <th className="p-4 font-bold">المحصّلون</th>
                              <th className="p-4 text-center font-bold">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredBranches.map(branch => (
                              <tr
                                key={branch.id}
                                className="cursor-pointer transition hover:bg-cyan-50/50"
                                onClick={() => setActiveBranchDetailId(branch.id)}
                              >
                                <td className="p-4">
                                  <div className="font-bold text-slate-900 text-sm">{branch.name}</div>
                                  <div className="text-[10px] text-slate-400">كود: {branch.id.replace('branch_', '')}</div>
                                </td>
                                <td className="p-4 text-slate-700 font-bold">{iqd(branch.subscribers?.length || 0)} مشترك</td>
                                <td className="p-4 text-slate-700">{branch.areas?.length || 0} منطقة</td>
                                <td className="p-4">
                                  <span className="rounded-md bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-900">
                                    {branch.managers?.length || 0} مسؤول
                                  </span>
                                </td>
                                <td className="p-4 text-slate-700">{branch.collectors?.length || 0} محصل</td>
                                <td className="p-4 text-center">
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      setActiveBranchDetailId(branch.id)
                                    }}
                                    className={`${btnGhost} !px-3 !py-1.5`}
                                  >
                                    إدارة الفرع
                                    <Icon name="left" className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {filteredBranches.map(branch => (
                        <div
                          key={branch.id}
                          onClick={() => setActiveBranchDetailId(branch.id)}
                          className={`${card} flex flex-col justify-between gap-4 p-5 text-right transition hover:border-cyan-700 hover:shadow-md cursor-pointer`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-bold text-slate-900">{branch.name}</h3>
                              <p className="mt-0.5 text-xs text-slate-400">كود: {branch.id.replace('branch_', '')}</p>
                            </div>
                            <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-900">
                              {iqd(branch.subscribers?.length || 0)} مشترك
                            </span>
                          </div>
                          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 rounded-xl bg-slate-50 py-3 text-center border border-slate-100">
                            <div>
                              <div className="text-[11px] text-slate-500 font-medium">المناطق</div>
                              <div className="mt-0.5 font-bold text-slate-900 text-sm">{branch.areas?.length || 0}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-slate-500 font-medium">المحصّلون</div>
                              <div className="mt-0.5 font-bold text-slate-900 text-sm">{branch.collectors?.length || 0}</div>
                            </div>
                            <div>
                              <div className="text-[11px] text-slate-500 font-medium">المسؤولون</div>
                              <div className="mt-0.5 font-bold text-cyan-800 text-sm">{branch.managers?.length || 0}</div>
                            </div>
                          </div>
                          <button className={`${btnPrimary} w-full !py-2 text-xs`}>
                            فتح سجل الفرع
                            <Icon name="left" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {filteredBranches.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
                      <p className="text-sm font-bold text-slate-600">لا يوجد فرع يطابق معايير البحث</p>
                      <p className="mt-1 text-xs text-slate-400">جرّب كتابة اسم آخر أو أضف فرعاً جديداً.</p>
                    </div>
                  )}
                </div>
              ) : (
                /* ───── صفحة الفرع المستقلة ───── */
                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button onClick={() => setActiveBranchDetailId(null)} className={btnGhost}>
                      <Icon name="right" />
                      العودة إلى كافة الأفرع
                    </button>
                    <div className="flex items-center gap-2">
                      <button onClick={openAddManager} className={btnPrimary}>
                        <Icon name="plus" />
                        إضافة مسؤول
                      </button>
                      <button onClick={() => handleDeleteBranch(activeBranch.id, activeBranch.name)} className={btnDanger}>
                        <Icon name="trash" />
                        <span>حذف الفرع</span>
                      </button>
                    </div>
                  </div>

                  <section className={`${card} overflow-hidden shadow-xs`}>
                    <div className="border-b border-slate-100 p-6">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-bold text-slate-900">{activeBranch.name}</h3>
                        <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-900">
                          {iqd(activeBranch.subscribers?.length || 0)} مشترك
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500 font-medium">
                        تاريخ الإنشاء: {new Date(activeBranch.createdAt).toLocaleDateString('ar-IQ')} • كود النظام: {activeBranch.id}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-slate-100 sm:grid-cols-4">
                      {[
                        { l: 'المناطق المائية', v: activeBranch.areas?.length || 0 },
                        { l: 'المحصّلون الميدانيون', v: activeBranch.collectors?.length || 0 },
                        { l: 'الكتّاب الإداريون', v: activeBranch.writers?.length || 0 },
                        { l: 'مسؤولو الفرع', v: activeBranch.managers?.length || 0 }
                      ].map(x => (
                        <div key={x.l} className="bg-white p-5">
                          <div className="text-xs text-slate-500 font-medium">{x.l}</div>
                          <div className="mt-1 text-2xl font-bold text-slate-900">{x.v}</div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className={`${card} overflow-hidden shadow-xs`}>
                    <div className="border-b border-slate-100 p-5 flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-slate-900">مسؤولو الفرع ({filteredManagers.length})</h4>
                        <p className="mt-0.5 text-xs text-slate-500 font-medium">لكل مسؤول حساب وصلاحيات لإدارة شؤون هذا الفرع.</p>
                      </div>
                    </div>

                    {filteredManagers.length === 0 ? (
                      <div className="py-12 text-center bg-slate-50/50">
                        <p className="text-xs font-bold text-slate-600">لا يوجد مسؤولون مسجلون في هذا الفرع حالياً</p>
                        <button onClick={openAddManager} className={`${btnPrimary} mt-4`}>
                          <Icon name="plus" />
                          إضافة أول مسؤول
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                              <th className="p-4 font-bold">اسم المسؤول</th>
                              <th className="p-4 font-bold">رقم الهاتف</th>
                              <th className="p-4 font-bold">تاريخ التعيين</th>
                              <th className="p-4 text-center font-bold">الإجراءات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {filteredManagers.map(manager => (
                              <tr key={manager.id} className="transition hover:bg-slate-50">
                                <td className="p-4">
                                  <div className="font-bold text-slate-900 text-sm">{manager.name}</div>
                                  <div className="text-[10px] text-slate-400">معرّف: {manager.id}</div>
                                </td>
                                <td className="p-4 font-bold text-slate-700">
                                  <span dir="ltr" className="inline-block">{manager.phone}</span>
                                </td>
                                <td className="p-4 text-slate-500">
                                  {manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('ar-IQ') : '—'}
                                </td>
                                <td className="p-4">
                                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => onVisitBranchManager(activeBranch, manager)}
                                      className={`${btnPrimary} !px-3 !py-1.5`}
                                      title="دخول لحساب المسؤول"
                                    >
                                      دخول
                                    </button>
                                    <button
                                      onClick={() => handleShareManagerWhatsApp(manager, activeBranch)}
                                      className={`${btnBase} !px-3 !py-1.5 text-white shadow-sm cursor-pointer`}
                                      style={{ backgroundColor: '#15803d' }}
                                      title="إرسال الرابط عبر واتساب"
                                    >
                                      <Icon name="chat" className="w-3.5 h-3.5" />
                                      واتساب
                                    </button>
                                    <button
                                      onClick={() => handleCopyManagerLink(manager, activeBranch)}
                                      className={`${btnGhost} !px-3 !py-1.5`}
                                      title="نسخ رابط الدخول المباشر"
                                    >
                                      <Icon name={copiedManagerId === manager.id ? 'check' : 'copy'} className="w-3.5 h-3.5" />
                                      {copiedManagerId === manager.id ? 'تم النسخ' : 'نسخ'}
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingManager(manager)
                                        setManagerName(manager.name)
                                        setManagerPhone(manager.phone)
                                        setShowAddManagerModal(true)
                                      }}
                                      className={`${btnGhost} !px-2.5 !py-1.5`}
                                      title="تعديل البيانات"
                                      aria-label="تعديل"
                                    >
                                      <Icon name="edit" className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteManager(manager.id, manager.name)}
                                      className={`${btnBase} !px-2.5 !py-1.5 border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer`}
                                      title="إزالة المسؤول"
                                      aria-label="حذف"
                                    >
                                      <Icon name="trash" className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </div>
              )}
            </div>
          )}

          {/* ═════════ التقارير المالية ═════════ */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">تقرير الجباية والتحصيل المالي الموحد</h2>
                  <p className="text-xs text-slate-500 font-medium">إحصائيات إيرادات الاشتراكات لمديرية ماء البصرة.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">السنة المالية:</span>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-xs">
                    {[2026, 2027, 2028].map(yr => (
                      <button
                        key={yr}
                        onClick={() => setReportYear(yr)}
                        className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          reportYear === yr ? 'bg-cyan-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <section className={`${card} p-6 shadow-xs`}>
                <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-4">
                  <h4 className="text-base font-bold text-slate-900">مقارنة أداء الفروع في التحصيل</h4>
                  <span className="text-xs font-bold text-slate-600">
                    الإجمالي العام: <strong className="text-emerald-700 text-sm font-black">{iqd(totalCollectedAllBranches)} د.ع</strong>
                  </span>
                </div>
                <div className="space-y-4">
                  {filteredReportStats.map(stat => {
                    const maxVal = Math.max(...filteredReportStats.map(s => s.collectedAmount), 1)
                    const percent = Math.min(100, Math.round((stat.collectedAmount / maxVal) * 100))
                    return (
                      <div key={stat.branchId}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-900">{stat.name}</span>
                          <span className="font-bold text-emerald-700">{iqd(stat.collectedAmount)} د.ع</span>
                        </div>
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 border border-slate-200">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(percent, 2)}%`,
                              backgroundColor: '#0e7490'
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                  {filteredReportStats.length === 0 && (
                    <p className="py-6 text-center text-xs text-slate-500">لا يوجد فرع يطابق معايير البحث</p>
                  )}
                </div>
              </section>

              <section className={`${card} overflow-hidden shadow-xs`}>
                <div className="border-b border-slate-100 p-5">
                  <h4 className="text-base font-bold text-slate-900">الجدول المالي المفصل</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700">
                        <th className="p-4 font-bold">اسم الفرع</th>
                        <th className="p-4 font-bold">المشتركون</th>
                        <th className="p-4 font-bold">المسؤولون</th>
                        <th className="p-4 font-bold">المحصّلون</th>
                        <th className="p-4 font-bold">المبالغ المستحصلة</th>
                        <th className="p-4 font-bold">نسبة التحصيل</th>
                        <th className="p-4 text-center font-bold">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredReportStats.map(s => (
                        <tr key={s.branchId} className="transition hover:bg-slate-50">
                          <td className="p-4 font-bold text-slate-900 text-sm">{s.name}</td>
                          <td className="p-4 text-slate-700">{iqd(s.subscribersCount)}</td>
                          <td className="p-4 text-slate-700">{s.managersCount}</td>
                          <td className="p-4 text-slate-700">{s.collectorsCount}</td>
                          <td className="p-4 font-bold text-emerald-700">{iqd(s.collectedAmount)} د.ع</td>
                          <td className="p-4 text-slate-500 font-bold">
                            {totalCollectedAllBranches > 0
                              ? `${Math.round((s.collectedAmount / totalCollectedAllBranches) * 100)}%`
                              : '0%'}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                setActiveTab('branches')
                                setActiveBranchDetailId(s.branchId)
                              }}
                              className={`${btnGhost} !px-3 !py-1.5`}
                            >
                              عرض الفرع
                              <Icon name="left" className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* ───────────── النوافذ المنبثقة ───────────── */}
      {showAddBranchModal && (
        <Modal
          title="إضافة فرع واردات جديد"
          onClose={() => setShowAddBranchModal(false)}
          footer={
            <>
              <button onClick={() => setShowAddBranchModal(false)} className={btnGhost}>
                إلغاء
              </button>
              <button onClick={handleAddBranch} className={btnPrimary}>
                تأكيد الإضافة
              </button>
            </>
          }
        >
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">اسم الفرع الجديد:</label>
            <input
              type="text"
              placeholder="مثال: فرع واردات القرنة"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>
        </Modal>
      )}

      {showAddManagerModal && (
        <Modal
          title={editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ (${activeBranch?.name})`}
          onClose={() => {
            setShowAddManagerModal(false)
            setEditingManager(null)
          }}
          footer={
            <>
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className={btnGhost}
              >
                إلغاء
              </button>
              <button onClick={handleSaveManager} className={btnPrimary}>
                حفظ البيانات
              </button>
            </>
          }
        >
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">الاسم الثلاثي:</label>
            <input
              type="text"
              placeholder="مثال: أحمد عبد الحسين علي"
              value={managerName}
              onChange={e => setManagerName(e.target.value)}
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-slate-700">رقم الهاتف:</label>
            <input
              type="text"
              placeholder="مثال: 07701234567"
              value={managerPhone}
              onChange={e => setManagerPhone(e.target.value)}
              className={`${inputCls} text-right`}
              dir="ltr"
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
