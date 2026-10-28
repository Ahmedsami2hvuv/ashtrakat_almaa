'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  DirectorateBranch,
  BranchManager,
  BranchCollector,
  BranchWriter,
  Consignment
} from '@/lib/directorateTypes'
import {
  generateSecureToken,
  generateWhatsAppLink,
  loadBranchSubscribersAndBilling,
  saveBranchSubscribersAndBilling
} from '@/lib/directorateStore'
import { Area, Subscriber, BillingRecords } from '@/components/MainApp'
import ConsignmentsA4Page from './ConsignmentsA4Page'
import BranchConsignmentsStore from './BranchConsignmentsStore'
import BranchInspectionsTab from './BranchInspectionsTab'
import ManagerInspectionDashboardModal from './ManagerInspectionDashboardModal'
import * as XLSX from 'xlsx'
import {
  Users,
  MapPin,
  Wallet,
  BookOpen,
  Building2,
  Settings,
  Plus,
  Upload,
  Share2,
  Edit3,
  Trash2,
  FileText,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  XCircle,
  Key,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Check,
  Copy,
  Layers,
  Archive,
  X,
  Menu,
  RefreshCw,
  Zap,
  Phone,
  AlertCircle,
  Hash,
  Clock,
  Activity,
  BarChart3,
  Calendar,
  DollarSign,
  Filter,
  Eye,
  CreditCard,
  Droplet
} from 'lucide-react'
import { checkWriterWorkHours, getIraqCurrentTime, formatTimeArabic, getIraqDateAndTimeString } from '@/lib/iraqTime'
import { loadWriterActivities, computeWriterComprehensiveStats, WriterComprehensiveStats, PeriodStats } from '@/lib/writerActivityStore'
import { loadCollectorActivities, computeCollectorComprehensiveStats, CollectorComprehensiveStats, CollectorPeriodStats } from '@/lib/collectorActivityStore'
import { WriterActivityEvent, CollectorActivityEvent } from '@/lib/directorateTypes'

interface BranchManagerDashboardProps {
  branch: DirectorateBranch
  currentManager?: BranchManager
  onUpdateBranch: (updatedBranch: DirectorateBranch) => void
  onOpenSubscriberApp: (params: {
    role: 'manager' | 'collector' | 'writer'
    userTitle: string
    canEdit: boolean
    assignedAreaIds?: string[]
    assignedSubscriberIds?: number[]
  }) => void
}

type TabType = 'dashboard' | 'subscribers' | 'areas' | 'consignments' | 'inspections' | 'collectors' | 'writers' | 'settings'

function HamburgerIcon({ open }: { open: boolean }) {
  return open ? <X size={20} color="#0f172a" /> : <Menu size={20} color="#0f172a" strokeWidth={2.2} />
}

export default function BranchManagerDashboard({
  branch,
  currentManager,
  onUpdateBranch,
  onOpenSubscriberApp
}: BranchManagerDashboardProps) {
  // التبويب الافتراضي: الرئيسية (أزرار أقسام بدون قراءات)
  const tabFromPath = (): TabType => {
    if (typeof window === 'undefined') return 'dashboard'
    const slug = window.location.pathname.split('/').filter(Boolean).pop()
    const valid: TabType[] = ['dashboard', 'subscribers', 'areas', 'consignments', 'inspections', 'collectors', 'writers', 'settings']
    return valid.includes(slug as TabType) ? slug as TabType : 'dashboard'
  }
  const [activeTab, setActiveTab] = useState<TabType>(tabFromPath)
  // القائمة الجانبية تفتح كمركبة (Overlay) فوق الصفحة
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [navToast, setNavToast] = useState<string | null>(null)
  // رابط حقيقي لكل قسم حتى يعمل كلك يمين → فتح في نافذة جديدة
  const tabHref = (tab: TabType) => {
    if (typeof window === 'undefined') return `/manager/${tab}`
    const params = new URLSearchParams(window.location.search)
    const query = params.toString()
    return `/manager/${tab}${query ? `?${query}` : ''}`
  }
  const navigateTab = (tab: TabType) => {
    setActiveTab(tab)
    setSidebarOpen(false)
    if (typeof window !== 'undefined') {
      const nextUrl = tabHref(tab)
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.pushState({ managerTab: tab }, '', nextUrl)
      }
    }
  }
  // نقرة عادية = نفس الصفحة؛ Ctrl/Cmd أو وسط الزر أو كلك يمين = سلوك المتصفح الطبيعي
  const handleTabLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, tab: TabType, label?: string) => {
    if (e.defaultPrevented) return
    if (e.button !== 0) return
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    if (label && tab !== 'dashboard') {
      setNavToast(`جاري فتح ${label}...`)
    }
    navigateTab(tab)
  }
  useEffect(() => {
    const onPopState = () => setActiveTab(tabFromPath())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  useEffect(() => {
    if (!navToast) return
    const t = setTimeout(() => setNavToast(null), 1400)
    return () => clearTimeout(t)
  }, [navToast])
  const [showInspectionDashboard, setShowInspectionDashboard] = useState(false)
  const [isConsignmentA4Open, setIsConsignmentA4Open] = useState(false)
  const [selectedConsignmentForView, setSelectedConsignmentForView] = useState<Consignment | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // توقيت العراق الرسمي الحي (توقيت بغداد)
  const [iraqTime, setIraqTime] = useState('')
  useEffect(() => {
    const updateIraqTime = () => {
      try {
        const formatted = new Intl.DateTimeFormat('ar-IQ', {
          timeZone: 'Asia/Baghdad',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(new Date())
        setIraqTime(formatted)
      } catch {
        setIraqTime(new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }))
      }
    }
    updateIraqTime()
    const timer = setInterval(updateIraqTime, 30000)
    return () => clearInterval(timer)
  }, [])

  // حالات المشتركين المحملين عند الطلب فقط مع كاش ذكي
  const [loadedSubscribers, setLoadedSubscribers] = useState<Subscriber[]>(() => branch.subscribers || [])
  const [loadedBilling, setLoadedBilling] = useState<BillingRecords>(() => branch.billing || {})
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false)
  const [hasLoadedSubscribers, setHasLoadedSubscribers] = useState(false)

  // دالة جلب المشتركين عند الطلب
  const fetchBranchSubscribers = async (force = false) => {
    // حتى لو الفرع فارغ (length === 0) لا نعيد الجلب إلى ما لا نهاية
    if (!force && hasLoadedSubscribers) return
    setIsLoadingSubscribers(true)
    try {
      const data = await loadBranchSubscribersAndBilling(branch.id, force)
      setLoadedSubscribers(data.subscribers)
      setLoadedBilling(data.billing)
      setHasLoadedSubscribers(true)
    } catch (err) {
      console.error('Failed to load branch subscribers:', err)
    } finally {
      setIsLoadingSubscribers(false)
    }
  }

  // سحب بيانات المشتركين فقط عند الحاجة الفعلية (سجل المشتركين أو فتح إرسالية A4)
  // الصفحة الرئيسية لا تسحب أي بيانات — وكل قسم آخر يسحب ما يحتاجه عند دخوله فقط
  useEffect(() => {
    if ((activeTab === 'subscribers' || isConsignmentA4Open) && !hasLoadedSubscribers) {
      fetchBranchSubscribers()
    }
  }, [activeTab, isConsignmentA4Open, hasLoadedSubscribers])

  // حالات المناطق والبحث والتفاعل المتقدم
  const [newAreaName, setNewAreaName] = useState('')
  const [showAreasListModal, setShowAreasListModal] = useState(false)
  const [areasListText, setAreasListText] = useState('')
  const [areaSearchQuery, setAreaSearchQuery] = useState('')
  const [selectedAreaForModal, setSelectedAreaForModal] = useState<Area | null>(null)
  // عند فتح نافذة منطقة: نجلب المشتركين حينها فقط (وليس عند مجرد عرض قائمة المناطق)
  useEffect(() => {
    if (selectedAreaForModal && !hasLoadedSubscribers) {
      fetchBranchSubscribers()
    }
  }, [selectedAreaForModal, hasLoadedSubscribers])
  const [isAssigningToArea, setIsAssigningToArea] = useState(false)
  const [areaSubscribersSearch, setAreaSubscribersSearch] = useState('')
  const [allSubscribersSearch, setAllSubscribersSearch] = useState('')
  const [selectedNewSubIdsForArea, setSelectedNewSubIdsForArea] = useState<Set<number>>(new Set())
  const [filterUnassignedOnly, setFilterUnassignedOnly] = useState(false)
  const [isSavingAreaSubs, setIsSavingAreaSubs] = useState(false)
  const [areaActionFeedback, setAreaActionFeedback] = useState<string | null>(null)

  // حالات استيراد المشتركين
  const [showImportModal, setShowImportModal] = useState(false)
  const [importText, setImportText] = useState('')

  // حالات استيراد ملف الإكسل الشامل
  const [showExcelModal, setShowExcelModal] = useState(false)
  const [isProcessingExcel, setIsProcessingExcel] = useState(false)
  const [excelPreviewResult, setExcelPreviewResult] = useState<{
    subscribers: Subscriber[]
    areas: Area[]
    writers: BranchWriter[]
    newSubscribersCount: number
    updatedSubscribersCount: number
    newAreasCount: number
    newWritersCount: number
    previewRows: any[]
  } | null>(null)
  const [excelError, setExcelError] = useState<string | null>(null)

  // حالات المحصلين
  const [showCollectorModal, setShowCollectorModal] = useState(false)
  const [editingCollector, setEditingCollector] = useState<BranchCollector | null>(null)
  const [collectorName, setCollectorName] = useState('')
  const [collectorPhone, setCollectorPhone] = useState('')
  const [collectorCanEdit, setCollectorCanEdit] = useState(false)
  const [selectedCollectorAreas, setSelectedCollectorAreas] = useState<string[]>([])
  const [collectorAreaSearch, setCollectorAreaSearch] = useState('')
  const [showSelectedOnlyCollector, setShowSelectedOnlyCollector] = useState(false)
  const [collectorRangeFrom, setCollectorRangeFrom] = useState('')
  const [collectorRangeTo, setCollectorRangeTo] = useState('')

  // حالات الكتاب
  const [showWriterModal, setShowWriterModal] = useState(false)
  const [editingWriter, setEditingWriter] = useState<BranchWriter | null>(null)
  const [writerName, setWriterName] = useState('')
  const [writerPhone, setWriterPhone] = useState('')
  const [selectedWriterAreas, setSelectedWriterAreas] = useState<string[]>([])
  const [writerAreaSearch, setWriterAreaSearch] = useState('')
  const [showSelectedOnlyWriter, setShowSelectedOnlyWriter] = useState(false)
  const [writerWorkHoursEnabled, setWriterWorkHoursEnabled] = useState(false)
  const [writerWorkHourStart, setWriterWorkHourStart] = useState('08:00')
  const [writerWorkHourEnd, setWriterWorkHourEnd] = useState('14:00')
  const [writerRangeFrom, setWriterRangeFrom] = useState('')
  const [writerRangeTo, setWriterRangeTo] = useState('')
  const [copiedWriterId, setCopiedWriterId] = useState<string | null>(null)
  const [copiedCollectorId, setCopiedCollectorId] = useState<string | null>(null)
  const [collectorSearch, setCollectorSearch] = useState('')
  const [writerSearch, setWriterSearch] = useState('')

  // حالات سجل نشاط وإحصائيات الكاتب
  const [showWriterStatsModal, setShowWriterStatsModal] = useState<boolean>(false)
  const [statsSelectedWriter, setStatsSelectedWriter] = useState<BranchWriter | null>(null)
  const [writerActivityEvents, setWriterActivityEvents] = useState<WriterActivityEvent[]>([])
  const [isLoadingWriterStats, setIsLoadingWriterStats] = useState<boolean>(false)
  const [statsTimeTab, setStatsTimeTab] = useState<'today' | 'month' | 'year' | 'all'>('today')
  const [statsSearchTerm, setStatsSearchTerm] = useState<string>('')
  const [statsActionFilter, setStatsActionFilter] = useState<'all' | 'login' | 'edit_subscriber' | 'update_debt' | 'add_payment'>('all')
  const [showSubscribersListModal, setShowSubscribersListModal] = useState<{
    title: string
    subscribers: Array<{ id?: number; name?: string; amount?: number }>
  } | null>(null)

  // دالة فتح نافذة سجل نشاط وإحصائيات الكاتب
  const handleOpenWriterStats = async (writer: BranchWriter) => {
    setStatsSelectedWriter(writer)
    setShowWriterStatsModal(true)
    setIsLoadingWriterStats(true)
    setStatsTimeTab('today')
    setStatsSearchTerm('')
    setStatsActionFilter('all')
    try {
      const events = await loadWriterActivities(branch.id, writer.id)
      setWriterActivityEvents(events)
    } catch (err) {
      console.error('Failed to load writer activities:', err)
    } finally {
      setIsLoadingWriterStats(false)
    }
  }

  // دالة تحديث سجل نشاط الكاتب لحظياً
  const handleRefreshWriterStats = async () => {
    if (!statsSelectedWriter) return
    setIsLoadingWriterStats(true)
    try {
      const events = await loadWriterActivities(branch.id, statsSelectedWriter.id)
      setWriterActivityEvents(events)
    } catch (err) {
      console.error('Failed to refresh writer activities:', err)
    } finally {
      setIsLoadingWriterStats(false)
    }
  }

  // حساب إحصائيات الكاتب الشاملة
  const writerStats = useMemo(() => {
    if (!statsSelectedWriter) return null
    return computeWriterComprehensiveStats(writerActivityEvents, statsSelectedWriter.id)
  }, [writerActivityEvents, statsSelectedWriter])

  // الأحداث المصفاة للجدول التفصيلي
  const filteredEventsForTable = useMemo(() => {
    if (!statsSelectedWriter) return []
    const iraqInfo = getIraqDateAndTimeString()
    let list = writerActivityEvents.filter(e => e.writerId === statsSelectedWriter.id)

    if (statsTimeTab === 'today') {
      list = list.filter(e => e.date === iraqInfo.date)
    } else if (statsTimeTab === 'month') {
      list = list.filter(e => e.year === iraqInfo.year && e.month === iraqInfo.month)
    } else if (statsTimeTab === 'year') {
      list = list.filter(e => e.year === iraqInfo.year)
    }

    if (statsActionFilter !== 'all') {
      list = list.filter(e => e.actionType === statsActionFilter)
    }

    if (statsSearchTerm.trim()) {
      const q = statsSearchTerm.trim().toLowerCase()
      list = list.filter(e =>
        (e.subscriberName && e.subscriberName.toLowerCase().includes(q)) ||
        (e.subscriberId && String(e.subscriberId).includes(q)) ||
        (e.details && e.details.toLowerCase().includes(q))
      )
    }

    return list
  }, [writerActivityEvents, statsSelectedWriter, statsTimeTab, statsActionFilter, statsSearchTerm])

  // حالات سجل نشاط وإحصائيات المحصل
  const [showCollectorStatsModal, setShowCollectorStatsModal] = useState<boolean>(false)
  const [statsSelectedCollector, setStatsSelectedCollector] = useState<BranchCollector | null>(null)
  const [collectorActivityEvents, setCollectorActivityEvents] = useState<CollectorActivityEvent[]>([])
  const [isLoadingCollectorStats, setIsLoadingCollectorStats] = useState<boolean>(false)
  const [collectorStatsTimeTab, setCollectorStatsTimeTab] = useState<'today' | 'month' | 'year' | 'all'>('today')
  const [collectorStatsSearchTerm, setCollectorStatsSearchTerm] = useState<string>('')
  const [collectorStatsActionFilter, setCollectorStatsActionFilter] = useState<'all' | 'login' | 'view_subscriber' | 'add_payment' | 'edit_subscriber'>('all')

  // دالة فتح نافذة سجل نشاط وإحصائيات المحصل
  const handleOpenCollectorStats = async (collector: BranchCollector) => {
    setStatsSelectedCollector(collector)
    setShowCollectorStatsModal(true)
    setIsLoadingCollectorStats(true)
    setCollectorStatsTimeTab('today')
    setCollectorStatsSearchTerm('')
    setCollectorStatsActionFilter('all')
    try {
      const events = await loadCollectorActivities(branch.id, collector.id)
      setCollectorActivityEvents(events)
    } catch (err) {
      console.error('Failed to load collector activities:', err)
    } finally {
      setIsLoadingCollectorStats(false)
    }
  }

  // دالة تحديث سجل نشاط المحصل لحظياً
  const handleRefreshCollectorStats = async () => {
    if (!statsSelectedCollector) return
    setIsLoadingCollectorStats(true)
    try {
      const events = await loadCollectorActivities(branch.id, statsSelectedCollector.id)
      setCollectorActivityEvents(events)
    } catch (err) {
      console.error('Failed to refresh collector activities:', err)
    } finally {
      setIsLoadingCollectorStats(false)
    }
  }

  // حساب إحصائيات المحصل الشاملة
  const collectorStats = useMemo(() => {
    if (!statsSelectedCollector) return null
    return computeCollectorComprehensiveStats(collectorActivityEvents, statsSelectedCollector.id)
  }, [collectorActivityEvents, statsSelectedCollector])

  // الأحداث المصفاة لجدول المحصل
  const filteredCollectorEventsForTable = useMemo(() => {
    if (!statsSelectedCollector) return []
    const iraqInfo = getIraqDateAndTimeString()
    let list = collectorActivityEvents.filter(e => e.collectorId === statsSelectedCollector.id)

    if (collectorStatsTimeTab === 'today') {
      list = list.filter(e => e.date === iraqInfo.date)
    } else if (collectorStatsTimeTab === 'month') {
      list = list.filter(e => e.year === iraqInfo.year && e.month === iraqInfo.month)
    } else if (collectorStatsTimeTab === 'year') {
      list = list.filter(e => e.year === iraqInfo.year)
    }

    if (collectorStatsActionFilter !== 'all') {
      list = list.filter(e => e.actionType === collectorStatsActionFilter)
    }

    if (collectorStatsSearchTerm.trim()) {
      const q = collectorStatsSearchTerm.trim().toLowerCase()
      list = list.filter(e =>
        (e.subscriberName && e.subscriberName.toLowerCase().includes(q)) ||
        (e.subscriberId && String(e.subscriberId).includes(q)) ||
        (e.details && e.details.toLowerCase().includes(q))
      )
    }

    return list
  }, [collectorActivityEvents, statsSelectedCollector, collectorStatsTimeTab, collectorStatsActionFilter, collectorStatsSearchTerm])

  // حالة عرض تفاصيل حساب المشترك وبلوك ديونه للمسؤول
  const [selectedDetailSubscriber, setSelectedDetailSubscriber] = useState<Subscriber | null>(null)
  const [detailSubscriberYear, setDetailSubscriberYear] = useState<number>(2026)


  // حالات الذكاء الاصطناعي
  const [newApiKey, setNewApiKey] = useState('')

  // حالات وضع التحديد والتخصيص الجماعي في سجل المشتركين
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedSubIds, setSelectedSubIds] = useState<Set<number>>(new Set())
  const [subscribersPage, setSubscribersPage] = useState(1)
  const [subscribersPageSize, setSubscribersPageSize] = useState<number>(30)

  // حالات التحديد بنطاق أرقام (مثلاً: من 1 إلى 1000)
  const [rangeFrom, setRangeFrom] = useState<string>('1')
  const [rangeTo, setRangeTo] = useState<string>('1000')
  const [rangeMode, setRangeMode] = useState<'index' | 'id'>('id')
  const [rangeKeepPrevious, setRangeKeepPrevious] = useState<boolean>(false)

  // حالات نوافذ التخصيص المنبثقة
  const [showAssignAreasModal, setShowAssignAreasModal] = useState(false)
  const [bulkSelectedAreaIds, setBulkSelectedAreaIds] = useState<string[]>([])
  const [bulkAreaSearch, setBulkAreaSearch] = useState('')

  const [showAssignWritersModal, setShowAssignWritersModal] = useState(false)
  const [bulkSelectedWriterIds, setBulkSelectedWriterIds] = useState<string[]>([])

  const [showAssignCollectorsModal, setShowAssignCollectorsModal] = useState(false)
  const [bulkSelectedCollectorIds, setBulkSelectedCollectorIds] = useState<string[]>([])

  const [isBulkSaving, setIsBulkSaving] = useState(false)
  const [bulkFeedbackMessage, setBulkFeedbackMessage] = useState<string | null>(null)

  // فلترة المشتركين المحملين فقط
  const filteredSubscribers = useMemo(() => {
    if (!searchQuery.trim()) return loadedSubscribers
    const q = searchQuery.toLowerCase()
    return loadedSubscribers.filter(
      s => s.name.toLowerCase().includes(q) || s.id.toString().includes(q)
    )
  }, [loadedSubscribers, searchQuery])

  // إعادة ضبط الصفحة عند تغيير البحث
  useEffect(() => {
    setSubscribersPage(1)
  }, [searchQuery])

  // المشتركون في الصفحة الحالية
  const totalSubPages = Math.ceil(filteredSubscribers.length / subscribersPageSize) || 1
  const paginatedSubscribers = useMemo(() => {
    const start = (subscribersPage - 1) * subscribersPageSize
    return filteredSubscribers.slice(start, start + subscribersPageSize)
  }, [filteredSubscribers, subscribersPage, subscribersPageSize])

  // فلترة المحصلين بالاسم أو الهاتف أو المنطقة
  const filteredCollectors = useMemo(() => {
    const list = branch.collectors || []
    if (!collectorSearch.trim()) return list
    const q = collectorSearch.trim().toLowerCase()
    return list.filter(c => 
      c.name.toLowerCase().includes(q) || 
      c.phone.includes(q) ||
      (branch.areas || []).some(a => (c.assignedAreaIds || []).includes(a.id) && a.name.toLowerCase().includes(q))
    )
  }, [branch.collectors, branch.areas, collectorSearch])

  // فلترة الكتّاب بالاسم أو الهاتف أو المنطقة
  const filteredWriters = useMemo(() => {
    const list = branch.writers || []
    if (!writerSearch.trim()) return list
    const q = writerSearch.trim().toLowerCase()
    return list.filter(w => 
      w.name.toLowerCase().includes(q) || 
      w.phone.includes(q) ||
      (branch.areas || []).some(a => (w.assignedAreaIds || []).includes(a.id) && a.name.toLowerCase().includes(q))
    )
  }, [branch.writers, branch.areas, writerSearch])

  // دوال التحكم بالتحديد
  const toggleSelectSubscriber = (id: number) => {
    setSelectedSubIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAllVisibleSubscribers = () => {
    setSelectedSubIds(prev => {
      const next = new Set(prev)
      paginatedSubscribers.forEach(s => next.add(s.id))
      return next
    })
  }

  const selectAllFilteredSubscribers = () => {
    setSelectedSubIds(new Set(filteredSubscribers.map(s => s.id)))
  }

  const clearSelectedSubscribers = () => {
    setSelectedSubIds(new Set())
  }

  // تحديد المشتركين عبر إدخال نطاق أرقام (مثلاً من 1 إلى 1000)
  const handleSelectByRange = (modeOverride?: 'index' | 'id') => {
    const fromNum = parseInt(rangeFrom.trim(), 10)
    const toNum = parseInt(rangeTo.trim(), 10)

    if (isNaN(fromNum) || isNaN(toNum) || fromNum <= 0 || toNum <= 0) {
      alert('يرجى إدخال أرقام صحيحة أكبر من الصفر في حقلي النطاق (من وإلى).')
      return
    }

    const start = Math.min(fromNum, toNum)
    const end = Math.max(fromNum, toNum)
    const currentMode = modeOverride || rangeMode

    const newlySelectedIds = new Set<number>()

    if (currentMode === 'index') {
      // 1. التحديد حسب تسلسل المشتركين في القائمة (مثلاً من المشترك 1 إلى 1000)
      const sliceStart = Math.max(0, start - 1)
      const sliceEnd = Math.min(filteredSubscribers.length, end)
      const targetSubs = filteredSubscribers.slice(sliceStart, sliceEnd)
      targetSubs.forEach(s => newlySelectedIds.add(s.id))
    } else {
      // 2. التحديد حسب رقم المشترك (ID) الفعلي
      filteredSubscribers.forEach(s => {
        const subIdNum = Number(s.id)
        if (!isNaN(subIdNum) && subIdNum >= start && subIdNum <= end) {
          newlySelectedIds.add(s.id)
        }
      })
    }

    if (newlySelectedIds.size === 0) {
      alert('لم يتم العثور على أي مشتركين يقعون ضمن هذا النطاق المحدد.')
      return
    }

    const selectedIdsArray = Array.from(newlySelectedIds)
    const minId = Math.min(...selectedIdsArray)
    const maxId = Math.max(...selectedIdsArray)

    setSelectedSubIds(prev => {
      if (rangeKeepPrevious) {
        const merged = new Set(prev)
        newlySelectedIds.forEach(id => merged.add(id))
        return merged
      }
      return newlySelectedIds
    })

    if (currentMode === 'id') {
      setBulkFeedbackMessage(`تم بنجاح تحديد (${newlySelectedIds.size}) مشترك بأرقام اشتراكات تقع بين (${start}) و (${end})! (من رقم #${minId} إلى #${maxId})`)
    } else {
      setBulkFeedbackMessage(`تم تحديد (${newlySelectedIds.size}) مشترك حسب تسلسل القائمة من ${start} إلى ${end} (أرقام اشتراكاتهم الحقيقية: #${minId} إلى #${maxId})`)
    }
    setTimeout(() => setBulkFeedbackMessage(null), 5000)
  }

  // تحديد سريع لأرقام جاهزة (500، 1000، 2000...)
  const handleQuickRange = (fromStr: string, toStr: string) => {
    const fromNum = parseInt(fromStr, 10)
    const toNum = parseInt(toStr, 10)
    const sliceStart = Math.max(0, fromNum - 1)
    const sliceEnd = Math.min(filteredSubscribers.length, toNum)
    const newlySelectedIds = new Set<number>()
    filteredSubscribers.slice(sliceStart, sliceEnd).forEach(s => newlySelectedIds.add(s.id))
    
    setSelectedSubIds(prev => {
      if (rangeKeepPrevious) {
        const merged = new Set(prev)
        newlySelectedIds.forEach(id => merged.add(id))
        return merged
      }
      return newlySelectedIds
    })

    setBulkFeedbackMessage(`تم تحديد (${newlySelectedIds.size}) مشترك (من ${fromStr} إلى ${toStr}) بنجاح!`)
    setTimeout(() => setBulkFeedbackMessage(null), 4000)
  }

  // الانتقال للدفعة التالية تلقائياً بنفس الحجم (مثلاً من 1001 إلى 2000)
  const handleNextBatch = () => {
    const fromNum = parseInt(rangeFrom.trim(), 10) || 1
    const toNum = parseInt(rangeTo.trim(), 10) || 1000
    const step = Math.max(1, toNum - fromNum + 1)
    const nextFrom = toNum + 1
    const nextTo = toNum + step
    setRangeFrom(String(nextFrom))
    setRangeTo(String(nextTo))

    const sliceStart = Math.max(0, nextFrom - 1)
    const sliceEnd = Math.min(filteredSubscribers.length, nextTo)
    const newlySelectedIds = new Set<number>()
    filteredSubscribers.slice(sliceStart, sliceEnd).forEach(s => newlySelectedIds.add(s.id))

    if (newlySelectedIds.size === 0) {
      alert(`وصلت إلى نهاية المشتركين (إجمالي المشتركين الحاليين: ${filteredSubscribers.length}).`)
      return
    }

    setSelectedSubIds(prev => {
      if (rangeKeepPrevious) {
        const merged = new Set(prev)
        newlySelectedIds.forEach(id => merged.add(id))
        return merged
      }
      return newlySelectedIds
    })

    setBulkFeedbackMessage(`تم تحديد الدفعة التالية: (${newlySelectedIds.size}) مشترك (من ${nextFrom} إلى ${nextTo}) بنجاح!`)
    setTimeout(() => setBulkFeedbackMessage(null), 4000)
  }

  // 1. تنفيذ التخصيص للمناطق
  const handleBulkAssignAreas = async () => {
    if (bulkSelectedAreaIds.length === 0) {
      alert('يرجى تحديد منطقة واحدة على الأقل')
      return
    }
    if (selectedSubIds.size === 0) {
      alert('يرجى تحديد مشترك واحد على الأقل')
      return
    }

    setIsBulkSaving(true)
    try {
      const primaryAreaId = bulkSelectedAreaIds[0]
      const updatedSubscribers = loadedSubscribers.map(sub => {
        if (selectedSubIds.has(sub.id)) {
          return {
            ...sub,
            areaId: primaryAreaId,
            areaIds: [...bulkSelectedAreaIds]
          }
        }
        return sub
      })

      // حفظ التعديلات في السحابة
      await saveBranchSubscribersAndBilling(branch.id, updatedSubscribers, loadedBilling)

      // تحديث الحالة للفرع والمكون الحالي
      setLoadedSubscribers(updatedSubscribers)
      onUpdateBranch({
        ...branch,
        subscribers: updatedSubscribers,
        subscribersCount: updatedSubscribers.length
      })

      setShowAssignAreasModal(false)
      setBulkSelectedAreaIds([])
      setSelectedSubIds(new Set())
      setIsSelectMode(false)
      setBulkFeedbackMessage(`تم بنجاح تخصيص ${selectedSubIds.size} مشترك للمناطق المحددة (${bulkSelectedAreaIds.length} مناطق)`)
      setTimeout(() => setBulkFeedbackMessage(null), 4500)
    } catch (err) {
      console.error('Error assigning areas:', err)
      alert('حدث خطأ أثناء حفظ تخصيص المناطق، يرجى المحاولة ثانية')
    } finally {
      setIsBulkSaving(false)
    }
  }

  // 2. تنفيذ التخصيص للكتّاب
  const handleBulkAssignWriters = async () => {
    if (bulkSelectedWriterIds.length === 0) {
      alert('يرجى تحديد كاتب واحد على الأقل')
      return
    }
    if (selectedSubIds.size === 0) {
      alert('يرجى تحديد مشترك واحد على الأقل')
      return
    }

    setIsBulkSaving(true)
    try {
      const idsToAdd = Array.from(selectedSubIds)
      const currentWriters = branch.writers || []
      const updatedWriters = currentWriters.map(writer => {
        if (bulkSelectedWriterIds.includes(writer.id)) {
          const existingIds = new Set(writer.assignedSubscriberIds || [])
          idsToAdd.forEach(id => existingIds.add(id))
          return {
            ...writer,
            assignedSubscriberIds: Array.from(existingIds)
          }
        }
        return writer
      })

      onUpdateBranch({
        ...branch,
        writers: updatedWriters
      })

      setShowAssignWritersModal(false)
      setBulkSelectedWriterIds([])
      setSelectedSubIds(new Set())
      setIsSelectMode(false)
      setBulkFeedbackMessage(`تم بنجاح تخصيص المشتركين للكتّاب المحددين (${bulkSelectedWriterIds.length} كاتب)`)
      setTimeout(() => setBulkFeedbackMessage(null), 4500)
    } catch (err) {
      console.error('Error assigning writers:', err)
      alert('حدث خطأ أثناء حفظ تخصيص الكتّاب')
    } finally {
      setIsBulkSaving(false)
    }
  }

  // 3. تنفيذ التخصيص للمحصلين
  const handleBulkAssignCollectors = async () => {
    if (bulkSelectedCollectorIds.length === 0) {
      alert('يرجى تحديد محصل واحد على الأقل')
      return
    }
    if (selectedSubIds.size === 0) {
      alert('يرجى تحديد مشترك واحد على الأقل')
      return
    }

    setIsBulkSaving(true)
    try {
      const idsToAdd = Array.from(selectedSubIds)
      const currentCollectors = branch.collectors || []
      const updatedCollectors = currentCollectors.map(collector => {
        if (bulkSelectedCollectorIds.includes(collector.id)) {
          const existingIds = new Set(collector.assignedSubscriberIds || [])
          idsToAdd.forEach(id => existingIds.add(id))
          return {
            ...collector,
            assignedSubscriberIds: Array.from(existingIds)
          }
        }
        return collector
      })

      onUpdateBranch({
        ...branch,
        collectors: updatedCollectors
      })

      setShowAssignCollectorsModal(false)
      setBulkSelectedCollectorIds([])
      setSelectedSubIds(new Set())
      setIsSelectMode(false)
      setBulkFeedbackMessage(`تم بنجاح تخصيص المشتركين للمحصلين المحددين (${bulkSelectedCollectorIds.length} محصل)`)
      setTimeout(() => setBulkFeedbackMessage(null), 4500)
    } catch (err) {
      console.error('Error assigning collectors:', err)
      alert('حدث خطأ أثناء حفظ تخصيص المحصلين')
    } finally {
      setIsBulkSaving(false)
    }
  }

  // 4. إزالة المشتركين المحددين من الكاتب المختار
  const handleBulkRemoveFromWriters = async () => {
    if (bulkSelectedWriterIds.length === 0) {
      alert('يرجى تحديد كاتب واحد على الأقل لإزالة المشتركين منه')
      return
    }
    if (selectedSubIds.size === 0) {
      alert('يرجى تحديد مشترك واحد على الأقل')
      return
    }

    if (!confirm(`هل أنت متأكد من رغبتك في إزالة المشتركين المحددين (${selectedSubIds.size} مشترك) من الكاتب المختار؟`)) {
      return
    }

    setIsBulkSaving(true)
    try {
      const idsToRemove = new Set(selectedSubIds)
      const currentWriters = branch.writers || []
      const updatedWriters = currentWriters.map(writer => {
        if (bulkSelectedWriterIds.includes(writer.id)) {
          const filteredIds = (writer.assignedSubscriberIds || []).filter(id => !idsToRemove.has(id))
          return {
            ...writer,
            assignedSubscriberIds: filteredIds
          }
        }
        return writer
      })

      onUpdateBranch({
        ...branch,
        writers: updatedWriters
      })

      setShowAssignWritersModal(false)
      setBulkSelectedWriterIds([])
      setSelectedSubIds(new Set())
      setIsSelectMode(false)
      setBulkFeedbackMessage(`تم بنجاح إزالة المشتركين المحددين من الكاتب المختار`)
      setTimeout(() => setBulkFeedbackMessage(null), 4500)
    } catch (err) {
      console.error('Error removing subscribers from writers:', err)
      alert('حدث خطأ أثناء إزالة المشتركين من الكاتب')
    } finally {
      setIsBulkSaving(false)
    }
  }

  // 5. إزالة المشتركين المحددين من المحصل المختار
  const handleBulkRemoveFromCollectors = async () => {
    if (bulkSelectedCollectorIds.length === 0) {
      alert('يرجى تحديد محصل واحد على الأقل لإزالة المشتركين منه')
      return
    }
    if (selectedSubIds.size === 0) {
      alert('يرجى تحديد مشترك واحد على الأقل')
      return
    }

    if (!confirm(`هل أنت متأكد من رغبتك في إزالة المشتركين المحددين (${selectedSubIds.size} مشترك) من المحصل المختار؟`)) {
      return
    }

    setIsBulkSaving(true)
    try {
      const idsToRemove = new Set(selectedSubIds)
      const currentCollectors = branch.collectors || []
      const updatedCollectors = currentCollectors.map(collector => {
        if (bulkSelectedCollectorIds.includes(collector.id)) {
          const filteredIds = (collector.assignedSubscriberIds || []).filter(id => !idsToRemove.has(id))
          return {
            ...collector,
            assignedSubscriberIds: filteredIds
          }
        }
        return collector
      })

      onUpdateBranch({
        ...branch,
        collectors: updatedCollectors
      })

      setShowAssignCollectorsModal(false)
      setBulkSelectedCollectorIds([])
      setSelectedSubIds(new Set())
      setIsSelectMode(false)
      setBulkFeedbackMessage(`تم بنجاح إزالة المشتركين المحددين من المحصل المختار`)
      setTimeout(() => setBulkFeedbackMessage(null), 4500)
    } catch (err) {
      console.error('Error removing subscribers from collectors:', err)
      alert('حدث خطأ أثناء إزالة المشتركين من المحصل')
    } finally {
      setIsBulkSaving(false)
    }
  }

  // 6. تفريغ جميع المشتركين من كاتب معين بضغطة زر
  const handleClearWriterSubscribers = (writerId: string, writerName: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إزالة وتفريغ جميع المشتركين المخصصين للكاتب (${writerName})؟`)) {
      return
    }
    const updatedWriters = (branch.writers || []).map(w => {
      if (w.id === writerId) {
        return {
          ...w,
          assignedSubscriberIds: []
        }
      }
      return w
    })
    onUpdateBranch({ ...branch, writers: updatedWriters })
    setBulkFeedbackMessage(`تم بنجاح إزالة وتفريغ جميع المشتركين من الكاتب (${writerName})`)
    setTimeout(() => setBulkFeedbackMessage(null), 4500)
  }

  // 7. تفريغ جميع المشتركين من محصل معين بضغطة زر
  const handleClearCollectorSubscribers = (collectorId: string, collectorName: string) => {
    if (!confirm(`هل أنت متأكد من رغبتك في إزالة وتفريغ جميع المشتركين المخصصين للمحصل (${collectorName})؟`)) {
      return
    }
    const updatedCollectors = (branch.collectors || []).map(c => {
      if (c.id === collectorId) {
        return {
          ...c,
          assignedSubscriberIds: []
        }
      }
      return c
    })
    onUpdateBranch({ ...branch, collectors: updatedCollectors })
    setBulkFeedbackMessage(`تم بنجاح إزالة وتفريغ جميع المشتركين من المحصل (${collectorName})`)
    setTimeout(() => setBulkFeedbackMessage(null), 4500)
  }

  // ------------------ إدارة المناطق ------------------
  const handleAddArea = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = newAreaName.trim()
    if (!trimmed) {
      alert('يرجى كتابة اسم المنطقة')
      return
    }
    const exists = (branch.areas || []).some(
      a => a.name.trim().toLowerCase() === trimmed.toLowerCase()
    )
    if (exists) {
      alert('هذه المنطقة مضافة مسبقاً!')
      return
    }
    const newArea: Area = {
      id: 'area_' + Date.now().toString(36),
      name: trimmed,
      branches: []
    }
    const updatedAreas = [...(branch.areas || []), newArea]
    onUpdateBranch({ ...branch, areas: updatedAreas })
    setNewAreaName('')
  }

  // إضافة قائمة مناطق دفعة واحدة (كل منطقة بسطر)
  const handleAddAreasList = () => {
    if (!areasListText.trim()) {
      alert('يرجى كتابة أو لصق أسماء المناطق')
      return
    }

    const lines = areasListText.split('\n')
    const existingAreaNames = new Set((branch.areas || []).map(a => a.name.trim().toLowerCase()))
    const newAreas: Area[] = []
    let addedCount = 0

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed) return
      if (!existingAreaNames.has(trimmed.toLowerCase())) {
        existingAreaNames.add(trimmed.toLowerCase())
        newAreas.push({
          id: 'area_' + Date.now().toString(36) + '_' + idx,
          name: trimmed,
          branches: []
        })
        addedCount++
      }
    })

    if (addedCount === 0) {
      alert('لم يتم العثور على مناطق جديدة، أو جميع المناطق المكتوبة مسجلة مسبقاً.')
      return
    }

    const updatedAreas = [...(branch.areas || []), ...newAreas]
    onUpdateBranch({ ...branch, areas: updatedAreas })
    setShowAreasListModal(false)
    setAreasListText('')
    alert(`تمت إضافة ${addedCount} منطقة بنجاح.`)
  }

  const handleDeleteArea = (areaId: string, areaName: string) => {
    if (confirm(`هل أنت متأكد من حذف منطقة (${areaName})؟`)) {
      const updatedAreas = branch.areas.filter(a => a.id !== areaId)
      onUpdateBranch({ ...branch, areas: updatedAreas })
      if (selectedAreaForModal?.id === areaId) {
        setSelectedAreaForModal(null)
      }
    }
  }

  // خريطة سريعة جداً لحساب عدد المشتركين في كل منطقة فورياً
  const areaSubscribersCountMap = useMemo(() => {
    const map = new Map<string, number>()
    loadedSubscribers.forEach(s => {
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
  }, [loadedSubscribers])

  // فلترة قائمة المناطق بالبحث
  const filteredAreas = useMemo(() => {
    const areas = branch.areas || []
    if (!areaSearchQuery.trim()) return areas
    const q = areaSearchQuery.trim().toLowerCase()
    return areas.filter(a => a.name.toLowerCase().includes(q))
  }, [branch.areas, areaSearchQuery])

  // مشتركو المنطقة المحددة حالياً في المودال التفاعلي
  const subscribersInSelectedArea = useMemo(() => {
    if (!selectedAreaForModal) return []
    const aid = selectedAreaForModal.id
    let list = loadedSubscribers.filter(s => s.areaId === aid || (s.areaIds && s.areaIds.includes(aid)))
    if (areaSubscribersSearch.trim()) {
      const q = areaSubscribersSearch.trim().toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || String(s.id).includes(q))
    }
    return list
  }, [selectedAreaForModal, loadedSubscribers, areaSubscribersSearch])

  // المشتركون المتاحون للإضافة إلى المنطقة
  const availableSubscribersForArea = useMemo(() => {
    if (!selectedAreaForModal) return []
    const currentAid = selectedAreaForModal.id
    let list = loadedSubscribers.filter(s => s.areaId !== currentAid && (!s.areaIds || !s.areaIds.includes(currentAid)))

    if (filterUnassignedOnly) {
      list = list.filter(s => !s.areaId && (!s.areaIds || s.areaIds.length === 0))
    }

    if (allSubscribersSearch.trim()) {
      const q = allSubscribersSearch.trim().toLowerCase()
      list = list.filter(s => s.name.toLowerCase().includes(q) || String(s.id).includes(q) || (s.detailedAddress && s.detailedAddress.toLowerCase().includes(q)))
    }
    return list
  }, [selectedAreaForModal, loadedSubscribers, filterUnassignedOnly, allSubscribersSearch])

  // حفظ تخصيص المشتركين للمنطقة
  const handleAssignSubscribersToArea = async () => {
    if (!selectedAreaForModal || selectedNewSubIdsForArea.size === 0) return
    setIsSavingAreaSubs(true)
    try {
      const targetAreaId = selectedAreaForModal.id
      const targetAreaName = selectedAreaForModal.name
      const updated = loadedSubscribers.map(s => {
        if (selectedNewSubIdsForArea.has(s.id)) {
          let updatedAddress = s.detailedAddress || ''
          if (updatedAddress.includes('المنطقة:')) {
            updatedAddress = updatedAddress.replace(/المنطقة:[^|]+/, `المنطقة: ${targetAreaName}`)
          } else {
            updatedAddress = `${updatedAddress ? updatedAddress + ' | ' : ''}المنطقة: ${targetAreaName}`
          }
          return {
            ...s,
            areaId: targetAreaId,
            detailedAddress: updatedAddress
          }
        }
        return s
      })

      setLoadedSubscribers(updated)
      await saveBranchSubscribersAndBilling(branch.id, updated, loadedBilling)
      setSelectedNewSubIdsForArea(new Set())
      setIsAssigningToArea(false)
      setAreaActionFeedback(`تمت إضافة ${selectedNewSubIdsForArea.size} مشترك إلى منطقة (${targetAreaName}) بنجاح!`)
      setTimeout(() => setAreaActionFeedback(null), 4000)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء حفظ المشتركين')
    } finally {
      setIsSavingAreaSubs(false)
    }
  }

  // إزالة مشترك من المنطقة الحالية (فك التخصيص)
  const handleRemoveSubscriberFromArea = async (subId: number, subName: string) => {
    if (!selectedAreaForModal) return
    if (!confirm(`هل أنت متأكد من إزالة المشترك (${subName}) من منطقة (${selectedAreaForModal.name})؟`)) return

    try {
      const updated = loadedSubscribers.map(s => {
        if (s.id === subId) {
          return {
            ...s,
            areaId: '',
            areaIds: s.areaIds ? s.areaIds.filter(aid => aid !== selectedAreaForModal.id) : []
          }
        }
        return s
      })

      setLoadedSubscribers(updated)
      await saveBranchSubscribersAndBilling(branch.id, updated, loadedBilling)
      setAreaActionFeedback(`تمت إزالة المشترك (${subName}) من المنطقة بنجاح.`)
      setTimeout(() => setAreaActionFeedback(null), 3000)
    } catch (err) {
      console.error(err)
      alert('حدث خطأ أثناء التحديث')
    }
  }

  // ------------------ استيراد المشتركين ------------------
  const handleExecuteImport = () => {
    if (!importText.trim()) {
      alert('يرجى لصق نص المشتركين')
      return
    }

    const lines = importText.split('\n')
    const newSubscribers: Subscriber[] = []
    let addedCount = 0

    const existingIds = new Set(loadedSubscribers.map(s => s.id))
    const startOrder = loadedSubscribers.length + 1

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      if (!trimmed) return

      const match = trimmed.match(/^(\d+)\s*[-–\t\s]\s*(.+)$/) || trimmed.match(/^(\d+)\s+(.+)$/)
      if (match) {
        const id = parseInt(match[1], 10)
        const name = match[2].trim()

        if (!existingIds.has(id)) {
          existingIds.add(id)
          newSubscribers.push({
            id,
            name,
            phone: '',
            areaId: '',
            branchId: branch.id,
            propertyType: 'سكني',
            meterType: '4 متر',
            detailedAddress: 'تم الاستيراد حديثاً',
            remainingPrev: 0,
            fee: 0,
            order: startOrder + idx,
            statuses: [],
            createdAt: new Date().toISOString()
          })
          addedCount++
        }
      }
    })

    if (addedCount === 0) {
      alert('لم يتم العثور على أرقام وأسماء جديدة، أو جميع الأرقام مسجلة مسبقاً.')
      return
    }

    const allSubscribers = [...loadedSubscribers, ...newSubscribers]
    setLoadedSubscribers(allSubscribers)
    setHasLoadedSubscribers(true)
    saveBranchSubscribersAndBilling(branch.id, allSubscribers, loadedBilling)

    onUpdateBranch({
      ...branch,
      subscribersCount: allSubscribers.length,
      subscribers: []
    })
    setShowImportModal(false)
    setImportText('')
    alert(`تم استيراد ${addedCount} مشترك بنجاح وحفظهم في قاعدة بيانات الفرع.`)
  }

  // ------------------ استيراد ملف إكسل شامل (Excel) ------------------
  // دالة ذكية للبحث عن قيمة الحقل في السطر حسب مفاتيح محتملة
  const extractFieldValue = (row: any, patterns: string[]): any => {
    const keys = Object.keys(row)
    for (const pattern of patterns) {
      // تطابق تام
      const exactKey = keys.find(k => k.trim().toLowerCase() === pattern.toLowerCase())
      if (exactKey && row[exactKey] !== undefined && row[exactKey] !== '') return row[exactKey]
      
      // تطابق جزئي
      const partialKey = keys.find(k => k.trim().toLowerCase().includes(pattern.toLowerCase()))
      if (partialKey && row[partialKey] !== undefined && row[partialKey] !== '') return row[partialKey]
    }
    return ''
  }

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setExcelError(null)
    setIsProcessingExcel(true)
    setExcelPreviewResult(null)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result
        const workbook = XLSX.read(buffer, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        if (!sheetName) {
          throw new Error('الملف فارغ ولا يحتوي على أوراق عمل.')
        }

        const sheet = workbook.Sheets[sheetName]
        const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' })

        if (!rawRows || rawRows.length === 0) {
          throw new Error('ورقة العمل لا تحتوي على بيانات أو سطور مقروءة.')
        }

        // إعداد الهياكل للربط والمعالجة
        const currentAreas = [...(branch.areas || [])]
        const areaMap = new Map<string, Area>()
        currentAreas.forEach(a => areaMap.set(a.name.trim().toLowerCase(), a))

        const currentWriters = [...(branch.writers || [])]
        const writerMap = new Map<string, BranchWriter>()
        currentWriters.forEach(w => writerMap.set(w.name.trim().toLowerCase(), w))

        const currentSubscribers = [...(loadedSubscribers || [])]
        const subscriberIdMap = new Map<number, Subscriber>()
        currentSubscribers.forEach(s => subscriberIdMap.set(s.id, s))

        let newAreasCount = 0
        let newWritersCount = 0
        let newSubscribersCount = 0
        let updatedSubscribersCount = 0

        // تحديد أعلى رقم متسلسل حالي للمشتركين إذا كان السطر بلا رقم
        let maxSubId = currentSubscribers.reduce((max, s) => Math.max(max, s.id || 0), 1000)
        let maxOrder = currentSubscribers.reduce((max, s) => Math.max(max, s.order || 0), 0)

        const previewRows: any[] = []

        rawRows.forEach((row) => {
          // 1. استخراج اسم المشترك (فحص جميع الأعمدة المحتملة لأن بعض الملفات تكرر عمود اسم المشترك)
          let name = ''
          const nameKeys = Object.keys(row).filter(k => 
            k.includes('اسم المشترك') || k.includes('الاسم') || k.includes('المشترك') || k.toLowerCase().includes('name')
          )
          for (const nk of nameKeys) {
            const val = String(row[nk] || '').trim()
            if (val && !val.includes('سجل رقم') && val.length > name.length) {
              name = val
            }
          }
          if (!name) {
            name = String(extractFieldValue(row, ['اسم', 'الاسم', 'المشترك', 'name']) || '').trim()
          }

          // 2. استخراج رقم المشترك / الاشتراك
          const idVal = extractFieldValue(row, [
            'الاشتراك', 'رقم الاشتراك', 'اشتراك', 'رقم المشترك', 'رقم_المشترك', 'الرقم', 'التسلسل', 'تسلسل', 'ت', 'رقم', 'رمز المشترك', 'رمز', 'id', 'sub_id', 'no'
          ])
          
          let subId: number = 0
          const parsedId = parseInt(String(idVal || '').replace(/[^\d]/g, ''), 10)
          if (!isNaN(parsedId) && parsedId > 0) {
            subId = parsedId
          } else {
            // فحص أي عمود يحتوي على رقم تسلسلي للمشترك
            const firstNumericKey = Object.keys(row).find(k => {
              const v = String(row[k] || '').trim()
              return /^\d+$/.test(v) && parseInt(v, 10) > 0 && parseInt(v, 10) < 500000
            })
            if (firstNumericKey) {
              subId = parseInt(String(row[firstNumericKey]).trim(), 10)
            } else if (name) {
              maxSubId++
              subId = maxSubId
            } else {
              // سطر فارغ تماماً نتجاهله
              return
            }
          }

          // إذا لم يكن هناك اسم، نضع اسماً افتراضياً برقم المشترك
          const finalName = name || `مشترك رقم ${subId}`

          // 3. استخراج اسم المنطقة
          const areaVal = extractFieldValue(row, [
            'اسم المنطقة', 'المنطقة', 'منطقة', 'الحي', 'حي', 'المحلة', 'محلة', 'الشارع', 'area', 'areaName'
          ])
          const areaName = String(areaVal || '').trim()
          let assignedAreaId = ''

          if (areaName && areaName !== 'بدون عنوان' && areaName !== 'متنوع') {
            const lowerArea = areaName.toLowerCase()
            if (areaMap.has(lowerArea)) {
              assignedAreaId = areaMap.get(lowerArea)!.id
            } else {
              // إنشاء منطقة جديدة تلقائياً
              const newArea: Area = {
                id: 'area_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
                name: areaName,
                branches: []
              }
              currentAreas.push(newArea)
              areaMap.set(lowerArea, newArea)
              assignedAreaId = newArea.id
              newAreasCount++
            }
          }

          // 4. استخراج رقم الإضبارة
          const dossierVal = extractFieldValue(row, [
            'رقم الاضبارة', 'رقم_الاضبارة', 'رقم الاضباره', 'الاضبارة', 'الاضباره', 'اضبارة', 'اضباره', 'رقم الملف', 'الملف', 'dossier'
          ])
          const dossierText = String(dossierVal || '').trim()

          // 5. استخراج الملاحظات
          const noteVal = extractFieldValue(row, [
            'ملاحظات', 'الملاحظات', 'ملاحظة', 'الملاحظة', 'notes', 'note'
          ])
          const noteText = String(noteVal || '').trim()

          // 6. استخراج نوع العقار (الصنف) والحالات
          const propVal = extractFieldValue(row, [
            'الصنف', 'نوع العقار', 'العقار', 'النوع', 'سكني/تجاري', 'نوع الاشتراك', 'property', 'type'
          ])
          const propText = String(propVal || '').trim()
          let propertyType: any = 'سكني'
          if (propText.includes('تجاري') || propText.includes('محل') || propText.includes('مخزن') || propText.includes('معمل')) {
            propertyType = 'تجاري'
          } else if (propText.includes('حكومي') || propText.includes('دائرة')) {
            propertyType = 'حكومي'
          } else if (propText.includes('صناعي')) {
            propertyType = 'صناعي'
          }

          // 7. استخراج المساحة / العداد (حجم العداد وحصة المتر المكعب)
          const meterVal = extractFieldValue(row, [
            'المساحة', 'المساحه', 'عدد المتر', 'المتر', 'العداد', 'نوع العداد', 'قطر العداد', 'القطر', 'meter', 'volume'
          ])
          const meterText = String(meterVal || '').trim() || '4/م مكعب'

          // 8. فحص واستخراج الحالات (مغلق، مهدوم، إيقاف حساب، قطعه فارغه، إلخ)
          const allRowText = Object.values(row).join(' ')
          const statuses: string[] = []

          if (allRowText.includes('مغلق')) statuses.push('مغلق')
          if (allRowText.includes('مهدوم') || allRowText.includes('مفلش')) statuses.push('مهدوم')
          if (allRowText.includes('إيقاف') || allRowText.includes('ايقاف') || allRowText.includes('متوقف')) statuses.push('إيقاف حساب')
          if (allRowText.includes('مقطوع')) statuses.push('مقطوع')
          if (allRowText.includes('متجاوز') || allRowText.includes('تجاوز')) statuses.push('متجاوز')
          if (allRowText.includes('قطعه فارغه') || allRowText.includes('قطعة فارغة') || allRowText.includes('فارغه') || allRowText.includes('فارغة') || allRowText.includes('عرصه')) statuses.push('قطعة فارغة')
          if (allRowText.includes('مرتحل') || allRowText.includes('مهجور')) statuses.push('مهجور/مرتحل')

          // 9. استخراج الدين السابق بذكاء (من عمود الدين المخصص أو المكتوب داخل الملاحظات مثل: ديون (360608))
          const debtColVal = extractFieldValue(row, [
            'الدين السابق', 'الديون السابقة', 'المتبقي السابق', 'الرصيد السابق', 'المتبقي', 'الدين', 'الذمة', 'debt', 'balance'
          ])
          let cleanDebt = parseFloat(String(debtColVal || '').replace(/[^\d.-]/g, '')) || 0

          if (cleanDebt === 0) {
            // البحث عن نمط الديون في نص الملاحظات مثل: عليه ديون (310456) أو لديه ديون(12120) أو ديون 131040
            const debtMatch = allRowText.match(/(?:ديون|دين|مطلوب|الديون|زياده)[^\d]*(\d+)/)
            if (debtMatch && debtMatch[1]) {
              cleanDebt = parseFloat(debtMatch[1]) || 0
            }
          }

          // 10. استخراج الهاتف إن وجد
          const phoneVal = extractFieldValue(row, [
            'الهاتف', 'رقم الهاتف', 'الموبايل', 'الجوال', 'phone', 'mobile'
          ])
          const phoneText = String(phoneVal || '').trim()

          // 11. استخراج اسم الكاتب إن وجد
          const writerVal = extractFieldValue(row, [
            'اسم الكاتب', 'اسم_الكاتب', 'الكاتب', 'القارئ', 'الجابي', 'الموظف', 'writer', 'reader'
          ])
          const writerName = String(writerVal || '').trim()

          if (writerName) {
            const lowerWriter = writerName.toLowerCase()
            let writerObj = writerMap.get(lowerWriter)
            if (!writerObj) {
              writerObj = {
                id: 'wri_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
                name: writerName,
                phone: '',
                token: generateSecureToken('wri'),
                assignedAreaIds: assignedAreaId ? [assignedAreaId] : [],
                assignedSubscriberIds: [subId],
                createdAt: new Date().toISOString()
              }
              currentWriters.push(writerObj)
              writerMap.set(lowerWriter, writerObj)
              newWritersCount++
            } else {
              if (assignedAreaId && !writerObj.assignedAreaIds.includes(assignedAreaId)) {
                writerObj.assignedAreaIds.push(assignedAreaId)
              }
              if (!writerObj.assignedSubscriberIds) {
                writerObj.assignedSubscriberIds = []
              }
              if (!writerObj.assignedSubscriberIds.includes(subId)) {
                writerObj.assignedSubscriberIds.push(subId)
              }
            }
          }

          // بناء العنوان والتفاصيل المدمجة لحفظ الإضبارة والملاحظات
          const addrParts: string[] = []
          if (areaName) addrParts.push(`المنطقة: ${areaName}`)
          if (dossierText) addrParts.push(`إضبارة: ${dossierText}`)
          if (noteText) addrParts.push(`ملاحظة: ${noteText}`)
          const detailedAddress = addrParts.join(' | ') || 'تم الاستيراد من ملف إكسل'

          const existingSub = subscriberIdMap.get(subId)
          if (existingSub) {
            // تحديث بيانات المشترك
            existingSub.name = finalName
            if (phoneText) existingSub.phone = phoneText
            if (assignedAreaId) existingSub.areaId = assignedAreaId
            existingSub.propertyType = propertyType
            existingSub.meterType = meterText as any
            existingSub.detailedAddress = detailedAddress
            if (dossierText) existingSub.dossier = dossierText
            if (noteText) existingSub.notes = noteText
            if (cleanDebt > 0) existingSub.remainingPrev = cleanDebt
            if (statuses.length > 0) {
              existingSub.statuses = Array.from(new Set([...(existingSub.statuses || []), ...statuses]))
            }
            updatedSubscribersCount++
          } else {
            // إنشاء مشترك جديد
            maxOrder++
            const newSub: Subscriber = {
              id: subId,
              name: finalName,
              phone: phoneText,
              areaId: assignedAreaId,
              branchId: branch.id,
              propertyType,
              meterType: meterText as any,
              detailedAddress,
              dossier: dossierText || undefined,
              notes: noteText || undefined,
              remainingPrev: cleanDebt,
              fee: 0,
              order: maxOrder,
              statuses,
              createdAt: new Date().toISOString()
            }
            subscriberIdMap.set(subId, newSub)
            currentSubscribers.push(newSub)
            newSubscribersCount++
          }

          if (previewRows.length < 10) {
            previewRows.push({
              id: subId,
              name: finalName,
              area: areaName || 'بدون منطقة',
              dossier: dossierText || '-',
              property: propertyType,
              meter: meterText,
              debt: cleanDebt,
              statuses: statuses.join('، ') || 'طبيعي',
              note: noteText || '-'
            })
          }
        })

        if (newSubscribersCount === 0 && updatedSubscribersCount === 0) {
          throw new Error('لم يتم العثور على أي مشتركين صالحين للاستيراد في الملف.')
        }

        setExcelPreviewResult({
          subscribers: Array.from(subscriberIdMap.values()),
          areas: currentAreas,
          writers: currentWriters,
          newSubscribersCount,
          updatedSubscribersCount,
          newAreasCount,
          newWritersCount,
          previewRows
        })
      } catch (err: any) {
        console.error('خطأ أثناء قراءة ملف الإكسل:', err)
        setExcelError(err?.message || 'حدث خطأ غير متوقع أثناء معالجة ملف الإكسل.')
      } finally {
        setIsProcessingExcel(false)
        e.target.value = ''
      }
    }

    reader.onerror = () => {
      setExcelError('فشلت قراءة الملف، يرجى المحاولة مرة أخرى.')
      setIsProcessingExcel(false)
    }

    reader.readAsArrayBuffer(file)
  }

  // حالة تقدم الحفظ السحابي لملف الإكسل
  const [excelSavingProgress, setExcelSavingProgress] = useState<{ text: string; pct: number } | null>(null)

  // تأكيد حفظ بيانات الإكسل في الفرع
  const handleConfirmExcelImport = async () => {
    if (!excelPreviewResult) return

    const newSubs = excelPreviewResult.subscribers
    setExcelSavingProgress({ text: 'جارٍ تجهيز سجلات الديون وقاعدة البيانات...', pct: 5 })

    // مزامنة الديون السابقة المستخرجة إلى سجلات الديون لسنة 2026
    const updatedBilling = { ...loadedBilling }
    newSubs.forEach(sub => {
      if (sub.remainingPrev && sub.remainingPrev > 0) {
        if (!updatedBilling[sub.id]) updatedBilling[sub.id] = {}
        if (!updatedBilling[sub.id][2026]) {
          updatedBilling[sub.id][2026] = [
            { oldDebtManual: sub.remainingPrev, paid: 0, totalManual: null, remainingManual: null },
            { oldDebtManual: null, paid: 0, totalManual: null, remainingManual: null },
            { oldDebtManual: null, paid: 0, totalManual: null, remainingManual: null },
            { oldDebtManual: null, paid: 0, totalManual: null, remainingManual: null },
            { oldDebtManual: null, paid: 0, totalManual: null, remainingManual: null },
            { oldDebtManual: null, paid: 0, totalManual: null, remainingManual: null }
          ]
        } else if (updatedBilling[sub.id][2026][0]) {
          updatedBilling[sub.id][2026][0].oldDebtManual = sub.remainingPrev
        }
      }
    })

    const saveResult = await saveBranchSubscribersAndBilling(
      branch.id,
      newSubs,
      updatedBilling,
      (text, pct) => {
        setExcelSavingProgress({ text, pct })
      }
    )

    if (!saveResult.success) {
      alert(`حدث خطأ أثناء حفظ المشتركين في السيرفر:\n${saveResult.error || 'يرجى المحاولة مرة أخرى'}`)
      setExcelSavingProgress(null)
      return
    }

    setLoadedSubscribers(newSubs)
    setLoadedBilling(updatedBilling)
    setHasLoadedSubscribers(true)

    onUpdateBranch({
      ...branch,
      areas: excelPreviewResult.areas,
      writers: excelPreviewResult.writers,
      subscribersCount: newSubs.length,
      subscribers: []
    })

    const msg = `تم الاستيراد والحفظ السحابي بنجاح تام!
• إجمالي المشتركين المسجلين: ${newSubs.length}
• المشتركون الجدد: ${excelPreviewResult.newSubscribersCount}
• المشتركون المحدثون: ${excelPreviewResult.updatedSubscribersCount}
• المناطق الجديدة المضافة: ${excelPreviewResult.newAreasCount}
• حسابات الكتاب الجديدة المنشأة: ${excelPreviewResult.newWritersCount}`

    alert(msg)
    setExcelSavingProgress(null)
    setShowExcelModal(false)
    setExcelPreviewResult(null)
  }

  // ------------------ إدارة المحصلين ------------------
  const handleSaveCollector = () => {
    if (!collectorName.trim() || !collectorPhone.trim()) {
      alert('يرجى ملء الاسم الثلاثي ورقم الهاتف')
      return
    }

    let assignedSubs: number[] = editingCollector?.assignedSubscriberIds || []
    let savedRangeFrom: number | undefined = undefined
    let savedRangeTo: number | undefined = undefined
    const cFrom = collectorRangeFrom.trim()
    const cTo = collectorRangeTo.trim()

    if (cFrom === '' && cTo === '') {
      assignedSubs = []
    } else if (cFrom !== '' && cTo !== '') {
      const fromNum = parseInt(cFrom, 10)
      const toNum = parseInt(cTo, 10)
      if (!isNaN(fromNum) && !isNaN(toNum) && fromNum > 0 && toNum > 0) {
        const start = Math.min(fromNum, toNum)
        const end = Math.max(fromNum, toNum)
        savedRangeFrom = start
        savedRangeTo = end
        const generated: number[] = []
        for (let id = start; id <= end; id++) {
          generated.push(id)
        }
        assignedSubs = generated
      }
    }

    let updatedCollectors = [...(branch.collectors || [])]
    if (editingCollector) {
      updatedCollectors = updatedCollectors.map(c =>
        c.id === editingCollector.id
          ? {
              ...c,
              name: collectorName.trim(),
              phone: collectorPhone.trim(),
              canEdit: collectorCanEdit,
              assignedAreaIds: selectedCollectorAreas,
              assignedSubscriberIds: assignedSubs
            }
          : c
      )
    } else {
      const newCollector: BranchCollector = {
        id: 'col_' + Date.now().toString(36),
        name: collectorName.trim(),
        phone: collectorPhone.trim(),
        token: generateSecureToken('col'),
        assignedAreaIds: selectedCollectorAreas,
        assignedSubscriberIds: assignedSubs,
        canEdit: collectorCanEdit,
        createdAt: new Date().toISOString()
      }
      updatedCollectors.push(newCollector)
    }

    onUpdateBranch({ ...branch, collectors: updatedCollectors })
    setShowCollectorModal(false)
    setEditingCollector(null)
    setCollectorName('')
    setCollectorPhone('')
    setSelectedCollectorAreas([])
    setCollectorRangeFrom('')
    setCollectorRangeTo('')
  }

  const handleDeleteCollector = (collectorId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف المحصل (${name})؟`)) {
      const updated = branch.collectors.filter(c => c.id !== collectorId)
      onUpdateBranch({ ...branch, collectors: updated })
    }
  }

  const handleToggleCollectorEdit = (collectorId: string, currentVal: boolean) => {
    const updated = branch.collectors.map(c =>
      c.id === collectorId ? { ...c, canEdit: !currentVal } : c
    )
    onUpdateBranch({ ...branch, collectors: updated })
  }

  const handleShareCollectorWhatsApp = (collector: BranchCollector) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=collector&token=${collector.token}&branch=${branch.id}`
    const msg = `مرحبا ${collector.name}\nمحصل واردات ${branch.name}\nرابط حسابك المباشر:\n${directLink}`
    const waUrl = generateWhatsAppLink(collector.phone, msg)
    window.open(waUrl, '_blank')
  }

  const handleCopyCollectorLink = (collector: BranchCollector) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=collector&token=${collector.token}&branch=${branch.id}`
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(directLink).then(() => {
        setCopiedCollectorId(collector.id)
        setTimeout(() => setCopiedCollectorId(null), 2500)
      }).catch(() => {
        prompt('انسخ الرابط التالي:', directLink)
      })
    } else {
      prompt('انسخ الرابط التالي:', directLink)
    }
  }

  // ------------------ إدارة الكتّاب ------------------
  const handleSaveWriter = () => {
    if (!writerName.trim() || !writerPhone.trim()) {
      alert('يرجى إدخال اسم الكاتب ورقم هاتفه')
      return
    }

    let assignedSubs: number[] = editingWriter?.assignedSubscriberIds || []
    const wFrom = writerRangeFrom.trim()
    const wTo = writerRangeTo.trim()
    let savedRangeFrom: number | undefined = undefined
    let savedRangeTo: number | undefined = undefined

    if (wFrom === '' && wTo === '') {
      assignedSubs = []
    } else if (wFrom !== '' && wTo !== '') {
      const fromNum = parseInt(wFrom, 10)
      const toNum = parseInt(wTo, 10)
      if (!isNaN(fromNum) && !isNaN(toNum) && fromNum > 0 && toNum > 0) {
        const start = Math.min(fromNum, toNum)
        const end = Math.max(fromNum, toNum)
        const generated: number[] = []
        for (let id = start; id <= end; id++) {
          generated.push(id)
        }
        assignedSubs = generated
      }
    }

    let updatedWriters = [...(branch.writers || [])]
    if (editingWriter) {
      updatedWriters = updatedWriters.map(w =>
        w.id === editingWriter.id
          ? {
              ...w,
              name: writerName.trim(),
              phone: writerPhone.trim(),
              assignedAreaIds: w.assignedAreaIds || [],
              assignedSubscriberIds: assignedSubs,
              rangeFrom: savedRangeFrom,
              rangeTo: savedRangeTo,
              workHoursEnabled: writerWorkHoursEnabled,
              workHourStart: writerWorkHoursEnabled ? writerWorkHourStart : undefined,
              workHourEnd: writerWorkHoursEnabled ? writerWorkHourEnd : undefined
            }
          : w
      )
    } else {
      const newWriter: BranchWriter = {
        id: 'wri_' + Date.now().toString(36),
        name: writerName.trim(),
        phone: writerPhone.trim(),
        token: generateSecureToken('wri'),
        assignedAreaIds: [],
        assignedSubscriberIds: assignedSubs,
        rangeFrom: savedRangeFrom,
        rangeTo: savedRangeTo,
        workHoursEnabled: writerWorkHoursEnabled,
        workHourStart: writerWorkHoursEnabled ? writerWorkHourStart : undefined,
        workHourEnd: writerWorkHoursEnabled ? writerWorkHourEnd : undefined,
        createdAt: new Date().toISOString()
      }
      updatedWriters.push(newWriter)
    }

    onUpdateBranch({ ...branch, writers: updatedWriters })
    setShowWriterModal(false)
    setEditingWriter(null)
    setWriterName('')
    setWriterPhone('')
    setSelectedWriterAreas([])
    setWriterWorkHoursEnabled(false)
    setWriterWorkHourStart('08:00')
    setWriterWorkHourEnd('14:00')
    setWriterRangeFrom('')
    setWriterRangeTo('')
  }

  const handleDeleteWriter = (writerId: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف الكاتب (${name})؟`)) {
      const updated = branch.writers.filter(w => w.id !== writerId)
      onUpdateBranch({ ...branch, writers: updated })
    }
  }

  const handleShareWriterWhatsApp = (writer: BranchWriter) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=writer&token=${writer.token}&branch=${branch.id}`
    const msg = `مرحبا ${writer.name}\nكاتب واردات ${branch.name}\nرابط حسابك المباشر:\n${directLink}`
    const waUrl = generateWhatsAppLink(writer.phone, msg)
    window.open(waUrl, '_blank')
  }

  const handleCopyWriterLink = (writer: BranchWriter) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const directLink = `${origin}/?role=writer&token=${writer.token}&branch=${branch.id}`
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(directLink).then(() => {
        setCopiedWriterId(writer.id)
        setTimeout(() => setCopiedWriterId(null), 2500)
      }).catch(() => {
        prompt('انسخ الرابط التالي:', directLink)
      })
    } else {
      prompt('انسخ الرابط التالي:', directLink)
    }
  }



  // ------------------ حفظ وترحيل الإرسالية A4 ------------------
  const handleSaveConsignmentA4 = (
    newConsignment: Consignment,
    updatedSubscribers: Subscriber[],
    updatedBilling: BillingRecords
  ) => {
    const updatedConsignments = [...(branch.consignments || []), newConsignment]
    const updatedBranch: DirectorateBranch = {
      ...branch,
      subscribers: updatedSubscribers,
      billing: updatedBilling,
      consignments: updatedConsignments
    }
    onUpdateBranch(updatedBranch)
  }

  // ------------------ إعدادات الذكاء الاصطناعي ------------------
  const handleAddAiKey = () => {
    if (!newApiKey.trim()) return
    const currentKeys = branch.aiApiKeys || []
    if (currentKeys.includes(newApiKey.trim())) {
      alert('المفتاح مضاف بالفعل')
      return
    }
    const updatedKeys = [...currentKeys, newApiKey.trim()]
    onUpdateBranch({ ...branch, aiApiKeys: updatedKeys })
    setNewApiKey('')
    alert('تم إضافة المفتاح بنجاح')
  }

  const handleDeleteAiKey = (keyToDelete: string) => {
    const updatedKeys = (branch.aiApiKeys || []).filter(k => k !== keyToDelete)
    onUpdateBranch({ ...branch, aiApiKeys: updatedKeys })
  }

  const handleDeleteConsignment = (consignmentId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في حذف هذه الإرسالية من مخزن الإرساليات؟')) return
    const updatedConsignments = (branch.consignments || []).filter(c => c.id !== consignmentId)
    onUpdateBranch({
      ...branch,
      consignments: updatedConsignments
    })
  }

  if (isConsignmentA4Open) {
    return (
      <ConsignmentsA4Page
        branch={{
          ...branch,
          subscribers: loadedSubscribers.length > 0 ? loadedSubscribers : (branch.subscribers || []),
          billing: Object.keys(loadedBilling).length > 0 ? loadedBilling : (branch.billing || {})
        }}
        initialConsignment={selectedConsignmentForView}
        onSaveConsignment={handleSaveConsignmentA4}
        onClose={() => {
          setIsConsignmentA4Open(false)
          setSelectedConsignmentForView(null)
        }}
        onOpenArchive={() => {
          setIsConsignmentA4Open(false)
          setSelectedConsignmentForView(null)
          navigateTab('consignments')
        }}
      />
    )
  }

  const navItems: { id: TabType; label: string; description: string; icon: typeof Users }[] = [
    { id: 'dashboard', label: 'الرئيسية', description: 'لوحة التحكم والوصول السريع للأقسام', icon: Building2 },
    { id: 'subscribers', label: 'سجل المشتركين', description: 'إدارة بيانات المشتركين والاشتراكات', icon: Users },
    { id: 'areas', label: 'المناطق المائية', description: 'تقسيم المناطق وشبكات المياه', icon: MapPin },
    { id: 'collectors', label: 'المحصلين (الجباة)', description: 'متابعة الجباة والتحصيل اليومي', icon: Wallet },
    { id: 'writers', label: 'كُتّاب الاشتراكات', description: 'إدارة كتاب الاشتراكات والمعاملات', icon: BookOpen },
    { id: 'consignments', label: 'مخزن الإرساليات', description: 'متابعة الإرساليات والمخزون', icon: Layers },
    { id: 'inspections', label: 'الكشوفات الفنية', description: 'الكشوفات والفحوصات الميدانية', icon: FileText },
    { id: 'settings', label: 'الإعدادات والنسخ الاحتياطي', description: 'إعدادات النظام والنسخ الاحتياطي', icon: Settings }
  ]

  const homeQuickLinks = navItems.filter((item) => item.id !== 'dashboard')

  const managerDisplayName = currentManager?.name || 'حسين علي لفته'

  const openConsignmentA4 = () => {
    if (!hasLoadedSubscribers) fetchBranchSubscribers()
    setSelectedConsignmentForView(null)
    setIsConsignmentA4Open(true)
  }

  const SidebarContent = ({ onClose }: { onClose?: () => void }) => (
    <>
      <div className="mgr-side-brand">
        <div className="mgr-side-brand-row">
          <div className="mgr-logo"><Droplet size={20} fill="currentColor" /></div>
          <div className="mgr-side-brand-text">
            <div className="mgr-side-title">واردات <span className="mgr-brand-grad">أبي الخصيب</span></div>
            <div className="mgr-side-sub">{branch.name} • <b>{managerDisplayName}</b></div>
          </div>
          <button type="button" className="mgr-side-close" onClick={() => (onClose ? onClose() : setSidebarOpen(false))} aria-label="إغلاق القائمة" title="إغلاق القائمة">
            <span /><span />
          </button>
        </div>
      </div>

      <div className="mgr-side-nav">
        <div className="mgr-side-nav-label">القائمة الرئيسية</div>
        <div className="mgr-side-nav-list">
          {navItems.map((sec) => {
            const Icon = sec.icon
            const isActive = activeTab === sec.id
            return (
              <a
                key={sec.id}
                href={tabHref(sec.id)}
                onClick={(e) => handleTabLinkClick(e, sec.id, sec.label)}
                className={`mgr-side-link${isActive ? ' is-active' : ''}`}
              >
                <span className="mgr-side-ico"><Icon size={18} strokeWidth={1.8} /></span>
                <span className="mgr-side-link-text">{sec.label}</span>
              </a>
            )
          })}
        </div>
      </div>

      <div className="mgr-side-foot">
        <div className="mgr-side-status">
          <span className="mgr-dot" />
          <span>النظام متصل</span>
          <span className="mgr-pill">مديرية ماء البصرة</span>
        </div>
      </div>
    </>
  )

  return (
    <div dir="rtl" className="mgr-shell water-dashboard" data-safe-area-inset-root>
      <style>{`
        .mgr-shell {
          --mgr-bg: #f8fbff;
          --mgr-blue: #0ea5e9;
          --mgr-blue-deep: #0284c7;
          --mgr-text: #0f172a;
          --mgr-muted: #64748b;
          box-sizing: border-box;
          min-height: 100vh;
          background: var(--mgr-bg);
          color: var(--mgr-text);
          position: relative;
          overflow-x: clip;
          padding-top: var(--safe-area-inset-top, 0px);
          font-family: 'Tajawal', system-ui, sans-serif;
        }
        .mgr-shell a { color: inherit; text-decoration: none; }
        .mgr-blobs { pointer-events: none; position: fixed; inset: 0; z-index: -1; overflow: hidden; }
        .mgr-blob { position: absolute; border-radius: 9999px; filter: blur(110px); }
        .mgr-blob-1 { top: -30%; right: -20%; width: 900px; height: 900px; background: #E0F2FE; opacity: .7; animation: mgrFloat 18s ease-in-out infinite; }
        .mgr-blob-2 { top: 10%; left: -15%; width: 700px; height: 700px; background: #BAE6FD; opacity: .6; animation: mgrFloat 22s ease-in-out infinite reverse; }
        .mgr-blob-3 { bottom: -20%; left: 20%; width: 800px; height: 800px; background: #7DD3FC; opacity: .35; animation: mgrFloat 25s ease-in-out infinite; }
        .mgr-blob-4 { top: 42%; right: 30%; width: 520px; height: 520px; background: #fff; opacity: .8; filter: blur(90px); }
        @keyframes mgrFloat { 0%,100%{transform:translate(0,0)} 50%{transform:translate(10px,-18px)} }
        @keyframes mgrSlideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }

        .glass { background: rgba(255,255,255,0.78); backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); border:1px solid rgba(255,255,255,0.9); box-shadow: 0 8px 32px rgba(15,23,42,0.06), inset 0 1px 0 #fff; }
        .glass-strong { background: rgba(255,255,255,0.92); backdrop-filter: blur(22px); -webkit-backdrop-filter: blur(22px); border:1px solid rgba(255,255,255,0.95); }
        .writer-card {
          border-radius: 28px;
          padding: 24px;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
          background: rgba(255, 255, 255, 0.88);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          box-shadow: 0 12px 40px rgba(15, 23, 42, 0.08), inset 0 1px 0 #ffffff;
        }
        .writer-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 50px rgba(14, 165, 233, 0.14), inset 0 1px 0 #ffffff;
          border-color: rgba(125, 211, 252, 0.7);
        }
        .badge-green { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46; height:28px; padding:0 10px; border-radius:999px; font-size:11px; font-weight:900; display:inline-flex; align-items:center; }
        .badge-phone { background:#fff; border:1px solid #e2e8f0; height:28px; padding:0 12px; border-radius:999px; font-size:11px; font-weight:800; display:inline-flex; align-items:center; gap:6px; color:#334155; }
        .btn-big { height:44px; border-radius:999px; font-size:13px; font-weight:900; display:flex; align-items:center; justify-content:center; gap:8px; width:100%; border:1px solid; cursor:pointer; transition:all 0.2s ease; }
        .btn-view { background:#f0f9ff; border-color:#bae6fd; color:#0369a1; }
        .btn-view:hover { background:#e0f2fe; border-color:#7dd3fc; }
        .btn-empty { background:#fef2f2; border-color:#fecaca; color:#dc2626; }
        .btn-empty:hover { background:#fee2e2; border-color:#fca5a5; }
        .circle-btn { width:40px; height:40px; border-radius:999px; display:grid; place-items:center; color:#fff; cursor:pointer; border:none; transition:all 0.2s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.08); flex-shrink: 0; }
        .circle-btn:hover { transform:scale(1.05); }
        .c-red{ background:#ef4444; } .c-blue{ background:#0ea5e9; } .c-purple{ background:#8b5cf6; } .c-green{ background:#10b981; } .c-white{ background:#fff; color:#334155; border:1px solid #e2e8f0; }
        .writer-grid { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
        @media(max-width:900px){ .writer-grid{grid-template-columns:1fr} }

        .mgr-header {
          position: sticky; z-index: 30; top: var(--safe-area-inset-top, 0px); height: 65px;
          display: flex; align-items: center;
          background: rgba(255,255,255,.75); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,.8);
          box-shadow: 0 1px 20px rgba(14,165,233,.06);
        }
        .mgr-header-inner {
          width: 100%; max-width: 1600px; margin: 0 auto; padding: 0 16px;
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
        }
        .mgr-header-right { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .mgr-header-left { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .mgr-ham {
          width: 40px; height: 40px; border-radius: 10px; border: 1px solid rgba(14,165,233,.3);
          background: #ffffff; display: flex; align-items: center; justify-content: center; cursor: pointer;
          box-shadow: 0 4px 14px rgba(14,165,233,.15); transition: all .2s ease;
        }
        .mgr-ham:hover {
          background: #f0f9ff; border-color: #0ea5e9;
          box-shadow: 0 6px 18px rgba(14,165,233,.25);
        }
        .mgr-brand { display: flex; align-items: center; gap: 8px; min-width: 0; margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
        .mgr-logo {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          display: grid; place-items: center; color: #fff !important; font-weight: 900; font-size: 13px;
          background: linear-gradient(135deg, #0EA5E9, #0284C7);
          box-shadow: 0 4px 10px rgba(14,165,233,.25);
          -webkit-background-clip: border-box; background-clip: border-box;
        }
        .mgr-brand-grad { background: linear-gradient(to left, #0EA5E9, #0284C7); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .mgr-mgr-pill {
          display: flex; align-items: center; gap: 6px; border-radius: 999px; background: #fff;
          border: 1px solid rgba(224,242,254,.9); padding: 5px 12px;
          box-shadow: 0 2px 10px rgba(14,165,233,.08); font-size: 12px; font-weight: 900; color: #1e293b;
        }
        .mgr-mgr-pill small { display: none; font-size: 10px; font-weight: 700; color: #94a3b8; }
        .mgr-dot { width: 8px; height: 8px; border-radius: 999px; background: #34d399; box-shadow: 0 0 8px rgba(16,185,129,.6); flex-shrink: 0; }
        .mgr-a4 {
          display: none; align-items: center; gap: 6px; border-radius: 999px; border: 0; cursor: pointer;
          background: #0ea5e9; color: #fff; font-size: 11px; font-weight: 900; padding: 6px 12px;
          box-shadow: 0 4px 12px rgba(14,165,233,.3);
        }
        .mgr-time {
          display: none; align-items: center; gap: 6px; border-radius: 999px; background: #fff;
          border: 1px solid rgba(224,242,254,.9); padding: 5px 10px; font-size: 11px; font-weight: 700; color: #475569;
        }

        .mgr-layout { max-width: 1600px; margin: 0 auto; display: flex; min-height: calc(100vh - 65px); }

        .mgr-side-brand { padding: 18px 20px; border-bottom: 1px solid rgba(255,255,255,.7); background: rgba(255,255,255,.4); }
        .mgr-side-brand-row { display: flex; align-items: center; gap: 10px; }
        .mgr-side-brand .mgr-logo { width: 36px; height: 36px; border-radius: 10px; }
        .mgr-side-brand-text { min-width: 0; line-height: 1.2; }
        .mgr-side-title { font-size: 15px; font-weight: 900; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mgr-side-title .mgr-brand-grad { background: linear-gradient(to left, #0EA5E9, #0284C7); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .mgr-side-sub { margin-top: 3px; font-size: 11px; font-weight: 700; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mgr-side-sub b { color: #1e293b; font-weight: 900; }
        .mgr-side-close {
          margin-inline-start: auto; width: 32px; height: 32px; border-radius: 10px; border: 1px solid rgba(255,255,255,.8);
          background: rgba(255,255,255,.8); position: relative; cursor: pointer; color: #334155;
        }
        .mgr-side-close span { position: absolute; top: 50%; left: 10px; right: 10px; height: 2px; background: currentColor; border-radius: 99px; }
        .mgr-side-close span:first-child { transform: translateY(-50%) rotate(45deg); }
        .mgr-side-close span:last-child { transform: translateY(-50%) rotate(-45deg); }
        .mgr-side-nav { flex: 1; overflow-y: auto; padding: 12px; }
        .mgr-side-nav-label { margin-bottom: 12px; padding: 0 8px; font-size: 10px; font-weight: 900; letter-spacing: .12em; color: #94a3b8; }
        .mgr-side-nav-list { display: flex; flex-direction: column; gap: 6px; }
        .mgr-side-link {
          width: 100%; height: 48px; border-radius: 12px; display: flex; align-items: center; gap: 12px; padding: 0 12px;
          background: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.8); color: #334155;
          transition: .25s ease; box-sizing: border-box;
        }
        .mgr-side-link:hover { background: rgba(240,249,255,.95); border-color: #e0f2fe; box-shadow: 0 4px 12px rgba(14,165,233,.08); }
        .mgr-side-link.is-active {
          background: linear-gradient(to left, #0ea5e9, #2563eb); color: #fff; border-color: rgba(56,189,248,.35);
          box-shadow: 0 8px 20px rgba(14,165,233,.28);
        }
        .mgr-side-ico {
          width: 32px; height: 32px; border-radius: 99px; display: grid; place-items: center; flex-shrink: 0;
          background: #fff; border: 1px solid #f1f5f9; color: #0284c7;
        }
        .mgr-side-link:hover .mgr-side-ico { background: #0ea5e9; border-color: #0ea5e9; color: #fff; }
        .mgr-side-link.is-active .mgr-side-ico { background: rgba(255,255,255,.2); border-color: transparent; color: #fff; }
        .mgr-side-link-text { flex: 1; min-width: 0; font-size: 13.5px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #1e293b; }
        .mgr-side-link.is-active .mgr-side-link-text { color: #fff; }
        .mgr-side-badge {
          min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; display: grid; place-items: center;
          font-size: 10px; font-weight: 700; background: #0f172a; color: #fff;
        }
        .mgr-side-link.is-active .mgr-side-badge { background: rgba(255,255,255,.2); }
        .mgr-side-foot { padding: 12px; border-top: 1px solid rgba(255,255,255,.7); background: rgba(255,255,255,.3); }
        .mgr-side-status {
          border-radius: 12px; background: linear-gradient(135deg, #fff, rgba(240,249,255,.85));
          border: 1px solid #fff; padding: 12px; display: flex; align-items: center; gap: 8px;
          font-size: 11px; font-weight: 900; color: #334155;
        }
        .mgr-pill { margin-inline-start: auto; border-radius: 999px; background: #0f172a; color: #fff; font-size: 10px; font-weight: 700; padding: 4px 10px; }

        .mgr-main { flex: 1; min-width: 0; padding: 16px; }
        .mgr-home-hint { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .mgr-home-hint-l { font-size: 11px; font-weight: 700; letter-spacing: .08em; color: #0284c7; }
        .mgr-home-hint-r { height: 24px; padding: 0 10px; border-radius: 999px; background: #fff; border: 1px solid #fff; font-size: 10px; font-weight: 700; color: #64748b; display: grid; place-items: center; box-shadow: 0 1px 4px rgba(15,23,42,.04); }

        .mgr-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        .mgr-card {
          display: block; text-align: right; border-radius: 24px; padding: 1px; color: inherit;
          background: linear-gradient(135deg, rgba(255,255,255,.85), rgba(255,255,255,.65));
          border: 1px solid rgba(255,255,255,.9);
          box-shadow: 0 8px 32px rgba(2,132,199,.07), 0 1px 2px rgba(15,23,42,.04), inset 0 1px 0 rgba(255,255,255,.9);
          transition: transform .45s cubic-bezier(.22,1,.36,1), box-shadow .45s ease, border-color .45s ease, background .45s ease;
        }
        .mgr-card:hover {
          transform: translateY(-6px);
          border-color: rgba(125,211,252,.6);
          background: linear-gradient(135deg, rgba(224,242,254,.9), rgba(255,255,255,.85));
          box-shadow: 0 20px 40px rgba(14,165,233,.18), 0 0 0 1px rgba(125,211,252,.4), inset 0 1px 0 #fff;
        }
        .mgr-card-inner {
          position: relative; border-radius: 23px; min-height: 200px; padding: 28px;
          display: flex; flex-direction: column;
          background: linear-gradient(135deg, rgba(255,255,255,.92), rgba(255,255,255,.62));
        }
        .mgr-card-top { display: flex; align-items: flex-start; justify-content: space-between; }
        .mgr-card-ico {
          width: 60px; height: 60px; border-radius: 16px; display: grid; place-items: center; color: #0284c7;
          background: linear-gradient(135deg, #fff, #f0f9ff); border: 1px solid #fff;
          box-shadow: 0 10px 24px rgba(14,165,233,.14), inset 0 1px 0 #fff;
          transition: .4s ease;
        }
        .mgr-card:hover .mgr-card-ico { background: linear-gradient(135deg, #0ea5e9, #2563eb); color: #fff; }
        .mgr-card-title { margin: 24px 0 0; font-size: 22px; font-weight: 800; color: #0f172a; line-height: 1.15; letter-spacing: -.02em; }
        .mgr-card-desc { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: #64748b; font-weight: 500; }
        .mgr-card-bot { margin-top: auto; padding-top: 24px; display: flex; align-items: center; justify-content: space-between; }
        .mgr-card-cta { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #0284c7; }
        .mgr-card-cta-btn {
          width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center;
          background: #f0f9ff; border: 1px solid #e0f2fe; color: #0284c7; transition: .3s ease;
        }
        .mgr-card:hover .mgr-card-cta-btn { background: #0ea5e9; border-color: #0ea5e9; color: #fff; }
        .mgr-card-meta { font-size: 11px; color: #94a3b8; font-weight: 500; }
        .mgr-card-line { position: absolute; bottom: 0; left: 28px; right: 28px; height: 1px; background: linear-gradient(to left, transparent, rgba(186,230,253,.7), transparent); opacity: .6; pointer-events: none; }
        .mgr-home-foot { margin-top: 24px; display: flex; justify-content: center; }
        .mgr-home-foot-pill {
          border-radius: 999px; padding: 8px 20px; font-size: 11px; font-weight: 700; color: #64748b;
          background: linear-gradient(135deg, rgba(255,255,255,.85), rgba(255,255,255,.65));
          border: 1px solid rgba(255,255,255,.8); box-shadow: 0 8px 24px rgba(2,132,199,.06);
        }
        .mgr-a4-mobile { display: flex; justify-content: center; margin-top: 16px; }
        .mgr-a4-mobile button {
          display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; border: 0; cursor: pointer;
          background: #0ea5e9; color: #fff; font-size: 12px; font-weight: 900; padding: 10px 16px;
          box-shadow: 0 4px 12px rgba(14,165,233,.3);
        }

        .mgr-drawer {
          position: fixed; inset: 0; z-index: 50; display: flex;
          top: calc(var(--safe-area-inset-top, 0px) + 65px);
          transition: opacity .3s cubic-bezier(.22,1,.36,1);
        }
        .mgr-drawer-bg {
          position: absolute; inset: 0; background: rgba(15,23,42,.25);
          backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
        }
        .mgr-drawer-panel {
          position: absolute; top: 0; bottom: 0; right: 0; left: auto;
          width: 290px; max-width: 85vw; display: flex; flex-direction: column;
          background: rgba(255,255,255,.95); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
          border-left: 1px solid rgba(255,255,255,.9);
          box-shadow: -12px 0 40px rgba(15,23,42,.18);
          transition: transform .3s cubic-bezier(.22,1,.36,1);
        }
        .mgr-toast-wrap { pointer-events: none; position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 60; width: 92%; max-width: 380px; }
        .mgr-toast {
          animation: mgrSlideUp .4s cubic-bezier(.22,1,.36,1);
          border-radius: 999px; background: rgba(255,255,255,.92); border: 1px solid #fff;
          box-shadow: 0 20px 40px rgba(2,132,199,.18); padding: 12px 20px;
          display: flex; align-items: center; gap: 12px; font-size: 13px; font-weight: 700; color: #1e293b;
        }
        .mgr-toast-ico {
          width: 32px; height: 32px; border-radius: 999px; display: grid; place-items: center; color: #fff;
          background: linear-gradient(135deg, #0ea5e9, #2563eb);
        }

        @media (min-width: 640px) {
          .mgr-a4 { display: inline-flex; }
          .mgr-a4-mobile { display: none; }
          .mgr-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
        }
        @media (min-width: 768px) {
          .mgr-header-inner { padding: 0 24px; }
          .mgr-home-hint { display: none; }
          .mgr-main { padding: 24px; }
          .mgr-brand { font-size: 22px; }
          .mgr-logo { width: 28px; height: 28px; }
          .mgr-mgr-pill small { display: inline; }
        }
        @media (min-width: 1024px) {
          .mgr-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
          .mgr-time { display: inline-flex; }
          .mgr-card-title { font-size: 24px; }
          .mgr-card-inner { padding: 32px; }
        }
      `}</style>

      <div className="mgr-blobs" aria-hidden>
        <div className="mgr-blob mgr-blob-1" />
        <div className="mgr-blob mgr-blob-2" />
        <div className="mgr-blob mgr-blob-3" />
        <div className="mgr-blob mgr-blob-4" />
      </div>

      <header className="mgr-header">
        <div className="mgr-header-inner">
          <div className="mgr-header-right">
            <button type="button" className="mgr-ham" onClick={() => setSidebarOpen((v) => !v)} aria-label={sidebarOpen ? 'إغلاق القائمة الجانبية' : 'فتح القائمة الجانبية'}>
              <HamburgerIcon open={sidebarOpen} />
            </button>
            <h1 className="mgr-brand">
              <span className="mgr-logo"><Droplet size={16} fill="currentColor" /></span>
              <span>واردات <span className="mgr-brand-grad">أبي الخصيب</span></span>
            </h1>
          </div>
          <div className="mgr-header-left">
            <div className="mgr-mgr-pill">
              <span className="mgr-dot" />
              <small>مسئول الفرع:</small>
              <span>{managerDisplayName}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="mgr-layout">
        <main className="mgr-main">
        {activeTab === 'dashboard' && (
          <section>
            <div className="mgr-home-hint">
              <div className="mgr-home-hint-l">لوحة التحكم • القائمة الرئيسية</div>
              <div className="mgr-home-hint-r">٧ أقسام</div>
            </div>

            <div className="mgr-grid">
              {homeQuickLinks.map((item) => {
                const Icon = item.icon
                return (
                  <a
                    key={item.id}
                    href={tabHref(item.id)}
                    onClick={(e) => handleTabLinkClick(e, item.id, item.label)}
                    className="mgr-card"
                  >
                    <div className="mgr-card-inner">
                      <div className="mgr-card-top">
                        <div className="mgr-card-ico"><Icon size={28} strokeWidth={1.8} /></div>
                        <span className="mgr-dot" style={{ marginTop: 4 }} />
                      </div>
                      <h3 className="mgr-card-title">{item.label}</h3>
                      <p className="mgr-card-desc">{item.description}</p>
                      <div className="mgr-card-bot">
                        <div className="mgr-card-cta">
                          <span>فتح القسم</span>
                          <span className="mgr-card-cta-btn"><ChevronLeft size={14} /></span>
                        </div>
                      </div>
                      <div className="mgr-card-line" />
                    </div>
                  </a>
                )
              })}
            </div>

            <div className="mgr-home-foot">
              <div className="mgr-home-foot-pill">مديرية ماء البصرة • نظام واردات أبي الخصيب • {branch.name}</div>
            </div>
          </section>
        )}

        {activeTab === 'subscribers' && (
            <div className="bg-white rounded-2xl p-3.5 sm:p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900">سجل المشتركين ({filteredSubscribers.length})</h3>
                  <p className="text-[11px] text-slate-500">قائمة المشتركين المسجلين في {branch.name} (يمكنك التحديد والتخصيص المباشر للمناطق والكُتّاب والمحصلين)</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* زر وضع التحديد */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = !isSelectMode
                      setIsSelectMode(nextMode)
                      if (!nextMode) {
                        setSelectedSubIds(new Set())
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      isSelectMode
                        ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                    }`}
                  >
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{isSelectMode ? 'إلغاء وضع التحديد' : 'تحديد المشتركين'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fetchBranchSubscribers(true)}
                    disabled={isLoadingSubscribers}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSubscribers ? 'animate-spin' : ''}`} />
                    <span>{isLoadingSubscribers ? 'جارِ التحميل...' : 'تحديث البيانات'}</span>
                  </button>

                  <button
                    onClick={() => navigateTab('settings')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>الاستيراد والإعدادات</span>
                  </button>
                </div>
              </div>

              {/* إشعار نجاح العمليات الجماعية */}
              {bulkFeedbackMessage && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{bulkFeedbackMessage}</span>
                </div>
              )}

              {/* شريط التحكم السريع بوضع التحديد بنظام Google Stitch الفخم */}
              {isSelectMode && (
                <div className="w-full rounded-2xl bg-gradient-to-br from-[#00142f] via-[#0f294a] to-[#00142f] text-white p-4 sm:p-5 shadow-xl space-y-3.5 text-xs relative overflow-hidden border border-blue-900/40">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-white text-sm">وضع التحديد نشط:</span>
                      <span className="px-3 py-1 rounded-full bg-[#0051d5] text-white font-black text-xs shadow-sm">
                        {selectedSubIds.size} مشترك محدد
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllVisibleSubscribers}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold transition cursor-pointer"
                      >
                        تحديد الصفحة الحالية ({paginatedSubscribers.length})
                      </button>
                      <button
                        type="button"
                        onClick={selectAllFilteredSubscribers}
                        className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold transition cursor-pointer"
                      >
                        تحديد كل نتائج البحث ({filteredSubscribers.length})
                      </button>
                      {selectedSubIds.size > 0 && (
                        <button
                          type="button"
                          onClick={clearSelectedSubscribers}
                          className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded-xl font-bold transition cursor-pointer"
                        >
                          إلغاء التحديد
                        </button>
                      )}
                    </div>
                  </div>

                  {/* أداة التحديد بنطاق الأرقام (مثلاً: من 1 إلى 1000) */}
                  <div className="bg-white/5 backdrop-blur-md p-3.5 sm:p-4 rounded-xl border border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#0051d5] text-white flex items-center justify-center shadow-xs">
                          <Hash className="w-5 h-5 font-black" />
                        </div>
                        <div>
                          <span className="font-black text-white text-xs sm:text-sm">تحديد المشتركين بالنطاق (من رقم إلى رقم)</span>
                          <p className="text-[11px] text-blue-200/70 font-bold">حدد مجموعة اشتراكات كاملة بنقرة واحدة (مثال: من 1 إلى 1000)</p>
                        </div>
                      </div>

                      {/* تبديل طريقة احتساب النطاق */}
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setRangeMode('id')}
                          className={`px-3 py-1 rounded-lg text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
                            rangeMode === 'id'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="يحدد المشتركين الذين تقع أرقام اشتراكاتهم الفعلية بين الرقمين"
                        >
                          <Check className={`w-3.5 h-3.5 ${rangeMode === 'id' ? 'inline' : 'hidden'}`} />
                          <span>حسب رقم الاشتراك (ID)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRangeMode('index')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            rangeMode === 'index'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="يحدد حسب تسلسل وترتيب المشتركين في القائمة"
                        >
                          <span>حسب تسلسل القائمة (1، 2، 3...)</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {/* حقل من رقم */}
                      <div className="flex items-center gap-1.5 bg-black/30 border border-white/20 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-400">
                        <span className="text-blue-200 font-bold text-xs">
                          {rangeMode === 'id' ? 'مِـن اشتراك:' : 'مِـن تسلسل:'}
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          placeholder="1"
                          className="w-20 font-black text-white text-center outline-none bg-transparent text-sm placeholder:text-white/30"
                        />
                      </div>

                      {/* حقل إلى رقم */}
                      <div className="flex items-center gap-1.5 bg-black/30 border border-white/20 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-400">
                        <span className="text-blue-200 font-bold text-xs">
                          {rangeMode === 'id' ? 'إلـى اشتراك:' : 'إلـى تسلسل:'}
                        </span>
                        <input
                          type="number"
                          min="1"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          placeholder="1000"
                          className="w-24 font-black text-white text-center outline-none bg-transparent text-sm placeholder:text-white/30"
                        />
                      </div>

                      {/* زر تحديد هذا النطاق */}
                      <button
                        type="button"
                        onClick={() => handleSelectByRange()}
                        className="px-5 py-2 bg-gradient-to-r from-[#0051d5] to-[#2563eb] hover:from-[#003ea8] hover:to-[#1d4ed8] text-white font-black text-xs sm:text-sm rounded-xl transition shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                      >
                        <CheckSquare className="w-4 h-4 text-white" />
                        <span>
                          {rangeMode === 'id'
                            ? `تحديد المشتركين من #${rangeFrom || 0} إلى #${rangeTo || 0}`
                            : `تحديد حسب التسلسل (${rangeFrom || 0} إلى ${rangeTo || 0})`}
                        </span>
                      </button>

                      {/* خيار الإبقاء على التحديد السابق */}
                      <label className="flex items-center gap-2 text-xs text-blue-100 font-bold cursor-pointer select-none bg-white/10 px-3 py-2 rounded-xl border border-white/15 hover:bg-white/15 transition">
                        <input
                          type="checkbox"
                          checked={rangeKeepPrevious}
                          onChange={(e) => setRangeKeepPrevious(e.target.checked)}
                          className="rounded text-blue-500 focus:ring-blue-400 w-4 h-4 cursor-pointer"
                        />
                        <span>إضافة للتحديد السابق (+)</span>
                      </label>
                    </div>

                    {/* اختصارات جاهزة للأرقام الشائعة */}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                      <span className="text-slate-400 font-bold text-xs">تحديد سريع:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeFrom('1')
                          setRangeTo('500')
                          handleQuickRange('1', '500')
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 rounded-lg font-bold text-xs border border-slate-200 transition cursor-pointer active:scale-95"
                      >
                        أول 500
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeFrom('1')
                          setRangeTo('1000')
                          handleQuickRange('1', '1000')
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 rounded-lg font-bold text-xs border border-slate-200 transition cursor-pointer active:scale-95"
                      >
                        أول 1,000
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeFrom('1')
                          setRangeTo('2000')
                          handleQuickRange('1', '2000')
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 rounded-lg font-bold text-xs border border-slate-200 transition cursor-pointer active:scale-95"
                      >
                        أول 2,000
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRangeFrom('1')
                          setRangeTo('5000')
                          handleQuickRange('1', '5000')
                        }}
                        className="px-3 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-900 rounded-lg font-bold text-xs border border-slate-200 transition cursor-pointer active:scale-95"
                      >
                        أول 5,000
                      </button>

                      {/* زر الدفعة التالية */}
                      <button
                        type="button"
                        onClick={handleNextBatch}
                        style={{ backgroundColor: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
                        className="px-3.5 py-1 hover:bg-emerald-100 border rounded-lg font-black text-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="تحديد الدفعة التالية تلقائياً بنفس المقدار"
                      >
                        <span>الدفعة التالية</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingSubscribers ? (
                <div className="py-12 text-center text-blue-600 font-bold bg-blue-50/50 rounded-xl flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <p className="text-xs">جارِ تحميل قاعدة بيانات مشتركي الفرع من السحابة...</p>
                </div>
              ) : (
                <>
                  {/* شريط البحث وخيارات العرض */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative flex-1 w-full">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث برقم المشترك أو اسمه أو منطقته..."
                        className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                      />
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <span className="text-[11px] font-bold text-slate-500">عرض بالصفحة:</span>
                      <select
                        value={subscribersPageSize}
                        onChange={(e) => {
                          setSubscribersPageSize(Number(e.target.value))
                          setSubscribersPage(1)
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value={30}>30</option>
                        <option value={60}>60</option>
                        <option value={100}>100</option>
                        <option value={10000}>الكل</option>
                      </select>
                    </div>
                  </div>

                  {/* جدول المشتركين مع مربعات التحديد ودعم التحديد المتعدد */}
                  <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                          {isSelectMode && (
                            <th className="p-3 w-10 text-center">
                              <input
                                type="checkbox"
                                checked={paginatedSubscribers.length > 0 && paginatedSubscribers.every(s => selectedSubIds.has(s.id))}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    selectAllVisibleSubscribers()
                                  } else {
                                    setSelectedSubIds(prev => {
                                      const next = new Set(prev)
                                      paginatedSubscribers.forEach(s => next.delete(s.id))
                                      return next
                                    })
                                  }
                                }}
                                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                title="تحديد/إلغاء صفحة المشتركين الحالية"
                              />
                            </th>
                          )}
                          <th className="p-3">رقم المشترك</th>
                          <th className="p-3">اسم المشترك</th>
                          <th className="p-3">المنطقة</th>
                          <th className="p-3">رقم الإضبارة / الملاحظات</th>
                          <th className="p-3">الصنف / العداد</th>
                          <th className="p-3">الدين السابق</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedSubscribers.map((sub) => {
                          const isSelected = selectedSubIds.has(sub.id)
                          // عرض كافة المناطق المخصصة للمشترك
                          const assignedAreaNames = sub.areaIds && sub.areaIds.length > 0
                            ? branch.areas?.filter(a => sub.areaIds?.includes(a.id)).map(a => a.name).join('، ')
                            : (branch.areas?.find(a => a.id === sub.areaId)?.name || 'غير محدد')

                          return (
                            <tr
                              key={sub.id}
                              onClick={() => {
                                if (isSelectMode) {
                                  toggleSelectSubscriber(sub.id)
                                } else {
                                  setSelectedDetailSubscriber(sub)
                                  setDetailSubscriberYear(2026)
                                }
                              }}
                              className={`font-bold transition cursor-pointer select-none ${
                                isSelected
                                  ? 'bg-blue-50/90 text-blue-950 ring-1 ring-inset ring-blue-300'
                                  : 'hover:bg-blue-50/50 hover:text-blue-950'
                              }`}
                            >
                              {isSelectMode && (
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelectSubscriber(sub.id)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </td>
                              )}
                              <td className="p-3 font-mono text-blue-700 bg-blue-50/40">#{sub.id}</td>
                              <td className="p-3 text-slate-900">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{sub.name}</span>
                                  {sub.statuses && sub.statuses.length > 0 && sub.statuses.map((st, i) => (
                                    <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-700 font-bold">
                                      {st}
                                    </span>
                                  ))}
                                </div>
                                {sub.phone && <div className="text-[10px] text-slate-400 font-mono font-normal">{sub.phone}</div>}
                              </td>
                              <td className="p-3 text-slate-600">
                                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{assignedAreaNames}</span>
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 text-[11px] max-w-[200px] truncate" title={sub.detailedAddress}>
                                {sub.detailedAddress || '-'}
                              </td>
                              <td className="p-3 text-slate-500">{sub.propertyType} - {sub.meterType}</td>
                              <td className="p-3 text-rose-600 font-mono">{(sub.remainingPrev || 0).toLocaleString('ar-IQ')} د.ع</td>
                            </tr>
                          )
                        })}
                        {filteredSubscribers.length === 0 && (
                          <tr>
                            <td colSpan={isSelectMode ? 7 : 6} className="text-center py-8 text-slate-400 font-bold">
                              لا توجد نتائج مطابقة للبحث
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* أزرار ترقيم الصفحات (Pagination) والتنقل */}
                  {filteredSubscribers.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
                      <div className="text-slate-500 font-bold text-[11px]">
                        عرض {((subscribersPage - 1) * subscribersPageSize) + 1} - {Math.min(subscribersPage * subscribersPageSize, filteredSubscribers.length)} من إجمالي {filteredSubscribers.length} مشترك
                      </div>

                      <div className="flex items-center gap-2">
                        {totalSubPages > 1 && (
                          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                            <button
                              type="button"
                              onClick={() => setSubscribersPage(p => Math.max(1, p - 1))}
                              disabled={subscribersPage === 1}
                              className="px-2.5 py-1 bg-white hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold rounded-lg transition"
                            >
                              السابق
                            </button>
                            <span className="px-3 py-1 font-black text-slate-800 text-[11px]">
                              {subscribersPage} / {totalSubPages}
                            </span>
                            <button
                              type="button"
                              onClick={() => setSubscribersPage(p => Math.min(totalSubPages, p + 1))}
                              disabled={subscribersPage === totalSubPages}
                              className="px-2.5 py-1 bg-white hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 font-bold rounded-lg transition"
                            >
                              التالي
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() =>
                            onOpenSubscriberApp({
                              role: 'manager',
                              userTitle: `مسؤول فرع (${branch.name})`,
                              canEdit: true
                            })
                          }
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
                        >
                          <span>فتح تطبيق المشتركين الكامل</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* القائمة السفلية العائمة للمشتركين المحددين (Bottom Action Bar) */}
              {selectedSubIds.size > 0 && (
                <div
                  style={{
                    position: 'fixed',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    width: '100%',
                    zIndex: 99999,
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    borderTop: '3px solid #3b82f6',
                    boxShadow: '0 -8px 30px rgba(0, 0, 0, 0.45)',
                    padding: '12px 18px',
                    boxSizing: 'border-box'
                  }}
                >
                  <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* شارة عدد المشتركين المحددين */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-sm font-black text-white flex items-center gap-2">
                          <span>تم تحديد</span>
                          <span style={{ color: '#60a5fa', fontSize: '16px', fontWeight: 900 }}>{selectedSubIds.size}</span>
                          <span>مشترك</span>
                        </div>
                        <div className="text-[11px] text-slate-300 font-bold">
                          اختر الإجراء لتخصيصهم لأكثر من منطقة أو كاتب أو محصل
                        </div>
                      </div>
                    </div>

                    {/* خيارات القائمة السفلية */}
                    <div className="flex flex-wrap items-center justify-center gap-2.5 w-full sm:w-auto">
                      {/* 1. خيار التخصيص للمناطق */}
                      <button
                        type="button"
                        onClick={() => {
                          setBulkSelectedAreaIds([])
                          setBulkAreaSearch('')
                          setShowAssignAreasModal(true)
                        }}
                        style={{
                          padding: '10px 18px',
                          backgroundColor: '#059669',
                          color: '#ffffff',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 800,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(5, 150, 105, 0.4)'
                        }}
                      >
                        <MapPin style={{ width: '16px', height: '16px' }} />
                        <span>تخصيص لمناطق</span>
                      </button>

                      {/* 2. خيار التخصيص للكتّاب */}
                      <button
                        type="button"
                        onClick={() => {
                          setBulkSelectedWriterIds([])
                          setShowAssignWritersModal(true)
                        }}
                        style={{
                          padding: '10px 18px',
                          backgroundColor: '#d97706',
                          color: '#ffffff',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 800,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(217, 119, 6, 0.4)'
                        }}
                      >
                        <BookOpen style={{ width: '16px', height: '16px' }} />
                        <span>تخصيص لكتّاب</span>
                      </button>

                      {/* 3. خيار التخصيص للمحصلين */}
                      <button
                        type="button"
                        onClick={() => {
                          setBulkSelectedCollectorIds([])
                          setShowAssignCollectorsModal(true)
                        }}
                        style={{
                          padding: '10px 18px',
                          backgroundColor: '#2563eb',
                          color: '#ffffff',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 800,
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
                        }}
                      >
                        <Wallet style={{ width: '16px', height: '16px' }} />
                        <span>تخصيص لمحصلين</span>
                      </button>

                      {/* زر إلغاء التحديد */}
                      <button
                        type="button"
                        onClick={clearSelectedSubscribers}
                        style={{
                          padding: '10px 14px',
                          backgroundColor: '#1e293b',
                          color: '#e2e8f0',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: 700,
                          border: '1px solid #334155',
                          cursor: 'pointer'
                        }}
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* تبويب المناطق - تصميم مدمج وأنيق وتفاعلي */}
          {activeTab === 'areas' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-5">
              {/* ترويسة التبويب والتحكم الملمومة والأنيقة */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-black text-slate-900">المناطق المشمولة بالفرع</h3>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200/60 rounded-full text-[11px] font-black">
                      {(branch.areas || []).length} منطقة
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 font-bold">
                    قائمة المناطق خفيفة بدون سحب مشتركين — اضغط منطقة لجلب مشتركيها عند الحاجة
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* شريط البحث في المناطق */}
                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={areaSearchQuery}
                      onChange={(e) => setAreaSearchQuery(e.target.value)}
                      placeholder="بحث سريع في المناطق..."
                      className="w-full pl-8 pr-9 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition shadow-2xs"
                    />
                    {areaSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setAreaSearchQuery('')}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* نموذج إضافة سريعة لمنطقة واحدة */}
                  <form onSubmit={handleAddArea} className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="اسم منطقة جديدة..."
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 w-36 shadow-2xs"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة</span>
                    </button>
                  </form>

                  {/* زر التوجيه لخيارات الاستيراد في الإعدادات */}
                  <button
                    type="button"
                    onClick={() => navigateTab('settings')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">خيارات الاستيراد</span>
                  </button>
                </div>
              </div>

              {/* شبكة المناطق المدمجة والأنيقة ككبسولات ملمومة وفخمة */}
              {filteredAreas.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm">لم يتم العثور على أي منطقة مطابقة لـ &quot;{areaSearchQuery}&quot;</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                  {filteredAreas.map((area) => {
                    const subsCount = areaSubscribersCountMap.get(area.id) || 0
                    const hasSubs = hasLoadedSubscribers && subsCount > 0

                    return (
                      <div
                        key={area.id}
                        onClick={() => {
                          setSelectedAreaForModal(area)
                          setIsAssigningToArea(false)
                          setSelectedNewSubIdsForArea(new Set())
                          setAreaSubscribersSearch('')
                          setAllSubscribersSearch('')
                        }}
                        className={`group relative p-2.5 rounded-xl border text-right transition-all duration-150 cursor-pointer flex items-center justify-between gap-2 select-none ${
                          hasSubs
                            ? 'bg-white hover:bg-blue-50/70 border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-xs'
                            : 'bg-slate-50/90 hover:bg-slate-100 border-slate-200/80 hover:border-slate-300 text-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <MapPin className={`w-3.5 h-3.5 shrink-0 ${hasSubs ? 'text-blue-600' : 'text-slate-400'}`} />
                          <h4
                            className="font-black text-slate-900 text-xs truncate group-hover:text-blue-700 transition"
                            title={area.name}
                          >
                            {area.name}
                          </h4>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
                              hasSubs
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : 'bg-slate-200/70 text-slate-600'
                            }`}
                            title={hasLoadedSubscribers ? `${subsCount} مشترك` : 'يظهر العدد بعد فتح المنطقة'}
                          >
                            <Users className="w-2.5 h-2.5" />
                            <span>{hasLoadedSubscribers ? subsCount : '—'}</span>
                          </span>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteArea(area.id, area.name)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                            title="حذف المنطقة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* تبويب مخزن الإرساليات الرسمية */}
          {activeTab === 'consignments' && (
            <BranchConsignmentsStore
              branch={branch}
              onOpenNewConsignment={() => {
                if (!hasLoadedSubscribers) {
                  fetchBranchSubscribers()
                }
                setSelectedConsignmentForView(null)
                setIsConsignmentA4Open(true)
              }}
              onViewConsignmentA4={(consignment) => {
                if (!hasLoadedSubscribers) {
                  fetchBranchSubscribers()
                }
                setSelectedConsignmentForView(consignment)
                setIsConsignmentA4Open(true)
              }}
              onDeleteConsignment={handleDeleteConsignment}
            />
          )}

          {/* تبويب الكشوفات الفنية لمسؤول الفرع */}
          {activeTab === 'inspections' && (
            <BranchInspectionsTab
              branch={branch}
              onOpenInspectionModal={(record) => {
                setShowInspectionDashboard(true)
              }}
            />
          )}

          {/* تبويب المحصلين */}
          {activeTab === 'collectors' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-5">
              {/* الرأسية مع شريط الإحصائيات وزر إضافة محصل بنمط ستيتش */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-1.5 text-xs text-[#0051d5] font-black uppercase tracking-wider mb-1">
                    <span className="w-2 h-2 rounded-full bg-[#0051d5] animate-pulse"></span>
                    <span>منظومة الرقابة المالية والجباية الرقمية</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-[#00142f]">كادر محصلي الجباية الميدانيين</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-black bg-blue-50 text-[#0051d5] border border-blue-200">
                      {branch.collectors?.length || 0} محصل مرخص
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إدارة وتخصيص صلاحيات المحصلين الميدانيين والمناطق المائية وسلاسل أرقام الاشتراكات المسندة
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingCollector(null)
                      setCollectorName('')
                      setCollectorPhone('')
                      setCollectorCanEdit(false)
                      setSelectedCollectorAreas([])
                      setCollectorRangeFrom('')
                      setCollectorRangeTo('')
                      setShowCollectorModal(true)
                    }}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#0051d5] to-[#2563eb] hover:from-[#003ea8] hover:to-[#1d4ed8] text-white rounded-xl text-xs font-black transition flex items-center gap-1.5 shadow-[0_4px_14px_rgba(37,99,235,0.3)] cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-white" />
                    <span>+ تسجيل محصل جديد</span>
                  </button>
                </div>
              </div>

              {/* شريط البحث السريع في المحصلين */}
              {branch.collectors && branch.collectors.length > 0 && (
                <div className="flex items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="بحث باسم المحصل أو رقم الهاتف أو المنطقة المسندة..."
                      value={collectorSearch}
                      onChange={(e) => setCollectorSearch(e.target.value)}
                      className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>
                  {collectorSearch && (
                    <button
                      onClick={() => setCollectorSearch('')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1"
                    >
                      إلغاء البحث
                    </button>
                  )}
                </div>
              )}

              {/* قائمة وجدول المحصلين المرتب والمدمج */}
              {(!branch.collectors || branch.collectors.length === 0) ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Wallet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">لا يوجد محصلون مسجلون حالياً</p>
                </div>
              ) : filteredCollectors.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500">لا توجد نتائج مطابقة لبحثك</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredCollectors.map((collector) => {
                    const assignedAreas = (branch.areas || []).filter(a => (collector.assignedAreaIds || []).includes(a.id))
                    const assignedCount = assignedAreas.length

                    return (
                      <div 
                        key={collector.id} 
                        className="bg-white hover:bg-slate-50/50 rounded-2xl p-4 border border-slate-200/90 hover:border-blue-300 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3 relative overflow-hidden"
                      >
                        {/* خط التدرج اللوني العلوي الرفيع لهوية المحصل */}
                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-600"></div>
                        {/* 1. رأس البطاقة: الاسم، الهاتف، وحالة الصلاحية */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                <Wallet className="w-4 h-4" />
                              </div>
                              <h4 className="font-black text-slate-900 text-sm sm:text-base">{collector.name}</h4>
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono dir-ltr justify-end pr-1">
                              <span>{collector.phone}</span>
                              <Phone className="w-3 h-3 text-slate-400" />
                            </div>
                          </div>

                          {/* زر وحالة الصلاحية */}
                          <div className="flex flex-col items-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleToggleCollectorEdit(collector.id, collector.canEdit)}
                              className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition border flex items-center gap-1 ${
                                collector.canEdit
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                              }`}
                              title={collector.canEdit ? 'انقر لإيقاف صلاحية التعديل' : 'انقر للسماح بالتعديل'}
                            >
                              {collector.canEdit ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>مسموح بالتعديل</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-3 h-3 text-amber-600" />
                                  <span>للقراءة فقط</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* 2. المناطق المسندة (تظهر فقط إذا كان لديه مناطق مسندة) */}
                        {assignedCount > 0 && (
                          <div className="p-2.5 bg-white rounded-xl border border-slate-100 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-black text-slate-700 flex items-center gap-1 text-[11px]">
                                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                <span>المناطق المسندة:</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-50 text-blue-700 border border-blue-200">
                                {assignedCount} {assignedCount === 1 ? 'منطقة' : assignedCount === 2 ? 'منطقتان' : 'مناطق'}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto pt-0.5">
                              {assignedAreas.slice(0, 4).map((a) => (
                                <span
                                  key={a.id}
                                  className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200/80"
                                >
                                  {a.name}
                                </span>
                              ))}
                              {assignedAreas.length > 4 && (
                                <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                                  +{assignedAreas.length - 4} أخرى
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* المشتركون المخصصون مباشرة للمحصل */}
                        {collector.assignedSubscriberIds && collector.assignedSubscriberIds.length > 0 && (() => {
                          const sortedIds = Array.from(new Set(collector.assignedSubscriberIds)).sort((a, b) => a - b)
                          const minId = sortedIds[0]
                          const maxId = sortedIds[sortedIds.length - 1]
                          const rangeText = sortedIds.length === 1 
                            ? `اشتراك #${minId}` 
                            : `من #${minId} إلى #${maxId}`

                          return (
                            <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Users className="w-3.5 h-3.5 text-blue-700" />
                                  <span className="font-black text-blue-950 text-[11px]">المشتركون المخصصون:</span>
                                  <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                    {collector.assignedSubscriberIds.length} مشترك
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allSubsPool = (loadedSubscribers && loadedSubscribers.length > 0) ? loadedSubscribers : (branch.subscribers || [])
                                      const collectorSubs = sortedIds.map(id => {
                                        const found = allSubsPool.find(s => s.id === id)
                                        return {
                                          id,
                                          name: found?.name || `مشترك رقم #${id}`
                                        }
                                      })
                                      setShowSubscribersListModal({
                                        title: `المشتركون المخصصون للمحصل (${collector.name}) - ${rangeText} (العدد: ${collector.assignedSubscriberIds?.length})`,
                                        subscribers: collectorSubs
                                      })
                                    }}
                                    className="px-2 py-1 bg-white hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black transition border border-blue-300 flex items-center gap-1 cursor-pointer shadow-2xs"
                                    title="عرض كشف بجميع أرقام وأسماء المشتركين المسندين لهذا المحصل"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>عرض القائمة</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleClearCollectorSubscribers(collector.id, collector.name)}
                                    className="px-2.5 py-1 bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
                                    title="إزالة وتفريغ جميع المشتركين المخصصين لهذا المحصل بنقرة واحدة"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>إفراغ</span>
                                  </button>
                                </div>
                              </div>

                              {/* سطر نطاق الاشتراكات (من وإلى) بخط واضح وشارة مميزة */}
                              <div className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-blue-200/90 text-xs font-bold text-slate-700">
                                <span className="text-[11px] font-black text-blue-900 flex items-center gap-1">
                                  <Hash className="w-3.5 h-3.5 text-blue-600" />
                                  <span>نطاق الاشتراكات:</span>
                                </span>
                                <span className="font-mono font-black text-blue-800 text-xs bg-blue-50 px-2 py-0.5 rounded border border-blue-300 dir-ltr">
                                  {rangeText}
                                </span>
                              </div>
                            </div>
                          )
                        })()}

                        {/* 3. شريط الأيقونات السريعة للأكشنز */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
                          <span className="text-[10px] font-bold text-slate-400">إجراءات وروابط:</span>

                          <div className="flex items-center gap-1.5">
                            {/* زر فتح الحساب - أيقونة */}
                            <button
                              type="button"
                              onClick={() => {
                                const origin = typeof window !== 'undefined' ? window.location.origin : ''
                                const directLink = `${origin}/?role=collector&token=${collector.token}&branch=${branch.id}`
                                window.open(directLink, '_blank')
                              }}
                              className="p-2 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-xl transition border border-blue-200 shadow-2xs group"
                              title="فتح حساب المحصل في نافذة جديدة"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            {/* زر نسخ الرابط - أيقونة */}
                            <button
                              type="button"
                              onClick={() => handleCopyCollectorLink(collector)}
                              className={`p-2 rounded-xl transition border shadow-2xs ${
                                copiedCollectorId === collector.id
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border-indigo-200'
                              }`}
                              title={copiedCollectorId === collector.id ? 'تم نسخ الرابط!' : 'نسخ رابط الدخول المباشر'}
                            >
                              {copiedCollectorId === collector.id ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>

                            {/* زر الواتساب - أيقونة */}
                            <button
                              type="button"
                              onClick={() => handleShareCollectorWhatsApp(collector)}
                              className="p-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl transition border border-emerald-200 shadow-2xs"
                              title="مشاركة رابط الدخول عبر واتساب"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            {/* زر التعديل - أيقونة */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCollector(collector)
                                setCollectorName(collector.name)
                                setCollectorPhone(collector.phone)
                                setCollectorCanEdit(collector.canEdit)
                                setSelectedCollectorAreas(collector.assignedAreaIds || [])
                                if (collector.assignedSubscriberIds && collector.assignedSubscriberIds.length > 0) {
                                  const sorted = Array.from(new Set(collector.assignedSubscriberIds)).sort((a, b) => a - b)
                                  setCollectorRangeFrom(sorted[0].toString())
                                  setCollectorRangeTo(sorted[sorted.length - 1].toString())
                                } else {
                                  setCollectorRangeFrom('')
                                  setCollectorRangeTo('')
                                }
                                setShowCollectorModal(true)
                              }}
                              className="p-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl transition border border-slate-200 shadow-2xs"
                              title="تعديل بيانات المحصل ومناطقه واشتراكاته"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* زر سجل النشاط والإحصائيات - أيقونة بارزة */}
                            <button
                              type="button"
                              onClick={() => handleOpenCollectorStats(collector)}
                              className="p-2 bg-blue-100 hover:bg-blue-600 text-blue-700 hover:text-white rounded-xl transition border border-blue-300 shadow-2xs"
                              title="عرض سجل نشاط وإحصائيات المحصل (اليومي، الشهري، السنوي)"
                            >
                              <Activity className="w-4 h-4" />
                            </button>

                            {/* زر الحذف - أيقونة */}
                            <button
                              type="button"
                              onClick={() => handleDeleteCollector(collector.id, collector.name)}
                              className="p-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl transition border border-rose-200 shadow-2xs"
                              title="حذف المحصل"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* زر فتح سجل نشاط وإحصائيات المحصل بنقرة واحدة */}
                        <button
                          type="button"
                          onClick={() => handleOpenCollectorStats(collector)}
                          className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-700 text-blue-800 hover:text-white rounded-xl text-xs font-black transition border border-blue-200 shadow-2xs flex items-center justify-center gap-2 cursor-pointer group"
                        >
                          <BarChart3 className="w-4 h-4 text-blue-600 group-hover:text-white" />
                          <span>سجل النشاط والعمليات (اليوم / الشهر / السنة)</span>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* تبويب الكتّاب - مطابق لتصميم Meta AI (Waridat Kuttab Final) 100% */}
          {activeTab === 'writers' && (
            <div className="space-y-6">
              {/* 1. التولبار العلوي لصفحة الكتاب */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2">
                {/* الجانب الأيمن: العنوان والعداد ورجوع للرئيسية */}
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">كُتّاب الاشتراكات</h2>
                  <span className="h-7 min-w-[28px] px-2 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center shadow-sm">
                    {branch.writers?.length || 0}
                  </span>
                  <a
                    href={tabHref('dashboard')}
                    onClick={(e) => handleTabLinkClick(e, 'dashboard', 'الرئيسية')}
                    className="px-4 py-2 rounded-full bg-white/80 hover:bg-white border border-sky-100 text-slate-700 text-xs font-black transition flex items-center gap-1.5 shadow-sm no-underline"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>رجوع للرئيسية</span>
                  </a>
                </div>

                {/* الجانب الأيسر: البحث وزر إضافة كاتب */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ابحث عن كاتب... الاسم أو الهاتف"
                      value={writerSearch}
                      onChange={(e) => setWriterSearch(e.target.value)}
                      className="w-full h-11 pr-11 pl-4 bg-white/90 focus:bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-900 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-sky-300 shadow-sm transition"
                    />
                    {writerSearch && (
                      <button
                        onClick={() => setWriterSearch('')}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-700"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setEditingWriter(null)
                      setWriterName('')
                      setWriterPhone('')
                      setSelectedWriterAreas([])
                      setWriterWorkHoursEnabled(false)
                      setWriterWorkHourStart('08:00')
                      setWriterWorkHourEnd('14:00')
                      setWriterRangeFrom('')
                      setWriterRangeTo('')
                      setShowWriterModal(true)
                    }}
                    className="h-11 px-5 bg-[#0ea5e9] hover:bg-[#0284c7] active:scale-95 text-white rounded-full text-xs font-black transition flex items-center justify-center gap-1.5 shadow-[0_4px_14px_rgba(14,165,233,0.35)] cursor-pointer shrink-0 border-none"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة كاتب</span>
                  </button>
                </div>
              </div>

              {/* قائمة وجدول الكتّاب */}
              {(!branch.writers || branch.writers.length === 0) ? (
                <div className="text-center py-14 bg-white/70 rounded-[28px] border border-dashed border-slate-200 glass">
                  <BookOpen className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-600">لا يوجد كتاب مسجلون حالياً</p>
                  <p className="text-xs text-slate-400 mt-1">اضغط على زر &quot;إضافة كاتب&quot; في الأعلى للبدء</p>
                </div>
              ) : filteredWriters.length === 0 ? (
                <div className="text-center py-10 bg-white/70 rounded-[28px] border border-slate-200 glass">
                  <p className="text-xs font-bold text-slate-500">لا توجد نتائج مطابقة لبحثك &quot;{writerSearch}&quot;</p>
                </div>
              ) : (
                <div className="writer-grid">
                  {filteredWriters.map((writer) => {
                    const assignedAreas = (branch.areas || []).filter(a => (writer.assignedAreaIds || []).includes(a.id))
                    const sortedSubIds = Array.from(new Set(writer.assignedSubscriberIds || [])).sort((a, b) => a - b)
                    const subCount = sortedSubIds.length
                    const minId = sortedSubIds[0]
                    const maxId = sortedSubIds[sortedSubIds.length - 1]
                    const rangeText = subCount === 0 
                      ? 'لا يوجد'
                      : subCount === 1 
                      ? `#${minId}` 
                      : `من #${minId} إلى #${maxId}`

                    const workCheck = checkWriterWorkHours(writer)
                    const writerCodeId = writer.id.slice(-4).toUpperCase() || '0001'

                    return (
                      <div
                        key={writer.id}
                        className="writer-card space-y-5"
                      >
                        {/* 1. رأس البطاقة: الاسم الكبير للهوية ورقم الهاتف بجانبه */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-right">
                          <div className="flex flex-wrap items-center gap-3 min-w-0">
                            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 truncate">{writer.name}</h3>
                            {writer.phone && (
                              <span className="badge-phone shrink-0">
                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-mono dir-ltr">{writer.phone}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 2. المشتركون المخصصون + الزران الكبيران */}
                        <div className="space-y-2.5">
                          <div className="text-xs font-black text-slate-900 text-right">
                            <span>المشتركون المخصصون: </span>
                            <span className="text-sky-700 font-extrabold">{subCount} مشترك</span>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                if (subCount === 0) return
                                const allSubsPool = (loadedSubscribers && loadedSubscribers.length > 0) ? loadedSubscribers : (branch.subscribers || [])
                                const writerSubs = sortedSubIds.map(id => {
                                  const found = allSubsPool.find(s => s.id === id)
                                  return {
                                    id,
                                    name: found?.name || `مشترك رقم #${id}`
                                  }
                                })
                                setShowSubscribersListModal({
                                  title: `المشتركون المخصصون للكاتب (${writer.name}) - ${rangeText} (العدد: ${subCount})`,
                                  subscribers: writerSubs
                                })
                              }}
                              disabled={subCount === 0}
                              className="btn-big btn-view disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Eye className="w-4 h-4" />
                              <span>عرض القائمة</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleClearWriterSubscribers(writer.id, writer.name)}
                              disabled={subCount === 0}
                              className="btn-big btn-empty disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>إفراغ</span>
                            </button>
                          </div>
                        </div>

                        {/* 3. صندوق النطاق وساعات العمل */}
                        <div className="space-y-2 text-xs pt-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-500">{rangeText}</span>
                            <span className="font-bold text-slate-700">نطاق الاشتراكات:</span>
                          </div>

                          <div className="flex items-center justify-between">
                            {writer.workHoursEnabled ? (
                              workCheck.allowed ? (
                                <span className="font-bold text-emerald-600 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                  من {formatTimeArabic(writer.workHourStart || '08:00')} إلى {formatTimeArabic(writer.workHourEnd || '14:00')}
                                </span>
                              ) : (
                                <span className="font-bold text-amber-600 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                  خارج وقت العمل
                                </span>
                              )
                            ) : (
                              <span className="font-bold text-emerald-600 flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                متاح 24 ساعة
                              </span>
                            )}
                            <span className="font-bold text-slate-700">ساعات العمل (توقيت العراق):</span>
                          </div>
                        </div>

                        {/* 4. إجراءات وروابط: الأزرار الدائرية (حذف، تعديل، سجل النشاط والعمليات، واتساب، رابط مباشر) */}
                        <div className="pt-3 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 text-slate-400 font-bold">
                              <span>ID: #{writerCodeId}</span>
                              <span>•</span>
                              <span>5 إجراءات سريعة</span>
                            </div>
                            <span className="font-bold text-slate-600">إجراءات وروابط</span>
                          </div>

                          <div className="flex items-center justify-end gap-2.5 pt-1">
                            {/* 1. سلة حذف أحمر (c-red) */}
                            <button
                              type="button"
                              onClick={() => handleDeleteWriter(writer.id, writer.name)}
                              className="circle-btn c-red"
                              title="حذف الكاتب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>

                            {/* 2. قلم تعديل أزرق (c-blue) */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWriter(writer)
                                setWriterName(writer.name)
                                setWriterPhone(writer.phone)
                                setSelectedWriterAreas(writer.assignedAreaIds || [])
                                setWriterWorkHoursEnabled(!!writer.workHoursEnabled)
                                setWriterWorkHourStart(writer.workHourStart || '08:00')
                                setWriterWorkHourEnd(writer.workHourEnd || '14:00')
                                if (writer.rangeFrom !== undefined && writer.rangeTo !== undefined) {
                                  setWriterRangeFrom(writer.rangeFrom.toString())
                                  setWriterRangeTo(writer.rangeTo.toString())
                                } else if (writer.assignedSubscriberIds && writer.assignedSubscriberIds.length > 0) {
                                  const sorted = Array.from(new Set(writer.assignedSubscriberIds)).sort((a, b) => a - b)
                                  setWriterRangeFrom(sorted[0].toString())
                                  setWriterRangeTo(sorted[sorted.length - 1].toString())
                                } else {
                                  setWriterRangeFrom('')
                                  setWriterRangeTo('')
                                }
                                setShowWriterModal(true)
                              }}
                              className="circle-btn c-blue"
                              title="تعديل البيانات"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* 3. زر سجل النشاط والعمليات (c-purple) */}
                            <button
                              type="button"
                              onClick={() => handleOpenWriterStats(writer)}
                              className="circle-btn c-purple"
                              title="سجل النشاط والعمليات"
                            >
                              <Activity className="w-4 h-4" />
                            </button>

                            {/* 4. واتساب أخضر (c-green) */}
                            <button
                              type="button"
                              onClick={() => handleShareWriterWhatsApp(writer)}
                              className="circle-btn c-green"
                              title="مشاركة رابط الدخول عبر الواتساب"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            {/* 5. رابط مباشر أبيض (c-white) */}
                            <button
                              type="button"
                              onClick={() => {
                                const origin = typeof window !== 'undefined' ? window.location.origin : ''
                                const directLink = `${origin}/?role=writer&token=${writer.token}&branch=${branch.id}`
                                window.open(directLink, '_blank')
                              }}
                              className="circle-btn c-white"
                              title="فتح رابط الحساب في نافذة جديدة"
                            >
                              <ExternalLink className="w-4 h-4 text-slate-700" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}



          {/* تبويب الإعدادات والذكاء الاصطناعي */}
          {activeTab === 'settings' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              {/* قسم إدارة واستيراد المشتركين */}
              <div className="space-y-3 pb-6 border-b border-slate-200">
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-900">
                    إدارة واستيراد بيانات المشتركين
                  </h3>
                  <p className="text-xs text-slate-500">
                    أدوات استيراد السجلات وفتح التطبيق الميداني
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {/* زر فتح تطبيق المشتركين */}
                  <button
                    onClick={() =>
                      onOpenSubscriberApp({
                        role: 'manager',
                        userTitle: `مسؤول فرع (${branch.name})`,
                        canEdit: true
                      })
                    }
                    className="p-4 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-right rounded-2xl transition flex flex-col justify-between group shadow-xs"
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                        <ExternalLink className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] bg-blue-200/60 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                        مباشر
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">تطبيق المشتركين</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">فتح واجهة المشتركين وإدارة الجباية</p>
                    </div>
                  </button>

                  {/* زر استيراد ملف إكسل شامل */}
                  <button
                    onClick={() => {
                      setExcelPreviewResult(null)
                      setExcelError(null)
                      setShowExcelModal(true)
                    }}
                    className="p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-right rounded-2xl transition flex flex-col justify-between group shadow-xs"
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] bg-emerald-200/60 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        Excel
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">استيراد ملف إكسل شامل</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">استخراج المشتركين والمناطق والكتاب تلقائياً</p>
                    </div>
                  </button>

                  {/* زر استيراد نصي سريع */}
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-right rounded-2xl transition flex flex-col justify-between group shadow-xs"
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="p-2.5 bg-slate-700 text-white rounded-xl shadow-xs">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                        لصق
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">استيراد نصي (لصق)</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">لصق قائمة أرقام وأسماء سطر بسطر</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* قسم إدارة واستيراد المناطق (خيارات مجمعة ووقتية) */}
              <div className="space-y-3 pb-6 border-b border-slate-200">
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-900">
                    إدارة واستيراد المناطق (خيارات مجمّعة)
                  </h3>
                  <p className="text-xs text-slate-500">
                    أدوات إضافة قوائم المناطق واستخراجها من ملفات الإكسل
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {/* زر إضافة قائمة مناطق بسطور متعددة */}
                  <button
                    onClick={() => setShowAreasListModal(true)}
                    className="p-4 bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-right rounded-2xl transition flex flex-col justify-between group shadow-xs"
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-xs">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] bg-emerald-200/60 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        سطر بسطر
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">إضافة قائمة مناطق (كل منطقة بسطر)</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">لصق أسماء المناطق دفعة واحدة لتحويلها لمناطق بالنظام</p>
                    </div>
                  </button>

                  {/* زر استيراد من إكسل */}
                  <button
                    onClick={() => {
                      setExcelPreviewResult(null)
                      setExcelError(null)
                      setShowExcelModal(true)
                    }}
                    className="p-4 bg-blue-50 hover:bg-blue-100/80 border border-blue-200 text-right rounded-2xl transition flex flex-col justify-between group shadow-xs"
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs">
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] bg-blue-200/60 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                        Excel
                      </span>
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">استيراد من إكسل</h4>
                      <p className="text-[11px] text-slate-500 font-bold mt-0.5">استخراج وتوليد المناطق تلقائياً من ملف الإكسل الشامل</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* قسم الذكاء الاصطناعي */}
              <div>
                <h3 className="text-sm md:text-base font-black text-slate-900">إعدادات الذكاء الاصطناعي (AI)</h3>
                <p className="text-xs text-slate-500">إدارة مفاتيح Gemini API لاستخراج بيانات الوصولات إلكترونياً</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="ألصق مفتاح Gemini API Key هنا..."
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddAiKey}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1"
                  >
                    <Key className="w-4 h-4" />
                    <span>حفظ المفتاح</span>
                  </button>
                </div>

                <div className="space-y-2 pt-2">
                  {(branch.aiApiKeys || []).map((key, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 text-xs">
                      <span className="font-mono text-slate-600">{key.substring(0, 10)}...{key.substring(key.length - 6)}</span>
                      <button
                        onClick={() => handleDeleteAiKey(key)}
                        className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Mobile Drawer */}
      <div
        className="mgr-drawer"
        style={{
          opacity: sidebarOpen ? 1 : 0,
          pointerEvents: sidebarOpen ? 'auto' : 'none',
        }}
      >
        <div className="mgr-drawer-bg" onClick={() => setSidebarOpen(false)} />
        <div
          className="mgr-drawer-panel"
          style={{ transform: sidebarOpen ? 'translateX(0)' : 'translateX(100%)' }}
        >
          <SidebarContent onClose={() => setSidebarOpen(false)} />
        </div>
      </div>

      {/* Toast */}
      <div className="mgr-toast-wrap">
        {navToast && (
          <div className="mgr-toast">
            <div className="mgr-toast-ico">
              <RefreshCw size={16} className="animate-spin" />
            </div>
            <span>{navToast}</span>
            <span className="mgr-dot" style={{ marginInlineStart: 'auto' }} />
          </div>
        )}
      </div>

      {/* النوافذ المنبثقة (Modals) */}
      {/* نافذة إضافة قائمة مناطق (كل منطقة بسطر) */}
      {showAreasListModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">إضافة قائمة مناطق دفعة واحدة</h3>
                <button
                  onClick={() => setShowAreasListModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
            </div>
            <p className="text-xs text-slate-600">
              اكتب أو الصق أسماء المناطق في المربع أدناه بحيث تكون <strong>كل منطقة في سطر مستقل</strong>:
            </p>

            <textarea
              rows={8}
              value={areasListText}
              onChange={(e) => setAreasListText(e.target.value)}
              placeholder={"العصفورية\nشارع الكهرباء\nحي الشهداء\nالدريهمية"}
              className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-slate-400 font-bold">
                عدد الأسطر المكتوبة: {areasListText.split('\n').filter(s => s.trim()).length} منطقة
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAreasListModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
                >
                  إلغاء
                </button>
                <button
                  onClick={handleAddAreasList}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>حفظ وإضافة المناطق</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة استيراد المشتركين */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-xl">
            <h3 className="text-base font-black text-slate-900">استيراد مشتركين جدد</h3>
            <p className="text-xs text-slate-500">الصق قائمة الأسماء مع أرقام المشتركين (مثال: 5202 نوري عبد الصمد):</p>

            <textarea
              rows={8}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="5202 نوري عبد الصمد&#10;5203 أحمد علي..."
              className="w-full p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
            />

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition"
              >
                بدء الاستيراد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة استيراد ملف إكسل شامل (Excel) */}
      {showExcelModal && (
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowExcelModal(false)
              setExcelPreviewResult(null)
              setExcelError(null)
            }
          }}
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 md:p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-3xl p-5 md:p-6 max-w-xl w-full space-y-4 shadow-2xl my-auto border border-slate-100 relative">
            {/* الترويسة مع زر إغلاق بارز وواضح */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black text-slate-900">
                    استيراد شامل من ملف إكسل (Excel)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    مشتركون، مناطق، وكتاب تلقائياً
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowExcelModal(false)
                  setExcelPreviewResult(null)
                  setExcelError(null)
                }}
                className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition shadow-sm"
                title="إغلاق النافذة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* حالة حدوث خطأ */}
            {excelError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-bold">
                <XCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{excelError}</span>
              </div>
            )}

            {/* صندوق اختيار الملف (إذا لم تكن هناك معاينة جاهزة بعد) */}
            {!excelPreviewResult ? (
              <div className="space-y-4">
                <div className="p-6 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl bg-emerald-50/40 text-center transition flex flex-col items-center justify-center space-y-2.5 relative cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleExcelFileUpload}
                    disabled={isProcessingExcel}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  />
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs md:text-sm font-black text-slate-800">
                      {isProcessingExcel ? 'جاري قراءة وتحليل بيانات الملف...' : 'اضغط لاختيار ملف الإكسل أو اسحبه هنا'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-bold">
                      يدعم ملفات Excel بصيغة (xlsx, xls, csv)
                    </p>
                  </div>
                  {isProcessingExcel && (
                    <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 pt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                      <span>جاري تصنيف وفهرسة المشتركين والمناطق...</span>
                    </div>
                  )}
                </div>

                {/* تعليمات وتوضيحات الاستيراد الذكي */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                  <p className="font-black text-slate-900 flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ميزات الاستيراد الذكي:</span>
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 pr-1 font-bold">
                    <li>يقبل المشترك حتى لو كان بلا منطقة أو بلا كاتب.</li>
                    <li>المناطق الجديدة المذكورة يتم إنشاؤها تلقائياً.</li>
                    <li>الكتاب الجدد يتم إنشاء حسابات ورموز دخول لهم فوراً.</li>
                    <li>التعرف على نوع العقار، العداد، والحالات (مغلق، مهدوم، إيقاف...).</li>
                  </ul>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExcelModal(false)
                      setExcelPreviewResult(null)
                      setExcelError(null)
                    }}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              /* شاشة المعاينة قبل التأكيد */
              <div className="space-y-4">
                {/* ملخص الأرقام المكتشفة */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <p className="text-[10px] font-bold text-emerald-700">مشتركون جدد</p>
                    <p className="text-base font-black text-emerald-800">{excelPreviewResult.newSubscribersCount}</p>
                  </div>

                  <div className="p-2.5 bg-blue-50 rounded-xl border border-blue-100 text-center">
                    <p className="text-[10px] font-bold text-blue-700">مشتركون محدثون</p>
                    <p className="text-base font-black text-blue-800">{excelPreviewResult.updatedSubscribersCount}</p>
                  </div>

                  <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100 text-center">
                    <p className="text-[10px] font-bold text-purple-700">مناطق جديدة</p>
                    <p className="text-base font-black text-purple-800">{excelPreviewResult.newAreasCount}</p>
                  </div>

                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100 text-center">
                    <p className="text-[10px] font-bold text-amber-700">كتاب جدد</p>
                    <p className="text-base font-black text-amber-800">{excelPreviewResult.newWritersCount}</p>
                  </div>
                </div>

                {/* جدول معاينة السطور */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-black text-slate-800">
                    معاينة عينة من المشتركين المستخرجين:
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48">
                    <table className="w-full text-right text-[11px]">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                          <th className="p-2">الاشتراك</th>
                          <th className="p-2">اسم المشترك</th>
                          <th className="p-2">اسم المنطقة</th>
                          <th className="p-2">رقم الاضبارة</th>
                          <th className="p-2">الصنف/المساحة</th>
                          <th className="p-2">الحالة</th>
                          <th className="p-2">الدين السابق</th>
                          <th className="p-2">ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {excelPreviewResult.previewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 font-bold">
                            <td className="p-2 font-mono text-blue-700">#{r.id}</td>
                            <td className="p-2 text-slate-900">{r.name}</td>
                            <td className="p-2 text-slate-600">{r.area}</td>
                            <td className="p-2 font-mono text-slate-700">{r.dossier}</td>
                            <td className="p-2 text-slate-500">{r.property} - {r.meter}</td>
                            <td className="p-2 text-amber-700">{r.statuses}</td>
                            <td className="p-2 font-mono text-rose-600">{r.debt > 0 ? `${r.debt.toLocaleString('ar-IQ')} د.ع` : '-'}</td>
                            <td className="p-2 text-[10px] text-slate-500 max-w-[130px] truncate" title={r.note}>{r.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* شريط تقدم الحفظ السحابي */}
                {excelSavingProgress && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs font-black text-blue-900">
                      <span className="flex items-center gap-1.5">
                        <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                        {excelSavingProgress.text}
                      </span>
                      <span>{excelSavingProgress.pct}%</span>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${excelSavingProgress.pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* أزرار الإجراءات */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={Boolean(excelSavingProgress)}
                    onClick={() => setExcelPreviewResult(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition disabled:opacity-50"
                  >
                    اختيار ملف آخر
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={Boolean(excelSavingProgress)}
                      onClick={() => {
                        setShowExcelModal(false)
                        setExcelPreviewResult(null)
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition disabled:opacity-50"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(excelSavingProgress)}
                      onClick={handleConfirmExcelImport}
                      className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {excelSavingProgress ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جارِ الحفظ السحابي...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>تأكيد واستيراد</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل محصل - تصميم متناسق ومريح مع 4 مناطق في السطر دائماً */}
      {showCollectorModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              width: '100%',
              maxWidth: '980px',
              height: '84vh',
              maxHeight: '84vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #cbd5e1'
            }}
          >
            {/* الرأس المدمج بدون أي فراغ زائد - مع الحقول وأدوات البحث في حزمة واحدة أنيقة */}
            <div style={{ flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#ffffff' }} className="space-y-2.5">
              {/* السطر الأول: العنوان على اليمين وزر الإغلاق على اليسار */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">
                      {editingCollector ? 'تعديل بيانات ومناطق المحصل' : 'إضافة محصل جديد'}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold leading-tight">حدد الصلاحيات والمناطق المخصصة لهذا المحصل</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowCollectorModal(false)
                    setShowSelectedOnlyCollector(false)
                  }}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* السطر الثاني: حقول الاسم والهاتف وصلاحية التعديل مدمجة في سطر واحد */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">اسم المحصل:</label>
                  <input
                    type="text"
                    value={collectorName}
                    onChange={(e) => setCollectorName(e.target.value)}
                    placeholder="الاسم الثلاثي..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="sm:col-span-4">
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">رقم الهاتف:</label>
                  <input
                    type="text"
                    value={collectorPhone}
                    onChange={(e) => setCollectorPhone(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right font-mono"
                  />
                </div>

                <div className="sm:col-span-3 flex items-center pb-1.5">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={collectorCanEdit}
                      onChange={(e) => setCollectorCanEdit(e.target.checked)}
                      className="w-3.5 h-3.5 text-blue-600 rounded bg-white border-slate-300"
                    />
                    <span>سماح بالتعديل</span>
                  </label>
                </div>
              </div>

              {/* قسم تخصيص نطاق اشتراكات المحصل (من رقم إلى رقم) */}
              {(() => {
                const cFromNum = parseInt(collectorRangeFrom.trim(), 10)
                const cToNum = parseInt(collectorRangeTo.trim(), 10)
                const isValidRange = !isNaN(cFromNum) && !isNaN(cToNum) && cFromNum > 0 && cToNum > 0
                const matchedCount = isValidRange ? (Math.abs(cToNum - cFromNum) + 1) : 0

                return (
                  <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-blue-700" />
                        <span className="text-xs font-black text-blue-950">
                          تحديد نطاق اشتراكات المحصل (من وإلى):
                        </span>
                      </div>

                      {isValidRange && (
                        <span className="text-[11px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-300">
                          سيتم إسناد ({matchedCount}) مشترك لهذا المحصل
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {/* حقل من اشتراك */}
                      <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1 focus-within:ring-2 focus-within:ring-blue-500 shadow-2xs">
                        <span className="text-[11px] font-bold text-slate-700">مِـن اشتراك رقم:</span>
                        <input
                          type="number"
                          min="1"
                          value={collectorRangeFrom}
                          onChange={(e) => setCollectorRangeFrom(e.target.value)}
                          placeholder="11001"
                          className="w-20 font-black text-blue-950 text-center outline-none bg-transparent text-xs"
                        />
                      </div>

                      {/* حقل إلى اشتراك */}
                      <div className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-lg px-2.5 py-1 focus-within:ring-2 focus-within:ring-blue-500 shadow-2xs">
                        <span className="text-[11px] font-bold text-slate-700">إلـى اشتراك رقم:</span>
                        <input
                          type="number"
                          min="1"
                          value={collectorRangeTo}
                          onChange={(e) => setCollectorRangeTo(e.target.value)}
                          placeholder="12000"
                          className="w-24 font-black text-blue-950 text-center outline-none bg-transparent text-xs"
                        />
                      </div>

                      {/* زر إفراغ النطاق */}
                      {(collectorRangeFrom || collectorRangeTo) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCollectorRangeFrom('')
                            setCollectorRangeTo('')
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-[10px] font-bold transition border border-rose-200 flex items-center gap-1 cursor-pointer"
                          title="مسح النطاق وإلغاء تخصيص الاشتراكات للمحصل"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>إفراغ النطاق</span>
                        </button>
                      )}

                      <span className="text-[10px] text-slate-500 font-bold">
                        (عند ملء النطاق سيتم إسناد كافة الاشتراكات الواقعة بين الرقمين تلقائياً عند الحفظ)
                      </span>
                    </div>
                  </div>
                )
              })()}

              {/* السطر الثالث: شريط البحث مع زر إظهار المناطق المختارة وأزرار التحديد السريع */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={collectorAreaSearch}
                    onChange={(e) => setCollectorAreaSearch(e.target.value)}
                    placeholder="ابحث عن اسم منطقة..."
                    className="w-full pr-7 pl-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-bold shrink-0">
                  {/* زر إظهار المناطق المختارة فقط */}
                  <button
                    type="button"
                    onClick={() => setShowSelectedOnlyCollector(!showSelectedOnlyCollector)}
                    className={`px-3 py-1 rounded-lg transition border flex items-center gap-1.5 shadow-2xs ${
                      showSelectedOnlyCollector
                        ? 'bg-blue-600 border-blue-700 text-white font-black'
                        : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                    }`}
                  >
                    <span>{showSelectedOnlyCollector ? 'إظهار جميع المناطق' : 'المناطق المختارة فقط'}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      showSelectedOnlyCollector ? 'bg-white text-blue-700' : 'bg-blue-200 text-blue-900'
                    }`}>
                      {selectedCollectorAreas.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const filteredIds = (branch.areas || [])
                        .filter(a => {
                          if (showSelectedOnlyCollector && !selectedCollectorAreas.includes(a.id)) return false
                          if (collectorAreaSearch && !a.name.toLowerCase().includes(collectorAreaSearch.toLowerCase())) return false
                          return true
                        })
                        .map(a => a.id)
                      setSelectedCollectorAreas(Array.from(new Set([...selectedCollectorAreas, ...filteredIds])))
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    تحديد المعروض
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCollectorAreas([])}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg transition"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>
            </div>

            {/* صندوق شبكة المناطق: 4 مناطق في السطر دائماً ومقاس مصغر */}
            <div 
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                padding: '10px 12px',
                backgroundColor: '#f8fafc'
              }}
            >
              <div 
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '6px'
                }}
              >
                {(branch.areas || [])
                  .filter(a => {
                    if (showSelectedOnlyCollector && !selectedCollectorAreas.includes(a.id)) return false
                    if (collectorAreaSearch && !a.name.toLowerCase().includes(collectorAreaSearch.toLowerCase())) return false
                    return true
                  })
                  .map(area => {
                    const isChecked = selectedCollectorAreas.includes(area.id)
                    return (
                      <label
                        key={area.id}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer transition border select-none text-[11px] ${
                          isChecked
                            ? 'bg-blue-50 border-blue-400 text-blue-950 font-black shadow-2xs'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCollectorAreas([...selectedCollectorAreas, area.id])
                            } else {
                              setSelectedCollectorAreas(selectedCollectorAreas.filter(id => id !== area.id))
                            }
                          }}
                          className="w-3 h-3 rounded text-blue-600 border-slate-300 cursor-pointer shrink-0"
                        />
                        <span className="truncate" title={area.name}>{area.name}</span>
                      </label>
                    )
                  })}
              </div>

              {/* رسائل التنبيه عند عدم وجود نتائج */}
              {(() => {
                const filteredCount = (branch.areas || []).filter(a => {
                  if (showSelectedOnlyCollector && !selectedCollectorAreas.includes(a.id)) return false
                  if (collectorAreaSearch && !a.name.toLowerCase().includes(collectorAreaSearch.toLowerCase())) return false
                  return true
                }).length

                if (filteredCount === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 font-bold text-xs space-y-1">
                      {showSelectedOnlyCollector ? (
                        <>
                          <p className="text-slate-600 font-black">لم تقم بتحديد أي مناطق لهذا المحصل حتى الآن</p>
                          <p className="text-[11px] text-slate-400">انقر على &quot;إظهار جميع المناطق&quot; لتحديد المناطق المطلوبة</p>
                        </>
                      ) : (
                        <p>لا توجد مناطق مطابقة للبحث</p>
                      )}
                    </div>
                  )
                }
                return null
              })()}
            </div>

            {/* أزرار الإجراءات في الأسفل مثبتة دائماً وظاهرة بحجم مدمج */}
            <div 
              style={{
                flexShrink: 0,
                padding: '10px 16px',
                borderTop: '1px solid #e2e8f0',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div className="text-xs font-black text-slate-700">
                المحدد: <span className="text-blue-700 font-mono font-black text-xs">{selectedCollectorAreas.length}</span> منطقة
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowCollectorModal(false)}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 transition shadow-2xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveCollector}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-lg transition shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>حفظ المحصل</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل كاتب - تصميم متناسق ومريح مع 4 مناطق في السطر دائماً */}
      {showWriterModal && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div 
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '580px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
              border: '1px solid #cbd5e1'
            }}
          >
            {/* رأس النافذة الأنيق */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {editingWriter ? 'تعديل بيانات الكاتب' : 'إضافة كاتب جديد'}
                  </h3>
                  <p className="text-[11px] text-slate-500 font-bold leading-tight mt-0.5">
                    تحديد بيانات الكاتب ونطاق الاشتراكات وساعات العمل
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowWriterModal(false)
                }}
                className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* جسم النافذة القابل للتمرير إن لزم الأمر */}
            <div className="p-4 space-y-3.5 overflow-y-auto max-h-[calc(90vh-130px)]">
              {/* حقول الاسم ورقم الهاتف جنباً إلى جنب في نفس السطر */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">اسم الكاتب:</label>
                  <input
                    type="text"
                    value={writerName}
                    onChange={(e) => setWriterName(e.target.value)}
                    placeholder="اسم الكاتب الكامل..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">رقم الهاتف:</label>
                  <input
                    type="text"
                    value={writerPhone}
                    onChange={(e) => setWriterPhone(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none dir-ltr text-right font-mono transition"
                  />
                </div>
              </div>

              {/* قسم تخصيص نطاق اشتراكات الكاتب (من رقم إلى رقم) */}
              {(() => {
                const wFromNum = parseInt(writerRangeFrom.trim(), 10)
                const wToNum = parseInt(writerRangeTo.trim(), 10)
                const isValidRange = !isNaN(wFromNum) && !isNaN(wToNum) && wFromNum > 0 && wToNum > 0
                const matchedCount = isValidRange ? (Math.abs(wToNum - wFromNum) + 1) : 0

                return (
                  <div className="bg-purple-50/70 border border-purple-200 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-700" />
                        <span className="text-xs font-black text-purple-950">
                          تحديد نطاق اشتراكات الكاتب (من وإلى):
                        </span>
                      </div>

                      {isValidRange && (
                        <span className="text-[11px] font-black bg-purple-100 text-purple-800 px-2.5 py-0.5 rounded-full border border-purple-300">
                          سيتم إسناد ({matchedCount}) مشترك لهذا الكاتب
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {/* حقل من اشتراك */}
                      <div className="bg-white border border-purple-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-purple-500 shadow-2xs">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">من اشتراك رقم:</label>
                        <input
                          type="number"
                          min="1"
                          value={writerRangeFrom}
                          onChange={(e) => setWriterRangeFrom(e.target.value)}
                          placeholder="مثلاً: 11001"
                          className="w-full font-black text-purple-950 outline-none bg-transparent text-sm font-mono"
                        />
                      </div>

                      {/* حقل إلى اشتراك */}
                      <div className="bg-white border border-purple-200 rounded-xl p-2 focus-within:ring-2 focus-within:ring-purple-500 shadow-2xs">
                        <label className="block text-[10px] font-bold text-slate-500 mb-0.5">إلى اشتراك رقم:</label>
                        <input
                          type="number"
                          min="1"
                          value={writerRangeTo}
                          onChange={(e) => setWriterRangeTo(e.target.value)}
                          placeholder="مثلاً: 12000"
                          className="w-full font-black text-purple-950 outline-none bg-transparent text-sm font-mono"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-slate-500 font-bold">
                        (عند الحفظ سيتم ربط كافة المشتركين الواقعين ضمن هذا النطاق بالكاتب تلقائياً)
                      </span>

                      {(writerRangeFrom || writerRangeTo) && (
                        <button
                          type="button"
                          onClick={() => {
                            setWriterRangeFrom('')
                            setWriterRangeTo('')
                          }}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-[10px] font-bold transition border border-rose-200 flex items-center gap-1 cursor-pointer shrink-0"
                          title="مسح النطاق"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>إفراغ النطاق</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })()}

              {/* قسم تقييد ساعات العمل بالتوقيت العراقي */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={writerWorkHoursEnabled}
                      onChange={(e) => setWriterWorkHoursEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-700" />
                      <span>تحديد ساعات عمل الكاتب (بالتوقيت العراقي)</span>
                    </span>
                  </label>

                  <span className="text-[10px] text-amber-800 font-bold bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200">
                    خارج هذا الوقت يُمنع الكاتب من فتح النظام
                  </span>
                </div>

                {writerWorkHoursEnabled && (
                  <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-amber-200/70">
                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-700">مِـن:</span>
                      <input
                        type="time"
                        value={writerWorkHourStart}
                        onChange={(e) => setWriterWorkHourStart(e.target.value)}
                        className="text-xs font-black text-slate-900 outline-none bg-transparent cursor-pointer font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">({formatTimeArabic(writerWorkHourStart)})</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-700">إلـى:</span>
                      <input
                        type="time"
                        value={writerWorkHourEnd}
                        onChange={(e) => setWriterWorkHourEnd(e.target.value)}
                        className="text-xs font-black text-slate-900 outline-none bg-transparent cursor-pointer font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">({formatTimeArabic(writerWorkHourEnd)})</span>
                    </div>

                    <span className="text-[10px] text-slate-500 font-bold">
                      الوقت الحالي: <strong className="text-amber-800 font-black">{getIraqCurrentTime().formatted12h}</strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* أزرار الإجراءات في الأسفل بارزة وواضحة جداً */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowWriterModal(false)}
                style={{
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  borderColor: '#cbd5e1'
                }}
                className="px-4 py-2.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition shadow-2xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveWriter}
                style={{
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(124, 58, 237, 0.35)'
                }}
                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs sm:text-sm font-black rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span className="font-black text-white">حفظ الكاتب</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة سجل نشاط وإحصائيات الكاتب الشاملة (اليومي، الشهري، السنوي) */}
      {showWriterStatsModal && statsSelectedWriter && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          dir="rtl"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right">
            {/* 1. رأس النافذة */}
            <div
              style={{ backgroundColor: '#1e1b4b', color: '#ffffff' }}
              className="p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md"
            >
              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' }}
                  className="w-12 h-12 rounded-2xl border flex items-center justify-center text-white shadow-inner"
                >
                  <BarChart3 className="w-6 h-6 text-purple-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">{statsSelectedWriter.name}</h3>
                    <span
                      style={{ backgroundColor: '#4338ca', color: '#ffffff', borderColor: '#6366f1' }}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-black border"
                    >
                      كاتب معتمد
                    </span>
                  </div>
                  <p className="text-xs text-purple-200 mt-1 flex items-center gap-2 font-bold">
                    <span>الهاتف: {statsSelectedWriter.phone}</span>
                    <span>•</span>
                    <span>توقيت العراق الرسمي (Asia/Baghdad)</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshWriterStats}
                  disabled={isLoadingWriterStats}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' }}
                  className="p-2 hover:bg-white/25 text-white rounded-xl transition border flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
                  title="تحديث البيانات لحظياً من السيرفر"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingWriterStats ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline font-black">تحديث</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowWriterStatsModal(false)}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' }}
                  className="p-2 hover:bg-white/25 text-white rounded-xl transition border cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. شريط التبويبات الزمنية (اليوم، هذا الشهر، هذه السنة، السجل الشامل) */}
            <div
              style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}
              className="px-4 sm:px-6 pt-3 pb-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0"
            >
              <div
                style={{ backgroundColor: '#e2e8f0', borderColor: '#cbd5e1' }}
                className="flex items-center gap-1 p-1 rounded-2xl text-xs font-bold border"
              >
                <button
                  type="button"
                  onClick={() => setStatsTimeTab('today')}
                  style={
                    statsTimeTab === 'today'
                      ? { backgroundColor: '#4f46e5', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', color: '#1e293b' }
                  }
                  className="px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 font-black shadow-2xs"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>أعمال اليوم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatsTimeTab('month')}
                  style={
                    statsTimeTab === 'month'
                      ? { backgroundColor: '#4f46e5', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', color: '#1e293b' }
                  }
                  className="px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 font-black shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>هذا الشهر</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatsTimeTab('year')}
                  style={
                    statsTimeTab === 'year'
                      ? { backgroundColor: '#4f46e5', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', color: '#1e293b' }
                  }
                  className="px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 font-black shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>هذه السنة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStatsTimeTab('all')}
                  style={
                    statsTimeTab === 'all'
                      ? { backgroundColor: '#4f46e5', color: '#ffffff' }
                      : { backgroundColor: '#ffffff', color: '#1e293b' }
                  }
                  className="px-3.5 py-1.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 font-black shadow-2xs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>السجل الشامل</span>
                </button>
              </div>

              {/* آخر ظهور للكاتب */}
              {writerStats?.lastLogin && (
                <div className="text-xs text-slate-700 font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-slate-300 shadow-2xs">
                  <span>آخر دخول للنظام:</span>
                  <span className="text-indigo-700 font-black">{writerStats.lastLogin.date} ({writerStats.lastLogin.time})</span>
                </div>
              )}
            </div>

            {/* 3. بطاقات الإحصائيات الأربعة الكبيرة */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 bg-white">
              {(() => {
                const currentPeriod: PeriodStats = writerStats
                  ? statsTimeTab === 'today'
                    ? writerStats.today
                    : statsTimeTab === 'month'
                    ? writerStats.thisMonth
                    : statsTimeTab === 'year'
                    ? writerStats.thisYear
                    : writerStats.allTime
                  : {
                      loginCount: 0,
                      editedSubscribersCount: 0,
                      uniqueEditedSubscribers: [],
                      debtSubscribersCount: 0,
                      totalDebtAmount: 0,
                      uniqueDebtSubscribers: [],
                      paymentSubscribersCount: 0,
                      totalPaymentAmount: 0,
                      paymentTransactionsCount: 0,
                      uniquePaymentSubscribers: [],
                      totalOperations: 0
                    }

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* بطاقة 1: فتح النظام */}
                    <div
                      style={{ backgroundColor: '#eff6ff', borderColor: '#93c5fd' }}
                      className="border-2 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: '#1e3a8a' }} className="text-xs font-black">فتح النظام</span>
                        <div style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }} className="w-8 h-8 rounded-xl flex items-center justify-center">
                          <Eye className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#172554' }} className="text-3xl font-black font-mono">
                          {currentPeriod.loginCount}
                        </div>
                        <p style={{ color: '#1e40af' }} className="text-xs font-bold mt-1">
                          {statsTimeTab === 'today' ? 'مرات فتح النظام اليوم' : 'مرات تسجيل الدخول'}
                        </p>
                      </div>
                      <div style={{ color: '#2563eb', borderTopColor: '#bfdbfe' }} className="text-[11px] font-bold pt-1.5 border-t">
                        {statsTimeTab === 'today' ? 'حسب التوقيت العراقي' : 'خلال هذه الفترة'}
                      </div>
                    </div>

                    {/* بطاقة 2: الأسماء المعدلة */}
                    <div
                      style={{ backgroundColor: '#fffbeb', borderColor: '#fcd34d' }}
                      className="border-2 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: '#78350f' }} className="text-xs font-black">الأسماء المعدلة</span>
                        <div style={{ backgroundColor: '#fef3c7', color: '#b45309' }} className="w-8 h-8 rounded-xl flex items-center justify-center">
                          <Edit3 className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#451a03' }} className="text-3xl font-black font-mono">
                          {currentPeriod.editedSubscribersCount}
                        </div>
                        <p style={{ color: '#92400e' }} className="text-xs font-bold mt-1">
                          مشترك تم تعديل بياناته
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={currentPeriod.editedSubscribersCount === 0}
                        onClick={() =>
                          setShowSubscribersListModal({
                            title: `قائمة المشتركين المعدلين بواسطة الكاتب (${currentPeriod.editedSubscribersCount} مشترك)`,
                            subscribers: currentPeriod.uniqueEditedSubscribers
                          })
                        }
                        style={{ color: '#78350f', borderTopColor: '#fde68a' }}
                        className="text-xs font-black pt-1.5 border-t flex items-center justify-between disabled:opacity-40 cursor-pointer hover:underline"
                      >
                        <span>عرض قائمة الأسماء</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* بطاقة 3: تنزيل وتعديل الديون */}
                    <div
                      style={{ backgroundColor: '#fff1f2', borderColor: '#fda4af' }}
                      className="border-2 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: '#881337' }} className="text-xs font-black">تنزيل الديون</span>
                        <div style={{ backgroundColor: '#ffe4e6', color: '#e11d48' }} className="w-8 h-8 rounded-xl flex items-center justify-center">
                          <DollarSign className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#4c0519' }} className="text-3xl font-black font-mono">
                          {currentPeriod.debtSubscribersCount}
                        </div>
                        <p style={{ color: '#9f1239' }} className="text-xs font-bold mt-1">
                          مشترك نُزّلت/عُدّلت له ديون
                        </p>
                        {currentPeriod.totalDebtAmount > 0 && (
                          <p style={{ color: '#be123c' }} className="text-xs font-black mt-0.5 font-mono">
                            {currentPeriod.totalDebtAmount.toLocaleString('ar-IQ')} د.ع
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={currentPeriod.debtSubscribersCount === 0}
                        onClick={() =>
                          setShowSubscribersListModal({
                            title: `المشتركون الذين نُزلت لهم ديون (${currentPeriod.debtSubscribersCount} مشترك)`,
                            subscribers: currentPeriod.uniqueDebtSubscribers
                          })
                        }
                        style={{ color: '#881337', borderTopColor: '#fecdd3' }}
                        className="text-xs font-black pt-1.5 border-t flex items-center justify-between disabled:opacity-40 cursor-pointer hover:underline"
                      >
                        <span>عرض قائمة المشتركين</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* بطاقة 4: تنزيل المدفوعات */}
                    <div
                      style={{ backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }}
                      className="border-2 rounded-2xl p-4 shadow-sm flex flex-col justify-between space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span style={{ color: '#064e3b' }} className="text-xs font-black">تنزيل المدفوعات</span>
                        <div style={{ backgroundColor: '#d1fae5', color: '#059669' }} className="w-8 h-8 rounded-xl flex items-center justify-center">
                          <Wallet className="w-4 h-4" />
                        </div>
                      </div>
                      <div>
                        <div style={{ color: '#022c22' }} className="text-3xl font-black font-mono">
                          {currentPeriod.paymentSubscribersCount}
                        </div>
                        <p style={{ color: '#065f46' }} className="text-xs font-bold mt-1">
                          مشترك نُزّلت له مدفوعات
                        </p>
                        <p style={{ color: '#047857' }} className="text-xs font-black mt-0.5 font-mono">
                          {currentPeriod.totalPaymentAmount.toLocaleString('ar-IQ')} د.ع ({currentPeriod.paymentTransactionsCount} دفعة)
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={currentPeriod.paymentSubscribersCount === 0}
                        onClick={() =>
                          setShowSubscribersListModal({
                            title: `المشتركون الذين نُزلت لهم مدفوعات (${currentPeriod.paymentSubscribersCount} مشترك)`,
                            subscribers: currentPeriod.uniquePaymentSubscribers
                          })
                        }
                        style={{ color: '#064e3b', borderTopColor: '#a7f3d0' }}
                        className="text-xs font-black pt-1.5 border-t flex items-center justify-between disabled:opacity-40 cursor-pointer hover:underline"
                      >
                        <span>عرض قائمة المشتركين</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* 4. قسم السجل الزمني التفصيلي للحركات */}
              <div
                style={{ backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }}
                className="border-2 rounded-2xl p-4 space-y-3 shadow-2xs"
              >
                <div
                  style={{ borderBottomColor: '#cbd5e1' }}
                  className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-purple-700" />
                    <h4 className="text-xs sm:text-sm font-black text-slate-900">
                      السجل الزمني للعمليات ({filteredEventsForTable.length} عملية)
                    </h4>
                  </div>

                  {/* فلاتر نوع الحركة وحقل البحث */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <select
                      value={statsActionFilter}
                      onChange={(e) => setStatsActionFilter(e.target.value as any)}
                      style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#94a3b8' }}
                      className="px-3 py-1.5 border-2 rounded-xl text-xs font-black focus:outline-none focus:border-purple-600"
                    >
                      <option value="all">جميع أنواع العمليات</option>
                      <option value="login">فتح النظام (دخول)</option>
                      <option value="edit_subscriber">تعديل بيانات مشترك</option>
                      <option value="update_debt">تنزيل / تعديل ديون</option>
                      <option value="add_payment">تنزيل مدفوعات</option>
                    </select>

                    <div className="relative flex-1 sm:w-48">
                      <Search className="w-3.5 h-3.5 text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="بحث بالمشترك..."
                        value={statsSearchTerm}
                        onChange={(e) => setStatsSearchTerm(e.target.value)}
                        style={{ backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#94a3b8' }}
                        className="w-full pr-8 pl-2 py-1.5 border-2 rounded-xl text-xs font-bold placeholder-slate-400 focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>
                </div>

                {/* قائمة العمليات */}
                {isLoadingWriterStats ? (
                  <div className="py-12 text-center text-slate-700 font-bold text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                    <span>جارِ تحميل سجل العمليات من السحابة...</span>
                  </div>
                ) : filteredEventsForTable.length === 0 ? (
                  <div
                    style={{ backgroundColor: '#ffffff', color: '#334155', borderColor: '#cbd5e1' }}
                    className="py-10 text-center font-black text-xs rounded-xl border-2 border-dashed shadow-2xs"
                  >
                    لا توجد أي حركات مسجلة لهذا الكاتب في هذه الفترة المحددة
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {filteredEventsForTable.map((ev) => {
                      const isLogin = ev.actionType === 'login'
                      const isEdit = ev.actionType === 'edit_subscriber'
                      const isDebt = ev.actionType === 'update_debt'
                      const isPay = ev.actionType === 'add_payment'

                      return (
                        <div
                          key={ev.id}
                          style={{ backgroundColor: '#ffffff', borderColor: '#cbd5e1' }}
                          className="p-3 rounded-xl border-2 hover:border-purple-400 shadow-2xs transition flex flex-wrap items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            {/* شارة نوع الحركة */}
                            <span
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black shrink-0 ${
                                isLogin
                                  ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                  : isEdit
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : isDebt
                                  ? 'bg-rose-100 text-rose-900 border border-rose-300'
                                  : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              }`}
                            >
                              {isLogin
                                ? 'فتح النظام'
                                : isEdit
                                ? 'تعديل مشترك'
                                : isDebt
                                ? 'تنزيل ديون'
                                : 'تنزيل دفعة'}
                            </span>

                            {/* اسم المشترك والتفاصيل */}
                            <div>
                              {ev.subscriberName ? (
                                <div className="font-black text-slate-950 text-xs">
                                  {ev.subscriberName} {ev.subscriberId ? `(#${ev.subscriberId})` : ''}
                                </div>
                              ) : null}
                              <div className="text-[11px] text-slate-600 font-bold">
                                {ev.details || (isLogin ? 'تسجيل دخول وفتح النظام' : '')}
                              </div>
                            </div>
                          </div>

                          {/* الوقت والتاريخ والمبلغ */}
                          <div className="flex items-center gap-3 mr-auto">
                            {ev.amount ? (
                              <span
                                style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', borderColor: '#d8b4fe' }}
                                className="font-mono font-black text-xs px-2.5 py-1 rounded-lg border"
                              >
                                {ev.amount.toLocaleString('ar-IQ')} د.ع
                              </span>
                            ) : null}

                            <div className="text-left text-[10px] font-mono text-slate-500 font-bold dir-ltr">
                              <div>{ev.date}</div>
                              <div className="text-slate-800 font-black">{ev.time}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* زر الإغلاق السفلي */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowWriterStatsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة سجل نشاط وإحصائيات المحصل الشاملة (اليومي، الشهري، السنوي) */}
      {showCollectorStatsModal && statsSelectedCollector && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          dir="rtl"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-right">
            {/* 1. رأس النافذة */}
            <div
              style={{ backgroundColor: '#0f294a', color: '#ffffff' }}
              className="p-4 sm:p-5 flex items-center justify-between shrink-0 shadow-md"
            >
              <div className="flex items-center gap-3">
                <div
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' }}
                  className="w-12 h-12 rounded-2xl border flex items-center justify-center text-white shadow-inner"
                >
                  <BarChart3 className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-white">{statsSelectedCollector.name}</h3>
                    <span
                      style={{ backgroundColor: '#1d4ed8', color: '#ffffff', borderColor: '#60a5fa' }}
                      className="px-2.5 py-0.5 rounded-md text-[11px] font-black border"
                    >
                      محصل معتمد
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-1 flex items-center gap-2 font-bold">
                    <span>الهاتف: {statsSelectedCollector.phone}</span>
                    <span>•</span>
                    <span>توقيت العراق الرسمي (Asia/Baghdad)</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRefreshCollectorStats}
                  disabled={isLoadingCollectorStats}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)', borderColor: 'rgba(255, 255, 255, 0.25)' }}
                  className="p-2 hover:bg-white/25 text-white rounded-xl transition border flex items-center gap-1.5 text-xs font-bold disabled:opacity-50 cursor-pointer"
                  title="تحديث البيانات لحظياً من السيرفر"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingCollectorStats ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline font-black">تحديث</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCollectorStatsModal(false)}
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
                  className="p-2 hover:bg-rose-600 text-white rounded-xl transition cursor-pointer"
                  title="إغلاق النافذة"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* 2. شريط التبويبات الزمنية (اليوم، هذا الشهر، هذه السنة، السجل الشامل) */}
            <div
              style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
              className="p-3 flex flex-wrap items-center justify-between gap-2 shrink-0"
            >
              <div className="flex items-center gap-1.5 bg-slate-200/90 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCollectorStatsTimeTab('today')}
                  style={{
                    backgroundColor: collectorStatsTimeTab === 'today' ? '#1d4ed8' : 'transparent',
                    color: collectorStatsTimeTab === 'today' ? '#ffffff' : '#334155'
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-2xs"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setCollectorStatsTimeTab('month')}
                  style={{
                    backgroundColor: collectorStatsTimeTab === 'month' ? '#1d4ed8' : 'transparent',
                    color: collectorStatsTimeTab === 'month' ? '#ffffff' : '#334155'
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-2xs"
                >
                  هذا الشهر
                </button>
                <button
                  type="button"
                  onClick={() => setCollectorStatsTimeTab('year')}
                  style={{
                    backgroundColor: collectorStatsTimeTab === 'year' ? '#1d4ed8' : 'transparent',
                    color: collectorStatsTimeTab === 'year' ? '#ffffff' : '#334155'
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-2xs"
                >
                  هذه السنة
                </button>
                <button
                  type="button"
                  onClick={() => setCollectorStatsTimeTab('all')}
                  style={{
                    backgroundColor: collectorStatsTimeTab === 'all' ? '#1d4ed8' : 'transparent',
                    color: collectorStatsTimeTab === 'all' ? '#ffffff' : '#334155'
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-2xs"
                >
                  السجل الشامل
                </button>
              </div>

              <div className="text-xs font-black text-slate-700 bg-white px-3 py-1 rounded-lg border border-slate-200">
                الفترة المحددة: {
                  collectorStatsTimeTab === 'today' ? 'نشاط اليوم' :
                  collectorStatsTimeTab === 'month' ? 'نشاط الشهر الحالي' :
                  collectorStatsTimeTab === 'year' ? 'نشاط سنة 2026' : 'كافة الفترات'
                }
              </div>
            </div>

            {/* 3. جسم النافذة القابل للتمرير */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
              {/* شبكة البطاقات الإحصائية الأربع - تصميم بألوان واضحة وعالية التباين */}
              {(() => {
                const currentPeriodStats = collectorStats
                  ? collectorStatsTimeTab === 'today'
                    ? collectorStats.today
                    : collectorStatsTimeTab === 'month'
                    ? collectorStats.thisMonth
                    : collectorStatsTimeTab === 'year'
                    ? collectorStats.thisYear
                    : collectorStats.allTime
                  : {
                      loginCount: 0,
                      viewedSubscribersCount: 0,
                      uniqueViewedSubscribers: [],
                      paymentSubscribersCount: 0,
                      totalPaymentAmount: 0,
                      paymentTransactionsCount: 0,
                      uniquePaymentSubscribers: [],
                      editedSubscribersCount: 0,
                      uniqueEditedSubscribers: [],
                      totalOperations: 0
                    }

                const lastLoginDisplay = collectorStats?.lastLogin
                  ? `${collectorStats.lastLogin.date} (${collectorStats.lastLogin.time})`
                  : undefined

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* بطاقة 1: فتح النظام ووقت آخر ظهور */}
                    <div
                      style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }}
                      className="p-4 rounded-2xl border shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ color: '#1e3a8a' }} className="text-xs font-black">
                            فتح النظام
                          </span>
                          <span
                            style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                            className="p-1.5 rounded-lg"
                          >
                            <Clock className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span style={{ color: '#0f172a' }} className="text-2xl font-black">
                            {currentPeriodStats.loginCount}
                          </span>
                          <span style={{ color: '#475569' }} className="text-xs font-bold">مرة</span>
                        </div>
                      </div>
                      <div
                        style={{ borderTop: '1px solid #dbeafe', color: '#334155' }}
                        className="mt-3 pt-2 text-[11px] font-bold"
                      >
                        {lastLoginDisplay ? (
                          <div>
                            آخر ظهور: <span style={{ color: '#1d4ed8', fontWeight: 900 }}>{lastLoginDisplay}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#64748b' }}>لا يوجد تسجيل دخول مسجل</span>
                        )}
                      </div>
                    </div>

                    {/* بطاقة 2: المشتركون الذين دخل عليهم المحصل */}
                    <div
                      style={{ backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' }}
                      className="p-4 rounded-2xl border shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ color: '#4c1d95' }} className="text-xs font-black">
                            المشتركون الذين دخل عليهم
                          </span>
                          <span
                            style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}
                            className="p-1.5 rounded-lg"
                          >
                            <Eye className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span style={{ color: '#0f172a' }} className="text-2xl font-black">
                            {currentPeriodStats.viewedSubscribersCount}
                          </span>
                          <span style={{ color: '#475569' }} className="text-xs font-bold">مشترك</span>
                        </div>
                      </div>
                      <div
                        style={{ borderTop: '1px solid #ede9fe' }}
                        className="mt-3 pt-2 flex items-center justify-between"
                      >
                        <span style={{ color: '#6d28d9' }} className="text-[11px] font-bold">
                          معاينات الحسابات
                        </span>
                        {currentPeriodStats.uniqueViewedSubscribers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSubscribersListModal({
                                title: `قائمة المشتركين الذين دخل عليهم المحصل (${statsSelectedCollector.name})`,
                                subscribers: currentPeriodStats.uniqueViewedSubscribers
                              })
                            }}
                            style={{ backgroundColor: '#ede9fe', color: '#5b21b6', borderColor: '#c4b5fd' }}
                            className="text-[10px] font-black px-2 py-0.5 rounded-md border hover:bg-purple-200 transition cursor-pointer"
                          >
                            عرض الأسماء ({currentPeriodStats.uniqueViewedSubscribers.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* بطاقة 3: المبالغ والمدفوعات المحصلة */}
                    <div
                      style={{ backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }}
                      className="p-4 rounded-2xl border shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ color: '#064e3b' }} className="text-xs font-black">
                            المدفوعات المحصلة
                          </span>
                          <span
                            style={{ backgroundColor: '#d1fae5', color: '#047857' }}
                            className="p-1.5 rounded-lg"
                          >
                            <CreditCard className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span style={{ color: '#065f46' }} className="text-xl font-black">
                            {(currentPeriodStats.totalPaymentAmount || 0).toLocaleString('ar-IQ')}
                          </span>
                          <span style={{ color: '#047857' }} className="text-xs font-black">د.ع</span>
                        </div>
                      </div>
                      <div
                        style={{ borderTop: '1px solid #d1fae5' }}
                        className="mt-3 pt-2 flex items-center justify-between"
                      >
                        <span style={{ color: '#047857' }} className="text-[11px] font-bold">
                          {currentPeriodStats.paymentSubscribersCount} مشترك سددوا
                        </span>
                        {currentPeriodStats.uniquePaymentSubscribers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSubscribersListModal({
                                title: `المشتركون الذين تم استلام دفعات منهم بواسطة (${statsSelectedCollector.name})`,
                                subscribers: currentPeriodStats.uniquePaymentSubscribers
                              })
                            }}
                            style={{ backgroundColor: '#d1fae5', color: '#065f46', borderColor: '#6ee7b7' }}
                            className="text-[10px] font-black px-2 py-0.5 rounded-md border hover:bg-emerald-200 transition cursor-pointer"
                          >
                            عرض المسددين ({currentPeriodStats.uniquePaymentSubscribers.length})
                          </button>
                        )}
                      </div>
                    </div>

                    {/* بطاقة 4: الأسماء المعدلة (تعديل بيانات المشتركين) */}
                    <div
                      style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a' }}
                      className="p-4 rounded-2xl border shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span style={{ color: '#78350f' }} className="text-xs font-black">
                            تعديل المشتركين
                          </span>
                          <span
                            style={{ backgroundColor: '#fef3c7', color: '#b45309' }}
                            className="p-1.5 rounded-lg"
                          >
                            <Edit3 className="w-4 h-4" />
                          </span>
                        </div>
                        <div className="flex items-baseline gap-1">
                          <span style={{ color: '#0f172a' }} className="text-2xl font-black">
                            {currentPeriodStats.editedSubscribersCount}
                          </span>
                          <span style={{ color: '#475569' }} className="text-xs font-bold">مشترك</span>
                        </div>
                      </div>
                      <div
                        style={{ borderTop: '1px solid #fef3c7' }}
                        className="mt-3 pt-2 flex items-center justify-between"
                      >
                        <span style={{ color: '#92400e' }} className="text-[11px] font-bold">
                          تحديث بيانات
                        </span>
                        {currentPeriodStats.uniqueEditedSubscribers.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setShowSubscribersListModal({
                                title: `المشتركون الذين تم تعديل بياناتهم بواسطة المحصل (${statsSelectedCollector.name})`,
                                subscribers: currentPeriodStats.uniqueEditedSubscribers
                              })
                            }}
                            style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }}
                            className="text-[10px] font-black px-2 py-0.5 rounded-md border hover:bg-amber-200 transition cursor-pointer"
                          >
                            عرض الأسماء ({currentPeriodStats.uniqueEditedSubscribers.length})
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* 4. قسم سجل العمليات التفصيلي مع خيارات البحث والفلترة */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900">سجل العمليات والتحركات المفصل</h4>
                    <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      {filteredCollectorEventsForTable.length} حركة
                    </span>
                  </div>

                  {/* فلترة نوع الحركة */}
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setCollectorStatsActionFilter('all')}
                      style={{
                        backgroundColor: collectorStatsActionFilter === 'all' ? '#0f294a' : '#f1f5f9',
                        color: collectorStatsActionFilter === 'all' ? '#ffffff' : '#334155'
                      }}
                      className="px-2.5 py-1 rounded-lg font-black transition cursor-pointer"
                    >
                      الكل
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectorStatsActionFilter('login')}
                      style={{
                        backgroundColor: collectorStatsActionFilter === 'login' ? '#1d4ed8' : '#eff6ff',
                        color: collectorStatsActionFilter === 'login' ? '#ffffff' : '#1e3a8a'
                      }}
                      className="px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      فتح الحساب
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectorStatsActionFilter('view_subscriber')}
                      style={{
                        backgroundColor: collectorStatsActionFilter === 'view_subscriber' ? '#6d28d9' : '#f5f3ff',
                        color: collectorStatsActionFilter === 'view_subscriber' ? '#ffffff' : '#5b21b6'
                      }}
                      className="px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      معاينة مشترك
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectorStatsActionFilter('add_payment')}
                      style={{
                        backgroundColor: collectorStatsActionFilter === 'add_payment' ? '#047857' : '#ecfdf5',
                        color: collectorStatsActionFilter === 'add_payment' ? '#ffffff' : '#065f46'
                      }}
                      className="px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      استلام دفعة
                    </button>
                    <button
                      type="button"
                      onClick={() => setCollectorStatsActionFilter('edit_subscriber')}
                      style={{
                        backgroundColor: collectorStatsActionFilter === 'edit_subscriber' ? '#b45309' : '#fffbeb',
                        color: collectorStatsActionFilter === 'edit_subscriber' ? '#ffffff' : '#92400e'
                      }}
                      className="px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                    >
                      تعديل
                    </button>
                  </div>
                </div>

                {/* حقل البحث السريع */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={collectorStatsSearchTerm}
                    onChange={(e) => setCollectorStatsSearchTerm(e.target.value)}
                    placeholder="ابحث في العمليات بالاسم، نوع الحركة، التفاصيل أو التوقيت..."
                    style={{ backgroundColor: '#f8fafc', color: '#0f172a' }}
                    className="w-full pl-3 pr-9 py-2 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* قائمة الحركات */}
                {filteredCollectorEventsForTable.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 space-y-2">
                    <Activity className="w-8 h-8 mx-auto opacity-30 text-blue-500" />
                    <p className="text-xs font-bold">لا توجد حركات مسجلة لهذا المحصل ضمن هذه الفترة أو معايير البحث.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
                    {filteredCollectorEventsForTable.map((ev) => {
                      return (
                        <div
                          key={ev.id}
                          className="p-3 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 transition flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {ev.actionType === 'login' && (
                              <span
                                style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                                className="px-2 py-1 rounded-lg font-black text-[10px] shrink-0"
                              >
                                فتح النظام
                              </span>
                            )}
                            {ev.actionType === 'view_subscriber' && (
                              <span
                                style={{ backgroundColor: '#ede9fe', color: '#6d28d9' }}
                                className="px-2 py-1 rounded-lg font-black text-[10px] shrink-0"
                              >
                                معاينة حساب
                              </span>
                            )}
                            {ev.actionType === 'add_payment' && (
                              <span
                                style={{ backgroundColor: '#d1fae5', color: '#065f46' }}
                                className="px-2 py-1 rounded-lg font-black text-[10px] shrink-0"
                              >
                                استلام دفعة
                              </span>
                            )}
                            {ev.actionType === 'edit_subscriber' && (
                              <span
                                style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                                className="px-2 py-1 rounded-lg font-black text-[10px] shrink-0"
                              >
                                تعديل مشترك
                              </span>
                            )}

                            <div className="truncate">
                              {ev.subscriberName && (
                                <span className="font-black text-slate-900 ml-1.5">
                                  {ev.subscriberName}
                                </span>
                              )}
                              <span className="text-slate-600 font-bold text-[11px]">
                                {ev.details}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {ev.amount ? (
                              <span
                                style={{ backgroundColor: '#ecfdf5', color: '#065f46', borderColor: '#a7f3d0' }}
                                className="px-2 py-0.5 rounded-md font-black text-[11px] border"
                              >
                                +{(ev.amount || 0).toLocaleString('ar-IQ')} د.ع
                              </span>
                            ) : null}

                            <div className="text-left text-[10px] font-mono text-slate-500 font-bold dir-ltr">
                              <div>{ev.date}</div>
                              <div className="text-slate-800 font-black">{ev.time}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* زر الإغلاق السفلي */}
            <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setShowCollectorStatsModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة عرض قائمة أسماء المشتركين المعنيين */}
      {showSubscribersListModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          dir="rtl"
        >
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden text-right">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="font-black text-sm">{showSubscribersListModal.title}</h4>
              <button
                type="button"
                onClick={() => setShowSubscribersListModal(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-96 space-y-1.5 flex-1">
              {showSubscribersListModal.subscribers.map((s, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-bold"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-800 font-mono text-[10px] flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-slate-900 font-black">{s.name || 'بدون اسم'}</span>
                    {s.id ? <span className="text-slate-400 font-mono text-[11px]">#{s.id}</span> : null}
                  </div>

                  {s.amount ? (
                    <span className="font-mono font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                      {s.amount.toLocaleString('ar-IQ')} د.ع
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-100 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSubscribersListModal(null)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تخصيص المشتركين للمناطق */}
      {showAssignAreasModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              boxSizing: 'border-box'
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تخصيص المشتركين للمناطق</h3>
                  <p className="text-[11px] text-slate-500 font-bold">المشتركون المحددون: {selectedSubIds.size} مشترك</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignAreasModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-bold">
              اختر منطقة واحدة أو ضع إشارة صح على أكثر من منطقة لتخصيص هؤلاء المشتركين إليها:
            </p>

            {/* فلتر البحث في المناطق وأزرار التحديد السريع */}
            <div className="space-y-2">
              <input
                type="text"
                value={bulkAreaSearch}
                onChange={(e) => setBulkAreaSearch(e.target.value)}
                placeholder="ابحث عن منطقة..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none"
              />

              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1">
                <span>المناطق المحددة: ({bulkSelectedAreaIds.length})</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const allIds = (branch.areas || []).map(a => a.id)
                      setBulkSelectedAreaIds(allIds)
                    }}
                    className="text-emerald-700 hover:underline"
                  >
                    تحديد الكل
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => setBulkSelectedAreaIds([])}
                    className="text-rose-600 hover:underline"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>
            </div>

            {/* قائمة المناطق */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              {(branch.areas || [])
                .filter(a => !bulkAreaSearch || a.name.toLowerCase().includes(bulkAreaSearch.toLowerCase()))
                .map(area => {
                  const isChecked = bulkSelectedAreaIds.includes(area.id)
                  const countInArea = loadedSubscribers.filter(s => s.areaId === area.id || s.areaIds?.includes(area.id)).length
                  return (
                    <label
                      key={area.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer font-bold transition border ${
                        isChecked
                          ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 shadow-2xs'
                          : 'bg-white hover:bg-slate-100 border-slate-200/80 text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setBulkSelectedAreaIds(prev => [...prev, area.id])
                            } else {
                              setBulkSelectedAreaIds(prev => prev.filter(id => id !== area.id))
                            }
                          }}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <span>{area.name}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">
                        {countInArea} مشترك
                      </span>
                    </label>
                  )
                })}
              {(branch.areas || []).length === 0 && (
                <div className="text-center py-6 text-slate-400 font-bold">
                  لا توجد مناطق مسجلة في هذا الفرع بعد
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignAreasModal(false)}
                disabled={isBulkSaving}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleBulkAssignAreas}
                disabled={isBulkSaving || bulkSelectedAreaIds.length === 0}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-900/20"
              >
                {isBulkSaving ? <span>جارِ الحفظ...</span> : <span>تطبيق التخصيص للمناطق ({bulkSelectedAreaIds.length})</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تخصيص المشتركين للكتّاب */}
      {showAssignWritersModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              boxSizing: 'border-box'
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تخصيص المشتركين للكتّاب</h3>
                  <p className="text-[11px] text-slate-500 font-bold">المشتركون المحددون: {selectedSubIds.size} مشترك</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignWritersModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-bold">
              اختر كاتباً أو ضع إشارة صح على أكثر من كاتب لتعيين هؤلاء المشتركين إليهم في نفس الوقت:
            </p>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1">
              <span>الكتّاب المحددون: ({bulkSelectedWriterIds.length})</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = (branch.writers || []).map(w => w.id)
                    setBulkSelectedWriterIds(allIds)
                  }}
                  className="text-amber-700 hover:underline"
                >
                  تحديد الكل
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setBulkSelectedWriterIds([])}
                  className="text-rose-600 hover:underline"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            {/* قائمة الكتّاب */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              {(branch.writers || []).map(writer => {
                const isChecked = bulkSelectedWriterIds.includes(writer.id)
                const assignedCount = writer.assignedSubscriberIds?.length || 0
                return (
                  <label
                    key={writer.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer font-bold transition border ${
                      isChecked
                        ? 'bg-amber-50/80 border-amber-300 text-amber-950 shadow-2xs'
                        : 'bg-white hover:bg-slate-100 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkSelectedWriterIds(prev => [...prev, writer.id])
                          } else {
                            setBulkSelectedWriterIds(prev => prev.filter(id => id !== writer.id))
                          }
                        }}
                        className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-black text-slate-900">{writer.name}</div>
                        {writer.phone && <div className="text-[10px] text-slate-400 font-mono font-normal">{writer.phone}</div>}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                      {assignedCount} مشترك مخصص
                    </span>
                  </label>
                )
              })}
              {(branch.writers || []).length === 0 && (
                <div className="text-center py-6 text-slate-400 font-bold">
                  لا يوجد كتّاب مضافون في هذا الفرع بعد (يمكنك إضافتهم من تبويب الكُتّاب)
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignWritersModal(false)}
                disabled={isBulkSaving}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                إلغاء
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkRemoveFromWriters}
                  disabled={isBulkSaving || bulkSelectedWriterIds.length === 0}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 disabled:opacity-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="إزالة هؤلاء المشتركين المحددين من الكاتب المختار"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>إزالة المشتركين من الكاتب (-)</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkAssignWriters}
                  disabled={isBulkSaving || bulkSelectedWriterIds.length === 0}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-amber-900/20 cursor-pointer"
                >
                  {isBulkSaving ? <span>جارِ الحفظ...</span> : <span>إضافة للكاتب (+)</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* نافذة تخصيص المشتركين للمحصلين */}
      {showAssignCollectorsModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            backgroundColor: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '24px',
              maxWidth: '520px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
              boxSizing: 'border-box'
            }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تخصيص المشتركين للمحصلين</h3>
                  <p className="text-[11px] text-slate-500 font-bold">المشتركون المحددون: {selectedSubIds.size} مشترك</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAssignCollectorsModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-bold">
              اختر محصلاً أو ضع إشارة صح على أكثر من محصل لتعيين هؤلاء المشتركين إليهم في نفس الوقت:
            </p>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1">
              <span>المحصلون المحددون: ({bulkSelectedCollectorIds.length})</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = (branch.collectors || []).map(c => c.id)
                    setBulkSelectedCollectorIds(allIds)
                  }}
                  className="text-blue-700 hover:underline"
                >
                  تحديد الكل
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setBulkSelectedCollectorIds([])}
                  className="text-rose-600 hover:underline"
                >
                  إلغاء التحديد
                </button>
              </div>
            </div>

            {/* قائمة المحصلين */}
            <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
              {(branch.collectors || []).map(collector => {
                const isChecked = bulkSelectedCollectorIds.includes(collector.id)
                const assignedCount = collector.assignedSubscriberIds?.length || 0
                return (
                  <label
                    key={collector.id}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer font-bold transition border ${
                      isChecked
                        ? 'bg-blue-50/80 border-blue-300 text-blue-950 shadow-2xs'
                        : 'bg-white hover:bg-slate-100 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBulkSelectedCollectorIds(prev => [...prev, collector.id])
                          } else {
                            setBulkSelectedCollectorIds(prev => prev.filter(id => id !== collector.id))
                          }
                        }}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-black text-slate-900">{collector.name}</div>
                        {collector.phone && <div className="text-[10px] text-slate-400 font-mono font-normal">{collector.phone}</div>}
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">
                      {assignedCount} مشترك مخصص
                    </span>
                  </label>
                )
              })}
              {(branch.collectors || []).length === 0 && (
                <div className="text-center py-6 text-slate-400 font-bold">
                  لا يوجد محصلون مضافون في هذا الفرع بعد (يمكنك إضافتهم من تبويب المحصلين)
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignCollectorsModal(false)}
                disabled={isBulkSaving}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition cursor-pointer"
              >
                إلغاء
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkRemoveFromCollectors}
                  disabled={isBulkSaving || bulkSelectedCollectorIds.length === 0}
                  className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 disabled:opacity-50 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  title="إزالة هؤلاء المشتركين المحددين من المحصل المختار"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                  <span>إزالة المشتركين من المحصل (-)</span>
                </button>

                <button
                  type="button"
                  onClick={handleBulkAssignCollectors}
                  disabled={isBulkSaving || bulkSelectedCollectorIds.length === 0}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-900/20 cursor-pointer"
                >
                  {isBulkSaving ? <span>جارِ الحفظ...</span> : <span>إضافة للمحصل (+)</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          نافذة تفاصيل المشترك وكشف الحساب وبلوك الديون للمسؤول
      ======================================================== */}
      {selectedDetailSubscriber && (() => {
        const sub = selectedDetailSubscriber
        const meterAmount = Number.parseInt(sub.meterType, 10)
        const due = sub.propertyType === 'تجاري'
          ? (Number.isFinite(meterAmount) && meterAmount > 0 ? meterAmount * 60 * 200 : 0)
          : (branch.pricing?.[sub.propertyType]?.[sub.meterType] ?? 24600)

        const subBilling = loadedBilling[sub.id] || {}
        let prevRemaining = sub.remainingPrev ?? 0
        if (subBilling[2026]?.[0]?.oldDebtManual !== null && subBilling[2026]?.[0]?.oldDebtManual !== undefined) {
          prevRemaining = subBilling[2026][0].oldDebtManual as number
        }

        const fee = prevRemaining >= due * 4 && due > 0 ? Math.round(prevRemaining * 0.1) : 0
        const totalCarried = prevRemaining + fee

        const periods = ['1 و 2', '3 و 4', '5 و 6', '7 و 8', '9 و 10', '11 و 12']
        const rows: Array<{
          periodLabel: string
          old: number
          due: number
          total: number
          paid: number
          remaining: number
        }> = []

        for (let p = 0; p < 6; p++) {
          const rec = subBilling[detailSubscriberYear]?.[p]
          const paid = rec?.paid ?? 0
          const manualOld = rec?.oldDebtManual
          const isManual = manualOld !== null && manualOld !== undefined
          const oldDebt: number = (p === 0)
            ? (isManual ? (manualOld as number) : totalCarried)
            : (isManual ? (manualOld as number) : rows[p - 1].remaining)

          const manualTotal = rec?.totalManual
          const isTotalManual = manualTotal !== null && manualTotal !== undefined
          const total: number = isTotalManual ? (manualTotal as number) : (oldDebt + due)

          const manualRemaining = rec?.remainingManual
          const isRemainingManual = manualRemaining !== null && manualRemaining !== undefined
          const remaining: number = isRemainingManual ? (manualRemaining as number) : (total - paid)

          rows.push({
            periodLabel: periods[p],
            old: oldDebt,
            due,
            total,
            paid,
            remaining
          })
        }

        const totalRemaining = rows.length > 0 ? rows[rows.length - 1].remaining : 0
        const dossierVal = sub.dossier || (sub.detailedAddress?.match(/إضبارة:\s*([^|]+)/)?.[1]?.trim()) || ''
        const notesVal = sub.notes || (sub.detailedAddress?.match(/ملاحظة:\s*(.+)$/)?.[1]?.trim()) || ''
        const areaName = branch.areas?.find(a => a.id === sub.areaId)?.name || 'غير محدد'
        const statusesList = sub.statuses || []

        const whatsappMsg = `مرحبا مشتركنا العزيز ${sub.name} (رقم الاشتراك #${sub.id})، مجموع المستحق في ذمتك لفرع ${branch.name} هو ${totalRemaining.toLocaleString('ar-IQ')} د.ع`
        const whatsappUrl = sub.phone ? generateWhatsAppLink(sub.phone, whatsappMsg) : ''

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
              
              {/* الرأس */}
              <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-blue-700">#{sub.id}</span>
                      <h3 className="text-sm sm:text-base font-black text-slate-900">{sub.name}</h3>
                    </div>
                    <div className="text-[11px] font-bold text-slate-500 mt-0.5">
                      {areaName} • {sub.propertyType} ({sub.meterType})
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSubscriberApp({
                        role: 'manager',
                        userTitle: `مسؤول فرع (${branch.name})`,
                        canEdit: true,
                        assignedSubscriberIds: [sub.id]
                      })
                      setSelectedDetailSubscriber(null)
                    }}
                    className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-xs"
                    title="فتح هذا المشترك في تطبيق المشتركين الكامل"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>تطبيق المشتركين</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedDetailSubscriber(null)}
                    className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-xl transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* المحتوى الداخلي */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                
                {/* شريط الإضبارة والملاحظات والدين السابق والحالات */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {dossierVal && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-bold">
                        <span className="text-[11px] text-blue-700">الإضبارة:</span>
                        <span className="font-mono font-black">#{dossierVal}</span>
                      </div>
                    )}

                    {sub.remainingPrev !== undefined && sub.remainingPrev > 0 && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 font-bold">
                        <span className="text-[11px] text-rose-600">الدين السابق المسجل:</span>
                        <span className="font-mono font-black">{sub.remainingPrev.toLocaleString('ar-IQ')} د.ع</span>
                      </div>
                    )}

                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 font-bold">
                      <span className="text-[11px] text-slate-500">القسط:</span>
                      <span className="font-mono">{due.toLocaleString('ar-IQ')} د.ع</span>
                    </div>

                    {sub.phone && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono font-bold" dir="ltr">
                        {sub.phone}
                      </div>
                    )}
                  </div>

                  {/* الحالات الخاصة */}
                  {statusesList.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-500">الحالات:</span>
                      {statusesList.map((st) => (
                        <span
                          key={st}
                          className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-rose-50 border border-rose-200 text-rose-800 shadow-2xs"
                        >
                          {st}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* الملاحظات */}
                  {notesVal && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs font-bold leading-relaxed">
                      <span className="text-amber-800 font-black ml-1">ملاحظة:</span>
                      <span>{notesVal}</span>
                    </div>
                  )}
                </div>

                {/* أزرار اختيار السنة */}
                <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                  <div className="text-xs font-black text-slate-800">سجل الفواتير والديون:</div>
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
                    {[2026, 2027, 2028].map((y) => {
                      const isSelected = detailSubscriberYear === y
                      return (
                        <button
                          key={y}
                          type="button"
                          onClick={() => setDetailSubscriberYear(y)}
                          className={`px-3 py-1 rounded-lg text-xs font-black transition ${
                            isSelected
                              ? y === 2026
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-slate-900 text-white shadow-xs'
                              : 'text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {y}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* بداية السنة */}
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>بداية سنة {detailSubscriberYear}:</span>
                  <span className="font-mono text-slate-900 font-black">
                    القديم ({prevRemaining.toLocaleString('ar-IQ')}) + الفائدة ({fee.toLocaleString('ar-IQ')}) = {totalCarried.toLocaleString('ar-IQ')} د.ع
                  </span>
                </div>

                {/* جدول الفترات الست لسنة المشترك المحددة */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                        <th className="p-2.5 text-center">الفترة</th>
                        <th className="p-2.5 text-center">القديم</th>
                        <th className="p-2.5 text-center">المجموع</th>
                        <th className="p-2.5 text-center">المدفوع</th>
                        <th className="p-2.5 text-center">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-bold">
                      {rows.map((row, idx) => {
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="p-2.5 text-center font-bold text-slate-800 bg-slate-50/50">
                              {row.periodLabel}
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-600">
                              {row.old.toLocaleString('ar-IQ')}
                            </td>
                            <td className="p-2.5 text-center font-mono text-slate-900 font-black">
                              {row.total.toLocaleString('ar-IQ')}
                            </td>
                            <td className="p-2 text-center">
                              <input
                                type="number"
                                defaultValue={row.paid || ''}
                                placeholder="0"
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value) || 0
                                  if (val !== row.paid) {
                                    // حفظ المدفوع للمسؤول مباشرة
                                    const updatedBilling = { ...loadedBilling }
                                    if (!updatedBilling[sub.id]) updatedBilling[sub.id] = {}
                                    if (!updatedBilling[sub.id][detailSubscriberYear]) {
                                      updatedBilling[sub.id][detailSubscriberYear] = [
                                        { oldDebtManual: null, paid: 0 },
                                        { oldDebtManual: null, paid: 0 },
                                        { oldDebtManual: null, paid: 0 },
                                        { oldDebtManual: null, paid: 0 },
                                        { oldDebtManual: null, paid: 0 },
                                        { oldDebtManual: null, paid: 0 }
                                      ]
                                    }
                                    const yRecs = [...updatedBilling[sub.id][detailSubscriberYear]]
                                    yRecs[idx] = { ...yRecs[idx], paid: val, remainingManual: null }
                                    updatedBilling[sub.id][detailSubscriberYear] = yRecs
                                    setLoadedBilling(updatedBilling)
                                    saveBranchSubscribersAndBilling(branch.id, loadedSubscribers, updatedBilling)
                                  }
                                }}
                                className="w-20 px-2 py-1 bg-white border border-slate-300 rounded-lg text-center font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </td>
                            <td className={`p-2.5 text-center font-mono font-black ${
                              row.remaining === 0 ? 'text-emerald-600 bg-emerald-50/40' : 'text-rose-600 bg-rose-50/20'
                            }`}>
                              {row.remaining.toLocaleString('ar-IQ')} د.ع
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* كارت ملخص الدين الكلي وزر الواتساب */}
                <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-bold text-blue-800">إجمالي المبلغ المستحق بذمة المشترك:</div>
                    <div className="text-xl font-black text-blue-950 font-mono">
                      {totalRemaining.toLocaleString('ar-IQ')} د.ع
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {sub.phone && whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>مراسلة واتساب</span>
                      </a>
                    )}
                    {sub.phone && (
                      <a
                        href={`tel:${sub.phone}`}
                        className="px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition hover:bg-slate-50"
                      >
                        اتصال
                      </a>
                    )}
                  </div>
                </div>

              </div>

              {/* أسفل النافذة */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenSubscriberApp({
                      role: 'manager',
                      userTitle: `مسؤول فرع (${branch.name})`,
                      canEdit: true,
                      assignedSubscriberIds: [sub.id]
                    })
                    setSelectedDetailSubscriber(null)
                  }}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>فتح تطبيق المشتركين الكامل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDetailSubscriber(null)}
                  className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition"
                >
                  إغلاق
                </button>
              </div>

            </div>
          </div>
        )
      })()}

      {/* نافذة تفاصيل المنطقة التفاعلية وإدارة مشتركيها */}
      {selectedAreaForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* رأس النافذة */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900">{selectedAreaForModal.name}</h3>
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-black rounded-full">
                      {areaSubscribersCountMap.get(selectedAreaForModal.id) || 0} مشترك
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-bold mt-0.5">
                    إدارة مشتركي المنطقة وتخصيص المشتركين إليها
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSelectedAreaForModal(null)
                  setIsAssigningToArea(false)
                }}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* شريط الكوادر المعينة لهذه المنطقة (تعدد المحصلين والكتاب) */}
            {(() => {
              const assignedCols = (branch.collectors || []).filter(c => c.assignedAreaIds?.includes(selectedAreaForModal.id))
              const assignedWrs = (branch.writers || []).filter(w => w.assignedAreaIds?.includes(selectedAreaForModal.id))
              return (
                <div className="px-4 py-2.5 bg-slate-100/60 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-black text-slate-700 text-[11px]">المحصلون ({assignedCols.length}):</span>
                    {assignedCols.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assignedCols.map(c => (
                          <span key={c.id} className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200/80 rounded-md font-bold text-[10px]">
                            {c.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-bold">غير مخصصة لمحصل بعد</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="font-black text-slate-700 text-[11px]">الكتّاب ({assignedWrs.length}):</span>
                    {assignedWrs.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {assignedWrs.map(w => (
                          <span key={w.id} className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200/80 rounded-md font-bold text-[10px]">
                            {w.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[11px] font-bold">غير مخصصة لكاتب بعد</span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* إشعار التغذية الراجعة */}
            {areaActionFeedback && (
              <div className="mx-4 mt-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black rounded-xl text-center flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{areaActionFeedback}</span>
              </div>
            )}

            {/* أزرار التبديل بين مشتركي المنطقة وإضافة مشتركين جدد */}
            <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex gap-2">
              <button
                type="button"
                onClick={() => setIsAssigningToArea(false)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  !isAssigningToArea
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>مشتركو المنطقة ({subscribersInSelectedArea.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAssigningToArea(true)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 ${
                  isAssigningToArea
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-blue-700 bg-blue-50 hover:bg-blue-100/80'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة وتخصيص مشتركين للمنطقة</span>
              </button>
            </div>

            {/* جسم النافذة */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* 1. وضع عرض مشتركي المنطقة الحاليين */}
              {!isAssigningToArea ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={areaSubscribersSearch}
                        onChange={(e) => setAreaSubscribersSearch(e.target.value)}
                        placeholder="بحث في مشتركي هذه المنطقة..."
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsAssigningToArea(true)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 shrink-0 shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة مشتركين</span>
                    </button>
                  </div>

                  {subscribersInSelectedArea.length === 0 ? (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <div>
                        <p className="text-sm font-bold text-slate-700">لا يوجد مشتركون في هذه المنطقة حالياً</p>
                        <p className="text-xs text-slate-400 mt-0.5">يمكنك إضافة وتحديد المشتركين لهذه المنطقة بضغطة زر واحدة</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAssigningToArea(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة مشتركين الآن</span>
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
                      {subscribersInSelectedArea.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-3 hover:bg-slate-50 flex items-center justify-between gap-2 transition"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="px-2 py-1 bg-slate-100 text-blue-700 font-mono font-black text-xs rounded-lg shrink-0">
                              #{sub.id}
                            </span>
                            <div className="min-w-0">
                              <h5 className="font-black text-slate-900 text-xs sm:text-sm truncate">{sub.name}</h5>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-bold mt-0.5">
                                <span>{sub.propertyType}</span>
                                <span>•</span>
                                <span>{sub.meterType}</span>
                                {sub.remainingPrev && sub.remainingPrev > 0 ? (
                                  <>
                                    <span>•</span>
                                    <span className="text-rose-600 font-mono">{sub.remainingPrev.toLocaleString('ar-IQ')} د.ع</span>
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDetailSubscriber(sub)
                                setDetailSubscriberYear(2026)
                              }}
                              className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition"
                              title="كشف حساب الديون"
                            >
                              كشف الحساب
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubscriberFromArea(sub.id, sub.name)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
                              title="إزالة المشترك من هذه المنطقة"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* 2. وضع تحديد وإضافة المشتركين للمنطقة */
                <div className="space-y-3">
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={allSubscribersSearch}
                        onChange={(e) => setAllSubscribersSearch(e.target.value)}
                        placeholder="بحث في كافة المشتركين بالاسم، رقم الاشتراك، أو العنوان..."
                        className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600 px-1">
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterUnassignedOnly}
                          onChange={(e) => setFilterUnassignedOnly(e.target.checked)}
                          className="w-4 h-4 rounded text-blue-600 border-slate-300"
                        />
                        <span>عرض المشتركين غير المخصصين لأي منطقة فقط</span>
                      </label>

                      <div className="flex items-center gap-3 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            const newSet = new Set(selectedNewSubIdsForArea)
                            availableSubscribersForArea.slice(0, 100).forEach(s => newSet.add(s.id))
                            setSelectedNewSubIdsForArea(newSet)
                          }}
                          className="text-blue-600 hover:underline"
                        >
                          تحديد نتائج البحث
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedNewSubIdsForArea(new Set())}
                          className="text-rose-600 hover:underline"
                        >
                          إلغاء التحديد
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* قائمة المشتركين القابلة للاختيار */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100 max-h-[45vh] overflow-y-auto">
                    {availableSubscribersForArea.slice(0, 150).map((sub) => {
                      const isSelected = selectedNewSubIdsForArea.has(sub.id)
                      const currentAreaName = branch.areas?.find(a => a.id === sub.areaId)?.name

                      return (
                        <label
                          key={sub.id}
                          className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                            isSelected ? 'bg-blue-50/70 border-r-4 border-blue-600' : 'hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedNewSubIdsForArea)
                                if (e.target.checked) next.add(sub.id)
                                else next.delete(sub.id)
                                setSelectedNewSubIdsForArea(next)
                              }}
                              className="w-4 h-4 rounded text-blue-600 border-slate-300 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-blue-700 text-xs">#{sub.id}</span>
                                <h5 className="font-black text-slate-900 text-xs sm:text-sm truncate">{sub.name}</h5>
                              </div>
                              <div className="text-[11px] text-slate-500 font-bold mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span>{sub.propertyType}</span>
                                {currentAreaName ? (
                                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                    حالياً في: {currentAreaName}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">
                                    بدون منطقة
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                        </label>
                      )
                    })}

                    {availableSubscribersForArea.length === 0 && (
                      <div className="py-10 text-center text-slate-400 font-bold">
                        لا توجد نتائج مطابقة لبحثك
                      </div>
                    )}
                  </div>
                  {availableSubscribersForArea.length > 150 && (
                    <p className="text-[11px] text-slate-400 font-bold text-center">
                      يتم عرض أول 150 نتيجة للسرعة، استخدم البحث لتحديد مشتركين بعينهم
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* أسفل النافذة */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
              {isAssigningToArea ? (
                <>
                  <div className="text-xs font-black text-slate-700">
                    تم اختيار: <span className="text-blue-700 font-mono font-black">{selectedNewSubIdsForArea.size}</span> مشترك
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsAssigningToArea(false)}
                      className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      disabled={selectedNewSubIdsForArea.size === 0 || isSavingAreaSubs}
                      onClick={handleAssignSubscribersToArea}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm"
                    >
                      {isSavingAreaSubs ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>جارِ الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>تأكيد الإضافة للمنطقة</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onOpenSubscriberApp({
                        role: 'manager',
                        userTitle: `مسؤول فرع (${branch.name})`,
                        canEdit: true,
                        assignedAreaIds: [selectedAreaForModal.id]
                      })
                      setSelectedAreaForModal(null)
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition inline-flex items-center gap-1.5 shadow-sm"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>فتح المنطقة في تطبيق المشتركين</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedAreaForModal(null)}
                    className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    إغلاق
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

          {/* لوحة الكشوفات الفنية للمدير */}
      <ManagerInspectionDashboardModal
        isOpen={showInspectionDashboard}
        onClose={() => setShowInspectionDashboard(false)}
        branchId={branch.id}
        branchName={branch.name}
        branchManagerName={currentManager?.name || branch.managers?.[0]?.name}
      />
    </div>
  )
}
