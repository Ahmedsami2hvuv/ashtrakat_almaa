'use client'

import React, { useState, useMemo } from 'react'
import { DirectorateData, DirectorateBranch, BranchManager, BranchCollector, BranchWriter } from '@/lib/directorateTypes'
import { generateSecureToken, generateWhatsAppLink } from '@/lib/directorateStore'
import { Area, Subscriber, calculateBilling, PERIODS, formatInputDisplay } from '@/components/MainApp'

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
  // حالة فتح وإغلاق القائمة الجانبية (مغلقة افتراضياً بناء على طلب المدير)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  // القسم النشط في القائمة الجانبية
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard')

  // الفرع المختار لعرض صفحته المستقلة
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null)

  // البحث
  const [searchQuery, setSearchQuery] = useState('')

  // حالات النسخ
  const [copiedManagerId, setCopiedManagerId] = useState<string | null>(null)

  // التبويب النشط داخل صفحة الفرع المستقلة
  const [branchDetailTab, setBranchDetailTab] = useState<'subscribers' | 'areas' | 'collectors' | 'writers' | 'managers'>('subscribers')

  // بحث المشتركين داخل الفرع
  const [branchSubscriberSearch, setBranchSubscriberSearch] = useState('')

  // المشترك المختار للعرض فقط (Read-only للمدير)
  const [viewingSubscriber, setViewingSubscriber] = useState<Subscriber | null>(null)
  const [viewingSubscriberYear, setViewingSubscriberYear] = useState<number>(2026)

  // المحصل المختار لعرض تفاصيل الجباية والمناطق
  const [viewingCollector, setViewingCollector] = useState<BranchCollector | null>(null)

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

  // قائمة بجميع مسؤولي الأفرع عبر كافة الأفرع
  const allManagersList = useMemo(() => {
    const list: { manager: BranchManager; branch: DirectorateBranch }[] = []
    directorateData.branches.forEach(b => {
      ;(b.managers || []).forEach(m => {
        list.push({ manager: m, branch: b })
      })
    })
    return list
  }, [directorateData.branches])

  // قائمة بجميع المشتركين عبر كافة الأفرع
  const allSubscribersList = useMemo(() => {
    const list: { subscriber: Subscriber; branch: DirectorateBranch }[] = []
    directorateData.branches.forEach(b => {
      ;(b.subscribers || []).forEach(s => {
        list.push({ subscriber: s, branch: b })
      })
    })
    return list
  }, [directorateData.branches])

  // تصفية جميع المشتركين حسب البحث
  const filteredAllSubscribers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return allSubscribersList
    return allSubscribersList.filter(item => {
      const s = item.subscriber
      const b = item.branch
      return (
        s.name?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.id?.toString().includes(q) ||
        b.name?.toLowerCase().includes(q)
      )
    })
  }, [allSubscribersList, searchQuery])

  // قائمة بجميع المحصلين والكُتّاب عبر كافة الأفرع
  const allStaffList = useMemo(() => {
    const list: {
      id: string
      name: string
      phone: string
      type: 'collector' | 'writer'
      branch: DirectorateBranch
      areasCount: number
      collected: number
      rawCollector?: BranchCollector
      rawWriter?: BranchWriter
    }[] = []

    directorateData.branches.forEach(b => {
      ;(b.collectors || []).forEach(c => {
        let colSum = 0
        if (b.consignments) {
          b.consignments.filter(cons => cons.collectorId === c.id).forEach(cons => {
            colSum += cons.totalAmount || 0
          })
        }
        list.push({
          id: c.id,
          name: c.name,
          phone: c.phone,
          type: 'collector',
          branch: b,
          areasCount: c.assignedAreaIds?.length || 0,
          collected: colSum,
          rawCollector: c
        })
      })

      ;(b.writers || []).forEach(w => {
        list.push({
          id: w.id,
          name: w.name,
          phone: w.phone,
          type: 'writer',
          branch: b,
          areasCount: w.assignedAreaIds?.length || 0,
          collected: 0,
          rawWriter: w
        })
      })
    })

    return list
  }, [directorateData.branches])

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
      {/* تنسيقات الجوال المتجاوبة وتصميم مديرية ماء البصرة        */}
      {/* ======================================================== */}
      <style>{`
        /* القائمة السفلية للموبايل (تختفي بالحاسبة وتظهر بالهاتف) */
        .mobile-nav {
          display: none;
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          background-color: #1e293b;
          justify-content: space-around;
          align-items: center;
          padding: 8px 4px;
          box-shadow: 0 -3px 15px rgba(0,0,0,0.2);
          z-index: 1000;
          border-top: 1px solid #334155;
        }

        .mobile-nav-item {
          color: #94a3b8;
          text-decoration: none;
          font-size: 0.72rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 5px 8px;
          border-radius: 8px;
          transition: all 0.2s ease;
          font-weight: 700;
          font-family: inherit;
        }

        .mobile-nav-item.active, .mobile-nav-item:hover {
          color: #38bdf8;
        }

        .mobile-nav-item.active {
          background-color: rgba(56, 189, 248, 0.12);
        }

        /* تنسيقات مخصصة عند فتح الصفحة من الموبايل (الشاشات أصغر من 768px) */
        @media (max-width: 768px) {
          .mobile-nav {
            display: flex !important;
          }

          .director-main-content {
            padding: 14px 12px !important;
            padding-bottom: 85px !important; /* مساحة للقائمة السفلية بالموبايل */
          }

          .director-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 14px 16px !important;
          }

          .director-header-left {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
          }

          .director-header-right {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            width: 100% !important;
            gap: 10px !important;
          }

          .director-search-bar {
            flex: 1 !important;
            width: 100% !important;
          }

          .director-search-bar input {
            width: 100% !important;
          }

          .director-stats-cards {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 10px !important;
            margin-bottom: 20px !important;
          }

          .director-stat-card {
            padding: 12px !important;
            gap: 10px !important;
          }

          .director-stat-icon {
            width: 38px !important;
            height: 38px !important;
            font-size: 1.1rem !important;
          }

          .director-stat-title {
            font-size: 0.78rem !important;
          }

          .director-stat-val {
            font-size: 1.05rem !important;
          }

          .charts-section {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            margin-bottom: 20px !important;
          }

          .section-header-wrap {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 10px !important;
          }

          .director-branch-tabs-scroll {
            display: flex !important;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            padding-bottom: 6px !important;
            -webkit-overflow-scrolling: touch;
          }

          .director-branch-tabs-scroll button {
            flex-shrink: 0 !important;
            font-size: 0.82rem !important;
            padding: 8px 14px !important;
          }
        }

        @media (max-width: 480px) {
          .director-stats-cards {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* ======================================================== */}
      {/* 1. القائمة الجانبية العائمة (Floating Sidebar)           */}
      {/* ======================================================== */}
      {/* خلفية شبه شفافة عند فتح القائمة الجانبية لإغلاقها بالنقر في أي مكان */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(2px)',
            zIndex: 998,
            transition: 'opacity 0.3s'
          }}
        />
      )}

      <aside
        style={{
          width: '260px',
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
          zIndex: 999,
          boxShadow: isSidebarOpen ? '-6px 0 25px rgba(0,0,0,0.25)' : 'none',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          visibility: isSidebarOpen ? 'visible' : 'hidden'
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '25px',
              borderBottom: '1px solid #334155',
              paddingBottom: '15px'
            }}
          >
            <h2
              style={{
                fontSize: '1.2rem',
                color: '#38bdf8',
                fontWeight: 800,
                margin: 0
              }}
            >
              واردات ماء البصرة
            </h2>
            <button
              onClick={() => setIsSidebarOpen(false)}
              style={{
                background: '#334155',
                color: '#ffffff',
                border: 'none',
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem'
              }}
              title="إغلاق القائمة الجانبية"
            >
              ✕
            </button>
          </div>

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
        className="director-main-content"
        style={{
          width: '100%',
          padding: '30px',
          minHeight: '100vh',
          boxSizing: 'border-box'
        }}
      >
        {/* =================== الهيدر =================== */}
        <div
          className="director-header"
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
          <div className="director-header-left" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* زر فتح / إغلاق القائمة الجانبية */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              style={{
                backgroundColor: isSidebarOpen ? '#f1f5f9' : '#0056b3',
                color: isSidebarOpen ? '#1e293b' : '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '9px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 800,
                fontSize: '0.9rem',
                transition: 'all 0.2s ease',
                boxShadow: isSidebarOpen ? 'none' : '0 2px 8px rgba(0, 86, 179, 0.3)'
              }}
              title={isSidebarOpen ? 'إغلاق القائمة الجانبية' : 'فتح القائمة الجانبية'}
            >
              <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>{isSidebarOpen ? 'إخفاء القائمة' : 'القائمة الجانبية'}</span>
            </button>

            <div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                أهلاً بك، المدير العام
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                نظام واردات ماء البصرة
              </p>
            </div>
          </div>

          <div className="director-header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            {/* بحث سريع */}
            <div
              className="director-search-bar"
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#f1f5f9',
                borderRadius: '8px',
                padding: '8px 14px',
                border: '1px solid #e2e8f0'
              }}
            >
              <svg style={{ width: '16px', height: '16px', color: '#64748b', marginLeft: '8px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
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

              {/* أزرار التبويبات الخمسة التفاعلية بالأعلى */}
              <div
                className="director-branch-tabs-scroll"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '15px',
                  marginTop: '20px'
                }}
              >
                {/* 1. المشتركون */}
                <button
                  onClick={() => setBranchDetailTab('subscribers')}
                  style={{
                    background: branchDetailTab === 'subscribers' ? '#eff6ff' : '#ffffff',
                    border: branchDetailTab === 'subscribers' ? '2px solid #0056b3' : '1px solid #cbd5e1',
                    padding: '16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s',
                    boxShadow: branchDetailTab === 'subscribers' ? '0 4px 12px rgba(0, 86, 179, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ color: branchDetailTab === 'subscribers' ? '#0056b3' : '#64748b', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>المشتركون</span>
                    <span style={{ fontSize: '1.1rem' }}>👥</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                    {(selectedBranch.subscribers?.length || 0).toLocaleString('ar-IQ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: branchDetailTab === 'subscribers' ? '#0056b3' : '#94a3b8', fontWeight: 700, marginTop: '4px' }}>
                    قاعدة بيانات المشتركين
                  </div>
                </button>

                {/* 2. المناطق المائية */}
                <button
                  onClick={() => setBranchDetailTab('areas')}
                  style={{
                    background: branchDetailTab === 'areas' ? '#eff6ff' : '#ffffff',
                    border: branchDetailTab === 'areas' ? '2px solid #0056b3' : '1px solid #cbd5e1',
                    padding: '16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s',
                    boxShadow: branchDetailTab === 'areas' ? '0 4px 12px rgba(0, 86, 179, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ color: branchDetailTab === 'areas' ? '#0056b3' : '#64748b', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>المناطق المائية</span>
                    <span style={{ fontSize: '1.1rem' }}>📍</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                    {selectedBranch.areas?.length || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: branchDetailTab === 'areas' ? '#0056b3' : '#94a3b8', fontWeight: 700, marginTop: '4px' }}>
                    المناطق التابعة للفرع
                  </div>
                </button>

                {/* 3. المحصلون */}
                <button
                  onClick={() => setBranchDetailTab('collectors')}
                  style={{
                    background: branchDetailTab === 'collectors' ? '#eff6ff' : '#ffffff',
                    border: branchDetailTab === 'collectors' ? '2px solid #0056b3' : '1px solid #cbd5e1',
                    padding: '16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s',
                    boxShadow: branchDetailTab === 'collectors' ? '0 4px 12px rgba(0, 86, 179, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ color: branchDetailTab === 'collectors' ? '#0056b3' : '#64748b', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>المحصلون</span>
                    <span style={{ fontSize: '1.1rem' }}>💼</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                    {selectedBranch.collectors?.length || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: branchDetailTab === 'collectors' ? '#0056b3' : '#94a3b8', fontWeight: 700, marginTop: '4px' }}>
                    المحصلين ومناطق الجباية
                  </div>
                </button>

                {/* 4. الكُتّاب */}
                <button
                  onClick={() => setBranchDetailTab('writers')}
                  style={{
                    background: branchDetailTab === 'writers' ? '#eff6ff' : '#ffffff',
                    border: branchDetailTab === 'writers' ? '2px solid #0056b3' : '1px solid #cbd5e1',
                    padding: '16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s',
                    boxShadow: branchDetailTab === 'writers' ? '0 4px 12px rgba(0, 86, 179, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ color: branchDetailTab === 'writers' ? '#0056b3' : '#64748b', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>الكُتّاب</span>
                    <span style={{ fontSize: '1.1rem' }}>✍️</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                    {selectedBranch.writers?.length || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: branchDetailTab === 'writers' ? '#0056b3' : '#94a3b8', fontWeight: 700, marginTop: '4px' }}>
                    كُتاب القراءات والمسند لهم
                  </div>
                </button>

                {/* 5. مسؤولو الفرع */}
                <button
                  onClick={() => setBranchDetailTab('managers')}
                  style={{
                    background: branchDetailTab === 'managers' ? '#eff6ff' : '#ffffff',
                    border: branchDetailTab === 'managers' ? '2px solid #0056b3' : '1px solid #cbd5e1',
                    padding: '16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    textAlign: 'right',
                    transition: 'all 0.2s',
                    boxShadow: branchDetailTab === 'managers' ? '0 4px 12px rgba(0, 86, 179, 0.15)' : '0 2px 6px rgba(0,0,0,0.04)'
                  }}
                >
                  <div style={{ color: branchDetailTab === 'managers' ? '#0056b3' : '#64748b', fontSize: '0.85rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>مسؤولو الفرع</span>
                    <span style={{ fontSize: '1.1rem' }}>👔</span>
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0056b3', marginTop: '6px' }}>
                    {selectedBranch.managers?.length || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: branchDetailTab === 'managers' ? '#0056b3' : '#94a3b8', fontWeight: 700, marginTop: '4px' }}>
                    إدارة حسابات المسؤولين
                  </div>
                </button>
              </div>

              {/* ======================================================== */}
              {/* محتوى التبويب المختار                                    */}
              {/* ======================================================== */}

              {/* 1. تبويب المشتركين (قاعدة بيانات المشتركين - للقراءة والمعاينة فقط) */}
              {branchDetailTab === 'subscribers' && (
                <div style={{ marginTop: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                        قاعدة بيانات مشتركي ({selectedBranch.name})
                      </h3>
                      <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '3px' }}>
                        (وضع القراءة والمعاينة فقط للمدير العام - لا يمكن التعديل المباشر)
                      </p>
                    </div>

                    {/* بحث في المشتركين */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#f8fafc',
                        borderRadius: '8px',
                        padding: '8px 14px',
                        border: '1px solid #cbd5e1',
                        width: '260px'
                      }}
                    >
                      <svg style={{ width: '16px', height: '16px', color: '#64748b', marginLeft: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder="بحث بالاسم أو الهاتف..."
                        value={branchSubscriberSearch}
                        onChange={(e) => setBranchSubscriberSearch(e.target.value)}
                        style={{
                          border: 'none',
                          backgroundColor: 'transparent',
                          outline: 'none',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          width: '100%'
                        }}
                      />
                    </div>
                  </div>

                  {(!selectedBranch.subscribers || selectedBranch.subscribers.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '10px', color: '#64748b' }}>
                      لا يوجد مشتركون مسجلون في هذا الفرع حالياً
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>ت</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>اسم المشترك</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>رقم الهاتف</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>المنطقة المائية</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>نوع العقار</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800 }}>نوع المقياس</th>
                            <th style={{ padding: '12px 14px', fontWeight: 800, textAlign: 'center' }}>معاينة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBranch.subscribers
                            .filter(s => {
                              const q = branchSubscriberSearch.trim().toLowerCase()
                              if (!q) return true
                              return s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q))
                            })
                            .slice(0, 100)
                            .map((sub, index) => {
                              const areaName = selectedBranch.areas?.find(a => a.id === sub.areaId)?.name || 'غير محدد'
                              return (
                                <tr key={sub.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '12px 14px', color: '#64748b', fontWeight: 700 }}>{index + 1}</td>
                                  <td style={{ padding: '12px 14px', fontWeight: 800, color: '#1e293b' }}>{sub.name}</td>
                                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#0056b3' }} dir="ltr">{sub.phone || '—'}</td>
                                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#475569' }}>{areaName}</td>
                                  <td style={{ padding: '12px 14px', fontWeight: 700 }}>
                                    <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800, backgroundColor: sub.propertyType === 'تجاري' ? '#fef3c7' : '#e0f2fe', color: sub.propertyType === 'تجاري' ? '#b45309' : '#0369a1' }}>
                                      {sub.propertyType || 'سكني'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '12px 14px', fontWeight: 700, color: '#64748b' }}>{sub.meterType || 'ميكانيكي'}</td>
                                  <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                                    <button
                                      onClick={() => setViewingSubscriber(sub)}
                                      style={{
                                        backgroundColor: '#0056b3',
                                        color: '#ffffff',
                                        border: 'none',
                                        padding: '6px 14px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 800,
                                        fontSize: '0.8rem',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}
                                    >
                                      <span>معاينة</span>
                                      <span>👁️</span>
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 2. تبويب المناطق المائية */}
              {branchDetailTab === 'areas' && (
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '15px', color: '#1e293b' }}>
                    المناطق المائية المسجلة في ({selectedBranch.name})
                  </h3>

                  {(!selectedBranch.areas || selectedBranch.areas.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '10px', color: '#64748b' }}>
                      لا توجد مناطق مائية مسجلة في هذا الفرع حالياً
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>اسم المنطقة المائية</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>كود المنطقة</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>عدد المشتركين</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>المحصل المسند</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>الكاتب المسند</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBranch.areas.map(area => {
                            const subCount = selectedBranch.subscribers?.filter(s => s.areaId === area.id).length || 0
                            const assignedCollector = selectedBranch.collectors?.find(c => c.assignedAreaIds?.includes(area.id))
                            const assignedWriter = selectedBranch.writers?.find(w => w.assignedAreaIds?.includes(area.id))
                            return (
                              <tr key={area.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>{area.name}</td>
                                <td style={{ padding: '12px 15px', color: '#64748b', fontWeight: 700 }}>{area.id}</td>
                                <td style={{ padding: '12px 15px', fontWeight: 800, color: '#0056b3' }}>
                                  {subCount.toLocaleString('ar-IQ')} مشترك
                                </td>
                                <td style={{ padding: '12px 15px', fontWeight: 700, color: assignedCollector ? '#15803d' : '#94a3b8' }}>
                                  {assignedCollector ? `💼 ${assignedCollector.name}` : 'غير مسند'}
                                </td>
                                <td style={{ padding: '12px 15px', fontWeight: 700, color: assignedWriter ? '#b45309' : '#94a3b8' }}>
                                  {assignedWriter ? `✍️ ${assignedWriter.name}` : 'غير مسند'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 3. تبويب المحصلين (مع تفاصيل الجباية والمناطق المسندة) */}
              {branchDetailTab === 'collectors' && (
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '15px', color: '#1e293b' }}>
                    قائمة محصلي ({selectedBranch.name}) وتفاصيل الجباية
                  </h3>

                  {(!selectedBranch.collectors || selectedBranch.collectors.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '10px', color: '#64748b' }}>
                      لا يوجد محصلون مسجلون في هذا الفرع حالياً
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                      {selectedBranch.collectors.map(collector => {
                        const assignedAreas = selectedBranch.areas?.filter(a => collector.assignedAreaIds?.includes(a.id)) || []
                        const collectorConsignments = selectedBranch.consignments?.filter(c => c.collectorId === collector.id) || []
                        const collectorTotal = collectorConsignments.reduce((sum, c) => sum + (c.totalAmount || 0), 0)
                        return (
                          <div
                            key={collector.id}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #cbd5e1',
                              borderRadius: '12px',
                              padding: '20px',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '15px'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <h4 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1e293b' }}>{collector.name}</h4>
                                <span style={{ backgroundColor: '#e0f2fe', color: '#0056b3', padding: '3px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 800 }}>محصل معتمد</span>
                              </div>
                              <p style={{ color: '#0056b3', fontWeight: 700, fontSize: '0.85rem', marginTop: '4px' }} dir="ltr">{collector.phone}</p>

                              {/* المناطق المسندة */}
                              <div style={{ marginTop: '14px', background: '#ffffff', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', display: 'block', marginBottom: '6px' }}>
                                  المناطق المسندة إليه ({assignedAreas.length}):
                                </span>
                                {assignedAreas.length === 0 ? (
                                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>لا توجد مناطق مسندة حالياً</span>
                                ) : (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {assignedAreas.map(a => (
                                      <span key={a.id} style={{ backgroundColor: '#f1f5f9', color: '#1e293b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                        📍 {a.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* الجباية الإجمالية */}
                              <div style={{ marginTop: '10px', background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#15803d' }}>إجمالي الجباية المستحصلة:</span>
                                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                                  {collectorTotal.toLocaleString('ar-IQ')} د.ع
                                </div>
                              </div>
                            </div>

                            <button
                              onClick={() => setViewingCollector(collector)}
                              style={{
                                backgroundColor: '#0056b3',
                                color: '#ffffff',
                                border: 'none',
                                padding: '10px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 800,
                                fontSize: '0.85rem',
                                width: '100%',
                                textAlign: 'center'
                              }}
                            >
                              عرض تقرير الجباية والوصولات الكاملة ←
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 4. تبويب الكُتّاب */}
              {branchDetailTab === 'writers' && (
                <div style={{ marginTop: '30px' }}>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, marginBottom: '15px', color: '#1e293b' }}>
                    كُتّاب ({selectedBranch.name}) والمناطق المسندة إليهم
                  </h3>

                  {(!selectedBranch.writers || selectedBranch.writers.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '10px', color: '#64748b' }}>
                      لا يوجد كُتّاب مسجلون في هذا الفرع حالياً
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>اسم الكاتب</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>رقم الهاتف</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>المناطق المائية المسندة إليه</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>عدد المناطق</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedBranch.writers.map(writer => {
                            const assignedAreas = selectedBranch.areas?.filter(a => writer.assignedAreaIds?.includes(a.id)) || []
                            return (
                              <tr key={writer.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>{writer.name}</td>
                                <td style={{ padding: '12px 15px', fontWeight: 700, color: '#0056b3' }} dir="ltr">{writer.phone}</td>
                                <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                                  {assignedAreas.length === 0 ? (
                                    <span style={{ color: '#94a3b8' }}>لا توجد مناطق مسندة</span>
                                  ) : (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                      {assignedAreas.map(a => (
                                        <span key={a.id} style={{ backgroundColor: '#eff6ff', color: '#0056b3', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700 }}>
                                          ✍️ {a.name}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>
                                  {assignedAreas.length} مناطق
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 5. تبويب مسؤولي الفرع */}
              {branchDetailTab === 'managers' && (
                <div style={{ marginTop: '30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>
                      مسؤولو ({selectedBranch.name})
                    </h3>
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
                        padding: '8px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.85rem'
                      }}
                    >
                      + إضافة مسؤول جديد
                    </button>
                  </div>

                  {(!selectedBranch.managers || selectedBranch.managers.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '10px', color: '#64748b' }}>
                      لا يوجد مسؤولون مسجلون في هذا الفرع حالياً
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0' }}>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>الاسم</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800 }}>رقم الهاتف</th>
                            <th style={{ padding: '12px 15px', fontWeight: 800, textAlign: 'center' }}>الإجراءات</th>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =================== الصفحات المركزية حسب الاختيار =================== */
          <>
            {/* ======================================================== */}
            {/* 1. صفحة لوحة التحكم العامة (الرئيسية)                    */}
            {/* ======================================================== */}
            {activeSection === 'dashboard' && (
              <>
                {/* بطاقات الإحصائيات الأربعة السريعة */}
                <div
                  className="director-stats-cards"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '20px',
                    marginBottom: '30px'
                  }}
                >
                  {/* كارت 1: مجموع واردات الشهر */}
                  <div
                    className="director-stat-card"
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
                      className="director-stat-icon"
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '10px',
                        background: '#e0f2fe',
                        color: '#0056b3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        flexShrink: 0
                      }}
                    >
                      <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="director-stat-title" style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>مجموع واردات الشهر</h3>
                      <p className="director-stat-val" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                        {totalRevenue > 0 ? `${totalRevenue.toLocaleString('ar-IQ')} د.ع` : '450,000,000 د.ع'}
                      </p>
                    </div>
                  </div>

                  {/* كارت 2: عدد الأفرع */}
                  <div
                    className="director-stat-card"
                    onClick={() => setActiveSection('branches')}
                    style={{
                      background: '#ffffff',
                      padding: '20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      className="director-stat-icon"
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '10px',
                        background: '#e0f2fe',
                        color: '#0056b3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        flexShrink: 0
                      }}
                    >
                      <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="director-stat-title" style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>عدد الأفرع</h3>
                      <p className="director-stat-val" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                        {directorateData.branches.length} أفرع
                      </p>
                    </div>
                  </div>

                  {/* كارت 3: الكُتّاب والمحصلين */}
                  <div
                    className="director-stat-card"
                    onClick={() => setActiveSection('staff')}
                    style={{
                      background: '#ffffff',
                      padding: '20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      className="director-stat-icon"
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '10px',
                        background: '#e0f2fe',
                        color: '#0056b3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        flexShrink: 0
                      }}
                    >
                      <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="director-stat-title" style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>الكُتّاب والمحصلين</h3>
                      <p className="director-stat-val" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                        {totalStaff > 0 ? `${totalStaff} موظف` : '120 محصّل'}
                      </p>
                    </div>
                  </div>

                  {/* كارت 4: إجمالي المشتركين */}
                  <div
                    className="director-stat-card"
                    onClick={() => setActiveSection('subscribers')}
                    style={{
                      background: '#ffffff',
                      padding: '20px',
                      borderRadius: '12px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '15px',
                      cursor: 'pointer'
                    }}
                  >
                    <div
                      className="director-stat-icon"
                      style={{
                        width: '50px',
                        height: '50px',
                        borderRadius: '10px',
                        background: '#e0f2fe',
                        color: '#0056b3',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        flexShrink: 0
                      }}
                    >
                      <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="director-stat-title" style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>إجمالي المشتركين</h3>
                      <p className="director-stat-val" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                        {totalSubscribers > 0 ? `${totalSubscribers.toLocaleString('ar-IQ')} مشترك` : '85,000 مشترك'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* قسم الرسوم البيانية والجباية (تم حذف رسم توزيع الكوادر بناء على طلب المدير) */}
                <div
                  style={{
                    background: '#ffffff',
                    padding: '22px 25px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    marginBottom: '30px'
                  }}
                >
                  <h3 style={{ marginBottom: '18px', fontSize: '1.15rem', color: '#334155', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg style={{ width: '20px', height: '20px', color: '#0056b3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>نسبة الجباية حسب المناطق (بالعراقي)</span>
                  </h3>

                  {/* رسم بياني مخصص بالأعمدة ممتد بعرض الصفحة كاملاً */}
                  <div style={{ height: '240px', display: 'flex', alignItems: 'flex-end', gap: '20px', padding: '10px 10px 30px', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
                    {directorateData.branches.map((b, idx) => {
                      const stats = branchFinancialStats.find(s => s.branch.id === b.id)
                      const collected = stats ? stats.collected : 0
                      const fallbackValues = [120, 95, 80, 110, 45, 60]
                      const heightPercent = collected > 0
                        ? Math.max(15, Math.min(100, (collected / maxRevenue) * 100))
                        : fallbackValues[idx % fallbackValues.length]
                      return (
                        <div key={b.id} style={{ flex: 1, minWidth: '70px', display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '45px',
                              height: `${heightPercent}%`,
                              backgroundColor: '#0056b3',
                              borderRadius: '6px 6px 0 0',
                              transition: 'height 0.4s ease',
                              boxShadow: '0 2px 6px rgba(0, 86, 179, 0.3)'
                            }}
                            title={`${b.name}: ${collected > 0 ? collected.toLocaleString('ar-IQ') + ' د.ع' : heightPercent + ' مليون'}`}
                          />
                          <span
                            style={{
                              fontSize: '0.78rem',
                              color: '#64748b',
                              fontWeight: 700,
                              marginTop: '8px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: '85px',
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

                {/* جدول الأفرع والمسؤولين السريع */}
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
                    className="section-header-wrap"
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
                          const managerDisplay = firstManager ? firstManager.name : 'لم يعين بعد'
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

            {/* ======================================================== */}
            {/* 2. صفحة أفرع المناطق (الأفرع)                            */}
            {/* ======================================================== */}
            {activeSection === 'branches' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px 25px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      أفرع مديرية ماء البصرة ({directorateData.branches.length} فرع)
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                      انقر على أي فرع للدخول إلى إدارته وقاعدة بياناته المستقلة
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddBranchModal(true)}
                    style={{
                      backgroundColor: '#0056b3',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    + إضافة فرع جديد
                  </button>
                </div>

                {/* كروت الأفرع التفاعلية */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                  {filteredBranches.map(b => {
                    const manager = b.managers && b.managers[0]
                    const subs = b.subscribers?.length || 0
                    const collectors = b.collectors?.length || 0
                    const writers = b.writers?.length || 0
                    return (
                      <div
                        key={b.id}
                        onClick={() => setSelectedBranchId(b.id)}
                        style={{
                          background: '#ffffff',
                          borderRadius: '12px',
                          padding: '22px',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                          cursor: 'pointer',
                          border: '1px solid #e2e8f0',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                              {b.name}
                            </h3>
                            <span style={{ backgroundColor: '#e0f2fe', color: '#0056b3', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '12px' }}>
                              فرع فعال
                            </span>
                          </div>

                          <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '15px' }}>
                            المسؤول: <strong style={{ color: '#1e293b' }}>{manager ? manager.name : 'لم يعين بعد'}</strong>
                          </p>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', textAlign: 'center' }}>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>المشتركين</span>
                              <strong style={{ fontSize: '1rem', color: '#0056b3' }}>{subs.toLocaleString('ar-IQ')}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>المحصلين</span>
                              <strong style={{ fontSize: '1rem', color: '#16a34a' }}>{collectors}</strong>
                            </div>
                            <div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>الكُتّاب</span>
                              <strong style={{ fontSize: '1rem', color: '#d97706' }}>{writers}</strong>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedBranchId(b.id)
                          }}
                          style={{
                            width: '100%',
                            backgroundColor: '#0056b3',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 800,
                            fontSize: '0.9rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          <span>دخول وإدارة الفرع</span>
                          <span>←</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 3. صفحة مسؤولي الأفرع (المسؤولين)                        */}
            {/* ======================================================== */}
            {activeSection === 'managers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px 25px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      مسؤولو أفرع المديرية ({allManagersList.length} مسؤول)
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                      إدارة مسؤولي الأفرع وإرسال روابط الدخول المباشرة لهم عبر الواتساب
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingManager(null)
                      setManagerFullName('')
                      setManagerPhone('')
                      setShowAddManagerModal(true)
                    }}
                    style={{
                      backgroundColor: '#16a34a',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    + إضافة مسؤول جديد
                  </button>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    overflowX: 'auto'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>اسم المسؤول</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>الفرع المسؤول عنه</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>رقم الهاتف</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>رابط الدخول</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>إرسال واتساب</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allManagersList.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                            لم يتم إضافة أي مسؤول بعد، انقر على زر "إضافة مسؤول جديد" بالأعلى
                          </td>
                        </tr>
                      ) : (
                        allManagersList.map(({ manager, branch }) => (
                          <tr key={manager.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>
                              {manager.name}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 700, color: '#0056b3' }}>
                              {branch.name}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 600, color: '#475569', direction: 'ltr', textAlign: 'right' }}>
                              {manager.phone}
                            </td>
                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleCopyLink(manager, branch)}
                                style={{
                                  backgroundColor: copiedManagerId === manager.id ? '#16a34a' : '#f1f5f9',
                                  color: copiedManagerId === manager.id ? '#ffffff' : '#1e293b',
                                  border: '1px solid #cbd5e1',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '0.8rem'
                                }}
                              >
                                {copiedManagerId === manager.id ? 'تم النسخ ✓' : 'نسخ الرابط'}
                              </button>
                            </td>
                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                              <button
                                onClick={() => handleShareWhatsApp(manager, branch)}
                                style={{
                                  backgroundColor: '#25D366',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px'
                                }}
                              >
                                <span>واتساب</span>
                              </button>
                            </td>
                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  onClick={() => {
                                    setEditingManager(manager)
                                    setManagerFullName(manager.name)
                                    setManagerPhone(manager.phone)
                                    setSelectedBranchForManager(branch.id)
                                    setShowAddManagerModal(true)
                                  }}
                                  style={{
                                    backgroundColor: '#e0f2fe',
                                    color: '#0056b3',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  تعديل
                                </button>
                                <button
                                  onClick={() => handleDeleteManager(branch.id, manager.id, manager.name)}
                                  style={{
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626',
                                    border: 'none',
                                    padding: '5px 10px',
                                    borderRadius: '5px',
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
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 4. صفحة المشتركين المركزية (المشتركين)                   */}
            {/* ======================================================== */}
            {activeSection === 'subscribers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px 25px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      قاعدة بيانات المشتركين المركزية ({allSubscribersList.length} مشترك)
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                      معاينة المشتركين وسجلات ديونهم وفترات الجباية (للقراءة فقط للمدير)
                    </p>
                  </div>

                  {/* بحث في المشتركين */}
                  <div style={{ width: '260px' }}>
                    <input
                      type="text"
                      placeholder="بحث بالاسم أو الهاتف أو الحساب..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    overflowX: 'auto'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>اسم المشترك</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>الفرع</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>رقم الحساب</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>رقم الهاتف</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>نوع العقار</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>سجل الديون والمعاينة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAllSubscribers.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                            {searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'لا يوجد مشتركون مسجلون في أي فرع بعد'}
                          </td>
                        </tr>
                      ) : (
                        filteredAllSubscribers.map(({ subscriber, branch }) => (
                          <tr key={subscriber.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>
                              {subscriber.name}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 700, color: '#0056b3' }}>
                              {branch.name}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 700, color: '#475569' }}>
                              #{subscriber.id}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 600, color: '#64748b', direction: 'ltr', textAlign: 'right' }}>
                              {subscriber.phone || '—'}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                              <span style={{ backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                {subscriber.propertyType || 'سكني'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                              <button
                                onClick={() => {
                                  setSelectedBranchId(branch.id)
                                  setViewingSubscriber(subscriber)
                                  setViewingSubscriberYear(2026)
                                }}
                                style={{
                                  backgroundColor: '#0056b3',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '7px 14px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 800,
                                  fontSize: '0.82rem',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <span>معاينة وسجل الديون</span>
                                <span>👁️</span>
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 5. صفحة كادر الجباية والكُتّاب (المحصلين)                */}
            {/* ======================================================== */}
            {activeSection === 'staff' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px 25px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      كادر الجباية والكُتّاب في الأفرع ({allStaffList.length} موظف)
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                      متابعة أداء المحصلين والكُتّاب والمناطق المسندة لكل منهم والمبالغ المستحصلة
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    overflowX: 'auto'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>اسم الموظف</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>الصفة الوظيفية</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>الفرع التابع له</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>رقم الهاتف</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>المناطق المسندة</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>المبالغ المستحصلة</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>التفاصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allStaffList.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                            لا يوجد محصلون أو كُتّاب مسجلون في أي فرع حتى الآن
                          </td>
                        </tr>
                      ) : (
                        allStaffList.map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>
                              {item.name}
                            </td>
                            <td style={{ padding: '12px 15px' }}>
                              <span
                                style={{
                                  backgroundColor: item.type === 'collector' ? '#e0f2fe' : '#fef3c7',
                                  color: item.type === 'collector' ? '#0056b3' : '#b45309',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontWeight: 800,
                                  fontSize: '0.8rem'
                                }}
                              >
                                {item.type === 'collector' ? 'محصّل جباية' : 'كاتب منطقة'}
                              </span>
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 700, color: '#475569' }}>
                              {item.branch.name}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 600, color: '#64748b', direction: 'ltr', textAlign: 'right' }}>
                              {item.phone || '—'}
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                              {item.areasCount} منطقة
                            </td>
                            <td style={{ padding: '12px 15px', fontWeight: 800, color: '#16a34a' }}>
                              {item.collected > 0 ? `${item.collected.toLocaleString('ar-IQ')} د.ع` : '—'}
                            </td>
                            <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                              {item.rawCollector ? (
                                <button
                                  onClick={() => {
                                    setSelectedBranchId(item.branch.id)
                                    setViewingCollector(item.rawCollector!)
                                  }}
                                  style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#1e293b',
                                    border: '1px solid #cbd5e1',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  معاينة الجباية والمناطق
                                </button>
                              ) : (
                                <button
                                  onClick={() => setSelectedBranchId(item.branch.id)}
                                  style={{
                                    backgroundColor: '#f1f5f9',
                                    color: '#1e293b',
                                    border: '1px solid #cbd5e1',
                                    padding: '5px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 700,
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  عرض بالفرع
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ======================================================== */}
            {/* 6. صفحة التقارير المالية والواردات                      */}
            {/* ======================================================== */}
            {activeSection === 'financials' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px 25px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                      التقارير المالية والواردات المستحصلة
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                      مجموع إيرادات مديرية ماء البصرة: <strong>{totalRevenue.toLocaleString('ar-IQ')} د.ع</strong>
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    background: '#ffffff',
                    padding: '20px',
                    borderRadius: '12px',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    overflowX: 'auto'
                  }}
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>الفرع</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>عدد المشتركين</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>المحصلين</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>المبالغ المستحصلة</th>
                        <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {branchFinancialStats.map(({ branch, collected }) => (
                        <tr key={branch.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>
                            {branch.name}
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                            {branch.subscribers?.length || 0} مشترك
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                            {branch.collectors?.length || 0} محصّل
                          </td>
                          <td style={{ padding: '12px 15px', fontWeight: 800, color: '#16a34a' }}>
                            {collected > 0 ? `${collected.toLocaleString('ar-IQ')} د.ع` : '0 د.ع'}
                          </td>
                          <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                            <button
                              onClick={() => setSelectedBranchId(branch.id)}
                              style={{
                                backgroundColor: '#0056b3',
                                color: '#ffffff',
                                border: 'none',
                                padding: '6px 14px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: 800,
                                fontSize: '0.8rem'
                              }}
                            >
                              تفاصيل الفرع ←
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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

      {/* ======================================================== */}
      {/* 5. نافذة معاينة بيانات المشترك وسجل الديون (للقراءة فقط)   */}
      {/* ======================================================== */}
      {viewingSubscriber && (() => {
        const subBilling = calculateBilling(
          viewingSubscriber.id,
          viewingSubscriberYear,
          selectedBranch?.billing || {},
          selectedBranch?.subscribers || [],
          selectedBranch?.pricing || { 'سكني': { '3 متر': 24600, '4 متر': 24600 }, 'تجاري': {} }
        )

        return (
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
              zIndex: 110
            }}
          >
            <div
              style={{
                background: '#fff',
                padding: '25px',
                borderRadius: '14px',
                width: '740px',
                maxWidth: '95%',
                maxHeight: '92vh',
                overflowY: 'auto',
                boxShadow: '0 6px 30px rgba(0,0,0,0.25)'
              }}
            >
              {/* رأس النافذة */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1e293b', margin: 0 }}>
                    معاينة المشترك: {viewingSubscriber.name}
                  </h3>
                  <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>
                    (سجل رسمي للاطلاع والمعاينة فقط - فرع {selectedBranch?.name} • بدون صلاحية تعديل)
                  </span>
                </div>
                <button
                  onClick={() => setViewingSubscriber(null)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', width: '32px', height: '32px', cursor: 'pointer', fontWeight: 800, fontSize: '0.9rem' }}
                >
                  ✕
                </button>
              </div>

              {/* بطاقة معلومات المشترك المختصرة */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>رقم الهاتف:</span>
                  <span style={{ fontWeight: 800, color: '#0056b3', fontSize: '0.9rem' }} dir="ltr">{viewingSubscriber.phone || 'غير مسجل'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>المنطقة المائية:</span>
                  <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>
                    {selectedBranch?.areas?.find(a => a.id === viewingSubscriber.areaId)?.name || 'غير محدد'}
                  </span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>نوع العقار:</span>
                  <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{viewingSubscriber.propertyType || 'سكني'}</span>
                </div>
                <div>
                  <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700, display: 'block' }}>نوع المقياس:</span>
                  <span style={{ fontWeight: 800, color: '#1e293b', fontSize: '0.9rem' }}>{viewingSubscriber.meterType || 'ميكانيكي'}</span>
                </div>
                {viewingSubscriber.detailedAddress && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e2e8f0', paddingTop: '6px', marginTop: '4px' }}>
                    <span style={{ color: '#64748b', fontSize: '0.75rem', fontWeight: 700 }}>العنوان: </span>
                    <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.85rem' }}>{viewingSubscriber.detailedAddress}</span>
                  </div>
                )}
              </div>

              {/* سجل الديون وفترات الجباية (مطابق تماماً لما يظهر عند المحصل والكاتب) */}
              <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <span>سجل الديون وفترات الجباية</span>
                    <span style={{ fontSize: '0.75rem', color: '#15803d', backgroundColor: '#dcfce7', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>
                      قراءة فقط
                    </span>
                  </h4>

                  {/* شريط اختيار السنة */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', padding: '0 6px' }}>السنة:</span>
                    {[2026, 2027, 2028].map(yr => (
                      <button
                        key={yr}
                        onClick={() => setViewingSubscriberYear(yr)}
                        style={{
                          backgroundColor: viewingSubscriberYear === yr ? '#0056b3' : 'transparent',
                          color: viewingSubscriberYear === yr ? '#ffffff' : '#334155',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          transition: 'all 0.15s'
                        }}
                      >
                        {yr}
                      </button>
                    ))}
                  </div>
                </div>

                {/* جدول فترات الديون الأربعة أعمدة المطابق لمحاسبة النظام */}
                <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#ffffff' }}>
                  {/* رأس جدول الديون */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22% 26% 26% 26%',
                      backgroundColor: '#1e293b',
                      color: '#ffffff',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      padding: '10px 0'
                    }}
                  >
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>الديون السابقة</div>
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>المجموع</div>
                    <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)' }}>المدفوع</div>
                    <div>المجموع الكلي</div>
                  </div>

                  {/* صفوف الفترات الست */}
                  {subBilling.rows.map((row, idx) => (
                    <div
                      key={row.periodLabel}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '22% 26% 26% 26%',
                        borderBottom: idx === 5 ? 'none' : '1px solid #e2e8f0',
                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        padding: '6px 4px',
                        alignItems: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 700
                      }}
                    >
                      {/* 1. الديون السابقة */}
                      <div style={{ padding: '0 4px' }}>
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 4px',
                            textAlign: 'center',
                            fontWeight: 800,
                            color: '#1e293b',
                            fontSize: '0.85rem'
                          }}
                        >
                          {formatInputDisplay(row.old) || '0'}
                        </div>
                      </div>

                      {/* 2. المجموع */}
                      <div style={{ padding: '0 4px' }}>
                        <div
                          style={{
                            backgroundColor: '#ffffff',
                            border: '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 4px',
                            textAlign: 'center',
                            fontWeight: 800,
                            color: '#1e293b',
                            fontSize: '0.85rem'
                          }}
                        >
                          {formatInputDisplay(row.total) || '0'}
                        </div>
                      </div>

                      {/* 3. المدفوع */}
                      <div style={{ padding: '0 4px' }}>
                        <div
                          style={{
                            backgroundColor: row.paid > 0 ? '#ecfdf5' : '#ffffff',
                            border: row.paid > 0 ? '1px solid #86efac' : '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 4px',
                            textAlign: 'center',
                            fontWeight: 800,
                            color: row.paid > 0 ? '#15803d' : '#94a3b8',
                            fontSize: '0.85rem'
                          }}
                        >
                          {row.paid > 0 ? formatInputDisplay(row.paid) : '0'}
                        </div>
                      </div>

                      {/* 4. المجموع الكلي / المتبقي */}
                      <div style={{ padding: '0 4px' }}>
                        <div
                          style={{
                            backgroundColor: row.remaining > 0 ? '#fff1f2' : '#f8fafc',
                            border: row.remaining > 0 ? '1px solid #fecdd3' : '1px solid #cbd5e1',
                            borderRadius: '6px',
                            padding: '6px 4px',
                            textAlign: 'center',
                            fontWeight: 800,
                            color: row.remaining > 0 ? '#be123c' : '#475569',
                            fontSize: '0.85rem'
                          }}
                        >
                          {formatInputDisplay(row.remaining) || '0'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* شريط الإجمالي والحسابات النهائية */}
                <div style={{ marginTop: '14px', background: '#f8fafc', border: '1px solid #cbd5e1', padding: '12px 18px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>استحقاق الفترة الواحدة: </span>
                    <span style={{ fontSize: '0.85rem', color: '#0056b3', fontWeight: 800 }}>{(subBilling.due || 24600).toLocaleString('ar-IQ')} د.ع</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#1e293b', fontWeight: 800 }}>صافي المبلغ المطلوب حالياً:</span>
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        color: subBilling.totalRemaining > 0 ? '#dc2626' : '#16a34a',
                        backgroundColor: subBilling.totalRemaining > 0 ? '#fee2e2' : '#dcfce7',
                        padding: '4px 14px',
                        borderRadius: '8px',
                        border: subBilling.totalRemaining > 0 ? '1px solid #fca5a5' : '1px solid #bbf7d0'
                      }}
                    >
                      {(subBilling.totalRemaining || 0).toLocaleString('ar-IQ')} د.ع
                    </span>
                  </div>
                </div>
              </div>

              {/* زر الإغلاق */}
              <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setViewingSubscriber(null)}
                  style={{
                    background: '#1e293b',
                    color: '#fff',
                    border: 'none',
                    padding: '9px 24px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '0.9rem'
                  }}
                >
                  إغلاق المعاينة
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ======================================================== */}
      {/* 6. نافذة تفاصيل المحصل والمناطق والجباية                  */}
      {/* ======================================================== */}
      {viewingCollector && (
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
            zIndex: 110
          }}
        >
          <div
            style={{
              background: '#fff',
              padding: '25px',
              borderRadius: '12px',
              width: '560px',
              maxWidth: '92%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 25px rgba(0,0,0,0.2)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1e293b', margin: 0 }}>
                  تقرير المحصل: {viewingCollector.name}
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#0056b3', fontWeight: 700 }} dir="ltr">
                  هاتف: {viewingCollector.phone}
                </span>
              </div>
              <button
                onClick={() => setViewingCollector(null)}
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', width: '30px', height: '30px', cursor: 'pointer', fontWeight: 800 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* المناطق المسندة */}
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#1e293b', marginBottom: '8px' }}>
                  المناطق المائية المسندة للمحصل:
                </h4>
                {(() => {
                  const assigned = selectedBranch?.areas?.filter(a => viewingCollector.assignedAreaIds?.includes(a.id)) || []
                  if (assigned.length === 0) return <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>لا توجد مناطق مسندة حالياً لهذا المحصل</p>
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {assigned.map(a => {
                        const count = selectedBranch?.subscribers?.filter(s => s.areaId === a.id).length || 0
                        return (
                          <div key={a.id} style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem' }}>
                            <span style={{ fontWeight: 800, color: '#1e293b' }}>📍 {a.name}</span>
                            <span style={{ color: '#0056b3', fontWeight: 700, marginRight: '6px' }}>({count} مشترك)</span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>

              {/* تفاصيل الجباية المالية */}
              <div style={{ background: '#f0fdf4', padding: '14px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#15803d', margin: 0 }}>
                    تفاصيل الجباية والمبالغ المودعة:
                  </h4>
                  {(() => {
                    const cCons = selectedBranch?.consignments?.filter(c => c.collectorId === viewingCollector.id) || []
                    const cTotal = cCons.reduce((s, c) => s + (c.totalAmount || 0), 0)
                    return (
                      <span style={{ fontSize: '1.2rem', fontWeight: 900, color: '#16a34a' }}>
                        {cTotal.toLocaleString('ar-IQ')} د.ع
                      </span>
                    )
                  })()}
                </div>

                <div style={{ marginTop: '12px' }}>
                  {(() => {
                    const cCons = selectedBranch?.consignments?.filter(c => c.collectorId === viewingCollector.id) || []
                    if (cCons.length === 0) return <p style={{ color: '#64748b', fontSize: '0.85rem' }}>لا توجد وصولات أو إرساليات جباية مسجلة لهذا المحصل حتى الآن.</p>
                    return (
                      <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.8rem' }}>
                          <thead>
                            <tr style={{ background: '#f0fdf4', color: '#15803d', borderBottom: '1px solid #bbf7d0' }}>
                              <th style={{ padding: '8px 10px', fontWeight: 800 }}>كود الإرسالية</th>
                              <th style={{ padding: '8px 10px', fontWeight: 800 }}>التاريخ</th>
                              <th style={{ padding: '8px 10px', fontWeight: 800 }}>عدد الوصولات</th>
                              <th style={{ padding: '8px 10px', fontWeight: 800 }}>المبلغ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cCons.map(c => (
                              <tr key={c.id} style={{ borderBottom: '1px solid #f0fdf4' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{c.id}</td>
                                <td style={{ padding: '8px 10px', color: '#475569' }}>{c.date || new Date(c.createdAt).toLocaleDateString('ar-IQ')}</td>
                                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{c.items?.length || 0} وصل</td>
                                <td style={{ padding: '8px 10px', fontWeight: 800, color: '#16a34a' }}>{(c.totalAmount || 0).toLocaleString('ar-IQ')} د.ع</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setViewingCollector(null)}
                style={{
                  background: '#1e293b',
                  color: '#fff',
                  border: 'none',
                  padding: '9px 24px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 800,
                  fontSize: '0.9rem'
                }}
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* 4. القائمة السفلية للموبايل (Mobile Bottom Navigation)     */}
      {/* ======================================================== */}
      <nav className="mobile-nav">
        {/* زر 1: الرئيسية */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('dashboard')
            setSelectedBranchId(null)
          }}
          className={`mobile-nav-item ${activeSection === 'dashboard' && !selectedBranchId ? 'active' : ''}`}
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <span>الرئيسية</span>
        </button>

        {/* زر 2: الأفرع */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('branches')
            setSelectedBranchId(null)
          }}
          className={`mobile-nav-item ${activeSection === 'branches' && !selectedBranchId ? 'active' : ''}`}
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span>الأفرع</span>
        </button>

        {/* زر 3: المسؤولين */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('managers')
            setSelectedBranchId(null)
          }}
          className={`mobile-nav-item ${activeSection === 'managers' ? 'active' : ''}`}
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span>المسؤولين</span>
        </button>

        {/* زر 4: المشتركين */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('subscribers')
            setSelectedBranchId(null)
          }}
          className={`mobile-nav-item ${activeSection === 'subscribers' ? 'active' : ''}`}
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>المشتركين</span>
        </button>

        {/* زر 5: المحصلين */}
        <button
          type="button"
          onClick={() => {
            setActiveSection('staff')
            setSelectedBranchId(null)
          }}
          className={`mobile-nav-item ${activeSection === 'staff' ? 'active' : ''}`}
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span>المحصلين</span>
        </button>
      </nav>
    </div>
  )
}
