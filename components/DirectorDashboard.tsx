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
  const [activeTab, setActiveTab] = useState<TabType>('branches')
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [branchViewMode, setBranchViewMode] = useState<ViewMode>('table')
  const [activeBranchDetailId, setActiveBranchDetailId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedManagerId, setCopiedManagerId] = useState<string | null>(null)
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [showAddManagerModal, setShowAddManagerModal] = useState(false)
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  const [reportYear, setReportYear] = useState<number>(2026)

  const activeBranch = useMemo(() => {
    if (!activeBranchDetailId) return null
    return directorateData.branches.find(b => b.id === activeBranchDetailId) || null
  }, [activeBranchDetailId, directorateData.branches])

  const handleAddBranch = () => {
    if (!newBranchName.trim()) { alert('يرجى كتابة اسم الفرع'); return }
    const newBranch: DirectorateBranch = {
      id: 'branch_' + Date.now().toString(36),
      name: newBranchName.trim(),
      createdAt: new Date().toISOString(),
      managers: [], collectors: [], writers: [], treasuryManagers: [], areas: [], subscribers: [], billing: {}, consignments: []
    }
    onUpdateDirectorate({ ...directorateData, branches: [...directorateData.branches, newBranch] })
    setNewBranchName(''); setShowAddBranchModal(false); setActiveBranchDetailId(newBranch.id)
  }

  const handleDeleteBranch = (branchId: string, branchName: string) => {
    if (directorateData.branches.length <= 1) { alert('لا يمكن حذف الفرع الأخير في المديرية'); return }
    if (confirm(`هل أنت متأكد من حذف (${branchName}) نهائياً مع كافة السجلات؟`)) {
      onUpdateDirectorate({ ...directorateData, branches: directorateData.branches.filter(b => b.id !== branchId) })
      setActiveBranchDetailId(null)
    }
  }

  const handleSaveManager = () => {
    if (!managerName.trim() || !managerPhone.trim()) { alert('يرجى إدخال اسم ورقم هاتف المسؤول'); return }
    if (!activeBranch) return
    let updatedManagers = [...(activeBranch.managers || [])]
    if (editingManager) {
      updatedManagers = updatedManagers.map(m => m.id === editingManager.id ? { ...m, name: managerName.trim(), phone: managerPhone.trim() } : m)
    } else {
      updatedManagers.push({ id: 'mgr_' + Date.now().toString(36), name: managerName.trim(), phone: managerPhone.trim(), token: generateSecureToken('mgr'), createdAt: new Date().toISOString() })
    }
    onUpdateDirectorate({ ...directorateData, branches: directorateData.branches.map(b => b.id === activeBranch.id ? { ...b, managers: updatedManagers } : b) })
    setShowAddManagerModal(false); setEditingManager(null); setManagerName(''); setManagerPhone('')
  }

  const handleDeleteManager = (managerId: string, name: string) => {
    if (!activeBranch) return
    if (confirm(`هل أنت متأكد من إزالة المسؤول (${name}) من هذا الفرع؟`)) {
      const updatedManagers = (activeBranch.managers || []).filter(m => m.id !== managerId)
      onUpdateDirectorate({ ...directorateData, branches: directorateData.branches.map(b => b.id === activeBranch.id ? { ...b, managers: updatedManagers } : b) })
    }
  }

  const handleShareManagerWhatsApp = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    const msg = `السلام عليكم\nالأستاذ ${manager.name} المحترم\nمسؤول فرع: ${branch.name}\n\nرابط الدخول المباشر:\n${directLink}`
    window.open(generateWhatsAppLink(manager.phone, msg), '_blank')
  }

  const handleCopyManagerLink = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    navigator.clipboard?.writeText(directLink).then(() => { setCopiedManagerId(manager.id); setTimeout(() => setCopiedManagerId(null), 2500) })
  }

  const totalSubscribersAllBranches = directorateData.branches.reduce((sum, b) => sum + (b.subscribers?.length || 0), 0)
  const totalCollectorsAllBranches = directorateData.branches.reduce((sum, b) => sum + (b.collectors?.length || 0), 0)
  const totalManagersAllBranches = directorateData.branches.reduce((sum, b) => sum + (b.managers?.length || 0), 0)
  const totalAreasAllBranches = directorateData.branches.reduce((sum, b) => sum + (b.areas?.length || 0), 0)

  const branchStats = directorateData.branches.map(b => {
    let collectedAmount = 0
    if (b.billing) {
      Object.values(b.billing).forEach((yearObj: any) => {
        if (yearObj && typeof yearObj === 'object') {
          Object.values(yearObj).forEach((periods: any) => {
            if (Array.isArray(periods)) periods.forEach((p: any) => { if (p?.paid) collectedAmount += Number(p.paid) })
          })
        }
      })
    }
    if (b.consignments) b.consignments.forEach(c => { if (c.totalAmount) collectedAmount += c.totalAmount })
    return { branchId: b.id, name: b.name, subscribersCount: b.subscribers?.length || 0, areasCount: b.areas?.length || 0, managersCount: b.managers?.length || 0, collectorsCount: b.collectors?.length || 0, collectedAmount }
  })
  const totalCollectedAllBranches = branchStats.reduce((s, b) => s + b.collectedAmount, 0)

  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return directorateData.branches
    return directorateData.branches.filter(b => b.name.toLowerCase().includes(q))
  }, [searchQuery, directorateData.branches])

  const filteredManagers = useMemo(() => {
    if (!activeBranch) return []
    const q = searchQuery.trim().toLowerCase()
    if (!q) return activeBranch.managers || []
    return (activeBranch.managers || []).filter(m => m.name.toLowerCase().includes(q) || m.phone.includes(q))
  }, [activeBranch, searchQuery])

  const filteredReportStats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return branchStats
    return branchStats.filter(s => s.name.toLowerCase().includes(q))
  }, [searchQuery, branchStats])

  return (
    <div dir="rtl" className="min-h-screen bg-[#f6f7fb] text-slate-800 font-sans flex antialiased selection:bg-blue-600 selection:text-white">
      {/* SIDEBAR - ثابت ومفتوح دائماً وغير قابل للإغلاق مع ألوان داكنة ملكية واضحة جداً */}
      <aside
        style={{
          width: '270px',
          minWidth: '270px',
          backgroundColor: '#0b1329',
          color: '#ffffff',
          borderLeft: '1px solid #1e293b'
        }}
        className="shrink-0 sticky top-0 h-screen flex flex-col z-40 shadow-xl"
      >
        <div className="h-full flex flex-col w-full">
          {/* ترويسة وهوية المديرية */}
          <div className="p-6" style={{ borderBottom: '1px solid #1e293b' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
                style={{ backgroundColor: '#2563eb' }}
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="font-black text-sm tracking-tight text-white">مديرية ماء البصرة</h1>
                <p className="text-xs font-bold mt-0.5" style={{ color: '#38bdf8' }}>نظام إدارة الواردات المركزي</p>
              </div>
            </div>

            {/* بطاقة هوية المدير العام */}
            <div
              className="mt-5 p-4 rounded-2xl"
              style={{ backgroundColor: '#15203b', border: '1px solid #233252' }}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-white">المدير العام</p>
                <span
                  className="text-[10px] px-2.5 py-1 rounded-full font-black"
                  style={{ backgroundColor: '#064e3b', color: '#34d399', border: '1px solid #059669' }}
                >
                  متصل الآن
                </span>
              </div>
              <p className="text-xs mt-2 font-medium" style={{ color: '#94a3b8' }}>
                صلاحيات كاملة • عرض شامل للمديرية
              </p>
              <div className="mt-3 h-px" style={{ backgroundColor: '#233252' }} />
              <div className="mt-3 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold" style={{ color: '#94a3b8' }}>إجمالي الجباية</p>
                  <p className="text-xs font-black mt-1" style={{ color: '#34d399' }}>
                    {totalCollectedAllBranches.toLocaleString('ar-IQ')} <small className="text-[10px] text-slate-400">د.ع</small>
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-bold" style={{ color: '#94a3b8' }}>الأفرع</p>
                  <p className="text-xs font-black text-white mt-1">{directorateData.branches.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* روابط التنقل الرئيسية */}
          <nav className="p-4 space-y-2 flex-1">
            <p className="px-3 text-[10px] font-black tracking-widest uppercase mb-2" style={{ color: '#64748b' }}>
              القائمة الرئيسية
            </p>
            {[
              { id: 'overview', label: 'لوحة المتابعة', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', count: null },
              { id: 'branches', label: 'دليل الأفرع', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4', count: directorateData.branches.length },
              { id: 'reports', label: 'التقارير المالية', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', count: null },
            ].map(item => {
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as TabType); setActiveBranchDetailId(null); setSearchQuery('') }}
                  className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-black transition-all"
                  style={{
                    backgroundColor: isActive ? '#2563eb' : 'transparent',
                    color: isActive ? '#ffffff' : '#cbd5e1',
                    border: isActive ? '1px solid #3b82f6' : '1px solid transparent',
                    boxShadow: isActive ? '0 4px 14px rgba(37, 99, 235, 0.3)' : 'none'
                  }}
                >
                  <span className="flex items-center gap-3">
                    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                    </svg>
                    <span>{item.label}</span>
                  </span>
                  {item.count !== null && (
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-black"
                      style={{
                        backgroundColor: isActive ? '#1d4ed8' : '#1e293b',
                        color: '#ffffff'
                      }}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* زر تسجيل الخروج في الأسفل */}
          <div className="p-4 mt-auto" style={{ borderTop: '1px solid #1e293b' }}>
            <button
              onClick={onLogout}
              className="w-full py-3 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 shadow-md"
              style={{
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: '1px solid #ef4444'
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 backdrop-blur-xl bg-white/80 border-b border-slate-200/60">
          <div className="px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <span className="text-slate-900 font-black">المديرية</span><span>/</span>
                <span className="text-slate-900">{activeTab === 'overview' ? 'لوحة المتابعة' : activeTab === 'branches' ? 'دليل الأفرع' : 'التقارير'}</span>
                {activeBranch && <><span>/</span><span className="text-blue-600 font-black">{activeBranch.name}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <svg className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={activeBranch ? `بحث في ${activeBranch.name}...` : 'ابحث عن فرع، مسؤول...'} className="w-64 sm:w-72 h-11 pr-10 pl-4 rounded-2xl bg-slate-100 border border-transparent focus:bg-white focus:border-slate-200 focus:ring-4 focus:ring-slate-100 text-xs font-bold outline-none transition" />
                {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 text-xs">✕</button>}
              </div>
              {activeTab === 'branches' && !activeBranch && (
                <button onClick={() => setShowAddBranchModal(true)} className="h-11 px-5 rounded-2xl bg-slate-900 text-white text-xs font-black shadow-sm hover:bg-black transition">+ فرع جديد</button>
              )}
            </div>
          </div>
        </header>

        <main className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
          {activeTab === 'overview' && (
            <>
              <div className="rounded-2xl bg-white border border-slate-200 p-7 flex flex-col lg:flex-row justify-between gap-6 shadow-sm">
                <div><h2 className="text-xl font-black tracking-tight">نظام المتابعة المركزي</h2><p className="text-xs text-slate-500 font-medium mt-2">مديرية ماء البصرة • مؤشرات الأداء اللحظية للواردات والجباية</p></div>
                <div className="flex items-center gap-2"><span className="px-4 h-9 flex items-center rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-xs font-black">السنة المالية 2026</span><span className="px-4 h-9 flex items-center rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black">● النظام نشط</span></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                {[
                  { label: 'إجمالي المشتركين', value: totalSubscribersAllBranches.toLocaleString('ar-IQ'), sub: `${directorateData.branches.length} فروع نشطة`, grad: 'from-blue-600 to-indigo-600' },
                  { label: 'المبالغ المستحصلة', value: `${totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع`, sub: 'إجمالي الإيرادات المودعة', grad: 'from-emerald-600 to-teal-600' },
                  { label: 'المناطق المغطاة', value: totalAreasAllBranches, sub: `${directorateData.branches.length} فرع`, grad: 'from-violet-600 to-purple-600' },
                  { label: 'الكوادر', value: totalManagersAllBranches + totalCollectorsAllBranches, sub: `${totalManagersAllBranches} مسؤول • ${totalCollectorsAllBranches} جابي`, grad: 'from-amber-600 to-orange-600' },
                ].map((c, i) => (
                  <div key={i} className="group relative overflow-hidden rounded-2xl bg-white border border-slate-200 p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    <div className={`absolute top-0 right-0 w-full h-1 bg-gradient-to-r ${c.grad}`} />
                    <p className="text-xs font-black tracking-widest text-slate-400">{c.label}</p>
                    <p className="text-2xl font-black mt-3 tracking-tight">{c.value}</p>
                    <p className="text-xs font-bold text-slate-500 mt-2">{c.sub}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white p-7 flex flex-col justify-between min-h-[180px]">
                  <div><h3 className="font-black text-base">دليل الأفرع والمسؤولين</h3><p className="text-xs text-white/60 leading-relaxed mt-2 max-w-md">إدارة فروع المحافظة، تعيين المسؤولين، وإنشاء روابط الدخول المباشر عبر واتساب.</p></div>
                  <button onClick={() => setActiveTab('branches')} className="mt-6 self-start px-5 h-11 rounded-xl bg-white text-slate-900 text-xs font-black">فتح الدليل ←</button>
                </div>
                <div className="rounded-2xl bg-white border border-slate-200 p-7 flex flex-col justify-between min-h-[180px]">
                  <div><h3 className="font-black text-base">التقارير المالية الموحدة</h3><p className="text-xs text-slate-500 leading-relaxed mt-2 max-w-md">مقارنة الأداء بين الأفرع ومتابعة الجباية الشهرية والسنوية بلوحات تحليلية.</p></div>
                  <button onClick={() => setActiveTab('reports')} className="mt-6 self-start px-5 h-11 rounded-xl bg-slate-900 text-white text-xs font-black">عرض التقارير ←</button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'branches' && !activeBranch && (
            <div className="space-y-5">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4">
                <div><h2 className="font-black text-base">فروع المديرية ({filteredBranches.length})</h2><p className="text-xs text-slate-500 mt-1">انقر على أي فرع لفتح سجله الإداري</p></div>
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  <button onClick={() => setBranchViewMode('table')} className={`px-4 h-8 rounded-lg text-xs font-black transition ${branchViewMode === 'table' ? 'bg-white shadow' : 'text-slate-500'}`}>جدول</button>
                  <button onClick={() => setBranchViewMode('cards')} className={`px-4 h-8 rounded-lg text-xs font-black transition ${branchViewMode === 'cards' ? 'bg-white shadow' : 'text-slate-500'}`}>بطاقات</button>
                </div>
              </div>

              {branchViewMode === 'table' ? (
                <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-xs font-black tracking-widest text-slate-500"><tr><th className="p-4">الفرع</th><th className="p-4">مشتركين</th><th className="p-4">مناطق</th><th className="p-4">مسؤولين</th><th className="p-4">جباة</th><th className="p-4 text-center">إجراء</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredBranches.map(b => (
                          <tr key={b.id} onClick={() => setActiveBranchDetailId(b.id)} className="hover:bg-slate-50/70 cursor-pointer transition">
                            <td className="p-4"><p className="font-black">{b.name}</p><p className="text-xs text-slate-400 mt-1">{b.id.slice(0, 12)}</p></td>
                            <td className="p-4 font-bold">{b.subscribers?.length || 0}</td>
                            <td className="p-4 font-bold">{b.areas?.length || 0}</td>
                            <td className="p-4"><span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black">{b.managers?.length || 0}</span></td>
                            <td className="p-4 font-bold">{b.collectors?.length || 0}</td>
                            <td className="p-4 text-center"><span className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-black">إدارة ←</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredBranches.map(b => (
                    <div key={b.id} onClick={() => setActiveBranchDetailId(b.id)} className="group rounded-2xl bg-white border border-slate-200 p-6 hover:shadow-xl hover:-translate-y-1 cursor-pointer transition-all">
                      <div className="flex justify-between items-start"><div><h3 className="font-black text-base">{b.name}</h3><p className="text-xs text-slate-400 mt-1">{b.subscribers?.length || 0} مشترك • {b.areas?.length || 0} منطقة</p></div><div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition">↗</div></div>
                      <div className="mt-5 grid grid-cols-3 gap-2">
                        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">مسؤولين</p><p className="font-black mt-1">{b.managers?.length || 0}</p></div>
                        <div className="rounded-xl bg-slate-50 p-3 text-center"><p className="text-xs text-slate-500">جباة</p><p className="font-black mt-1">{b.collectors?.length || 0}</p></div>
                        <div className="rounded-xl bg-blue-50 p-3 text-center"><p className="text-xs text-blue-600">مشتركين</p><p className="font-black mt-1 text-blue-700">{b.subscribers?.length || 0}</p></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'branches' && activeBranch && (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setActiveBranchDetailId(null)} className="h-11 px-5 rounded-xl bg-white border border-slate-200 text-xs font-black">→ العودة للدليل</button>
                <button onClick={() => { setEditingManager(null); setManagerName(''); setManagerPhone(''); setShowAddManagerModal(true) }} className="h-11 px-5 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-sm">+ إضافة مسؤول</button>
                <button onClick={() => handleDeleteBranch(activeBranch.id, activeBranch.name)} className="h-11 px-5 rounded-xl bg-red-50 text-red-700 border border-red-200 text-xs font-black">حذف الفرع</button>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 p-7 shadow-sm">
                <div className="flex justify-between gap-4 flex-wrap"><div><h3 className="text-xl font-black">{activeBranch.name}</h3><p className="text-xs text-slate-500 mt-1">كود النظام: {activeBranch.id} • تاريخ الإنشاء {new Date(activeBranch.createdAt).toLocaleDateString('ar-IQ')}</p></div><span className="px-4 h-8 flex items-center rounded-full bg-slate-900 text-white text-xs font-black">{activeBranch.subscribers?.length || 0} مشترك</span></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                  {[{ l: 'المناطق', v: activeBranch.areas?.length || 0 }, { l: 'الجباة', v: activeBranch.collectors?.length || 0 }, { l: 'الكتاب', v: activeBranch.writers?.length || 0 }, { l: 'المسؤولين', v: activeBranch.managers?.length || 0 }].map(x => (
                    <div key={x.l} className="rounded-2xl bg-slate-50 border border-slate-200 p-4"><p className="text-xs text-slate-500 font-bold">{x.l}</p><p className="text-xl font-black mt-1">{x.v}</p></div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-6 flex justify-between items-center border-b"><h4 className="font-black text-base">مسؤولو الفرع ({filteredManagers.length})</h4></div>
                {filteredManagers.length === 0 ? (
                  <div className="p-12 text-center"><p className="text-xs font-bold text-slate-500">لا يوجد مسؤولون حالياً</p><button onClick={() => setShowAddManagerModal(true)} className="mt-4 px-5 h-10 rounded-xl bg-slate-900 text-white text-xs font-black">إضافة مسؤول</button></div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs"><thead className="bg-slate-50 text-xs text-slate-500 font-black"><tr><th className="p-4">المسؤول</th><th className="p-4">الهاتف</th><th className="p-4">التعيين</th><th className="p-4 text-center">الإجراءات</th></tr></thead>
                      <tbody className="divide-y">
                        {filteredManagers.map(m => (
                          <tr key={m.id} className="hover:bg-slate-50/60"><td className="p-4 font-black">{m.name}</td><td className="p-4 font-mono font-bold dir-ltr text-right">{m.phone}</td><td className="p-4 text-slate-500 text-xs">{m.createdAt ? new Date(m.createdAt).toLocaleDateString('ar-IQ') : '—'}</td>
                            <td className="p-4"><div className="flex justify-center gap-1.5 flex-wrap">
                              <button onClick={() => onVisitBranchManager(activeBranch, m)} className="px-3 h-8 rounded-lg bg-slate-900 text-white text-xs font-black">دخول</button>
                              <button onClick={() => handleShareManagerWhatsApp(m, activeBranch)} className="px-3 h-8 rounded-lg bg-emerald-600 text-white text-xs font-black">واتساب</button>
                              <button onClick={() => handleCopyManagerLink(m, activeBranch)} className="px-3 h-8 rounded-lg bg-white border text-xs font-black">{copiedManagerId === m.id ? '✓ نسخ' : 'نسخ'}</button>
                              <button onClick={() => { setEditingManager(m); setManagerName(m.name); setManagerPhone(m.phone); setShowAddManagerModal(true) }} className="px-3 h-8 rounded-lg bg-slate-100 text-xs font-black">تعديل</button>
                              <button onClick={() => handleDeleteManager(m.id, m.name)} className="px-3 h-8 rounded-lg bg-red-50 text-red-600 border border-red-200 text-xs font-black">حذف</button>
                            </div></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="rounded-2xl bg-white border border-slate-200 p-5 flex flex-wrap justify-between gap-4 items-center"><h3 className="font-black text-base">التقارير المالية الموحدة</h3><div className="flex bg-slate-100 p-1 rounded-xl">{[2026, 2027, 2028].map(y => <button key={y} onClick={() => setReportYear(y)} className={`px-4 h-8 rounded-lg text-xs font-black ${reportYear === y ? 'bg-white shadow' : ''}`}>{y}</button>)}</div></div>
              <div className="rounded-2xl bg-white border border-slate-200 p-7">
                <div className="flex justify-between mb-6"><h4 className="font-black text-base">مقارنة أداء الفروع</h4><span className="text-xs font-black text-emerald-600">الإجمالي {totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع</span></div>
                <div className="space-y-4">{filteredReportStats.map(s => { const max = Math.max(...filteredReportStats.map(x => x.collectedAmount), 1); const pct = Math.min(100, (s.collectedAmount / max) * 100); return <div key={s.branchId}><div className="flex justify-between text-xs font-bold"><span>{s.name}</span><span className="text-emerald-700">{s.collectedAmount.toLocaleString('ar-IQ')} د.ع</span></div><div className="mt-2 h-2.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-slate-900 rounded-full transition-all" style={{ width: `${Math.max(pct, 4)}%` }} /></div></div> })}</div>
              </div>
              <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-right text-xs"><thead className="bg-slate-50 border-b text-xs font-black text-slate-500"><tr><th className="p-4">الفرع</th><th className="p-4">مشتركين</th><th className="p-4">مسؤولين</th><th className="p-4">جباة</th><th className="p-4">المبلغ</th><th className="p-4 text-center">عرض</th></tr></thead><tbody className="divide-y">{filteredReportStats.map(s => <tr key={s.branchId} className="hover:bg-slate-50"><td className="p-4 font-black">{s.name}</td><td className="p-4">{s.subscribersCount}</td><td className="p-4">{s.managersCount}</td><td className="p-4">{s.collectorsCount}</td><td className="p-4 font-black text-emerald-700">{s.collectedAmount.toLocaleString('ar-IQ')}</td><td className="p-4 text-center"><button onClick={() => { setActiveTab('branches'); setActiveBranchDetailId(s.branchId) }} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-black">فتح</button></td></tr>)}</tbody></table></div></div>
            </div>
          )}
        </main>
      </div>

      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"><div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl border animate-in"><h3 className="font-black text-lg">إضافة فرع واردات جديد</h3><input autoFocus value={newBranchName} onChange={e => setNewBranchName(e.target.value)} placeholder="مثال: فرع واردات القرنة" className="mt-5 w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white" /><div className="mt-6 flex justify-end gap-2"><button onClick={() => setShowAddBranchModal(false)} className="h-11 px-5 rounded-xl bg-slate-100 text-xs font-black">إلغاء</button><button onClick={handleAddBranch} className="h-11 px-6 rounded-xl bg-slate-900 text-white text-xs font-black">تأكيد الإضافة</button></div></div></div>
      )}

      {showAddManagerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"><div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl border"><h3 className="font-black text-lg">{editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ ${activeBranch?.name}`}</h3><div className="mt-5 space-y-4"><div><label className="text-xs font-black text-slate-600">الاسم الثلاثي</label><input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="أحمد عبد الحسين" className="mt-2 w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 focus:bg-white" /></div><div><label className="text-xs font-black text-slate-600">رقم الهاتف</label><input value={managerPhone} onChange={e => setManagerPhone(e.target.value)} placeholder="07701234567" className="mt-2 w-full h-12 px-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold outline-none dir-ltr text-right focus:ring-4 focus:ring-slate-100 focus:bg-white" /></div></div><div className="mt-6 flex justify-end gap-2"><button onClick={() => { setShowAddManagerModal(false); setEditingManager(null) }} className="h-11 px-5 rounded-xl bg-slate-100 text-xs font-black">إلغاء</button><button onClick={handleSaveManager} className="h-11 px-6 rounded-xl bg-emerald-600 text-white text-xs font-black">حفظ البيانات</button></div></div></div>
      )}
    </div>
  )
}
