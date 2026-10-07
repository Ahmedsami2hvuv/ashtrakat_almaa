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

type TabType = 'overview' | 'branches' | 'reports'

export default function DirectorDashboard({
  directorateData,
  onUpdateDirectorate,
  onVisitBranchManager,
  onLogout
}: DirectorDashboardProps) {
  // التبويب النشط: الافتراضي هو نظرة عامة ورسمية
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  
  // حالة القائمة الجانبية: يمكن إغلاقها وفتحها بالكامل
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // الفرع المختار داخل قسم الأفرع
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    directorateData.branches[0]?.id || ''
  )
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
    const msg = `السلام عليكم ${manager.name}\nمسؤول ${branch.name}\nرابط الدخول المباشر إلى نظام الإدارة:\n${directLink}`
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
      areasCount: b.areas?.length || 0,
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
      className="min-h-screen flex flex-row font-sans"
      dir="rtl"
      style={{ backgroundColor: '#f8fafc', color: '#0f172a' }}
    >
      {/* ======================================================== */}
      {/* 1. القائمة الجانبية الرسمية (قابلة للإغلاق والفتح تماماً)     */}
      {/* ======================================================== */}
      {isSidebarOpen && (
        <aside
          className="flex flex-col justify-between shrink-0"
          style={{
            width: '270px',
            backgroundColor: '#0f172a',
            color: '#f8fafc',
            borderLeft: '1px solid #1e293b',
            minHeight: '100vh',
            position: 'sticky',
            top: 0,
            zIndex: 40
          }}
        >
          {/* رأس القائمة الجانبية */}
          <div>
            <div
              className="p-4 flex items-center justify-between"
              style={{ borderBottom: '1px solid #1e293b' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: '#1e3a8a', color: '#60a5fa' }}
                >
                  ماء
                </div>
                <div>
                  <h1 className="text-sm font-bold tracking-tight text-white">مديرية ماء البصرة</h1>
                  <p className="text-[11px]" style={{ color: '#94a3b8' }}>إدارة الواردات المركزية</p>
                </div>
              </div>

              {/* زر إغلاق القائمة الجانبية الصريح (X) */}
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded transition text-slate-400 hover:text-white"
                style={{ backgroundColor: '#1e293b' }}
                title="إغلاق القائمة الجانبية"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* بطاقة المستخدم الرسمية */}
            <div
              className="mx-3 my-3 p-3 rounded"
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">مدير الواردات</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#064e3b', color: '#6ee7b7' }}>
                  متصل
                </span>
              </div>
              <p className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>محافظة البصرة - المقر العام</p>
            </div>

            {/* خيارات التنقل بالقائمة الجانبية */}
            <nav className="px-2 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: '#64748b' }}>
                أقسام النظام
              </div>

              {/* 1. الرئيسية (لوحة المؤشرات) */}
              <button
                onClick={() => setActiveTab('overview')}
                className="w-full text-right px-3 py-2.5 rounded text-xs font-bold flex items-center justify-between transition"
                style={{
                  backgroundColor: activeTab === 'overview' ? '#1e3a8a' : 'transparent',
                  color: activeTab === 'overview' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span>الرئيسية (لوحة المؤشرات)</span>
                </div>
              </button>

              {/* 2. خانة الأفرع وإدارتها */}
              <button
                onClick={() => setActiveTab('branches')}
                className="w-full text-right px-3 py-2.5 rounded text-xs font-bold flex items-center justify-between transition"
                style={{
                  backgroundColor: activeTab === 'branches' ? '#1e3a8a' : 'transparent',
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
                  className="text-[11px] px-2 py-0.2 rounded font-bold"
                  style={{ backgroundColor: '#334155', color: '#e2e8f0' }}
                >
                  {directorateData.branches.length}
                </span>
              </button>

              {/* 3. التقارير والإحصائيات */}
              <button
                onClick={() => setActiveTab('reports')}
                className="w-full text-right px-3 py-2.5 rounded text-xs font-bold flex items-center justify-between transition"
                style={{
                  backgroundColor: activeTab === 'reports' ? '#1e3a8a' : 'transparent',
                  color: activeTab === 'reports' ? '#ffffff' : '#cbd5e1'
                }}
              >
                <div className="flex items-center gap-2.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>التقارير والتحصيل المالي</span>
                </div>
              </button>
            </nav>
          </div>

          {/* أسفل القائمة: ملخص مالي مقتضب + تسجيل خروج */}
          <div className="p-3 space-y-2" style={{ borderTop: '1px solid #1e293b' }}>
            <div
              className="p-2.5 rounded"
              style={{ backgroundColor: '#1e293b', border: '1px solid #334155' }}
            >
              <div className="text-[10px]" style={{ color: '#94a3b8' }}>إجمالي المبالغ المستحصلة:</div>
              <div className="text-sm font-bold mt-0.5" style={{ color: '#34d399' }}>
                {totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع
              </div>
            </div>

            <button
              onClick={onLogout}
              className="w-full px-3 py-2 rounded text-xs font-bold transition flex items-center justify-center gap-2"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.2)'
              }}
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
      {/* 2. منطقة المحتوى الرئيسية                                 */}
      {/* ======================================================== */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* شريط الأدوات العلوي الرسمي */}
        <header
          className="sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between"
          style={{
            backgroundColor: '#ffffff',
            borderBottom: '1px solid #e2e8f0'
          }}
        >
          <div className="flex items-center gap-3">
            {/* زر فتح/إغلاق القائمة الجانبية (شغال دائماً) */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded border border-slate-300 hover:bg-slate-100 transition flex items-center gap-1.5 text-xs font-bold text-slate-700"
              title={isSidebarOpen ? 'إخفاء القائمة الجانبية' : 'إظهار القائمة الجانبية'}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>{isSidebarOpen ? 'إخفاء القائمة' : 'القائمة الجانبية'}</span>
            </button>

            <div className="h-4 w-px bg-slate-300 mx-1 hidden sm:block"></div>

            <div className="text-sm font-bold text-slate-900">
              {activeTab === 'overview' && 'لوحة المؤشرات العامة للمحافظة'}
              {activeTab === 'branches' && 'إدارة أفرع واردات مديرية ماء البصرة'}
              {activeTab === 'reports' && 'مركز التقارير والإحصائيات المالية'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'branches' && (
              <button
                onClick={() => setShowAddBranchModal(true)}
                className="px-3.5 py-2 rounded text-xs font-bold transition flex items-center gap-1.5"
                style={{ backgroundColor: '#1d4ed8', color: '#ffffff' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>إضافة فرع جديد</span>
              </button>
            )}

            <button
              onClick={onLogout}
              className="px-3 py-1.5 rounded text-xs font-bold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition"
            >
              خروج
            </button>
          </div>
        </header>

        {/* جسم الصفحة حسب التبويب المختار */}
        <main className="p-6 md:p-8 space-y-6 flex-1 max-w-7xl w-full mx-auto">
          {/* ======================================================== */}
          {/* تبويب 1: الصفحة الرئيسية (نظيفة ومرتبة دون عرض الأفرع)   */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* ترويسة الصفحة الترحيبية الهادئة */}
              <div
                className="p-6 rounded border border-slate-200"
                style={{ backgroundColor: '#ffffff' }}
              >
                <h3 className="text-lg font-bold text-slate-900">
                  لوحة المتابعة الإدارية - مديرية ماء محافظة البصرة
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  نظام مركزي لمتابعة إيرادات واشتراكات الأفرع والكوادر الميدانية في عموم أقضية ونواحي المحافظة.
                </p>
              </div>

              {/* بطاقات المؤشرات الأساسية الأربعة بتصميم رسمي نظيف */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. المشتركون */}
                <div className="p-5 rounded border border-slate-200 bg-white">
                  <div className="text-xs font-bold text-slate-500 mb-1">إجمالي مشتركي المحافظة</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {totalSubscribersAllBranches.toLocaleString('ar-IQ')}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    مسجلون في {directorateData.branches.length} فروع رسمية
                  </div>
                </div>

                {/* 2. المبالغ المستحصلة */}
                <div className="p-5 rounded border border-slate-200 bg-white">
                  <div className="text-xs font-bold text-slate-500 mb-1">إجمالي المبالغ المستحصلة</div>
                  <div className="text-2xl font-bold text-emerald-700">
                    {totalCollectedAllBranches.toLocaleString('ar-IQ')}{' '}
                    <span className="text-xs font-normal text-slate-600">د.ع</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">إجمالي إيرادات الجباية المحققة</div>
                </div>

                {/* 3. أفرع المديرية */}
                <div className="p-5 rounded border border-slate-200 bg-white">
                  <div className="text-xs font-bold text-slate-500 mb-1">أفرع ماء البصرة</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {directorateData.branches.length}{' '}
                    <span className="text-xs font-normal text-slate-500">فروع</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    تغطي {totalAreasAllBranches} منطقة مائية
                  </div>
                </div>

                {/* 4. الكوادر العاملة */}
                <div className="p-5 rounded border border-slate-200 bg-white">
                  <div className="text-xs font-bold text-slate-500 mb-1">الكوادر الإدارية والميدانية</div>
                  <div className="text-2xl font-bold text-slate-900">
                    {totalManagersAllBranches + totalCollectorsAllBranches}{' '}
                    <span className="text-xs font-normal text-slate-500">موظف</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {totalManagersAllBranches} مسؤولين | {totalCollectorsAllBranches} محصلين
                  </div>
                </div>
              </div>

              {/* أزرار تنقل وإجراءات سريعة واضحة */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-6 rounded border border-slate-200 bg-white space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">إدارة الأفرع ومسؤوليها</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    يمكنك الدخول إلى قسم الأفرع لمعاينة كل فرع، وتعيين المسؤولين، ومشاركة روابط الدخول بالواتساب، أو إضافة فرع جديد.
                  </p>
                  <button
                    onClick={() => setActiveTab('branches')}
                    className="px-4 py-2 rounded text-xs font-bold transition inline-flex items-center gap-2"
                    style={{ backgroundColor: '#1d4ed8', color: '#ffffff' }}
                  >
                    <span>فتح قسم الأفرع</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </div>

                <div className="p-6 rounded border border-slate-200 bg-white space-y-3">
                  <h4 className="text-sm font-bold text-slate-900">التقارير المالية والتحصيل</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    استعراض مقارنة التحصيل المالي بين الأفرع، وتتبع فترات السنة المالية وجداول الأداء المالي المعتمدة.
                  </p>
                  <button
                    onClick={() => setActiveTab('reports')}
                    className="px-4 py-2 rounded text-xs font-bold transition inline-flex items-center gap-2"
                    style={{ backgroundColor: '#0f172a', color: '#ffffff' }}
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
          {/* تبويب 2: خانة الأفرع (هنا توجد الأفرع وإضافتها ومسؤولوها)   */}
          {/* ======================================================== */}
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* شريط إدارة الأفرع */}
              <div className="p-5 rounded border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    أفرع مديرية ماء محافظة البصرة ({directorateData.branches.length})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    اختر الفرع من القائمة أدناه لمعاينة بياناته ومسؤوليه أو إضافة فرع جديد.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddBranchModal(true)}
                  className="px-4 py-2 rounded text-xs font-bold transition flex items-center gap-1.5"
                  style={{ backgroundColor: '#1d4ed8', color: '#ffffff' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ إضافة فرع جديد</span>
                </button>
              </div>

              {/* أزرار اختيار الأفرع بتصميم منظم ومحدد */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                {directorateData.branches.map(branch => {
                  const isSelected = selectedBranchId === branch.id
                  return (
                    <button
                      key={branch.id}
                      onClick={() => setSelectedBranchId(branch.id)}
                      className="p-3 rounded text-right transition border text-xs flex flex-col justify-between gap-2"
                      style={{
                        backgroundColor: isSelected ? '#1e293b' : '#ffffff',
                        color: isSelected ? '#ffffff' : '#0f172a',
                        borderColor: isSelected ? '#1e293b' : '#cbd5e1'
                      }}
                    >
                      <span className="font-bold truncate block">{branch.name}</span>
                      <div className="flex items-center justify-between w-full pt-1">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: isSelected ? '#334155' : '#f1f5f9',
                            color: isSelected ? '#ffffff' : '#475569'
                          }}
                        >
                          {branch.subscribers?.length || 0} مشترك
                        </span>
                        {branch.managers && branch.managers.length > 0 && (
                          <span className="text-[10px] text-emerald-600 font-bold">
                            ✓ {branch.managers.length}
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* تفاصيل الفرع المختار ومسؤولوه */}
              {currentBranch && (
                <div className="rounded border border-slate-200 bg-white overflow-hidden space-y-6 p-6">
                  {/* ترويسة الفرع المختار */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h4 className="text-xl font-bold text-slate-900">{currentBranch.name}</h4>
                        <span className="text-xs px-2.5 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                          {currentBranch.subscribers?.length || 0} مشترك
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-600 mt-2">
                        <span>المناطق: <strong>{currentBranch.areas?.length || 0}</strong></span>
                        <span>المحصلون: <strong>{currentBranch.collectors?.length || 0}</strong></span>
                        <span>الكُتّاب: <strong>{currentBranch.writers?.length || 0}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingManager(null)
                          setManagerName('')
                          setManagerPhone('')
                          setShowAddManagerModal(true)
                        }}
                        className="px-3.5 py-2 rounded text-xs font-bold transition flex items-center gap-1.5"
                        style={{ backgroundColor: '#059669', color: '#ffffff' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        <span>إضافة مسؤول للفرع</span>
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(currentBranch.id, currentBranch.name)}
                        className="px-3 py-2 rounded text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition"
                      >
                        حذف الفرع
                      </button>
                    </div>
                  </div>

                  {/* مسؤولو الفرع */}
                  <div>
                    <div className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                      <span>مسؤولو الفرع:</span>
                      <span className="text-xs text-slate-500">({currentBranch.managers?.length || 0})</span>
                    </div>

                    {(!currentBranch.managers || currentBranch.managers.length === 0) ? (
                      <div className="text-center py-10 bg-slate-50 rounded border border-dashed border-slate-300">
                        <p className="text-xs text-slate-600 font-bold">لا يوجد مسؤول مسجل لهذا الفرع حتى الآن</p>
                        <button
                          onClick={() => {
                            setEditingManager(null)
                            setManagerName('')
                            setManagerPhone('')
                            setShowAddManagerModal(true)
                          }}
                          className="mt-3 px-4 py-1.5 rounded text-xs font-bold text-white bg-blue-700 transition"
                        >
                          + إضافة مسؤول للفرع
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {currentBranch.managers.map(manager => (
                          <div
                            key={manager.id}
                            className="p-4 rounded border border-slate-200 bg-white flex flex-col justify-between space-y-3"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-bold text-slate-900 text-sm">{manager.name}</h5>
                                <p className="text-xs text-slate-500 dir-ltr text-right mt-0.5">{manager.phone}</p>
                              </div>
                              <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                مسؤول
                              </span>
                            </div>

                            <div className="pt-2 border-t border-slate-100 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  onClick={() => onVisitBranchManager(currentBranch, manager)}
                                  className="px-2.5 py-1.5 rounded text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition flex items-center justify-center gap-1"
                                >
                                  <span>دخول لصفحته</span>
                                </button>
                                <button
                                  onClick={() => handleShareManagerWhatsApp(manager, currentBranch)}
                                  className="px-2.5 py-1.5 rounded text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition flex items-center justify-center gap-1"
                                >
                                  <span>واتساب</span>
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-1.5">
                                <button
                                  onClick={() => handleCopyManagerLink(manager, currentBranch)}
                                  className="px-2 py-1 rounded text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                >
                                  {copiedManagerId === manager.id ? '✓ تم' : 'نسخ الرابط'}
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingManager(manager)
                                    setManagerName(manager.name)
                                    setManagerPhone(manager.phone)
                                    setShowAddManagerModal(true)
                                  }}
                                  className="px-2 py-1 rounded text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                >
                                  تعديل
                                </button>
                                <button
                                  onClick={() => handleDeleteManager(manager.id, manager.name)}
                                  className="px-2 py-1 rounded text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 transition"
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
          {/* تبويب 3: التقارير والإحصائيات المالية                     */}
          {/* ======================================================== */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* شريط فلترة السنوات */}
              <div className="p-5 rounded border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    تقارير التحصيل المالي ومقارنة الأفرع
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    البيانات المالية المعتمدة لمديرية ماء محافظة البصرة
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded border border-slate-200">
                  <span className="text-xs font-bold text-slate-600 px-2">السنة المالية:</span>
                  {[2026, 2027, 2028].map(yr => (
                    <button
                      key={yr}
                      onClick={() => setReportYear(yr)}
                      className={`px-3 py-1 rounded text-xs font-bold transition ${
                        reportYear === yr
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {yr}
                    </button>
                  ))}
                </div>
              </div>

              {/* مقارنة تحصيل الأفرع */}
              <div className="p-6 rounded border border-slate-200 bg-white space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900">
                    مقارنة المبالغ المستحصلة بين أفرع محافظة البصرة
                  </h4>
                  <span className="text-xs font-bold text-emerald-700">
                    الإجمالي: {totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>

                <div className="space-y-3 pt-1">
                  {branchStats.map(stat => {
                    const maxVal = Math.max(...branchStats.map(s => s.collectedAmount), 1)
                    const percent = Math.min(100, Math.round((stat.collectedAmount / maxVal) * 100))
                    return (
                      <div key={stat.branchId} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800">{stat.name}</span>
                          <span className="font-bold text-emerald-700">
                            {stat.collectedAmount.toLocaleString('ar-IQ')} د.ع
                          </span>
                        </div>
                        <div className="w-full h-2.5 bg-slate-100 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-700 transition-all duration-300"
                            style={{ width: `${Math.max(percent, 2)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* جدول تفصيلي كامل للأفرع */}
              <div className="rounded border border-slate-200 bg-white p-6 space-y-4">
                <h4 className="text-sm font-bold text-slate-900">جدول البيانات المالية الموحدة</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <th className="p-3">اسم الفرع</th>
                        <th className="p-3">المشتركون</th>
                        <th className="p-3">المسؤولون</th>
                        <th className="p-3">المحصلون</th>
                        <th className="p-3">المبالغ المستحصلة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {branchStats.map(s => (
                        <tr key={s.branchId} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-900">{s.name}</td>
                          <td className="p-3 text-slate-700">{s.subscribersCount.toLocaleString('ar-IQ')}</td>
                          <td className="p-3 text-slate-700">{s.managersCount}</td>
                          <td className="p-3 text-slate-700">{s.collectorsCount}</td>
                          <td className="p-3 font-bold text-emerald-700">
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
      {/* 3. النوافذ المنبثقة الرسمية (Modals)                      */}
      {/* ======================================================== */}

      {/* نافذة إضافة فرع جديد */}
      {showAddBranchModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
        >
          <div className="p-6 max-w-md w-full rounded border border-slate-200 bg-white space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              إضافة فرع واردات جديد
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الفرع (مثال: فرع واردات القرنة):
              </label>
              <input
                type="text"
                placeholder="اكتب اسم الفرع..."
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full px-3 py-2 rounded text-xs font-bold border border-slate-300 outline-none"
                autoFocus
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="px-4 py-2 rounded text-xs font-bold bg-slate-100 text-slate-700"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddBranch}
                className="px-4 py-2 rounded text-xs font-bold text-white bg-blue-700"
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
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}
        >
          <div className="p-6 max-w-md w-full rounded border border-slate-200 bg-white space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              {editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ (${currentBranch?.name})`}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الاسم الثلاثي:
                </label>
                <input
                  type="text"
                  placeholder="مثال: أحمد عبد الحسين علي"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full px-3 py-2 rounded text-xs font-bold border border-slate-300 outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  رقم الهاتف:
                </label>
                <input
                  type="text"
                  placeholder="مثال: 07701234567"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded text-xs font-bold border border-slate-300 outline-none dir-ltr text-right"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className="px-4 py-2 rounded text-xs font-bold bg-slate-100 text-slate-700"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManager}
                className="px-4 py-2 rounded text-xs font-bold text-white bg-emerald-600"
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
