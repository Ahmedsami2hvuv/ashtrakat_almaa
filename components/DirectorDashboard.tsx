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
  // التبويب النشط
  const [activeTab, setActiveTab] = useState<'branches' | 'reports'>('branches')
  
  // الفرع المختار
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    directorateData.branches[0]?.id || ''
  )
  
  // حالة القائمة الجانبية في الشاشات الصغيرة
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [copiedManagerId, setCopiedManagerId] = useState<string | null>(null)

  // حالات إضافة فرع
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  // حالات إضافة وتعديل مسؤول
  const [showAddManagerModal, setShowAddManagerModal] = useState(false)
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null)
  const [managerName, setManagerName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')

  // فلترة سنة التقرير
  const [reportYear, setReportYear] = useState<number>(2026)

  // الفرع المحدد حالياً
  const currentBranch =
    directorateData.branches.find(b => b.id === selectedBranchId) ||
    directorateData.branches[0]

  // دالة إضافة فرع جديد
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

  // حفظ / إضافة مسؤول
  const handleSaveManager = () => {
    if (!managerName.trim() || !managerPhone.trim()) {
      alert('يرجى إدخال اسم المسؤول ورقم هاتفه')
      return
    }

    if (!currentBranch) return

    let updatedManagers = [...(currentBranch.managers || [])]
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
      b.id === currentBranch.id ? { ...b, managers: updatedManagers } : b
    )

    onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    setShowAddManagerModal(false)
    setEditingManager(null)
    setManagerName('')
    setManagerPhone('')
  }

  // حذف مسؤول
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

  // إرسال الرابط عبر واتساب
  const handleShareManagerWhatsApp = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    const msg = `مرحباً ${manager.name}\nمسؤول ${branch.name}\nهذا رابط حسابك للدخول المباشر إلى النظام:\n${directLink}`
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

  // حساب فترات السنة
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
    <div
      className="min-h-screen flex flex-col md:flex-row font-sans"
      dir="rtl"
      style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}
    >
      {/* ======================================================== */}
      {/* 1. القائمة الجانبية الفخمة والواضحة (Sidebar)             */}
      {/* ======================================================== */}
      {/* خلفية معتمة للهواتف عند فتح القائمة */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 md:hidden"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(3px)' }}
        />
      )}

      <aside
        className={`fixed md:sticky top-0 inset-y-0 right-0 z-50 w-80 flex flex-col justify-between transition-transform duration-300 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
        }`}
        style={{
          backgroundColor: '#0f172a',
          color: '#ffffff',
          borderLeft: '1px solid #1e293b',
          height: '100vh',
          minWidth: '300px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
        }}
      >
        {/* القسم العلوي للقائمة: الشعار وهوية المديرية */}
        <div className="flex-1 flex flex-col overflow-y-auto">
          {/* هيدر القائمة */}
          <div
            className="p-5 flex items-center justify-between"
            style={{ borderBottom: '1px solid #1e293b' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                  color: '#ffffff'
                }}
              >
                ماء
              </div>
              <div>
                <h1 className="text-base font-black tracking-wide" style={{ color: '#ffffff' }}>
                  مديرية ماء البصرة
                </h1>
                <p className="text-xs font-bold" style={{ color: '#38bdf8' }}>
                  لوحة مدير الواردات العام
                </p>
              </div>
            </div>

            {/* زر إغلاق القائمة في الشاشات الصغيرة */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-2 rounded-xl transition"
              style={{ backgroundColor: '#1e293b', color: '#ffffff' }}
              aria-label="إغلاق القائمة"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* بطاقة معلومات مدير الواردات */}
          <div
            className="mx-4 my-4 p-3.5 rounded-2xl flex items-center gap-3"
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155'
            }}
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm"
              style={{ backgroundColor: '#0284c7', color: '#ffffff' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black" style={{ color: '#ffffff' }}>مدير الواردات</span>
                <span
                  className="text-[10px] font-black px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}
                >
                  ● نشط
                </span>
              </div>
              <p className="text-[11px] font-medium truncate" style={{ color: '#94a3b8' }}>
                محافظة البصرة - المركز
              </p>
            </div>
          </div>

          {/* روابط التنقل الرئيسية */}
          <nav className="px-3 space-y-2">
            <div
              className="px-3 pt-2 pb-1 text-[11px] font-black uppercase tracking-wider"
              style={{ color: '#94a3b8' }}
            >
              الأقسام الرئيسية
            </div>

            {/* 1. خيار إدارة الأفرع */}
            <button
              onClick={() => {
                setActiveTab('branches')
                setMobileMenuOpen(false)
              }}
              className="w-full text-right px-4 py-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all"
              style={{
                backgroundColor: activeTab === 'branches' ? '#0284c7' : '#1e293b',
                color: '#ffffff',
                border: activeTab === 'branches' ? '1px solid #38bdf8' : '1px solid transparent',
                boxShadow: activeTab === 'branches' ? '0 4px 12px rgba(2, 132, 199, 0.4)' : 'none'
              }}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span className="text-sm">إدارة أفرع المديرية</span>
              </div>
              <span
                className="text-xs px-2.5 py-0.5 rounded-full font-black"
                style={{
                  backgroundColor: activeTab === 'branches' ? '#ffffff' : '#334155',
                  color: activeTab === 'branches' ? '#0284c7' : '#ffffff'
                }}
              >
                {directorateData.branches.length}
              </span>
            </button>

            {/* 2. خيار التقارير والإحصائيات */}
            <button
              onClick={() => {
                setActiveTab('reports')
                setMobileMenuOpen(false)
              }}
              className="w-full text-right px-4 py-3 rounded-2xl font-black text-xs flex items-center justify-between transition-all"
              style={{
                backgroundColor: activeTab === 'reports' ? '#0284c7' : '#1e293b',
                color: '#ffffff',
                border: activeTab === 'reports' ? '1px solid #38bdf8' : '1px solid transparent',
                boxShadow: activeTab === 'reports' ? '0 4px 12px rgba(2, 132, 199, 0.4)' : 'none'
              }}
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="text-sm">التقارير والإحصائيات</span>
              </div>
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-black"
                style={{
                  backgroundColor: '#059669',
                  color: '#ffffff'
                }}
              >
                تحليلات
              </span>
            </button>

            {/* زر إضافة فرع جديد مباشرة داخل القائمة */}
            <div className="pt-2">
              <button
                onClick={() => {
                  setShowAddBranchModal(true)
                  setMobileMenuOpen(false)
                }}
                className="w-full text-right px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition"
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.1)',
                  color: '#38bdf8',
                  border: '1px dashed #0284c7'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>+ إضافة فرع واردات جديد</span>
              </button>
            </div>

            {/* قائمة سريعة بأسماء الأفرع للتنقل الفوري */}
            <div className="pt-4">
              <div
                className="px-3 pb-2 text-[11px] font-black uppercase tracking-wider flex items-center justify-between"
                style={{ color: '#94a3b8' }}
              >
                <span>أفرع المحافظة ({directorateData.branches.length})</span>
                <span className="text-[10px] text-cyan-400">انقر للتنقل</span>
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {directorateData.branches.map(branch => {
                  const isCurrent = currentBranch?.id === branch.id
                  return (
                    <button
                      key={branch.id}
                      onClick={() => {
                        setSelectedBranchId(branch.id)
                        setActiveTab('branches')
                        setMobileMenuOpen(false)
                      }}
                      className="w-full text-right px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition"
                      style={{
                        backgroundColor: isCurrent ? 'rgba(2, 132, 199, 0.25)' : 'transparent',
                        color: isCurrent ? '#38bdf8' : '#cbd5e1',
                        borderRight: isCurrent ? '3px solid #38bdf8' : '3px solid transparent'
                      }}
                    >
                      <span className="truncate">{branch.name}</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-black"
                        style={{
                          backgroundColor: '#1e293b',
                          color: '#94a3b8'
                        }}
                      >
                        {branch.subscribers?.length || 0}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* الجزء السفلي من القائمة: الملخص المالي + زر تسجيل الخروج */}
        <div
          className="p-4 space-y-3"
          style={{ borderTop: '1px solid #1e293b', backgroundColor: '#090d16' }}
        >
          {/* كارت ملخص مالي مدمج */}
          <div
            className="p-3.5 rounded-2xl space-y-2"
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155'
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{ color: '#94a3b8' }}>
                إجمالي الجباية العامة
              </span>
              <span
                className="text-[10px] font-black px-2 py-0.5 rounded-md"
                style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}
              >
                البصرة
              </span>
            </div>
            <p className="text-base font-black tracking-tight" style={{ color: '#34d399' }}>
              {totalCollectedAllBranches.toLocaleString('ar-IQ')}{' '}
              <span className="text-xs font-normal" style={{ color: '#94a3b8' }}>د.ع</span>
            </p>
            <div
              className="flex justify-between items-center text-[11px] pt-1.5"
              style={{ borderTop: '1px solid #334155', color: '#94a3b8' }}
            >
              <span>إجمالي المشتركين:</span>
              <span className="font-black" style={{ color: '#38bdf8' }}>
                {totalSubscribersAllBranches.toLocaleString('ar-IQ')}
              </span>
            </div>
          </div>

          {/* زر تسجيل الخروج */}
          <button
            onClick={onLogout}
            className="w-full px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>تسجيل الخروج من النظام</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. منطقة العمل والمحتوى الرئيسي (Main Content)            */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* الشريط العلوي (الهيدر) */}
        <header
          className="sticky top-0 z-30 px-4 md:px-8 py-4 flex items-center justify-between gap-4"
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div className="flex items-center gap-3">
            {/* زر فتح القائمة الجانبية للشاشات الصغيرة */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2.5 rounded-xl transition"
              style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
              aria-label="فتح القائمة الجانبية"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div>
              <h2 className="text-base md:text-xl font-black" style={{ color: '#0f172a' }}>
                {activeTab === 'branches'
                  ? 'إدارة أفرع ومسؤولي ماء البصرة'
                  : 'مركز التقارير والإحصائيات والتحصيل'}
              </h2>
              <p className="text-xs font-bold hidden sm:block" style={{ color: '#64748b' }}>
                مديرية ماء محافظة البصرة - النظام المالي المركزي
              </p>
            </div>
          </div>

          {/* أزرار الهيدر العلوية */}
          <div className="flex items-center gap-3">
            {activeTab === 'branches' && (
              <button
                onClick={() => setShowAddBranchModal(true)}
                className="px-4 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-2 shadow-sm"
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>إضافة فرع جديد</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="hidden sm:flex px-3.5 py-2 rounded-xl text-xs font-black transition items-center gap-1.5"
              style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca'
              }}
              title="تسجيل الخروج"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>خروج</span>
            </button>
          </div>
        </header>

        {/* جسم الصفحة الرئيسي */}
        <main className="p-4 md:p-8 space-y-6 flex-1 w-full max-w-7xl mx-auto">
          {/* ==================================================== */}
          {/* بطاقات المؤشرات العامة (KPIs)                         */}
          {/* ==================================================== */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* بطاقة 1: إجمالي المشتركين */}
            <div
              className="p-5 rounded-3xl transition"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black" style={{ color: '#64748b' }}>
                  مشتركو المحافظة
                </span>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
                  style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}
                >
                  👥
                </div>
              </div>
              <p className="text-2xl font-black" style={{ color: '#0f172a' }}>
                {totalSubscribersAllBranches.toLocaleString('ar-IQ')}
              </p>
              <p className="text-[11px] font-bold mt-1" style={{ color: '#64748b' }}>
                في {directorateData.branches.length} أفرع رسمية
              </p>
            </div>

            {/* بطاقة 2: إجمالي التحصيل */}
            <div
              className="p-5 rounded-3xl transition"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black" style={{ color: '#64748b' }}>
                  المبالغ المستحصلة
                </span>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
                  style={{ backgroundColor: '#d1fae5', color: '#059669' }}
                >
                  💰
                </div>
              </div>
              <p className="text-xl md:text-2xl font-black" style={{ color: '#059669' }}>
                {totalCollectedAllBranches.toLocaleString('ar-IQ')}{' '}
                <span className="text-xs font-bold" style={{ color: '#64748b' }}>د.ع</span>
              </p>
              <p className="text-[11px] font-bold mt-1" style={{ color: '#059669' }}>
                إجمالي إيرادات الدوائر
              </p>
            </div>

            {/* بطاقة 3: عدد الأفرع */}
            <div
              className="p-5 rounded-3xl transition"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black" style={{ color: '#64748b' }}>
                  أفرع المحافظة
                </span>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
                  style={{ backgroundColor: '#f3e8ff', color: '#9333ea' }}
                >
                  🏢
                </div>
              </div>
              <p className="text-2xl font-black" style={{ color: '#0f172a' }}>
                {directorateData.branches.length}{' '}
                <span className="text-xs font-bold" style={{ color: '#64748b' }}>فروع</span>
              </p>
              <p className="text-[11px] font-bold mt-1" style={{ color: '#64748b' }}>
                تغطي عموم أقضية ونواحي البصرة
              </p>
            </div>

            {/* بطاقة 4: الكوادر العاملة */}
            <div
              className="p-5 rounded-3xl transition"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black" style={{ color: '#64748b' }}>
                  الكوادر العاملة
                </span>
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold"
                  style={{ backgroundColor: '#fef3c7', color: '#d97706' }}
                >
                  💼
                </div>
              </div>
              <p className="text-2xl font-black" style={{ color: '#0f172a' }}>
                {totalManagersAllBranches + totalCollectorsAllBranches}{' '}
                <span className="text-xs font-bold" style={{ color: '#64748b' }}>موظف</span>
              </p>
              <p className="text-[11px] font-bold mt-1" style={{ color: '#64748b' }}>
                {totalManagersAllBranches} مسؤولين | {totalCollectorsAllBranches} محصلين
              </p>
            </div>
          </div>

          {/* ==================================================== */}
          {/* تبويب 1: إدارة الأفرع والمسؤولين                      */}
          {/* ==================================================== */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* شريط اختيار الفرع */}
              <div
                className="p-6 rounded-3xl space-y-4"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📌</span>
                    <h3 className="text-sm font-black" style={{ color: '#0f172a' }}>
                      اختر الفرع للمعاينة والإدارة:
                    </h3>
                  </div>

                  <span className="text-xs font-bold" style={{ color: '#64748b' }}>
                    الفرع المعروض الآن:{' '}
                    <strong style={{ color: '#0284c7', fontSize: '13px' }}>
                      {currentBranch?.name}
                    </strong>
                  </span>
                </div>

                {/* شبكة أزرار الأفرع الفخمة مع بطاقات مميزة */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {directorateData.branches.map(branch => {
                    const isSelected = selectedBranchId === branch.id
                    return (
                      <button
                        key={branch.id}
                        onClick={() => setSelectedBranchId(branch.id)}
                        className="p-3.5 rounded-2xl text-right font-black text-xs transition-all flex flex-col justify-between gap-2"
                        style={{
                          backgroundColor: isSelected ? '#0f172a' : '#f8fafc',
                          color: isSelected ? '#ffffff' : '#1e293b',
                          border: isSelected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                          boxShadow: isSelected ? '0 4px 12px rgba(15, 23, 42, 0.25)' : 'none'
                        }}
                      >
                        <span className="truncate w-full block text-sm font-black">
                          {branch.name}
                        </span>
                        <div className="flex items-center justify-between w-full pt-1">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded-full font-black"
                            style={{
                              backgroundColor: isSelected ? '#0284c7' : '#e2e8f0',
                              color: isSelected ? '#ffffff' : '#334155'
                            }}
                          >
                            {branch.subscribers?.length || 0} مشترك
                          </span>
                          {branch.managers && branch.managers.length > 0 && (
                            <span
                              className="text-[10px] font-black"
                              style={{ color: isSelected ? '#34d399' : '#059669' }}
                            >
                              ✓ {branch.managers.length}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* تفاصيل الفرع المختار ومسؤولوه */}
              {currentBranch && (
                <div
                  className="rounded-3xl overflow-hidden"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.04)'
                  }}
                >
                  {/* رأس بطاقة الفرع */}
                  <div
                    className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6"
                    style={{
                      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                      color: '#ffffff'
                    }}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                        <h3 className="text-2xl font-black" style={{ color: '#ffffff' }}>
                          {currentBranch.name}
                        </h3>
                        <span
                          className="px-3 py-1 text-xs font-black rounded-xl"
                          style={{
                            backgroundColor: 'rgba(2, 132, 199, 0.5)',
                            border: '1px solid #38bdf8',
                            color: '#e0f2fe'
                          }}
                        >
                          {currentBranch.subscribers?.length || 0} مشترك مسجل
                        </span>
                      </div>

                      {/* مؤشرات سريعة للفرع */}
                      <div className="flex items-center gap-3 text-xs font-bold pt-1 flex-wrap">
                        <span
                          className="px-3 py-1 rounded-xl"
                          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' }}
                        >
                          📍 المناطق: {currentBranch.areas?.length || 0}
                        </span>
                        <span
                          className="px-3 py-1 rounded-xl"
                          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' }}
                        >
                          💼 المحصلون: {currentBranch.collectors?.length || 0}
                        </span>
                        <span
                          className="px-3 py-1 rounded-xl"
                          style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' }}
                        >
                          ✍️ الكتاب: {currentBranch.writers?.length || 0}
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
                        className="px-5 py-3 rounded-2xl font-black text-xs transition flex items-center gap-2 shadow-md"
                        style={{
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          boxShadow: '0 4px 10px rgba(5, 150, 105, 0.3)'
                        }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>إضافة مسؤول للفرع</span>
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(currentBranch.id, currentBranch.name)}
                        className="px-4 py-3 rounded-2xl font-black text-xs transition flex items-center gap-1.5"
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.2)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239, 68, 68, 0.4)'
                        }}
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
                    <div
                      className="flex items-center justify-between pb-3"
                      style={{ borderBottom: '1px solid #f1f5f9' }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">👔</span>
                        <h4 className="text-base font-black" style={{ color: '#0f172a' }}>
                          مسؤولو فرع ({currentBranch.name})
                        </h4>
                        <span
                          className="text-xs px-2.5 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: '#e2e8f0', color: '#334155' }}
                        >
                          {currentBranch.managers?.length || 0}
                        </span>
                      </div>

                      <p className="text-xs font-bold hidden sm:block" style={{ color: '#64748b' }}>
                        يمكن إرسال رابط الدخول المباشر للمسؤول دون الحاجة لكلمة مرور
                      </p>
                    </div>

                    {/* إذا لم يكن هناك مسؤولين */}
                    {(!currentBranch.managers || currentBranch.managers.length === 0) ? (
                      <div
                        className="text-center py-16 rounded-3xl space-y-3"
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '2px dashed #cbd5e1'
                        }}
                      >
                        <div
                          className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-2xl font-bold"
                          style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}
                        >
                          👤
                        </div>
                        <p className="text-sm font-black" style={{ color: '#334155' }}>
                          لا يوجد مسؤول مسجل لهذا الفرع حالياً
                        </p>
                        <p className="text-xs font-bold" style={{ color: '#64748b' }}>
                          قم بإضافة مسؤول للفرع لتمكينه من إدارة المحصلين والفواتير والمشتركين
                        </p>
                        <button
                          onClick={() => {
                            setEditingManager(null)
                            setManagerName('')
                            setManagerPhone('')
                            setShowAddManagerModal(true)
                          }}
                          className="mt-2 px-6 py-2.5 rounded-2xl text-xs font-black shadow-md transition"
                          style={{ backgroundColor: '#0284c7', color: '#ffffff' }}
                        >
                          + إضافة مسؤول الآن
                        </button>
                      </div>
                    ) : (
                      /* شبكة كروت المسؤولين الحديثة */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {currentBranch.managers.map(manager => (
                          <div
                            key={manager.id}
                            className="p-5 rounded-3xl flex flex-col justify-between space-y-4 shadow-sm"
                            style={{
                              backgroundColor: '#ffffff',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            {/* معلومات المسؤول */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg shadow-md"
                                  style={{
                                    background: 'linear-gradient(135deg, #0284c7 0%, #06b6d4 100%)',
                                    color: '#ffffff'
                                  }}
                                >
                                  {manager.name.charAt(0)}
                                </div>
                                <div>
                                  <h5 className="font-black text-base" style={{ color: '#0f172a' }}>
                                    {manager.name}
                                  </h5>
                                  <p
                                    className="text-xs font-bold mt-0.5 dir-ltr text-right"
                                    style={{ color: '#64748b' }}
                                  >
                                    {manager.phone}
                                  </p>
                                </div>
                              </div>
                              <span
                                className="text-[10px] px-2.5 py-1 rounded-full font-black"
                                style={{
                                  backgroundColor: '#e0f2fe',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd'
                                }}
                              >
                                مسؤول فرع
                              </span>
                            </div>

                            {/* الإجراءات الأساسية */}
                            <div
                              className="space-y-2 pt-3"
                              style={{ borderTop: '1px solid #f1f5f9' }}
                            >
                              <div className="grid grid-cols-2 gap-2">
                                {/* 1. زيارة الصفحة */}
                                <button
                                  onClick={() => onVisitBranchManager(currentBranch, manager)}
                                  className="px-3 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
                                  style={{ backgroundColor: '#0284c7', color: '#ffffff' }}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                  <span>دخول لصفحته</span>
                                </button>

                                {/* 2. إرسال الرابط عبر الواتساب */}
                                <button
                                  onClick={() => handleShareManagerWhatsApp(manager, currentBranch)}
                                  className="px-3 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 shadow-sm"
                                  style={{ backgroundColor: '#059669', color: '#ffffff' }}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.941-.708-1.792s.446-1.27.605-1.444c.159-.175.347-.219.462-.219.116 0 .232.001.332.006.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.101-.179.21-.077.385.101.174.453.748.971 1.209.667.593 1.229.776 1.403.863.174.087.275.072.376-.044.101-.116.433-.505.549-.679.116-.174.232-.145.39-.087s1.011.477 1.185.564c.174.087.289.13.332.203.043.072.043.419-.101.824z"/>
                                  </svg>
                                  <span>واتساب</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2 pt-1">
                                {/* زر نسخ الرابط */}
                                <button
                                  onClick={() => handleCopyManagerLink(manager, currentBranch)}
                                  className="px-2 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                                  style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#334155',
                                    border: '1px solid #e2e8f0'
                                  }}
                                  title="نسخ رابط الدخول المباشر"
                                >
                                  {copiedManagerId === manager.id ? (
                                    <span style={{ color: '#059669', fontWeight: '900' }}>✓ تم</span>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                                  className="px-2 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                                  style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#334155',
                                    border: '1px solid #e2e8f0'
                                  }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                  <span>تعديل</span>
                                </button>

                                {/* زر حذف المسؤول */}
                                <button
                                  onClick={() => handleDeleteManager(manager.id, manager.name)}
                                  className="px-2 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                                  style={{
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fecaca'
                                  }}
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* ==================================================== */}
          {/* تبويب 2: التقارير والإحصائيات والتحصيل               */}
          {/* ==================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* شريط فلترة السنوات */}
              <div
                className="p-6 rounded-3xl flex flex-wrap items-center justify-between gap-4"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div>
                  <h3 className="text-lg font-black" style={{ color: '#0f172a' }}>
                    تقارير حركة الأفرع والتحصيل المالي
                  </h3>
                  <p className="text-xs font-bold mt-0.5" style={{ color: '#64748b' }}>
                    تحليل الأداء المالي ونسب التحصيل لمديرية ماء محافظة البصرة
                  </p>
                </div>

                <div
                  className="flex items-center gap-2 p-1.5 rounded-2xl"
                  style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}
                >
                  <span className="text-xs font-black px-2" style={{ color: '#475569' }}>
                    السنة المالية:
                  </span>
                  {[2026, 2027, 2028].map(yr => (
                    <button
                      key={yr}
                      onClick={() => setReportYear(yr)}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-black transition"
                      style={{
                        backgroundColor: reportYear === yr ? '#0284c7' : 'transparent',
                        color: reportYear === yr ? '#ffffff' : '#334155'
                      }}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* مقارنة تحصيل الأفرع */}
              <div
                className="p-6 md:p-8 rounded-3xl space-y-5"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div
                  className="flex items-center justify-between pb-3"
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📊</span>
                    <h4 className="text-base font-black" style={{ color: '#0f172a' }}>
                      مقارنة المبالغ المستحصلة بين أفرع محافظة البصرة
                    </h4>
                  </div>
                  <span className="text-xs font-bold" style={{ color: '#64748b' }}>
                    الإجمالي:{' '}
                    <strong style={{ color: '#059669', fontSize: '13px' }}>
                      {totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع
                    </strong>
                  </span>
                </div>

                <div className="space-y-4 pt-1">
                  {branchStats.map(stat => {
                    const maxVal = Math.max(...branchStats.map(s => s.collectedAmount), 1)
                    const percent = Math.min(100, Math.round((stat.collectedAmount / maxVal) * 100))
                    return (
                      <div key={stat.branchId} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="font-black flex items-center gap-2" style={{ color: '#0f172a' }}>
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            {stat.name}
                          </span>
                          <span className="font-black text-sm" style={{ color: '#059669' }}>
                            {stat.collectedAmount.toLocaleString('ar-IQ')} د.ع
                          </span>
                        </div>
                        <div
                          className="w-full h-3.5 rounded-full overflow-hidden p-0.5"
                          style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0' }}
                        >
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(percent, 3)}%`,
                              background: 'linear-gradient(90deg, #0284c7 0%, #059669 100%)'
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* تطور التحصيل خلال فترات السنة */}
              <div
                className="p-6 md:p-8 rounded-3xl space-y-5"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div
                  className="flex items-center justify-between pb-3"
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <h4 className="text-base font-black" style={{ color: '#0f172a' }}>
                      تطور وتوزيع التحصيل خلال فترات سنة ({reportYear})
                    </h4>
                  </div>
                  <span className="text-xs font-bold" style={{ color: '#64748b' }}>
                    الأشهر الثنائية
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-2">
                  {monthlyStatsForYear.map((m, idx) => {
                    const maxPeriod = Math.max(...monthlyStatsForYear.map(x => x.amount), 1)
                    const heightPercent = Math.min(100, Math.round((m.amount / maxPeriod) * 100))
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center gap-3 p-4 rounded-2xl transition"
                        style={{
                          backgroundColor: '#f8fafc',
                          border: '1px solid #e2e8f0'
                        }}
                      >
                        <div className="w-full h-32 flex items-end justify-center">
                          <div
                            className="w-10 rounded-t-xl transition-all duration-300 shadow-sm"
                            style={{
                              height: `${Math.max(heightPercent, 12)}%`,
                              background: 'linear-gradient(180deg, #0284c7 0%, #38bdf8 100%)'
                            }}
                          />
                        </div>
                        <span className="text-xs font-black" style={{ color: '#334155' }}>
                          {m.periodLabel}
                        </span>
                        <span
                          className="text-xs font-black px-2 py-0.5 rounded-lg"
                          style={{
                            backgroundColor: '#d1fae5',
                            color: '#059669'
                          }}
                        >
                          {m.amount > 0 ? m.amount.toLocaleString('ar-IQ') : '0'} د.ع
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* جدول تفصيلي كامل للأفرع */}
              <div
                className="p-6 md:p-8 rounded-3xl space-y-4"
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div
                  className="flex items-center justify-between pb-3"
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  <h4 className="text-base font-black" style={{ color: '#0f172a' }}>
                    جدول إحصائيات الأفرع التفصيلي
                  </h4>
                  <span className="text-xs font-bold" style={{ color: '#64748b' }}>
                    محدث سحابياً
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr
                        className="font-black"
                        style={{
                          backgroundColor: '#f1f5f9',
                          color: '#334155',
                          borderBottom: '1px solid #e2e8f0'
                        }}
                      >
                        <th className="p-3.5 rounded-r-2xl">الفرع</th>
                        <th className="p-3.5">عدد المشتركين</th>
                        <th className="p-3.5">المسؤولون</th>
                        <th className="p-3.5">المحصلون</th>
                        <th className="p-3.5 rounded-l-2xl">المبالغ المستحصلة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {branchStats.map(s => (
                        <tr key={s.branchId} className="hover:bg-slate-50 transition">
                          <td className="p-3.5 font-black" style={{ color: '#0f172a' }}>{s.name}</td>
                          <td className="p-3.5" style={{ color: '#0284c7' }}>{s.subscribersCount.toLocaleString('ar-IQ')} مشترك</td>
                          <td className="p-3.5" style={{ color: '#334155' }}>{s.managersCount} مسؤول</td>
                          <td className="p-3.5" style={{ color: '#334155' }}>{s.collectorsCount} محصل</td>
                          <td className="p-3.5 font-black text-sm" style={{ color: '#059669' }}>
                            {s.collectedAmount.toLocaleString('ar-IQ')} د.ع
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="p-6 md:p-8 max-w-md w-full rounded-3xl shadow-2xl space-y-5"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg"
                style={{ backgroundColor: '#e0f2fe', color: '#0284c7' }}
              >
                +
              </div>
              <div>
                <h3 className="text-lg font-black" style={{ color: '#0f172a' }}>
                  إضافة فرع واردات جديد
                </h3>
                <p className="text-xs font-bold" style={{ color: '#64748b' }}>
                  سيتم إنشاء فرع مستقل بكامل أقسامه ومحصليه
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-black mb-1.5" style={{ color: '#334155' }}>
                اسم الفرع (مثال: فرع واردات القرنة):
              </label>
              <input
                type="text"
                placeholder="اكتب اسم الفرع..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl text-sm font-bold outline-none transition"
                style={{
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  color: '#0f172a'
                }}
                autoFocus
              />
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-black transition"
                style={{ backgroundColor: '#f1f5f9', color: '#475569' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleAddBranch}
                className="px-6 py-2.5 rounded-xl text-xs font-black shadow-md transition"
                style={{ backgroundColor: '#0284c7', color: '#ffffff' }}
              >
                تأكيد الإضافة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل مسؤول فرع */}
      {showAddManagerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="p-6 md:p-8 max-w-md w-full rounded-3xl shadow-2xl space-y-5"
            style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
          >
            <div className="flex items-center gap-3 pb-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black"
                style={{ backgroundColor: '#d1fae5', color: '#059669' }}
              >
                👔
              </div>
              <div>
                <h3 className="text-lg font-black" style={{ color: '#0f172a' }}>
                  {editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ (${currentBranch?.name})`}
                </h3>
                <p className="text-xs font-bold" style={{ color: '#64748b' }}>
                  سيتم إنشاء رابط دخول مباشر خاص به
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black mb-1.5" style={{ color: '#334155' }}>
                  الاسم الثلاثي للمسؤول:
                </label>
                <input
                  type="text"
                  placeholder="مثال: أحمد عبد الحسين علي"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl text-sm font-bold outline-none transition"
                  style={{
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-black mb-1.5" style={{ color: '#334155' }}>
                  رقم الهاتف (مع رمز الدولة أو محلي):
                </label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl text-sm font-bold outline-none dir-ltr text-right transition"
                  style={{
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    color: '#0f172a'
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end pt-2">
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className="px-5 py-2.5 rounded-xl text-xs font-black transition"
                style={{ backgroundColor: '#f1f5f9', color: '#475569' }}
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManager}
                className="px-6 py-2.5 rounded-xl text-xs font-black shadow-md transition"
                style={{ backgroundColor: '#059669', color: '#ffffff' }}
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
