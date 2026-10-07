'use client'

import React, { useState } from 'react'
import { DirectorateData, DirectorateBranch, BranchManager } from '@/lib/directorateTypes'
import { generateSecureToken, generateWhatsAppLink } from '@/lib/directorateStore'

interface DirectorDashboardProps {
  directorateData: DirectorateData
  onUpdateDirectorate: (updatedData: DirectorateData) => void
  onVisitBranchManager: (branch: DirectorateBranch, manager: BranchManager) => void
  onLogout: () => void
}

export default function DirectorDashboard({
  directorateData,
  onUpdateDirectorate,
  onVisitBranchManager,
  onLogout
}: DirectorDashboardProps) {
  const [activeTab, setActiveTab] = useState<'branches' | 'reports'>('branches')
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    directorateData.branches[0]?.id || ''
  )
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [copiedManagerId, setCopiedManagerId] = useState<string | null>(null)

  // حالات إضافة وتعديل فرع
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  // حالات إضافة وتعديل مسؤول
  const [showAddManagerModal, setShowAddManagerModal] = useState(false)
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')

  // فلترة تقارير السنوات
  const [reportYear, setReportYear] = useState<number>(2026)

  // الفرع المحدد حالياً
  const currentBranch =
    directorateData.branches.find(b => b.id === selectedBranchId) ||
    directorateData.branches[0]

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
    setSelectedBranchId(newBranch.id)
    setNewBranchName('')
    setShowAddBranchModal(false)
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
      setSelectedBranchId(updatedBranches[0].id)
    }
  }

  // دالة حفظ / إضافة مسؤول فرع
  const handleSaveManager = () => {
    if (!managerName.trim() || !managerPhone.trim()) {
      alert('يرجى كتابة الاسم الثلاثي ورقم الهاتف للمسؤول')
      return
    }

    if (!currentBranch) return

    let updatedManagers = [...(currentBranch.managers || [])]
    if (editingManager) {
      // تعديل
      updatedManagers = updatedManagers.map(m =>
        m.id === editingManager.id
          ? { ...m, name: managerName.trim(), phone: managerPhone.trim() }
          : m
      )
    } else {
      // إضافة جديد
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
      b.id === currentBranch.id ? { ...b, managers: updatedManagers } : b
    )

    onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    setShowAddManagerModal(false)
    setEditingManager(null)
    setManagerName('')
    setManagerPhone('')
  }

  // حذف مسؤول فرع
  const handleDeleteManager = (managerId: string, name: string) => {
    if (!currentBranch) return
    if (confirm(`هل أنت متأكد من حذف المسؤول (${name})؟`)) {
      const updatedManagers = (currentBranch.managers || []).filter(m => m.id !== managerId)
      const updatedBranches = directorateData.branches.map(b =>
        b.id === currentBranch.id ? { ...b, managers: updatedManagers } : b
      )
      onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    }
  }

  // مشاركة رابط المسؤول عبر الواتساب
  const handleShareManagerWhatsApp = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    const msg = `مرحباً ${manager.name}\nمسؤول ${branch.name}\nهذا رابط الفرع الخاص بك للدخول المباشر إلى النظام:\n${directLink}`
    const waUrl = generateWhatsAppLink(manager.phone, msg)
    window.open(waUrl, '_blank')
  }

  // نسخ رابط المسؤول إلى الحافظة
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

  // إحصائيات المديرية
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

  // حساب المبالغ المستحصلة لكل فرع
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
      managersCount: b.managers?.length || 0,
      collectorsCount: b.collectors?.length || 0,
      collectedAmount
    }
  })

  const totalCollectedAllBranches = branchStats.reduce((s, b) => s + b.collectedAmount, 0)

  // حساب التحصيل حسب الأشهر والسنوات (2026, 2027, 2028)
  const periodNames = ['1 و 2', '3 و 4', '5 و 6', '7 و 8', '9 و 10', '11 و 12']
  const monthlyStatsForYear = periodNames.map((pName, pIndex) => {
    let periodPaid = 0
    directorateData.branches.forEach(b => {
      if (b.billing) {
        Object.values(b.billing).forEach((yearObj: any) => {
          if (yearObj && yearObj[reportYear] && Array.isArray(yearObj[reportYear])) {
            const p = yearObj[reportYear][pIndex]
            if (p && p.paid) periodPaid += Number(p.paid)
          }
        })
      }
    })
    return {
      periodLabel: `فترة ${pName}`,
      amount: periodPaid
    }
  })

  return (
    <div className="min-h-screen bg-slate-100/90 text-slate-800 flex flex-col md:flex-row font-sans" dir="rtl">
      {/* ======================================================== */}
      {/* 1. القائمة الجانبية الفخمة (Sidebar)                     */}
      {/* ======================================================== */}
      <aside
        className={`fixed inset-y-0 right-0 z-40 w-72 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white flex flex-col justify-between border-l border-slate-800/80 shadow-2xl transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* الجزء العلوي: الشعار ومعلومات الحساب */}
        <div>
          {/* رأس القائمة والشعار */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 via-cyan-500 to-teal-400 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-cyan-500/20 ring-2 ring-white/10">
                ماء
              </div>
              <div>
                <h1 className="text-base font-black text-white tracking-wide">مديرية ماء البصرة</h1>
                <p className="text-[11px] text-cyan-300 font-bold">نظام الإدارة والواردات</p>
              </div>
            </div>

            {/* زر إغلاق القائمة في الشاشات الصغيرة */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-white p-1 rounded-lg"
              aria-label="إغلاق القائمة"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* بطاقة هوية مدير الواردات */}
          <div className="mx-4 my-4 p-3.5 bg-slate-800/50 rounded-2xl border border-slate-700/60 flex items-center gap-3 shadow-inner">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-300 font-black text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-white">مدير الواردات</span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  متصل
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">محافظة البصرة - المركز</p>
            </div>
          </div>

          {/* روابط التنقل الرئيسية */}
          <nav className="px-3 space-y-1.5">
            <div className="px-3 py-1.5 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              لوحة التحكم
            </div>

            <button
              onClick={() => {
                setActiveTab('branches')
                setMobileMenuOpen(false)
              }}
              className={`w-full text-right px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-between transition-all duration-200 ${
                activeTab === 'branches'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/40'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>إدارة أفرع المديرية</span>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'branches' ? 'bg-white/20 text-white' : 'bg-slate-800 text-cyan-300'}`}>
                {directorateData.branches.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveTab('reports')
                setMobileMenuOpen(false)
              }}
              className={`w-full text-right px-4 py-3 rounded-2xl font-black text-sm flex items-center justify-between transition-all duration-200 ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400/40'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>التقارير والإحصائيات</span>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${activeTab === 'reports' ? 'bg-white/20 text-white' : 'bg-slate-800 text-emerald-400'}`}>
                تحليلات
              </span>
            </button>
          </nav>
        </div>

        {/* الجزء السفلي: مؤشرات سريعة + زر تسجيل الخروج */}
        <div className="p-4 space-y-3 border-t border-slate-800/80">
          {/* بطاقة ملخص مالي مدمجة داخل القائمة */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800/90 rounded-2xl p-3.5 border border-slate-700/60 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400">إجمالي الجباية</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-black">العام</span>
            </div>
            <p className="text-base font-black text-emerald-400 tracking-tight">
              {totalCollectedAllBranches.toLocaleString('ar-IQ')} <span className="text-[11px] font-normal text-slate-400">د.ع</span>
            </p>
            <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1.5 border-t border-slate-700/60">
              <span>إجمالي المشتركين:</span>
              <span className="font-black text-cyan-300">{totalSubscribersAllBranches.toLocaleString('ar-IQ')}</span>
            </div>
          </div>

          {/* زر تسجيل الخروج */}
          <button
            onClick={onLogout}
            className="w-full px-4 py-2.5 bg-rose-500/10 hover:bg-rose-600 text-rose-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border border-rose-500/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            تسجيل الخروج من النظام
          </button>
        </div>
      </aside>

      {/* خلفية معتمة للموبايل عند فتح القائمة */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-30 md:hidden"
        />
      )}

      {/* ======================================================== */}
      {/* 2. منطقة المحتوى الرئيسية (Main Content)                  */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* شريط الهيدر العلوي الحديث */}
        <header className="bg-white sticky top-0 z-20 border-b border-slate-200/80 shadow-xs px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* زر فتح القائمة للشاشات الصغيرة */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition"
              aria-label="فتح القائمة"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              <h2 className="text-base md:text-lg font-black text-slate-900">
                {activeTab === 'branches' ? 'إدارة أفرع ومسؤولي ماء البصرة' : 'مركز التقارير والإحصائيات والتحصيل'}
              </h2>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                لوحة المتابعة المركزية - مديرية ماء محافظة البصرة
              </p>
            </div>
          </div>

          {/* الإجراءات العلوية */}
          <div className="flex items-center gap-2.5">
            {activeTab === 'branches' && (
              <button
                onClick={() => setShowAddBranchModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>إضافة فرع جديد</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="hidden sm:flex px-3 py-2 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl text-xs font-bold transition items-center gap-1.5 border border-slate-200"
              title="تسجيل الخروج"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              خروج
            </button>
          </div>
        </header>

        {/* جسم الصفحة الرئيسي */}
        <main className="p-4 md:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {/* ---------------------------------------------------- */}
          {/* بطاقات المؤشرات العامة (KPIs)                         */}
          {/* ---------------------------------------------------- */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* بطاقة 1: إجمالي المشتركين */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-500">مشتركو المحافظة</span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {totalSubscribersAllBranches.toLocaleString('ar-IQ')}
              </p>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                عبر {directorateData.branches.length} أفرع رسمية
              </p>
            </div>

            {/* بطاقة 2: إجمالي التحصيل */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-500">المبالغ المستحصلة</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xl md:text-2xl font-black text-emerald-600 tracking-tight">
                {totalCollectedAllBranches.toLocaleString('ar-IQ')} <span className="text-xs font-bold text-slate-500">د.ع</span>
              </p>
              <p className="text-[11px] text-emerald-700/80 font-semibold mt-1">
                إجمالي إيرادات الدوائر
              </p>
            </div>

            {/* بطاقة 3: عدد الأفرع */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-500">أفرع المحافظة</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {directorateData.branches.length} <span className="text-xs font-bold text-slate-400">فروع</span>
              </p>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                تغطي عموم أقضية ونواحي البصرة
              </p>
            </div>

            {/* بطاقة 4: الكادر الإداري والمحصلين */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-slate-500">الكوادر العاملة</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {totalManagersAllBranches + totalCollectorsAllBranches} <span className="text-xs font-bold text-slate-400">موظف</span>
              </p>
              <p className="text-[11px] text-slate-400 font-semibold mt-1">
                {totalManagersAllBranches} مسؤولين | {totalCollectorsAllBranches} محصلين
              </p>
            </div>
          </div>

          {/* ---------------------------------------------------- */}
          {/* تبويب 1: إدارة الأفرع والمسؤولين                      */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* شريط اختيار الفرع وتنقله السريع */}
              <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <h3 className="text-sm font-black text-slate-900">اختر الفرع للمعاينة والإدارة:</h3>
                  </div>

                  <span className="text-xs font-bold text-slate-500">
                    الفرع الحالي: <strong className="text-blue-600 font-black">{currentBranch?.name}</strong>
                  </span>
                </div>

                {/* شبكة أزرار الأفرع الفخمة مع بطاقات مميزة */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
                  {directorateData.branches.map(branch => {
                    const isSelected = selectedBranchId === branch.id
                    return (
                      <button
                        key={branch.id}
                        onClick={() => setSelectedBranchId(branch.id)}
                        className={`p-3 rounded-2xl text-right font-black text-xs transition-all relative border flex flex-col justify-between gap-2 ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-blue-500/50'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate w-full block text-sm">{branch.name}</span>
                        <div className="flex items-center justify-between w-full pt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                            {branch.subscribers?.length || 0} مشترك
                          </span>
                          {branch.managers && branch.managers.length > 0 && (
                            <span className="text-[10px] text-emerald-500 font-bold">
                              ✓ {branch.managers.length} مسؤول
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* بطاقة تفاصيل الفرع المختار ومسؤولوه */}
              {currentBranch && (
                <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
                  {/* رأس بطاقة الفرع */}
                  <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                        <h3 className="text-2xl font-black text-white">{currentBranch.name}</h3>
                        <span className="px-3 py-1 bg-blue-600/60 border border-blue-400/40 text-cyan-200 text-xs font-black rounded-xl">
                          {currentBranch.subscribers?.length || 0} مشترك مسجل
                        </span>
                      </div>

                      {/* مؤشرات سريعة للفرع */}
                      <div className="flex items-center gap-4 text-xs text-slate-300 font-bold pt-1 flex-wrap">
                        <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg">
                          <svg className="w-3.5 h-3.5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          </svg>
                          المناطق: {currentBranch.areas?.length || 0}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg">
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                          المحصلون: {currentBranch.collectors?.length || 0}
                        </span>
                        <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-lg">
                          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          الكُتّاب: {currentBranch.writers?.length || 0}
                        </span>
                      </div>
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
                        className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>إضافة مسؤول للفرع</span>
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(currentBranch.id, currentBranch.name)}
                        className="px-4 py-3 bg-rose-500/20 hover:bg-rose-600 text-rose-200 hover:text-white rounded-2xl font-black text-xs border border-rose-500/30 transition flex items-center gap-1.5"
                        title="حذف هذا الفرع"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>حذف الفرع</span>
                      </button>
                    </div>
                  </div>

                  {/* قائمة مسؤولي الفرع */}
                  <div className="p-6 md:p-8 space-y-5">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <h4 className="text-base font-black text-slate-900">
                          مسؤولو فرع ({currentBranch.name})
                        </h4>
                        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                          {currentBranch.managers?.length || 0}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-semibold hidden sm:block">
                        يمكنك إرسال رابط الدخول المباشر للمسؤول دون الحاجة لكلمة مرور
                      </p>
                    </div>

                    {/* إذا لم يكن هناك مسؤولين */}
                    {(!currentBranch.managers || currentBranch.managers.length === 0) ? (
                      <div className="text-center py-16 bg-slate-50/70 rounded-3xl border-2 border-dashed border-slate-200 space-y-3">
                        <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 mx-auto flex items-center justify-center">
                          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                          </svg>
                        </div>
                        <p className="text-sm font-black text-slate-700">لا يوجد مسؤول مسجل لهذا الفرع حالياً</p>
                        <p className="text-xs text-slate-400">قم بإضافة مسؤول للفرع لتمكينه من إدارة المحصلين والفواتير والمشتركين</p>
                        <button
                          onClick={() => {
                            setEditingManager(null)
                            setManagerName('')
                            setManagerPhone('')
                            setShowAddManagerModal(true)
                          }}
                          className="mt-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-2xl shadow-md transition"
                        >
                          + إضافة مسؤول الآن
                        </button>
                      </div>
                    ) : (
                      /* شبكة كروت المسؤولين الحديثة والعريضة */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {currentBranch.managers.map(manager => (
                          <div
                            key={manager.id}
                            className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4 ring-1 ring-slate-100"
                          >
                            {/* معلومات المسؤول */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-500 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
                                  {manager.name.charAt(0)}
                                </div>
                                <div>
                                  <h5 className="font-black text-slate-900 text-base">{manager.name}</h5>
                                  <p className="text-xs font-bold text-slate-500 mt-0.5 dir-ltr text-right">
                                    {manager.phone}
                                  </p>
                                </div>
                              </div>
                              <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-black border border-blue-100">
                                مسؤول فرع
                              </span>
                            </div>

                            {/* الإجراءات الأساسية */}
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <div className="grid grid-cols-2 gap-2">
                                {/* 1. زيارة الصفحة */}
                                <button
                                  onClick={() => onVisitBranchManager(currentBranch, manager)}
                                  className="px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm shadow-blue-600/20"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  <span>دخول لصفحته</span>
                                </button>

                                {/* 2. إرسال الرابط عبر الواتساب */}
                                <button
                                  onClick={() => handleShareManagerWhatsApp(manager, currentBranch)}
                                  className="px-3 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm shadow-emerald-600/20"
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.941-.708-1.792s.446-1.27.605-1.444c.159-.175.347-.219.462-.219.116 0 .232.001.332.006.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.101-.179.21-.077.385.101.174.453.748.971 1.209.667.593 1.229.776 1.403.863.174.087.275.072.376-.044.101-.116.433-.505.549-.679.116-.174.232-.145.39-.087s1.011.477 1.185.564c.174.087.289.13.332.203.043.072.043.419-.101.824z"/>
                                  </svg>
                                  <span>واتساب</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5 pt-1">
                                {/* زر نسخ الرابط المباشر */}
                                <button
                                  onClick={() => handleCopyManagerLink(manager, currentBranch)}
                                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1"
                                  title="نسخ رابط الدخول المباشر"
                                >
                                  {copiedManagerId === manager.id ? (
                                    <span className="text-emerald-600 font-black">✓ تم النسخ</span>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                      </svg>
                                      <span>نسخ</span>
                                    </>
                                  )}
                                </button>

                                {/* زر تعديل المسؤول */}
                                <button
                                  onClick={() => {
                                    setEditingManager(manager)
                                    setManagerName(manager.name)
                                    setManagerPhone(manager.phone)
                                    setShowAddManagerModal(true)
                                  }}
                                  className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1"
                                >
                                  <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  <span>تعديل</span>
                                </button>

                                {/* زر حذف المسؤول */}
                                <button
                                  onClick={() => handleDeleteManager(manager.id, manager.name)}
                                  className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-[11px] font-bold transition flex items-center justify-center gap-1"
                                >
                                  <svg className="w-3.5 h-3.5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  <span>حذف</span>
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

          {/* ---------------------------------------------------- */}
          {/* تبويب 2: التقارير والإحصائيات والتحصيل               */}
          {/* ---------------------------------------------------- */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* شريط فلترة السنوات والإحصاء العام */}
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">تقارير حركة الأفرع والتحصيل المالي</h3>
                  <p className="text-xs text-slate-500 font-semibold mt-0.5">
                    تحليل الأداء المالي ونسب التحصيل لمديرية ماء محافظة البصرة
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                  <span className="text-xs font-black text-slate-600 px-2">السنة المالية:</span>
                  {[2026, 2027, 2028].map(yr => (
                    <button
                      key={yr}
                      onClick={() => setReportYear(yr)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                        reportYear === yr
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* بطاقات مقارنة تحصيل الأفرع */}
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    <h4 className="text-base font-black text-slate-900">
                      مقارنة المبالغ المستحصلة بين أفرع محافظة البصرة
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    الإجمالي: <strong className="text-emerald-600 font-black">{totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع</strong>
                  </span>
                </div>

                <div className="space-y-4 pt-1">
                  {branchStats.map(stat => {
                    const maxVal = Math.max(...branchStats.map(s => s.collectedAmount), 1)
                    const percent = Math.min(100, Math.round((stat.collectedAmount / maxVal) * 100))
                    return (
                      <div key={stat.branchId} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-800 font-black flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            {stat.name}
                          </span>
                          <span className="text-emerald-700 font-black text-sm">
                            {stat.collectedAmount.toLocaleString('ar-IQ')} د.ع
                          </span>
                        </div>
                        <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percent, 3)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* تطور التحصيل خلال فترات السنة */}
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200/80 space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h4 className="text-base font-black text-slate-900">
                      تطور وتوزيع التحصيل خلال فترات سنة ({reportYear})
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-slate-500">الأشهر الثنائية</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                  {monthlyStatsForYear.map((m, idx) => {
                    const maxPeriod = Math.max(...monthlyStatsForYear.map(x => x.amount), 1)
                    const heightPercent = Math.min(100, Math.round((m.amount / maxPeriod) * 100))
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center gap-3 bg-slate-50/80 hover:bg-slate-100/90 p-4 rounded-2xl border border-slate-200/80 transition"
                      >
                        <div className="w-full h-32 flex items-end justify-center">
                          <div
                            className="w-10 bg-gradient-to-t from-blue-600 to-cyan-400 rounded-t-xl transition-all duration-300 shadow-sm"
                            style={{ height: `${Math.max(heightPercent, 12)}%` }}
                          />
                        </div>
                        <span className="text-xs font-black text-slate-700">{m.periodLabel}</span>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                          {m.amount > 0 ? m.amount.toLocaleString('ar-IQ') : '0'} د.ع
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* جدول تفصيلي كامل للأفرع */}
              <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-base font-black text-slate-900">جدول إحصائيات الأفرع التفصيلي</h4>
                  <span className="text-xs font-bold text-slate-500">محدث سحابياً</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                        <th className="p-3.5 rounded-r-2xl">الفرع</th>
                        <th className="p-3.5">عدد المشتركين</th>
                        <th className="p-3.5">المسؤولون</th>
                        <th className="p-3.5">المحصلون</th>
                        <th className="p-3.5 rounded-l-2xl">المبالغ المستحصلة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {branchStats.map(s => (
                        <tr key={s.branchId} className="hover:bg-slate-50/80 transition">
                          <td className="p-3.5 text-slate-900 font-black">{s.name}</td>
                          <td className="p-3.5 text-blue-600">{s.subscribersCount.toLocaleString('ar-IQ')} مشترك</td>
                          <td className="p-3.5 text-slate-700">{s.managersCount} مسؤول</td>
                          <td className="p-3.5 text-slate-700">{s.collectorsCount} محصل</td>
                          <td className="p-3.5 text-emerald-700 font-black text-sm">{s.collectedAmount.toLocaleString('ar-IQ')} د.ع</td>
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
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-black">
                +
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">إضافة فرع واردات جديد</h3>
                <p className="text-xs text-slate-500">سيتم إنشاء فرع مستقل بكامل أقسامه ومحصليه</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">اسم الفرع (مثال: فرع واردات القرنة):</label>
              <input
                type="text"
                placeholder="اكتب اسم الفرع..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                autoFocus
              />
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddBranch}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md transition"
              >
                تأكيد الإضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل مسؤول فرع */}
      {showAddManagerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-black">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ (${currentBranch?.name})`}
                </h3>
                <p className="text-xs text-slate-500">سيتم إنشاء رابط دخول مباشر خاص به</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">الاسم الثلاثي للمسؤول:</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد عبد الحسين علي"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">رقم الهاتف (مع رمز الدولة أو محلي):</label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right transition"
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManager}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition"
              >
                حفظ بيانات المسؤول
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
