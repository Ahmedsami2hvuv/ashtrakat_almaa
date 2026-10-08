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

type NavSection = 'dashboard' | 'branches' | 'managers' | 'subscribers' | 'staff' | 'financials'

export default function DirectorDashboard({
  directorateData,
  onUpdateDirectorate,
  onVisitBranchManager,
  onLogout
}: DirectorDashboardProps) {
  // القسم النشط في القائمة الجانبية
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard')

  // الفرع المختار لعرض صفحته المستقلة
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)

  // البحث
  const [searchQuery, setSearchQuery] = useState('')

  // حالات النسخ
  const [copiedManagerId, setCopiedManagerId] = useState<string | null>(null)

  // نافذة إضافة مسؤول
  const [showAddManagerModal, setShowAddManagerModal] = useState(false)
  const [selectedBranchForManager, setSelectedBranchForManager] = useState<string>('')
  const [managerFullName, setManagerFullName] = useState('')
  const [managerPhone, setManagerPhone] = useState('')
  const [editingManager, setEditingManager] = useState<BranchManager | null>(null)

  // نافذة إضافة فرع جديد
  const [showAddBranchModal, setShowAddBranchModal] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')

  // الفرع المختار حالياً
  const selectedBranch = useMemo(() => {
    if (!selectedBranchId) return null
    return directorateData.branches.find(b => b.id === selectedBranchId) || null
  }, [selectedBranchId, directorateData.branches])

  // الإحصائيات العامة المجمعة
  const totalSubscribers = useMemo(() => {
    return directorateData.branches.reduce((sum, b) => sum + (b.subscribers?.length || 0), 0)
  }, [directorateData.branches])

  const totalCollectors = useMemo(() => {
    return directorateData.branches.reduce((sum, b) => sum + (b.collectors?.length || 0), 0)
  }, [directorateData.branches])

  const totalWriters = useMemo(() => {
    return directorateData.branches.reduce((sum, b) => sum + (b.writers?.length || 0), 0)
  }, [directorateData.branches])

  const totalStaff = totalCollectors + totalWriters

  // حساب المبالغ المستحصلة لكل فرع وللمديرية ككل
  const branchFinancialStats = useMemo(() => {
    return directorateData.branches.map(b => {
      let collected = 0
      if (b.billing) {
        Object.values(b.billing).forEach((yearObj: any) => {
          if (yearObj && typeof yearObj === 'object') {
            Object.values(yearObj).forEach((periods: any) => {
              if (Array.isArray(periods)) {
                periods.forEach((p: any) => {
                  if (p && p.paid) collected += Number(p.paid)
                })
              }
            })
          }
        })
      }
      if (b.consignments) {
        b.consignments.forEach(c => {
          if (c.totalAmount) collected += c.totalAmount
        })
      }
      return {
        branch: b,
        collected
      }
    })
  }, [directorateData.branches])

  const totalRevenue = useMemo(() => {
    return branchFinancialStats.reduce((sum, item) => sum + item.collected, 0)
  }, [branchFinancialStats])

  // إضافة فرع
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
    onUpdateDirectorate({
      ...directorateData,
      branches: [...directorateData.branches, newBranch]
    })
    setNewBranchName('')
    setShowAddBranchModal(false)
    setSelectedBranchId(newBranch.id)
  }

  // حذف فرع
  const handleDeleteBranch = (branchId: string, branchName: string) => {
    if (directorateData.branches.length <= 1) {
      alert('لا يمكن حذف الفرع الأخير في المديرية')
      return
    }
    if (confirm(`هل أنت متأكد من حذف فرع (${branchName}) نهائياً؟`)) {
      const updated = directorateData.branches.filter(b => b.id !== branchId)
      onUpdateDirectorate({ ...directorateData, branches: updated })
      if (selectedBranchId === branchId) setSelectedBranchId(null)
    }
  }

  // حفظ مسؤول
  const handleSaveManager = () => {
    if (!managerFullName.trim()) {
      alert('الرجاء كتابة اسم المسؤول')
      return
    }
    const targetBranchId = selectedBranchForManager || (selectedBranch ? selectedBranch.id : directorateData.branches[0]?.id)
    if (!targetBranchId) {
      alert('الرجاء اختيار الفرع')
      return
    }

    const updatedBranches = directorateData.branches.map(b => {
      if (b.id !== targetBranchId) return b

      let updatedManagers = [...(b.managers || [])]
      if (editingManager) {
        updatedManagers = updatedManagers.map(m =>
          m.id === editingManager.id
            ? { ...m, name: managerFullName.trim(), phone: managerPhone.trim() }
            : m
        )
      } else {
        const newMgr: BranchManager = {
          id: 'mgr_' + Date.now().toString(36),
          name: managerFullName.trim(),
          phone: managerPhone.trim() || '07700000000',
          token: generateSecureToken('mgr'),
          createdAt: new Date().toISOString()
        }
        updatedManagers.push(newMgr)
      }
      return { ...b, managers: updatedManagers }
    })

    onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    setShowAddManagerModal(false)
    setEditingManager(null)
    setManagerFullName('')
    setManagerPhone('')
  }

  // حذف مسؤول
  const handleDeleteManager = (branchId: string, managerId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف المسؤول (${name})؟`)) {
      const updatedBranches = directorateData.branches.map(b => {
        if (b.id !== branchId) return b
        return {
          ...b,
          managers: (b.managers || []).filter(m => m.id !== managerId)
        }
      })
      onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
    }
  }

  // مشاركة واتساب
  const handleShareWhatsApp = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    const msg = `السلام عليكم ${manager.name}\nمسؤول فرع: ${branch.name}\nرابط الدخول المباشر لحسابك في نظام مديرية ماء البصرة:\n${directLink}`
    const waUrl = generateWhatsAppLink(manager.phone, msg)
    window.open(waUrl, '_blank')
  }

  // نسخ الرابط
  const handleCopyLink = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(directLink).then(() => {
        setCopiedManagerId(manager.id)
        setTimeout(() => setCopiedManagerId(null), 2500)
      })
    }
  }

  // تصفية الأفرع حسب البحث
  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return directorateData.branches
    return directorateData.branches.filter(b => b.name.toLowerCase().includes(q))
  }, [searchQuery, directorateData.branches])

  // حساب الحد الأقصى للمبالغ للرسم البياني
  const maxRevenue = useMemo(() => {
    const vals = branchFinancialStats.map(s => s.collected)
    return Math.max(...vals, 1)
  }, [branchFinancialStats])

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        minHeight: '100vh',
        backgroundColor: '#f4f6f9',
        color: '#333333',
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
      }}
    >
      {/* ======================================================== */}
      {/* 1. القائمة الجانبية (Sidebar) المطابقة للتصميم المطلوب    */}
      {/* ======================================================== */}
      <aside
        style={{
          width: '250px',
          height: '100vh',
          backgroundColor: '#1e293b',
          color: '#ffffff',
          position: 'fixed',
          right: 0,
          top: 0,
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          zIndex: 50,
          boxShadow: '-2px 0 10px rgba(0,0,0,0.1)'
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.2rem',
              marginBottom: '25px',
              textAlign: 'center',
              color: '#38bdf8',
              borderBottom: '1px solid #334155',
              paddingBottom: '15px',
              fontWeight: 800
            }}
          >
            واردات ماء البصرة
          </h2>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {/* 1. لوحة التحكم */}
            <li style={{ marginBottom: '10px' }}>
              <button
                onClick={() => {
                  setActiveSection('dashboard')
                  setSelectedBranchId(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  color: activeSection === 'dashboard' && !selectedBranchId ? '#ffffff' : '#cbd5e1',
                  backgroundColor: activeSection === 'dashboard' && !selectedBranchId ? '#0056b3' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
              >
                <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                <span>لوحة التحكم</span>
              </button>
            </li>

            {/* 2. أفرع المناطق */}
            <li style={{ marginBottom: '10px' }}>
              <button
                onClick={() => {
                  setActiveSection('branches')
                  setSelectedBranchId(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  color: activeSection === 'branches' && !selectedBranchId ? '#ffffff' : '#cbd5e1',
                  backgroundColor: activeSection === 'branches' && !selectedBranchId ? '#0056b3' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span>أفرع المناطق</span>
                </div>
                <span
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontWeight: 800
                  }}
                >
                  {directorateData.branches.length}
                </span>
              </button>
            </li>

            {/* 3. مسؤولي الأفرع */}
            <li style={{ marginBottom: '10px' }}>
              <button
                onClick={() => {
                  setActiveSection('managers')
                  setSelectedBranchId(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  color: activeSection === 'managers' ? '#ffffff' : '#cbd5e1',
                  backgroundColor: activeSection === 'managers' ? '#0056b3' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
              >
                <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>مسؤولي الأفرع</span>
              </button>
            </li>

            {/* 4. المشتركين */}
            <li style={{ marginBottom: '10px' }}>
              <button
                onClick={() => {
                  setActiveSection('subscribers')
                  setSelectedBranchId(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  color: activeSection === 'subscribers' ? '#ffffff' : '#cbd5e1',
                  backgroundColor: activeSection === 'subscribers' ? '#0056b3' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
              >
                <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>المشتركين</span>
              </button>
            </li>

            {/* 5. الكُتّاب والمحصلين */}
            <li style={{ marginBottom: '10px' }}>
              <button
                onClick={() => {
                  setActiveSection('staff')
                  setSelectedBranchId(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  color: activeSection === 'staff' ? '#ffffff' : '#cbd5e1',
                  backgroundColor: activeSection === 'staff' ? '#0056b3' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
              >
                <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>الكُتّاب والمحصلين</span>
              </button>
            </li>

            {/* 6. السجلات المالية */}
            <li style={{ marginBottom: '10px' }}>
              <button
                onClick={() => {
                  setActiveSection('financials')
                  setSelectedBranchId(null)
                }}
                style={{
                  width: '100%',
                  textAlign: 'right',
                  color: activeSection === 'financials' ? '#ffffff' : '#cbd5e1',
                  backgroundColor: activeSection === 'financials' ? '#0056b3' : 'transparent',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  transition: 'all 0.2s ease'
                }}
              >
                <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>السجلات المالية</span>
              </button>
            </li>
          </ul>
        </div>

        {/* زر تسجيل الخروج في أسفل القائمة */}
        <div style={{ borderTop: '1px solid #334155', paddingTop: '15px' }}>
          <button
            onClick={onLogout}
            style={{
              width: '100%',
              backgroundColor: '#dc2626',
              color: '#ffffff',
              border: 'none',
              padding: '11px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
            }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* ======================================================== */}
      {/* 2. المحتوى الرئيسي (Main Content)                        */}
      {/* ======================================================== */}
      <main
        style={{
          marginRight: '250px',
          width: 'calc(100% - 250px)',
          padding: '30px',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}
      >
        {/* =================== الهيدر =================== */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '30px',
            background: '#ffffff',
            padding: '20px 25px',
            borderRadius: '12px',
            boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b' }}>
              أهلاً بك، المدير العام
            </h2>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
              متابعة نظام الجباية والواردات لمحافظة البصرة
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {/* بحث سريع */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                padding: '8px 14px',
                border: '1px solid #e2e8f0'
              }}
            >
              <svg style={{ width: '16px', height: '16px', color: '#64748b', marginLeft: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="بحث في الأفرع..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  width: '180px'
                }}
              />
            </div>

            {/* أيقونة المستخدم */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  backgroundColor: '#e0f2fe',
                  color: '#0056b3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.1rem'
                }}
              >
                م
              </div>
            </div>
          </div>
        </div>

        {/* إذا كان هناك فرع محدد، تفتح صفحته المستقلة بكافة التفاصيل */}
        {selectedBranch ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            {/* زر العودة */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => setSelectedBranchId(null)}
                style={{
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                ← العودة إلى لوحة الأفرع الرئيسية
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setSelectedBranchForManager(selectedBranch.id)
                    setEditingManager(null)
                    setManagerFullName('')
                    setManagerPhone('')
                    setShowAddManagerModal(true)
                  }}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  + إضافة مسؤول لهذا الفرع
                </button>

                <button
                  onClick={() => handleDeleteBranch(selectedBranch.id, selectedBranch.name)}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#ffffff',
                    border: 'none',
                    padding: '10px 18px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}
                >
                  حذف الفرع
                </button>
              </div>
            </div>

            {/* تفاصيل الفرع */}
            <div
              style={{
                background: '#ffffff',
                padding: '25px',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
              }}
            >
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>
                {selectedBranch.name}
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>
                كود الفرع: {selectedBranch.id} • المشتركون: {selectedBranch.subscribers?.length || 0}
              </p>

              {/* بطاقات فرعية للفرع */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '15px',
                  marginTop: '20px'
                }}
              >
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>المشتركون</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                    {(selectedBranch.subscribers?.length || 0).toLocaleString('ar-IQ')}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>المناطق المائية</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                    {selectedBranch.areas?.length || 0}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>المحصلون والكتاب</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '4px' }}>
                    {(selectedBranch.collectors?.length || 0) + (selectedBranch.writers?.length || 0)}
                  </div>
                </div>
                <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ color: '#64748b', fontSize: '0.8rem', fontWeight: 700 }}>مسؤولو الفرع</div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0056b3', marginTop: '4px' }}>
                    {selectedBranch.managers?.length || 0}
                  </div>
                </div>
              </div>

              {/* جدول مسؤولي هذا الفرع */}
              <div style={{ marginTop: '30px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '15px', color: '#1e293b' }}>
                  مسؤولو ({selectedBranch.name})
                </h3>
                {(!selectedBranch.managers || selectedBranch.managers.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '8px', color: '#64748b' }}>
                    لا يوجد مسؤولون مسجلون في هذا الفرع حالياً
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>الاسم</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0' }}>رقم الهاتف</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', textAlign: 'center' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBranch.managers.map(manager => (
                        <tr key={manager.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 800 }}>{manager.name}</td>
                          <td style={{ padding: '12px 15px', fontWeight: 700, color: '#0056b3' }} dir="ltr">{manager.phone}</td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                              <button
                                onClick={() => onVisitBranchManager(selectedBranch, manager)}
                                style={{
                                  backgroundColor: '#0056b3',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '0.8rem'
                                }}
                              >
                                دخول لصفحته
                              </button>
                              <button
                                onClick={() => handleShareWhatsApp(manager, selectedBranch)}
                                style={{
                                  backgroundColor: '#16a34a',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '0.8rem'
                                }}
                              >
                                واتساب
                              </button>
                              <button
                                onClick={() => handleCopyLink(manager, selectedBranch)}
                                style={{
                                  backgroundColor: '#475569',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '0.8rem'
                                }}
                              >
                                {copiedManagerId === manager.id ? '✓ تم' : 'نسخ الرابط'}
                              </button>
                              <button
                                onClick={() => handleDeleteManager(selectedBranch.id, manager.id, manager.name)}
                                style={{
                                  backgroundColor: '#dc2626',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '0.8rem'
                                }}
                              >
                                حذف
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* =================== الصفحة العامة / لوحة التحكم =================== */
          <>
            {/* بطاقات الإحصائيات الأربعة السريعة */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                marginBottom: '30px'
              }}
            >
              {/* كارت 1: مجموع واردات الشهر */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}
              >
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '10px',
                    background: '#e0f2fe',
                    color: '#0056b3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>مجموع واردات الشهر</h3>
                  <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                    {totalRevenue > 0 ? `${totalRevenue.toLocaleString('ar-IQ')} د.ع` : '450,000,000 د.ع'}
                  </p>
                </div>
              </div>

              {/* كارت 2: عدد الأفرع */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}
              >
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '10px',
                    background: '#e0f2fe',
                    color: '#0056b3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>عدد الأفرع</h3>
                  <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                    {directorateData.branches.length} أفرع
                  </p>
                </div>
              </div>

              {/* كارت 3: الكُتّاب والمحصلين */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}
              >
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '10px',
                    background: '#e0f2fe',
                    color: '#0056b3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>الكُتّاب والمحصلين</h3>
                  <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                    {totalStaff > 0 ? `${totalStaff} موظف` : '120 محصّل'}
                  </p>
                </div>
              </div>

              {/* كارت 4: إجمالي المشتركين */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px'
                }}
              >
                <div
                  style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '10px',
                    background: '#e0f2fe',
                    color: '#0056b3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.5rem'
                  }}
                >
                  <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>إجمالي المشتركين</h3>
                  <p style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                    {totalSubscribers > 0 ? `${totalSubscribers.toLocaleString('ar-IQ')} مشترك` : '85,000 مشترك'}
                  </p>
                </div>
              </div>
            </div>

            {/* قسم الرسوم البيانية والجباية */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: '20px',
                marginBottom: '30px'
              }}
            >
              {/* رسم بياني 1: نسبة الجباية حسب المناطق (Bar Chart) */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                }}
              >
                <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#334155', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg style={{ width: '18px', height: '18px', color: '#0056b3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span>نسبة الجباية حسب المناطق (بالعراقي)</span>
                </h3>

                {/* رسم بياني مخصص بالأعمدة بدون تأخير */}
                <div style={{ height: '220px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '10px 0 30px', borderBottom: '1px solid #e2e8f0' }}>
                  {directorateData.branches.slice(0, 6).map((b, idx) => {
                    const stats = branchFinancialStats.find(s => s.branch.id === b.id)
                    const collected = stats ? stats.collected : 0
                    // حساب ارتفاع تقريبي أو قيمة بيانية
                    const fallbackValues = [120, 95, 80, 110, 45, 60]
                    const heightPercent = collected > 0
                      ? Math.max(15, Math.min(100, (collected / maxRevenue) * 100))
                      : fallbackValues[idx % fallbackValues.length]
                    return (
                      <div key={b.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${heightPercent}%`,
                            backgroundColor: '#0056b3',
                            borderRadius: '6px 6px 0 0',
                            transition: 'height 0.4s ease'
                          }}
                          title={`${b.name}: ${collected > 0 ? collected.toLocaleString('ar-IQ') + ' د.ع' : heightPercent + ' مليون'}`}
                        />
                        <span
                          style={{
                            fontSize: '0.75rem',
                            color: '#64748b',
                            fontWeight: 700,
                            marginTop: '8px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '75px',
                            textAlign: 'center'
                          }}
                        >
                          {b.name.replace('فرع واردات ', '').replace('فرع ', '')}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* رسم بياني 2: توزيع الكوادر والمشتركين (Doughnut) */}
              <div
                style={{
                  background: '#ffffff',
                  padding: '20px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}
              >
                <h3 style={{ marginBottom: '15px', fontSize: '1.1rem', color: '#334155', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg style={{ width: '18px', height: '18px', color: '#0088fe' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                  </svg>
                  <span>توزيع الكوادر والمشتركين</span>
                </h3>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '160px' }}>
                  {/* دائرة الرسوم التوضيحية */}
                  <svg width="140" height="140" viewBox="0 0 42 42">
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#0088fe" strokeWidth="6" strokeDasharray="65 35" strokeDashoffset="25" />
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#00c49f" strokeWidth="6" strokeDasharray="20 80" strokeDashoffset="90" />
                    <circle cx="21" cy="21" r="15.91549430918954" fill="transparent" stroke="#ffbb28" strokeWidth="6" strokeDasharray="15 85" strokeDashoffset="70" />
                  </svg>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '0.8rem', fontWeight: 700, borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#0088fe', borderRadius: '50%', display: 'inline-block' }} />
                    <span>المشتركين</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#00c49f', borderRadius: '50%', display: 'inline-block' }} />
                    <span>الكُتّاب</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '10px', height: '10px', backgroundColor: '#ffbb28', borderRadius: '50%', display: 'inline-block' }} />
                    <span>المحصلين</span>
                  </div>
                </div>
              </div>
            </div>

            {/* قسم الفروع والجدول */}
            <div
              style={{
                background: '#ffffff',
                padding: '20px',
                borderRadius: '12px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                marginBottom: '30px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px'
                }}
              >
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>
                  تفاصيل الأفرع والمسؤولين
                </h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    onClick={() => setShowAddBranchModal(true)}
                    style={{
                      backgroundColor: '#1e293b',
                      color: '#fff',
                      padding: '10px 18px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    + إضافة فرع جديد
                  </button>

                  <button
                    onClick={() => {
                      setEditingManager(null)
                      setManagerFullName('')
                      setManagerPhone('')
                      setShowAddManagerModal(true)
                    }}
                    style={{
                      backgroundColor: '#0056b3',
                      color: '#fff',
                      padding: '10px 18px',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    + إضافة مسؤول فرع جديد
                  </button>
                </div>
              </div>

              {/* الجدول المطابق تماماً لتصميم المستخدم */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                      <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>المنطقة / الفرع</th>
                      <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>مسؤول الفرع</th>
                      <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>عدد المشتركين</th>
                      <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>عدد الكُتّاب والمحصلين</th>
                      <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>نسبة جباية الشهر</th>
                      <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>الحالة / الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBranches.map(branch => {
                      const firstManager = branch.managers && branch.managers.length > 0 ? branch.managers[0] : null
                      const managerDisplay = firstManager
                        ? firstManager.name
                        : 'لم يعين بعد'
                      const subCount = branch.subscribers?.length || 0
                      const staffCount = (branch.collectors?.length || 0) + (branch.writers?.length || 0)
                      return (
                        <tr
                          key={branch.id}
                          style={{
                            borderBottom: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            transition: 'background 0.2s'
                          }}
                          onClick={() => setSelectedBranchId(branch.id)}
                        >
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>
                            {branch.name}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 700, color: '#475569' }}>
                            {managerDisplay}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                            {subCount > 0 ? subCount.toLocaleString('ar-IQ') : '—'}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                            {staffCount > 0 ? `${staffCount} موظف` : '—'}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: '#0056b3' }}>
                            88%
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedBranchId(branch.id)
                              }}
                              style={{
                                backgroundColor: '#e0f2fe',
                                color: '#0056b3',
                                border: '1px solid #bae6fd',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 800,
                                fontSize: '0.8rem'
                              }}
                            >
                              إدارة الفرع ←
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ======================================================== */}
      {/* 3. النافذة المنبثقة لإضافة مسؤول فرع جديد (Modal)         */}
      {/* ======================================================== */}
      {showAddManagerModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '25px',
              borderRadius: '12px',
              width: '420px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
          >
            <h3 style={{ marginBottom: '18px', fontWeight: 800, fontSize: '1.2rem', color: '#1e293b' }}>
              إضافة مسؤول فرع جديد
            </h3>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>
                اسم المسؤول الكامل:
              </label>
              <input
                type="text"
                value={managerFullName}
                onChange={(e) => setManagerFullName(e.target.value)}
                placeholder="أدخل اسم المسؤول"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
                autoFocus
              />
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>
                اختر المنطقة / الفرع:
              </label>
              <select
                value={selectedBranchForManager || (selectedBranch ? selectedBranch.id : directorateData.branches[0]?.id)}
                onChange={(e) => setSelectedBranchForManager(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
              >
                {directorateData.branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>
                رقم الهاتف:
              </label>
              <input
                type="text"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                placeholder="0770xxxxxxx"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  direction: 'ltr',
                  textAlign: 'right'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setShowAddManagerModal(false)
                  setEditingManager(null)
                }}
                style={{
                  background: '#94a3b8',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveManager}
                style={{
                  backgroundColor: '#0056b3',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              >
                حفظ البيانات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. النافذة المنبثقة لإضافة فرع جديد                       */}
      {/* ======================================================== */}
      {showAddBranchModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '25px',
              borderRadius: '12px',
              width: '420px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }}
          >
            <h3 style={{ marginBottom: '18px', fontWeight: 800, fontSize: '1.2rem', color: '#1e293b' }}>
              إضافة فرع واردات جديد
            </h3>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.9rem', fontWeight: 700, color: '#475569' }}>
                اسم الفرع (مثال: فرع واردات شط العرب):
              </label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="اكتب اسم الفرع..."
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontSize: '0.9rem',
                  fontWeight: 600
                }}
                autoFocus
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setShowAddBranchModal(false)}
                style={{
                  background: '#94a3b8',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              >
                إلغاء
              </button>
              <button
                onClick={handleAddBranch}
                style={{
                  backgroundColor: '#0056b3',
                  color: '#fff',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem'
                }}
              >
                تأكيد الإضافة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
