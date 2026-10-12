'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { DirectorateData, DirectorateBranch, BranchManager, BranchCollector, BranchWriter } from '@/lib/directorateTypes'
import { generateSecureToken, generateWhatsAppLink, loadBranchSubscribersAndBilling } from '@/lib/directorateStore'
import {
  Area,
  Subscriber,
  calculateBilling,
  PERIODS,
  YEARS,
  STATUS_CONFIG,
  isZeroAccountSubscriber,
  formatNumber,
  calculateDebtSummary,
  formatInputDisplay,
  BillingRecords
} from '@/components/MainApp'
import {
  Users,
  MapPin,
  Briefcase,
  PenTool,
  UserCheck,
  RefreshCw,
  Eye,
  Building2,
  Check,
  Copy,
  X,
  Search,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Phone,
  ShieldCheck,
  Share2
} from 'lucide-react'

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

  // التبويب النشط داخل صفحة الفرع المستقلة (يبدأ بالمناطق لمنع تحميل المشتركين تلقائياً)
  const [branchDetailTab, setBranchDetailTab] = useState<'subscribers' | 'areas' | 'collectors' | 'writers' | 'managers'>('areas')

  // حالات المشتركين عند الطلب لقسم المشتركين المركزي
  const [selectedSubscribersBranch, setSelectedSubscribersBranch] = useState<DirectorateBranch | null>(null)
  const [loadedSubscribers, setLoadedSubscribers] = useState<Subscriber[]>([])
  const [loadedBilling, setLoadedBilling] = useState<any>({})
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false)

  // حالات المشتركين عند الطلب لصفحة الفرع المستقلة
  const [branchDetailSubscribers, setBranchDetailSubscribers] = useState<Subscriber[]>([])
  const [branchDetailBilling, setBranchDetailBilling] = useState<BillingRecords>({})
  const [isLoadingBranchDetailSubscribers, setIsLoadingBranchDetailSubscribers] = useState(false)

  // بحث المشتركين داخل الفرع
  const [branchSubscriberSearch, setBranchSubscriberSearch] = useState('')

  // بحث المناطق المائية داخل الفرع
  const [branchAreaSearch, setBranchAreaSearch] = useState('')

  // المشترك المختار للعرض فقط (Read-only للمدير)
  const [viewingSubscriber, setViewingSubscriber] = useState<Subscriber | null>(null)
  const [viewingSubscriberYear, setViewingSubscriberYear] = useState<number>(2026)
  const [showViewingSubscriberContact, setShowViewingSubscriberContact] = useState(false)

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

  // دالة تحميل مشتركي الفرع عند الطلب لقسم المشتركين المركزي
  const handleSelectBranchForSubscribers = async (branch: DirectorateBranch, force = false) => {
    setSelectedSubscribersBranch(branch)
    setIsLoadingSubscribers(true)
    try {
      const data = await loadBranchSubscribersAndBilling(branch.id, force)
      setLoadedSubscribers(data.subscribers)
      setLoadedBilling(data.billing)
    } finally {
      setIsLoadingSubscribers(false)
    }
  }

  // دالة تحميل مشتركي الفرع لصفحة الفرع المستقلة
  const handleLoadBranchDetailSubscribers = async (branchId: string, force = false) => {
    setIsLoadingBranchDetailSubscribers(true)
    try {
      const data = await loadBranchSubscribersAndBilling(branchId, force)
      setBranchDetailSubscribers(data.subscribers)
      setBranchDetailBilling(data.billing || {})
    } finally {
      setIsLoadingBranchDetailSubscribers(false)
    }
  }

  // تحميل مشتركي الفرع تلقائياً عند فتح تفاصيل أي فرع لضمان ظهور الأعداد فوراً في المناطق والمشتركين
  useEffect(() => {
    if (selectedBranchId) {
      handleLoadBranchDetailSubscribers(selectedBranchId)
    } else {
      setBranchDetailSubscribers([])
      setBranchDetailBilling({})
    }
  }, [selectedBranchId])

  // الفرع المختار حالياً
  const selectedBranch = useMemo(() => {
    if (!selectedBranchId) return null
    return directorateData.branches.find(b => b.id === selectedBranchId) || null
  }, [selectedBranchId, directorateData.branches])

  // خريطة سريعة جداً لحساب عدد المشتركين في كل منطقة بالفرع فورياً
  const branchAreaSubscribersCountMap = useMemo(() => {
    const map = new Map<string, number>()
    const subs = branchDetailSubscribers.length > 0 ? branchDetailSubscribers : (selectedBranch?.subscribers || [])
    subs.forEach(s => {
      if (s.areaId) {
        map.set(s.areaId, (map.get(s.areaId) || 0) + 1)
      }
      if (s.areaIds && Array.isArray(s.areaIds)) {
        s.areaIds.forEach(aid => {
          map.set(aid, (map.get(aid) || 0) + 1)
        })
      }
    })
    return map
  }, [branchDetailSubscribers, selectedBranch?.subscribers])

  // الإحصائيات العامة المجمعة (سريعة جداً وخفيفة بدون جلب مصفوفات المشتركين)
  const totalSubscribers = useMemo(() => {
    return directorateData.branches.reduce((sum, b) => sum + (b.subscribersCount ?? b.subscribers?.length ?? 0), 0)
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

  // تصفية مشتركي الفرع المختار حالياً حسب البحث (عند الطلب فقط)
  const filteredBranchSubscribers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return loadedSubscribers
    return loadedSubscribers.filter(s => {
      return (
        s.name?.toLowerCase().includes(q) ||
        s.phone?.includes(q) ||
        s.id?.toString().includes(q)
      )
    })
  }, [loadedSubscribers, searchQuery])

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

  // حفظ أو تعديل مسؤول
  const handleSaveManager = () => {
    if (!managerFullName.trim()) {
      alert('الرجاء كتابة اسم المسؤول')
      return
    }

    const currentBranchOfEditingManager = editingManager
      ? directorateData.branches.find(b => b.managers?.some(m => m.id === editingManager.id))
      : null

    const targetBranchId = selectedBranchForManager || currentBranchOfEditingManager?.id || (selectedBranch ? selectedBranch.id : directorateData.branches[0]?.id)
    if (!targetBranchId) {
      alert('الرجاء اختيار الفرع')
      return
    }

    let updatedBranches = directorateData.branches

    if (editingManager) {
      const oldBranchId = currentBranchOfEditingManager?.id || targetBranchId

      if (oldBranchId === targetBranchId) {
        // نفس الفرع: تحديث الاسم ورقم الهاتف
        updatedBranches = directorateData.branches.map(b => {
          if (b.id !== targetBranchId) return b
          return {
            ...b,
            managers: (b.managers || []).map(m =>
              m.id === editingManager.id
                ? { ...m, name: managerFullName.trim(), phone: managerPhone.trim() || m.phone }
                : m
            )
          }
        })
      } else {
        // نقل المسؤول إلى فرع جديد
        const existingMgr = currentBranchOfEditingManager?.managers?.find(m => m.id === editingManager.id)
        const updatedMgr: BranchManager = {
          ...(existingMgr || editingManager),
          name: managerFullName.trim(),
          phone: managerPhone.trim() || (existingMgr?.phone || '07700000000')
        }
        updatedBranches = directorateData.branches.map(b => {
          if (b.id === oldBranchId) {
            return {
              ...b,
              managers: (b.managers || []).filter(m => m.id !== editingManager.id)
            }
          }
          if (b.id === targetBranchId) {
            return {
              ...b,
              managers: [...(b.managers || []), updatedMgr]
            }
          }
          return b
        })
      }
    } else {
      // إضافة مسؤول جديد
      const newMgr: BranchManager = {
        id: 'mgr_' + Date.now().toString(36),
        name: managerFullName.trim(),
        phone: managerPhone.trim() || '07700000000',
        token: generateSecureToken('mgr'),
        createdAt: new Date().toISOString()
      }
      updatedBranches = directorateData.branches.map(b => {
        if (b.id !== targetBranchId) return b
        return {
          ...b,
          managers: [...(b.managers || []), newMgr]
        }
      })
    }

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

  // تجديد الرمز السري وإبطال الرابط القديم فوراً
  const handleRegenerateManagerToken = (branchId: string, managerId: string, name: string) => {
    if (confirm(`هل تريد تجديد الرمز السري للمسؤول (${name})؟ سيتم إبطال الرابط القديم فوراً ولن يعمل أبداً.`)) {
      const newToken = generateSecureToken('mgr')
      const updatedBranches = directorateData.branches.map(b => {
        if (b.id !== branchId) return b
        return {
          ...b,
          managers: (b.managers || []).map(m => m.id === managerId ? { ...m, token: newToken } : m)
        }
      })
      onUpdateDirectorate({ ...directorateData, branches: updatedBranches })
      alert('تم تجديد الرمز السري بنجاح وإلغاء الرابط القديم نهائياً! يمكنك الآن نسخ الرابط الجديد المشفر.')
    }
  }

  // فتح صفحة المسؤول في نافذة جديدة مستقلة
  const handleOpenManagerPage = (manager: BranchManager, branch: DirectorateBranch) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
    window.open(directLink, '_blank')
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
              <X className="w-4 h-4 text-slate-500" />
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
                كود الفرع: {selectedBranch.id} • المشتركون: {(selectedBranch.subscribersCount ?? selectedBranch.subscribers?.length ?? 0).toLocaleString('ar-IQ')}
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
                  onClick={() => {
                    setBranchDetailTab('subscribers')
                    if (branchDetailSubscribers.length === 0) {
                      handleLoadBranchDetailSubscribers(selectedBranch.id)
                    }
                  }}
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
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#1e293b', marginTop: '6px' }}>
                    {(selectedBranch.subscribersCount ?? selectedBranch.subscribers?.length ?? 0).toLocaleString('ar-IQ')}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: branchDetailTab === 'subscribers' ? '#0056b3' : '#94a3b8', fontWeight: 700, marginTop: '4px' }}>
                    قاعدة بيانات المشتركين
                  </div>
                </button>

                {/* 2. المناطق المائية */}
                <button
                  onClick={() => {
                    setBranchDetailTab('areas')
                    if (branchDetailSubscribers.length === 0) {
                      handleLoadBranchDetailSubscribers(selectedBranch.id)
                    }
                  }}
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
                    <MapPin className="w-4 h-4 text-blue-600" />
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
                    <Briefcase className="w-4 h-4 text-blue-600" />
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
                    <PenTool className="w-4 h-4 text-blue-600" />
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
                    <UserCheck className="w-4 h-4 text-blue-600" />
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

                    {/* زر تحديث وبحث في المشتركين */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleLoadBranchDetailSubscribers(selectedBranch.id, true)}
                        disabled={isLoadingBranchDetailSubscribers}
                        style={{
                          padding: '8px 12px',
                          background: '#f8fafc',
                          color: '#0056b3',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBranchDetailSubscribers ? 'animate-spin' : ''}`} />
                        <span>تحديث</span>
                      </button>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          padding: '8px 14px',
                          border: '1px solid #cbd5e1',
                          width: '240px'
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
                  </div>

                  {isLoadingBranchDetailSubscribers ? (
                    <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '10px', color: '#0056b3', fontWeight: 800 }}>
                      ⏳ جارِ جلب قاعدة بيانات مشتركي الفرع من السحابة...
                    </div>
                  ) : (!branchDetailSubscribers || branchDetailSubscribers.length === 0) ? (
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
                          {branchDetailSubscribers
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
                                      <Eye className="w-3.5 h-3.5" />
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#1e293b' }}>
                      المناطق المائية المسجلة في ({selectedBranch.name})
                    </h3>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          placeholder="بحث بالاسم أو الكود..."
                          value={branchAreaSearch}
                          onChange={e => setBranchAreaSearch(e.target.value)}
                          style={{
                            padding: '8px 14px',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            outline: 'none',
                            minWidth: '220px'
                          }}
                        />
                        {branchAreaSearch && (
                          <button
                            onClick={() => setBranchAreaSearch('')}
                            style={{
                              position: 'absolute',
                              left: '8px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              background: 'transparent',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              fontWeight: 800
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      <button
                        onClick={() => handleLoadBranchDetailSubscribers(selectedBranch.id, true)}
                        disabled={isLoadingBranchDetailSubscribers}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          color: '#1e293b',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontSize: '0.85rem',
                          fontWeight: 800,
                          cursor: isLoadingBranchDetailSubscribers ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBranchDetailSubscribers ? 'animate-spin text-blue-600' : ''}`} />
                        <span>{isLoadingBranchDetailSubscribers ? 'جارِ التحميل...' : 'تحديث الأعداد'}</span>
                      </button>
                    </div>
                  </div>

                  {isLoadingBranchDetailSubscribers && (
                    <div style={{ textAlign: 'center', padding: '12px 20px', marginBottom: '15px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', color: '#0056b3', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                      <span>جارِ جلب قاعدة بيانات المشتركين واحتساب توزيع الأعداد على المناطق المائية...</span>
                    </div>
                  )}

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
                          {selectedBranch.areas
                            .filter(area => {
                              if (!branchAreaSearch.trim()) return true
                              const q = branchAreaSearch.trim().toLowerCase()
                              return area.name.toLowerCase().includes(q) || area.id.toLowerCase().includes(q)
                            })
                            .map(area => {
                              const subCount = branchAreaSubscribersCountMap.get(area.id) || (area.name ? branchAreaSubscribersCountMap.get(area.name) : 0) || 0
                              const assignedCollector = selectedBranch.collectors?.find(c => c.assignedAreaIds?.includes(area.id))
                              const assignedWriter = selectedBranch.writers?.find(w => w.assignedAreaIds?.includes(area.id))
                              return (
                                <tr key={area.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>{area.name}</td>
                                  <td style={{ padding: '12px 15px', color: '#64748b', fontWeight: 700 }}>{area.id}</td>
                                  <td style={{ padding: '12px 15px', fontWeight: 800, color: '#0056b3' }}>
                                    {subCount > 0 ? (
                                      <span>{subCount.toLocaleString('ar-IQ')} مشترك</span>
                                    ) : (
                                      <span style={{ color: '#94a3b8' }}>0 مشترك</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 15px', fontWeight: 700, color: assignedCollector ? '#15803d' : '#94a3b8' }}>
                                    {assignedCollector ? assignedCollector.name : 'غير مسند'}
                                  </td>
                                  <td style={{ padding: '12px 15px', fontWeight: 700, color: assignedWriter ? '#b45309' : '#94a3b8' }}>
                                    {assignedWriter ? assignedWriter.name : 'غير مسند'}
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
                                        {a.name}
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
                                          {a.name}
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
                                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <button
                                    onClick={() => {
                                      setEditingManager(manager)
                                      setManagerFullName(manager.name)
                                      setManagerPhone(manager.phone)
                                      setSelectedBranchForManager(selectedBranch.id)
                                      setShowAddManagerModal(true)
                                    }}
                                    style={{
                                      backgroundColor: '#0284c7',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 700,
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    تعديل
                                  </button>
                                  <button
                                    onClick={() => handleOpenManagerPage(manager, selectedBranch)}
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
                                    {copiedManagerId === manager.id ? 'تم النسخ' : 'نسخ الرابط'}
                                  </button>
                                  <button
                                    onClick={() => handleRegenerateManagerToken(selectedBranch.id, manager.id, manager.name)}
                                    title="توليد رمز سري مشفر جديد وإلغاء الرابط القديم فوراً"
                                    style={{
                                      backgroundColor: '#d97706',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '6px 12px',
                                      borderRadius: '6px',
                                      cursor: 'pointer',
                                      fontWeight: 700,
                                      fontSize: '0.8rem'
                                    }}
                                  >
                                    تجديد الرمز
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

                  {/* رسم بياني مخصص بالأعمدة ممتد بعرض الصفحة كاملاً - 5 أعمدة مع تموضع الاسم فوق قمة العمود */}
                  <div style={{ height: '280px', display: 'flex', alignItems: 'flex-end', gap: '16px', padding: '40px 15px 15px', borderBottom: '1px solid #e2e8f0', position: 'relative' }}>
                    {directorateData.branches.slice(0, 5).map((b, idx) => {
                      const stats = branchFinancialStats.find(s => s.branch.id === b.id)
                      const collected = stats ? stats.collected : 0
                      const fallbackValues = [80, 65, 50, 70, 35]
                      // الحد الأقصى للارتفاع 75% لترك مساحة كافية فوق قمة العمود لاسم الفرع ونسبته
                      const heightPercent = collected > 0
                        ? Math.max(15, Math.min(75, (collected / maxRevenue) * 75))
                        : fallbackValues[idx % fallbackValues.length]
                      const displayPercent = collected > 0
                        ? Math.round((collected / maxRevenue) * 100)
                        : heightPercent

                      return (
                        <div
                          key={b.id}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                            position: 'relative'
                          }}
                        >
                          {/* حاوية العمود التي يتغير ارتفاعها */}
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '52px',
                              height: `${heightPercent}%`,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              position: 'relative',
                              transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                          >
                            {/* اسم الفرع والريتنج فوق قمة العمود مباشرة - ينزل ويصعد مع حركة العمود */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '100%',
                                marginBottom: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                whiteSpace: 'nowrap',
                                pointerEvents: 'none',
                                zIndex: 2
                              }}
                            >
                              <span
                                style={{
                                  fontSize: '0.78rem',
                                  color: '#1e293b',
                                  fontWeight: 800,
                                  textAlign: 'center',
                                  maxWidth: '95px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                                title={b.name}
                              >
                                {b.name.replace('فرع واردات ', '').replace('فرع ', '')}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.68rem',
                                  color: '#0284c7',
                                  fontWeight: 800,
                                  backgroundColor: '#f0f9ff',
                                  border: '1px solid #bae6fd',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  marginTop: '2px'
                                }}
                              >
                                {displayPercent}%
                              </span>
                            </div>

                            {/* جسم العمود الملون المتدرج */}
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                background: 'linear-gradient(180deg, #0284c7 0%, #0056b3 100%)',
                                borderRadius: '8px 8px 0 0',
                                boxShadow: '0 4px 10px rgba(0, 86, 179, 0.25)',
                                cursor: 'pointer'
                              }}
                              title={`${b.name}: ${collected > 0 ? collected.toLocaleString('ar-IQ') + ' د.ع' : displayPercent + '%'}`}
                            />
                          </div>

                          {/* خط قاعدة ناعم أسفل كل عمود */}
                          <div
                            style={{
                              width: '100%',
                              maxWidth: '65px',
                              height: '4px',
                              backgroundColor: '#cbd5e1',
                              borderRadius: '2px',
                              marginTop: '2px'
                            }}
                          />
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
                                {copiedManagerId === manager.id ? 'تم النسخ' : 'نسخ الرابط'}
                              </button>
                              <button
                                onClick={() => handleRegenerateManagerToken(branch.id, manager.id, manager.name)}
                                title="توليد رمز سري مشفر جديد وإلغاء الرابط القديم فوراً"
                                style={{
                                  backgroundColor: '#d97706',
                                  color: '#ffffff',
                                  border: 'none',
                                  padding: '6px 12px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                  fontSize: '0.8rem',
                                  marginRight: '6px'
                                }}
                              >
                                تجديد الرمز
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
            {/* 4. صفحة المشتركين المركزية (باختيار الفرع عند الطلب)      */}
            {/* ======================================================== */}
            {activeSection === 'subscribers' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {!selectedSubscribersBranch ? (
                  /* شاشة اختيار الفرع للوصول إلى قاعدة بيانات المشتركين الخاصة به */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div
                      style={{
                        background: '#ffffff',
                        padding: '24px 28px',
                        borderRadius: '16px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                        border: '1px solid #e2e8f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Building2 className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                            قواعد بيانات المشتركين في فروع المديرية
                          </h2>
                          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px', margin: 0 }}>
                            للحفاظ على سرعة الخوادم وتجنب التحميل الضخم لملايين السجلات، يرجى اختيار الفرع المطلوب لعرض قاعدة بيانات المشتركين الخاصة به مباشرة:
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* شبكة بطاقات الأفرع */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '18px' }}>
                      {directorateData.branches.map((branch) => {
                        const count = branch.subscribersCount ?? branch.subscribers?.length ?? 0
                        const areasCount = branch.areas?.length || 0
                        const collectorsCount = branch.collectors?.length || 0

                        return (
                          <div
                            key={branch.id}
                            style={{
                              background: '#ffffff',
                              borderRadius: '16px',
                              padding: '22px',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'space-between',
                              gap: '16px',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
                                  {branch.name}
                                </div>
                                <span style={{ background: '#eff6ff', color: '#0056b3', fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', borderRadius: '20px' }}>
                                  فرع مفعل
                                </span>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '12px', textAlign: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>المشتركين</div>
                                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0056b3', marginTop: '2px' }}>
                                    {count.toLocaleString('ar-IQ')}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>المناطق</div>
                                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                                    {areasCount}
                                  </div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>المحصلين</div>
                                  <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                                    {collectorsCount}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleSelectBranchForSubscribers(branch)}
                              style={{
                                width: '100%',
                                padding: '12px',
                                background: '#0056b3',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: 800,
                                fontSize: '0.9rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                transition: 'background 0.2s'
                              }}
                            >
                              <span>فتح قاعدة بيانات المشتركين للفرع</span>
                              <span>←</span>
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  /* شاشة المشتركين الخاصة بالفرع المختار فقط */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div
                      style={{
                        background: '#ffffff',
                        padding: '20px 25px',
                        borderRadius: '16px',
                        boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '14px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubscribersBranch(null)
                            setSearchQuery('')
                          }}
                          style={{
                            padding: '8px 16px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #cbd5e1',
                            borderRadius: '10px',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <span>→</span>
                          <span>العودة لاختيار فرع آخر</span>
                        </button>

                        <div>
                          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
                            قاعدة بيانات مشتركي: {selectedSubscribersBranch.name}
                          </h2>
                          <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '3px', margin: 0 }}>
                            إجمالي المشتركين المحملين: ({loadedSubscribers.length.toLocaleString('ar-IQ')} مشترك)
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* زر تحديث يدوي من السحابة */}
                        <button
                          type="button"
                          onClick={() => handleSelectBranchForSubscribers(selectedSubscribersBranch, true)}
                          disabled={isLoadingSubscribers}
                          style={{
                            padding: '9px 14px',
                            background: '#f8fafc',
                            color: '#0056b3',
                            border: '1px solid #cbd5e1',
                            borderRadius: '8px',
                            fontWeight: 800,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSubscribers ? 'animate-spin' : ''}`} />
                          <span>تحديث البيانات</span>
                        </button>

                        {/* بحث في المشتركين لهذا الفرع */}
                        <div style={{ width: '240px' }}>
                          <input
                            type="text"
                            placeholder="بحث بالاسم أو الهاتف أو الحساب..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '9px 14px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.85rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {isLoadingSubscribers ? (
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '60px 20px',
                          borderRadius: '16px',
                          border: '1px solid #e2e8f0',
                          textAlign: 'center',
                          color: '#0056b3',
                          fontWeight: 800
                        }}
                      >
                        <div style={{ marginBottom: '12px' }}>
                          <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-600" />
                        </div>
                        <div>جارِ جلب قاعدة بيانات مشتركي الفرع من السحابة...</div>
                      </div>
                    ) : (
                      <div
                        style={{
                          background: '#ffffff',
                          padding: '20px',
                          borderRadius: '16px',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                          border: '1px solid #e2e8f0',
                          overflowX: 'auto'
                        }}
                      >
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', color: '#475569' }}>
                              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>ت</th>
                              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>اسم المشترك</th>
                              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>رقم الحساب</th>
                              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>رقم الهاتف</th>
                              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>المنطقة</th>
                              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800 }}>نوع العقار</th>
                              <th style={{ padding: '12px 15px', borderBottom: '1px solid #e2e8f0', fontWeight: 800, textAlign: 'center' }}>سجل الديون والمعاينة</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredBranchSubscribers.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontWeight: 700 }}>
                                  {searchQuery ? 'لا توجد نتائج مطابقة للبحث داخل هذا الفرع' : 'لا يوجد مشتركون مسجلون في هذا الفرع بعد'}
                                </td>
                              </tr>
                            ) : (
                              filteredBranchSubscribers.map((subscriber, idx) => {
                                const areaName = selectedSubscribersBranch.areas?.find(a => a.id === subscriber.areaId)?.name || 'غير محدد'
                                return (
                                  <tr key={subscriber.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '12px 15px', color: '#64748b', fontWeight: 700 }}>
                                      {idx + 1}
                                    </td>
                                    <td style={{ padding: '12px 15px', fontWeight: 800, color: '#1e293b' }}>
                                      {subscriber.name}
                                    </td>
                                    <td style={{ padding: '12px 15px', fontWeight: 700, color: '#0056b3' }}>
                                      #{subscriber.id}
                                    </td>
                                    <td style={{ padding: '12px 15px', fontWeight: 600, color: '#64748b', direction: 'ltr', textAlign: 'right' }}>
                                      {subscriber.phone || '—'}
                                    </td>
                                    <td style={{ padding: '12px 15px', fontWeight: 700, color: '#475569' }}>
                                      {areaName}
                                    </td>
                                    <td style={{ padding: '12px 15px', fontWeight: 700 }}>
                                      <span style={{ backgroundColor: subscriber.propertyType === 'تجاري' ? '#fef3c7' : '#e0f2fe', color: subscriber.propertyType === 'تجاري' ? '#b45309' : '#0369a1', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem' }}>
                                        {subscriber.propertyType || 'سكني'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '12px 15px', textAlign: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSelectedBranchId(selectedSubscribersBranch.id)
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
                                        <Eye className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                )
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
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
              {editingManager ? `تعديل بيانات المسؤول (${editingManager.name})` : 'إضافة مسؤول فرع جديد'}
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
                {editingManager ? 'حفظ التعديلات' : 'حفظ البيانات'}
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
      {/* 5. نافذة معاينة بيانات المشترك وسجل الديون (مطابقة للمحصل والكاتب - قراءة فقط) */}
      {/* ======================================================== */}
      {viewingSubscriber && (() => {
        const activeSubsList = branchDetailSubscribers.length > 0
          ? branchDetailSubscribers
          : (loadedSubscribers.length > 0 ? loadedSubscribers : (selectedBranch?.subscribers || []))

        const activeBillingRecords = (Object.keys(branchDetailBilling).length > 0
          ? branchDetailBilling
          : loadedBilling) || selectedBranch?.billing || {}

        const currentIndex = activeSubsList.findIndex(s => s.id === viewingSubscriber.id)
        const prevSub = currentIndex > 0 ? activeSubsList[currentIndex - 1] : null
        const nextSub = currentIndex >= 0 && currentIndex < activeSubsList.length - 1 ? activeSubsList[currentIndex + 1] : null

        const subBilling = calculateBilling(
          viewingSubscriber.id,
          viewingSubscriberYear,
          activeBillingRecords,
          activeSubsList,
          selectedBranch?.pricing || { 'سكني': { '3 متر': 24600, '4 متر': 24600 }, 'تجاري': {} }
        )

        const debtSummary = calculateDebtSummary(
          viewingSubscriber.id,
          activeBillingRecords,
          activeSubsList,
          selectedBranch?.pricing || { 'سكني': { '3 متر': 24600, '4 متر': 24600 }, 'تجاري': {} },
          viewingSubscriberYear,
          subBilling.rows
        )

        const dossierVal = (viewingSubscriber as any).dossier || 
          (viewingSubscriber.detailedAddress?.match(/إضبارة:\s*([^|]+)/)?.[1]?.trim()) || ''
        const notesVal = (viewingSubscriber as any).notes || 
          (viewingSubscriber.detailedAddress?.match(/ملاحظة:\s*(.+)$/)?.[1]?.trim()) || ''
        const prevDebt = viewingSubscriber.remainingPrev ?? 0
        const statusesList = viewingSubscriber.statuses || []
        const areaName = selectedBranch?.areas?.find(a => a.id === viewingSubscriber.areaId)?.name || 'غير محدد'

        const directWaMsg = `السلام عليكم ${viewingSubscriber.name}\nحساب رقم: ${viewingSubscriber.id}\nالفرع: ${selectedBranch?.name || ''}\nصافي المبلغ المطلوب: ${(subBilling.totalRemaining || 0).toLocaleString('ar-IQ')} د.ع`
        const waUrl = generateWhatsAppLink(viewingSubscriber.phone, directWaMsg)

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(15, 23, 42, 0.45)',
              backdropFilter: 'blur(3px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 110,
              padding: '12px'
            }}
          >
            <div
              style={{
                background: '#f0f9ff',
                borderRadius: '20px',
                width: '760px',
                maxWidth: '100%',
                maxHeight: '94vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                border: '1px solid #bae6fd'
              }}
            >
              {/* 1. رأس البطاقة (Hero Header) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid #e0f2fe',
                  padding: '14px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: '12px'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div
                      style={{
                        backgroundColor: '#e0f2fe',
                        border: '1px solid #bae6fd',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        color: '#0369a1'
                      }}
                    >
                      {viewingSubscriber.propertyType || 'سكني'} - {viewingSubscriber.meterType || 'ميكانيكي'}
                    </div>

                    <button
                      onClick={() => setShowViewingSubscriberContact(true)}
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #bae6fd',
                        color: '#0284c7',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <span>التواصل والموقع والصور</span>
                    </button>

                    {Boolean(viewingSubscriber.phone && viewingSubscriber.phone.trim()) && (
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          backgroundColor: '#16a34a',
                          color: '#ffffff',
                          borderRadius: '8px',
                          padding: '4px 12px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                        }}
                        title="مراسلة المشترك بمطالبة الدين عبر واتساب"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مراسلة واتساب ({viewingSubscriber.phone})</span>
                      </a>
                    )}

                    <div
                      style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '4px 10px',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: '#334155'
                      }}
                    >
                      المستحق: {formatNumber(subBilling.due)} د.ع
                    </div>

                    <div
                      style={{
                        backgroundColor: '#fef3c7',
                        border: '1px solid #fde68a',
                        borderRadius: '8px',
                        padding: '3px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 800,
                        color: '#b45309',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>قراءة فقط للمدير</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setViewingSubscriber(null)
                    setShowViewingSubscriberContact(false)
                  }}
                  style={{
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#64748b',
                    flexShrink: 0
                  }}
                  title="إغلاق المعاينة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 2. جسم البطاقة القابل للتمرير */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                
                {/* شريط السنوات (2026 أحمر أيقوني، 2027، 2028) */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e0f2fe',
                    borderRadius: '12px',
                    padding: '8px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflowX: 'auto',
                    marginBottom: '12px'
                  }}
                >
                  <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#64748b', marginLeft: '6px' }}>
                    السنة المالية:
                  </span>
                  {YEARS.map(y => {
                    const is2026 = y === 2026
                    const isSelected = viewingSubscriberYear === y
                    return (
                      <button
                        key={y}
                        onClick={() => setViewingSubscriberYear(y)}
                        style={{
                          height: '32px',
                          padding: '0 16px',
                          borderRadius: '9999px',
                          border: is2026
                            ? (isSelected ? '1px solid #ef4444' : '1px solid #fecaca')
                            : (isSelected ? '1px solid #0f172a' : '1px solid #e0f2fe'),
                          backgroundColor: is2026
                            ? (isSelected ? '#ef4444' : '#fef2f2')
                            : (isSelected ? '#0f172a' : '#ffffff'),
                          color: is2026
                            ? (isSelected ? '#ffffff' : '#dc2626')
                            : (isSelected ? '#ffffff' : '#475569'),
                          fontWeight: 800,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s'
                        }}
                      >
                        {y}
                      </button>
                    )
                  })}
                </div>

                {/* بداية السنة أو تنبيه تصفير الحساب */}
                <div style={{ marginBottom: '12px' }}>
                  {isZeroAccountSubscriber(viewingSubscriber) ? (
                    <div
                      style={{
                        borderRadius: '14px',
                        border: '1px solid #e4e4e7',
                        backgroundColor: '#f4f4f5',
                        padding: '10px 16px',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#a1a1aa' }}></span>
                        <strong style={{ color: '#27272a' }}>الحساب مصفّر كلياً (0 د.ع)</strong>
                        <span style={{ color: '#71717a', fontSize: '0.75rem' }}>
                          بسبب حالة المشترك ({statusesList.join('، ')})
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', backgroundColor: '#e4e4e7', color: '#3f3f46', padding: '2px 8px', borderRadius: '9999px', fontWeight: 800 }}>
                        بدون ديون
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        borderRadius: '14px',
                        border: '1px solid #e0f2fe',
                        backgroundColor: '#ffffff',
                        padding: '10px 16px',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontFamily: 'monospace',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                      }}
                    >
                      <strong style={{ color: '#1e293b', fontFamily: 'inherit' }}>بداية السنة:</strong>
                      <span style={{ color: '#475569' }}>
                        القديم {formatNumber(subBilling.remainingPrev)} + الفائدة {formatNumber(subBilling.fee)} = {formatNumber(subBilling.totalCarried)} د.ع
                      </span>
                    </div>
                  )}
                </div>

                {/* اسم ورقم المشترك والفرع والمنطقة */}
                <div style={{ padding: '4px 6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#0284c7' }}>#{formatNumber(viewingSubscriber.id)}</span>
                      <span>-</span>
                      <span>{viewingSubscriber.name}</span>
                    </h3>
                    <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 700, marginTop: '3px' }}>
                      (منطقة: {areaName} • {selectedBranch?.name || ''})
                    </div>
                  </div>
                </div>

                {/* بطاقة التفاصيل الشاملة: الإضبارة، الدين السابق، العقار والعداد، الحالات، الملاحظات */}
                <div style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                    {Boolean(dossierVal) && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e3a8a', fontWeight: 800, fontSize: '0.78rem' }}>
                        <span style={{ color: '#1d4ed8' }}>رقم الإضبارة:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 900 }}>#{dossierVal}</span>
                      </div>
                    )}

                    {prevDebt > 0 && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '10px', backgroundColor: '#fff1f2', border: '1px solid #fecdd3', color: '#9f1239', fontWeight: 800, fontSize: '0.78rem' }}>
                        <span style={{ color: '#e11d48' }}>الدين السابق المسجل:</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 900 }}>{formatNumber(prevDebt)} د.ع</span>
                      </div>
                    )}

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '10px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#1e293b', fontWeight: 700, fontSize: '0.78rem' }}>
                      <span style={{ color: '#64748b' }}>العقار والعداد:</span>
                      <span>{viewingSubscriber.propertyType || 'سكني'} - {viewingSubscriber.meterType || 'ميكانيكي'}</span>
                    </div>
                  </div>

                  {/* شارات الحالات الخاصة للمشترك */}
                  {statusesList.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', marginLeft: '4px' }}>حالات المشترك:</span>
                      {statusesList.map(st => {
                        const cfg = STATUS_CONFIG[st]
                        return (
                          <span
                            key={st}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.75rem',
                              borderRadius: '6px',
                              fontWeight: 800,
                              backgroundColor: cfg?.bg === 'bg-red-50' ? '#fef2f2' : (cfg?.bg === 'bg-emerald-50' ? '#ecfdf5' : '#f4f4f5'),
                              color: cfg?.text === 'text-red-700' ? '#b91c1c' : (cfg?.text === 'text-emerald-700' ? '#047857' : '#3f3f46'),
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            {st}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* كارت الملاحظات البارز */}
                  {Boolean(notesVal) && (
                    <div style={{ padding: '10px 14px', borderRadius: '12px', backgroundColor: '#fefce8', border: '1px solid #fef08a', color: '#713f12', fontSize: '0.8rem', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <strong style={{ color: '#854d0e', flexShrink: 0 }}>ملاحظات المشترك:</strong>
                      <span style={{ fontWeight: 700, lineHeight: 1.5 }}>{notesVal}</span>
                    </div>
                  )}
                </div>

                {/* أزرار التنقل السلس بين المشتركين (التالي والسابق) */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    onClick={() => {
                      if (prevSub) {
                        setViewingSubscriber(prevSub)
                        setViewingSubscriberYear(2026)
                      }
                    }}
                    disabled={!prevSub}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: prevSub ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                      backgroundColor: prevSub ? '#ffffff' : '#f8fafc',
                      color: prevSub ? '#1e293b' : '#94a3b8',
                      cursor: prevSub ? 'pointer' : 'not-allowed',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <ChevronRight className="w-4 h-4 text-slate-600" />
                    <div style={{ textAlign: 'right', overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>السابق</div>
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px', fontWeight: 800 }}>
                        {prevSub ? `${formatNumber(prevSub.id)} - ${prevSub.name}` : 'لا يوجد سابق'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (nextSub) {
                        setViewingSubscriber(nextSub)
                        setViewingSubscriberYear(2026)
                      }
                    }}
                    disabled={!nextSub}
                    style={{
                      flex: 1,
                      minHeight: '44px',
                      borderRadius: '12px',
                      border: nextSub ? '1px solid #bae6fd' : '1px solid #e2e8f0',
                      backgroundColor: nextSub ? '#ffffff' : '#f8fafc',
                      color: nextSub ? '#1e293b' : '#94a3b8',
                      cursor: nextSub ? 'pointer' : 'not-allowed',
                      fontWeight: 800,
                      fontSize: '0.8rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
                    }}
                  >
                    <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700 }}>التالي</div>
                      <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '160px', fontWeight: 800 }}>
                        {nextSub ? `${formatNumber(nextSub.id)} - ${nextSub.name}` : 'لا يوجد تالي'}
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-slate-600" />
                  </button>
                </div>

                {/* 3. جدول فترات الجباية الأربعة أعمدة (مطابق لمحاسبة الكاتب والمحصل) */}
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '14px',
                    border: '1px solid #bae6fd',
                    overflow: 'hidden',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)'
                  }}
                >
                  {/* رأس جدول الديون */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '25% 25% 25% 25%',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      textAlign: 'center',
                      padding: '10px 4px'
                    }}
                  >
                    <div style={{ padding: '0 4px' }}>الديون السابقة</div>
                    <div style={{ padding: '0 4px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>المجموع</div>
                    <div style={{ padding: '0 4px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>المدفوع</div>
                    <div style={{ padding: '0 4px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>المجموع الكلي</div>
                  </div>

                  {/* صفوف الفترات الست (قراءة فقط بدون إمكانية التعديل للمدير) */}
                  {subBilling.rows.map((row, idx) => {
                    const isCurrentPeriod = viewingSubscriberYear === 2026 && idx === 1 // الفترة الحالية
                    return (
                      <div
                        key={row.periodLabel}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '25% 25% 25% 25%',
                          borderBottom: idx === 5 ? 'none' : '1px solid #e0f2fe',
                          backgroundColor: isCurrentPeriod
                            ? '#fef2f2'
                            : (idx % 2 === 0 ? '#ffffff' : 'rgba(240, 249, 255, 0.4)'),
                          padding: '6px 4px',
                          alignItems: 'center',
                          borderRight: isCurrentPeriod ? '4px solid #ef4444' : 'none'
                        }}
                      >
                        {/* 1. الديون السابقة */}
                        <div style={{ padding: '0 4px' }}>
                          <input
                            readOnly
                            value={formatInputDisplay(row.old) || '0'}
                            style={{
                              width: '100%',
                              height: '32px',
                              fontSize: '13.5px',
                              padding: '0 2px',
                              borderRadius: '8px',
                              border: isCurrentPeriod ? '1px solid #fecaca' : '1px solid #e0f2fe',
                              backgroundColor: '#ffffff',
                              textAlign: 'center',
                              fontWeight: 800,
                              color: isCurrentPeriod ? '#ef4444' : '#1e293b',
                              outline: 'none',
                              cursor: 'default',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* 2. المجموع */}
                        <div style={{ padding: '0 4px', borderRight: '1px solid #f0f9ff' }}>
                          <input
                            readOnly
                            value={formatInputDisplay(row.total) || '0'}
                            style={{
                              width: '100%',
                              height: '32px',
                              fontSize: '13.5px',
                              padding: '0 2px',
                              borderRadius: '8px',
                              border: '1px solid #e0f2fe',
                              backgroundColor: '#ffffff',
                              textAlign: 'center',
                              fontWeight: 800,
                              color: '#1e293b',
                              outline: 'none',
                              cursor: 'default',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* 3. المدفوع */}
                        <div style={{ padding: '0 4px', borderRight: '1px solid #f0f9ff' }}>
                          <input
                            readOnly
                            value={row.paid > 0 ? formatInputDisplay(row.paid) : '0'}
                            style={{
                              width: '100%',
                              height: '32px',
                              fontSize: '13.5px',
                              padding: '0 2px',
                              borderRadius: '8px',
                              border: row.paid > 0 ? '1px solid #86efac' : '1px solid #e0f2fe',
                              backgroundColor: row.paid > 0 ? '#ecfdf5' : '#ffffff',
                              textAlign: 'center',
                              fontWeight: 800,
                              color: row.paid > 0 ? '#15803d' : '#94a3b8',
                              outline: 'none',
                              cursor: 'default',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>

                        {/* 4. المجموع الكلي */}
                        <div style={{ padding: '0 4px', borderRight: '1px solid #f0f9ff' }}>
                          <input
                            readOnly
                            value={formatInputDisplay(row.remaining) || '0'}
                            style={{
                              width: '100%',
                              height: '32px',
                              fontSize: '13.5px',
                              padding: '0 2px',
                              borderRadius: '8px',
                              border: row.remaining === 0 ? '1px solid #a7f3d0' : (row.remaining < 0 ? '1px solid #fecaca' : '1px solid #0f172a'),
                              backgroundColor: row.remaining === 0
                                ? '#ecfdf5'
                                : (row.remaining < 0
                                ? '#fef2f2'
                                : (isCurrentPeriod ? '#ffffff' : '#0f172a')),
                              textAlign: 'center',
                              fontWeight: 800,
                              color: row.remaining === 0
                                ? '#047857'
                                : (row.remaining < 0
                                ? '#b91c1c'
                                : (isCurrentPeriod ? '#ef4444' : '#ffffff')),
                              outline: 'none',
                              cursor: 'default',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* مفتاح الألوان التوضيحي */}
                <div style={{ marginTop: '10px', display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '0.75rem', color: '#64748b', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span> مسدد
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0f172a' }}></span> متبقي
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }}></span> الفترة الحالية
                  </span>
                </div>

                {/* ملخص الدين والتاريخ وأيام التأخير */}
                {debtSummary && debtSummary.months > 0 && (
                  <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '12px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 700 }}>
                      <span>مدة الدين التراكمي: </span>
                      <strong style={{ color: '#0f172a' }}>{debtSummary.durationText}</strong>
                    </div>
                    {debtSummary.startPeriod && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                        يبدأ من: <strong style={{ color: '#0284c7' }}>{debtSummary.startPeriod} ({debtSummary.startYear})</strong>
                      </div>
                    )}
                  </div>
                )}

                {/* شريط الإجمالي وصافي المبلغ المطلوب حالياً */}
                <div
                  style={{
                    marginTop: '12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #bae6fd',
                    padding: '12px 18px',
                    borderRadius: '14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 700 }}>استحقاق الدورة: </span>
                    <strong style={{ fontSize: '0.9rem', color: '#0284c7' }}>{(subBilling.due || 24600).toLocaleString('ar-IQ')} د.ع</strong>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#0f172a', fontWeight: 800 }}>صافي المبلغ المطلوب حالياً:</span>
                    <span
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 900,
                        color: subBilling.totalRemaining > 0 ? '#dc2626' : '#16a34a',
                        backgroundColor: subBilling.totalRemaining > 0 ? '#fee2e2' : '#dcfce7',
                        padding: '4px 14px',
                        borderRadius: '10px',
                        border: subBilling.totalRemaining > 0 ? '1px solid #fca5a5' : '1px solid #bbf7d0'
                      }}
                    >
                      {(subBilling.totalRemaining || 0).toLocaleString('ar-IQ')} د.ع
                    </span>
                  </div>
                </div>
              </div>

              {/* 4. أسفل البطاقة (Footer) */}
              <div
                style={{
                  backgroundColor: '#ffffff',
                  borderTop: '1px solid #e0f2fe',
                  padding: '12px 18px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                  🔒 شاشة رقابة ومعاينة للمدير العام (قراءة فقط - لحماية السجلات من أي تعديل غير مصرح به)
                </div>

                <button
                  onClick={() => {
                    setViewingSubscriber(null)
                    setShowViewingSubscriberContact(false)
                  }}
                  style={{
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    padding: '8px 24px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: '0.88rem'
                  }}
                >
                  إغلاق المعاينة
                </button>
              </div>
            </div>

            {/* نافذة التواصل والموقع والصور المنبثقة للمشترك */}
            {showViewingSubscriberContact && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 120,
                  padding: '16px'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    width: '460px',
                    maxWidth: '100%',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
                    border: '1px solid #e2e8f0',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
                      تفاصيل التواصل والموقع والصور
                    </h4>
                    <button
                      onClick={() => setShowViewingSubscriberContact(false)}
                      style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>رقم الهاتف:</span>
                      <strong style={{ fontSize: '0.95rem', color: '#0284c7' }} dir="ltr">{viewingSubscriber.phone || 'غير مسجل'}</strong>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>العنوان التفصيلي:</span>
                      <span style={{ fontSize: '0.88rem', color: '#1e293b', fontWeight: 700 }}>{viewingSubscriber.detailedAddress || 'غير محدد'}</span>
                    </div>

                    {viewingSubscriber.location && (
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '3px' }}>الموقع الجغرافي:</span>
                        <a
                          href={viewingSubscriber.location.link || `https://www.google.com/maps?q=${viewingSubscriber.location.lat},${viewingSubscriber.location.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#0284c7', fontSize: '0.85rem', fontWeight: 800, textDecoration: 'underline' }}
                        >
                          فتح الموقع على خرائط جوجل ↗
                        </a>
                      </div>
                    )}

                    {viewingSubscriber.doorImage && (
                      <div>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '6px' }}>صورة الباب / العداد:</span>
                        <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', maxHeight: '200px' }}>
                          <img
                            src={viewingSubscriber.doorImage}
                            alt="صورة المشترك"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '12px 18px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => setShowViewingSubscriberContact(false)}
                      style={{
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        border: '1px solid #cbd5e1',
                        padding: '6px 16px',
                        borderRadius: '8px',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer'
                      }}
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
            )}
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
                style={{ background: '#f1f5f9', border: 'none', borderRadius: '6px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X className="w-4 h-4 text-slate-600" />
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
                            <span style={{ fontWeight: 800, color: '#1e293b' }}>{a.name}</span>
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
