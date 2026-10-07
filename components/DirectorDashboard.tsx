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
  const currentBranch = directorateData.branches.find(b => b.id === selectedBranchId) || directorateData.branches[0]

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

    let updatedManagers = [...currentBranch.managers]
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
      const updatedManagers = currentBranch.managers.filter(m => m.id !== managerId)
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
    const msg = `مرحبا ${manager.name}\nمسؤول ${branch.name}\nهذا رابط الفرع الخاص بك للدخول المباشر:\n${directLink}`
    const waUrl = generateWhatsAppLink(manager.phone, msg)
    window.open(waUrl, '_blank')
  }

  // إحصائيات المديرية للتقارير
  const totalSubscribersAllBranches = directorateData.branches.reduce(
    (sum, b) => sum + (b.subscribers?.length || 0),
    0
  )

  // حساب المبالغ المستحصلة لكل فرع
  const branchStats = directorateData.branches.map(b => {
    let collectedAmount = 0
    // من الفواتير والمدفوعات
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
    // من الإرساليات أيضاً إذا وجدت
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
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="rtl">
      {/* الشريط العلوي لمدير الواردات */}
      <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-black text-white text-lg shadow-md">
              ماء
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-white">مديرية ماء محافظة البصرة</h1>
                <span className="bg-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  مدير الواردات
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center gap-2 border border-rose-500/30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              تسجيل الخروج
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي ولوحة التحكم */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* القائمة الجانبية لمدير الواردات */}
        <aside className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">القائمة الرئيسية</h2>
            <nav className="space-y-1">
              <button
                onClick={() => setActiveTab('branches')}
                className={`w-full text-right px-4 py-3 rounded-xl font-black text-sm flex items-center justify-between transition ${
                  activeTab === 'branches'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  إدارة الأفرع
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 font-bold">
                  {directorateData.branches.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('reports')}
                className={`w-full text-right px-4 py-3 rounded-xl font-black text-sm flex items-center justify-between transition ${
                  activeTab === 'reports'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  التقارير والإحصائيات
                </span>
              </button>
            </nav>
          </div>

          {/* ملخص إحصائي سريع */}
          <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase">مؤشرات الأداء العامة</h3>
            <div>
              <p className="text-xs text-slate-300">إجمالي مشتركي المحافظة</p>
              <p className="text-2xl font-black text-cyan-300 mt-0.5">{totalSubscribersAllBranches.toLocaleString('ar-IQ')}</p>
            </div>
            <div className="pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-300">إجمالي المبالغ المستحصلة</p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{totalCollectedAllBranches.toLocaleString('ar-IQ')} د.ع</p>
            </div>
          </div>
        </aside>

        {/* جسم الشاشة الرئيسي */}
        <main className="lg:col-span-3 space-y-6">
          {activeTab === 'branches' && (
            <div className="space-y-6">
              {/* شريط اختيار وإضافة الفرع */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">أفرع مديرية ماء البصرة</h2>
                </div>
                <button
                  onClick={() => setShowAddBranchModal(true)}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  إضافة فرع جديد
                </button>
              </div>

              {/* أزرار التنقل بين الأفرع */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {directorateData.branches.map(branch => (
                  <button
                    key={branch.id}
                    onClick={() => setSelectedBranchId(branch.id)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs whitespace-nowrap transition flex items-center gap-2 ${
                      selectedBranchId === branch.id
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                    }`}
                  >
                    <span>{branch.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-800 font-black">
                      {branch.subscribers?.length || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* تفاصيل الفرع المحدد ومسؤولوه */}
              {currentBranch && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-xl font-black text-slate-900">{currentBranch.name}</h3>
                        <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-bold rounded-lg border border-blue-200">
                          {currentBranch.subscribers?.length || 0} مشترك
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        عدد المناطق: {currentBranch.areas?.length || 0} | عدد المحصلين: {currentBranch.collectors?.length || 0} | عدد الكتاب: {currentBranch.writers?.length || 0}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingManager(null)
                          setManagerName('')
                          setManagerPhone('')
                          setShowAddManagerModal(true)
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm transition flex items-center gap-1.5"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                        إضافة مسؤول للفرع
                      </button>

                      <button
                        onClick={() => handleDeleteBranch(currentBranch.id, currentBranch.name)}
                        className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl font-bold text-xs border border-rose-200 transition"
                      >
                        حذف الفرع
                      </button>
                    </div>
                  </div>

                  {/* قائمة مسؤولي هذا الفرع */}
                  <div>
                    <h4 className="text-sm font-black text-slate-800 mb-4 flex items-center gap-2">
                      <span>مسؤولو {currentBranch.name}</span>
                      <span className="text-xs text-slate-500">({currentBranch.managers.length})</span>
                    </h4>

                    {currentBranch.managers.length === 0 ? (
                      <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <p className="text-sm font-bold text-slate-600">لا يوجد مسؤول مسجل لهذا الفرع حتى الآن</p>
                        <button
                          onClick={() => {
                            setEditingManager(null)
                            setManagerName('')
                            setManagerPhone('')
                            setShowAddManagerModal(true)
                          }}
                          className="mt-3 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition"
                        >
                          إضافة مسؤول
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {currentBranch.managers.map(manager => (
                          <div
                            key={manager.id}
                            className="bg-slate-50 hover:bg-slate-100/80 p-5 rounded-2xl border border-slate-200 transition space-y-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-base">
                                  {manager.name.charAt(0)}
                                </div>
                                <div>
                                  <h5 className="font-black text-slate-900 text-base">{manager.name}</h5>
                                  <p className="text-xs font-semibold text-slate-500 dir-ltr">{manager.phone}</p>
                                </div>
                              </div>
                              <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                                مسؤول فرع
                              </span>
                            </div>

                            {/* الإجراءات الأربعة المطلوبة لكل مسؤول */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                              {/* 1. زيارة صفحة المسؤول */}
                              <button
                                onClick={() => onVisitBranchManager(currentBranch, manager)}
                                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                                زيارة الصفحة
                              </button>

                              {/* 2. مشاركة رابط المسؤول بالواتساب */}
                              <button
                                onClick={() => handleShareManagerWhatsApp(manager, currentBranch)}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766 0-3.18-2.587-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.941-.708-1.792s.446-1.27.605-1.444c.159-.175.347-.219.462-.219.116 0 .232.001.332.006.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.101-.179.21-.077.385.101.174.453.748.971 1.209.667.593 1.229.776 1.403.863.174.087.275.072.376-.044.101-.116.433-.505.549-.679.116-.174.232-.145.39-.087s1.011.477 1.185.564c.174.087.289.13.332.203.043.072.043.419-.101.824z"/>
                                </svg>
                                مشاركة بالواتساب
                              </button>

                              {/* 3. تعديل المسؤول */}
                              <button
                                onClick={() => {
                                  setEditingManager(manager)
                                  setManagerName(manager.name)
                                  setManagerPhone(manager.phone)
                                  setShowAddManagerModal(true)
                                }}
                                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition text-center"
                              >
                                تعديل
                              </button>

                              {/* 4. مسح المسؤول */}
                              <button
                                onClick={() => handleDeleteManager(manager.id, manager.name)}
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
                </div>
              )}
            </div>
          )}

          {/* تبويب التقارير والإحصائيات والرسوم البيانية لمدير الواردات */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">تقارير حركة الأفرع والتحصيل</h2>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-slate-600">اختر السنة:</label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value={2026}>سنة 2026</option>
                    <option value={2027}>سنة 2027</option>
                    <option value={2028}>سنة 2028</option>
                  </select>
                </div>
              </div>

              {/* رسم بياني 1: مقارنة المبالغ المستحصلة بين الأفرع */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>المبالغ المستحصلة لكل فرع في محافظة البصرة</span>
                </h3>

                <div className="space-y-3 pt-2">
                  {branchStats.map(stat => {
                    const maxVal = Math.max(...branchStats.map(s => s.collectedAmount), 1)
                    const percent = Math.min(100, Math.round((stat.collectedAmount / maxVal) * 100))
                    return (
                      <div key={stat.branchId} className="space-y-1">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-800">{stat.name}</span>
                          <span className="text-emerald-700">{stat.collectedAmount.toLocaleString('ar-IQ')} د.ع</span>
                        </div>
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(percent, 4)}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* رسم بياني 2: تطور التحصيل عبر أشهر وفترات السنة */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <h3 className="text-sm font-black text-slate-900">
                  تطور التحصيل خلال فترات سنة ({reportYear})
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 pt-4">
                  {monthlyStatsForYear.map((m, idx) => {
                    const maxPeriod = Math.max(...monthlyStatsForYear.map(x => x.amount), 1)
                    const heightPercent = Math.min(100, Math.round((m.amount / maxPeriod) * 100))
                    return (
                      <div key={idx} className="flex flex-col items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                        <div className="w-full h-28 flex items-end justify-center">
                          <div
                            className="w-8 bg-blue-600 hover:bg-blue-500 rounded-t-lg transition-all duration-300"
                            style={{ height: `${Math.max(heightPercent, 10)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-bold text-slate-700">{m.periodLabel}</span>
                        <span className="text-[10px] font-black text-emerald-700">
                          {m.amount > 0 ? m.amount.toLocaleString('ar-IQ') : '0'} د.ع
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* جدول تفصيلي بالأرقام */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 overflow-x-auto">
                <h3 className="text-sm font-black text-slate-900 mb-4">جدول ملخص الأفرع والمحصلين</h3>
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                      <th className="p-3">الفرع</th>
                      <th className="p-3">عدد المشتركين</th>
                      <th className="p-3">المسؤولون</th>
                      <th className="p-3">المحصلون</th>
                      <th className="p-3">المبالغ المستحصلة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {branchStats.map(s => (
                      <tr key={s.branchId} className="hover:bg-slate-50 font-bold">
                        <td className="p-3 text-slate-900">{s.name}</td>
                        <td className="p-3">{s.subscribersCount.toLocaleString('ar-IQ')}</td>
                        <td className="p-3">{s.managersCount}</td>
                        <td className="p-3">{s.collectorsCount}</td>
                        <td className="p-3 text-emerald-700">{s.collectedAmount.toLocaleString('ar-IQ')} د.ع</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* نافذة إضافة فرع جديد */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in">
            <h3 className="text-lg font-black text-slate-900">إضافة فرع واردات جديد</h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم الفرع:</label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowAddBranchModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleAddBranch}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                إضافة الفرع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل مسؤول فرع */}
      {showAddManagerModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in">
            <h3 className="text-lg font-black text-slate-900">
              {editingManager ? 'تعديل بيانات المسؤول' : `إضافة مسؤول لـ (${currentBranch?.name})`}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الثلاثي:</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManager}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition"
              >
                حفظ المسؤول
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
