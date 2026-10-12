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
  RefreshCw,
  Zap,
  Phone,
  AlertCircle,
  Hash,
  Clock
} from 'lucide-react'
import { checkWriterWorkHours, getIraqCurrentTime, formatTimeArabic } from '@/lib/iraqTime'

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

type TabType = 'subscribers' | 'areas' | 'consignments' | 'collectors' | 'writers' | 'settings'

export default function BranchManagerDashboard({
  branch,
  currentManager,
  onUpdateBranch,
  onOpenSubscriberApp
}: BranchManagerDashboardProps) {
  // التبويب الافتراضي يبدأ بالمناطق لمنع تحميل ملايين المشتركين تلقائياً عند فتح الحساب
  const [activeTab, setActiveTab] = useState<TabType>('areas')
  const [isConsignmentA4Open, setIsConsignmentA4Open] = useState(false)
  const [selectedConsignmentForView, setSelectedConsignmentForView] = useState<Consignment | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // حالات المشتركين المحملين عند الطلب فقط مع كاش ذكي
  const [loadedSubscribers, setLoadedSubscribers] = useState<Subscriber[]>(() => branch.subscribers || [])
  const [loadedBilling, setLoadedBilling] = useState<BillingRecords>(() => branch.billing || {})
  const [isLoadingSubscribers, setIsLoadingSubscribers] = useState(false)
  const [hasLoadedSubscribers, setHasLoadedSubscribers] = useState(false)

  // دالة جلب المشتركين عند الطلب
  const fetchBranchSubscribers = async (force = false) => {
    if (!force && hasLoadedSubscribers && loadedSubscribers.length > 0) return
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

  // تحميل المشتركين تلقائياً إذا فتح المسؤول تبويب المشتركين أو المناطق أو صفحة الإرساليات
  useEffect(() => {
    if ((activeTab === 'subscribers' || activeTab === 'areas' || isConsignmentA4Open) && !hasLoadedSubscribers) {
      fetchBranchSubscribers()
    }
  }, [activeTab, isConsignmentA4Open, hasLoadedSubscribers])

  // حالات المناطق والبحث والتفاعل المتقدم
  const [newAreaName, setNewAreaName] = useState('')
  const [showAreasListModal, setShowAreasListModal] = useState(false)
  const [areasListText, setAreasListText] = useState('')
  const [areaSearchQuery, setAreaSearchQuery] = useState('')
  const [selectedAreaForModal, setSelectedAreaForModal] = useState<Area | null>(null)
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
  const [copiedWriterId, setCopiedWriterId] = useState<string | null>(null)
  const [copiedCollectorId, setCopiedCollectorId] = useState<string | null>(null)
  const [collectorSearch, setCollectorSearch] = useState('')
  const [writerSearch, setWriterSearch] = useState('')

  // حالة عرض تفاصيل حساب المشترك وبلوك ديونه للمسؤول
  const [selectedDetailSubscriber, setSelectedDetailSubscriber] = useState<Subscriber | null>(null)
  const [detailSubscriberYear, setDetailSubscriberYear] = useState<number>(2026)


  // حالات الذكاء الاصطناعي
  const [newApiKey, setNewApiKey] = useState('')

  // حساب الإحصائيات (سريعة وخفيفة بالاعتماد على subscribersCount أو المشتركين المحملين)
  const stats = useMemo(() => {
    const totalSubscribers = branch.subscribersCount ?? (hasLoadedSubscribers ? loadedSubscribers.length : (branch.subscribers?.length || 0))
    const totalDebt = loadedSubscribers.reduce((sum, s) => sum + (s.remainingPrev || 0), 0)
    const totalAreas = branch.areas?.length || 0
    const totalCollectors = branch.collectors?.length || 0
    const totalWriters = branch.writers?.length || 0
    return { totalSubscribers, totalDebt, totalAreas, totalCollectors, totalWriters }
  }, [branch, loadedSubscribers, hasLoadedSubscribers])

  // حالات وضع التحديد والتخصيص الجماعي في سجل المشتركين
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedSubIds, setSelectedSubIds] = useState<Set<number>>(new Set())
  const [subscribersPage, setSubscribersPage] = useState(1)
  const [subscribersPageSize, setSubscribersPageSize] = useState<number>(30)

  // حالات التحديد بنطاق أرقام (مثلاً: من 1 إلى 1000)
  const [rangeFrom, setRangeFrom] = useState<string>('1')
  const [rangeTo, setRangeTo] = useState<string>('1000')
  const [rangeMode, setRangeMode] = useState<'index' | 'id'>('index')
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

    setSelectedSubIds(prev => {
      if (rangeKeepPrevious) {
        const merged = new Set(prev)
        newlySelectedIds.forEach(id => merged.add(id))
        return merged
      }
      return newlySelectedIds
    })

    setBulkFeedbackMessage(`تم بنجاح تحديد (${newlySelectedIds.size}) مشترك ضمن النطاق من ${start} إلى ${end}!`)
    setTimeout(() => setBulkFeedbackMessage(null), 4000)
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

    let updatedCollectors = [...(branch.collectors || [])]
    if (editingCollector) {
      updatedCollectors = updatedCollectors.map(c =>
        c.id === editingCollector.id
          ? {
              ...c,
              name: collectorName.trim(),
              phone: collectorPhone.trim(),
              canEdit: collectorCanEdit,
              assignedAreaIds: selectedCollectorAreas
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

    let updatedWriters = [...(branch.writers || [])]
    if (editingWriter) {
      updatedWriters = updatedWriters.map(w =>
        w.id === editingWriter.id
          ? {
              ...w,
              name: writerName.trim(),
              phone: writerPhone.trim(),
              assignedAreaIds: selectedWriterAreas,
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
        assignedAreaIds: selectedWriterAreas,
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
          setActiveTab('consignments')
        }}
      />
    )
  }

  const navItems = [
    { id: 'subscribers', label: 'المشتركون', icon: Users, count: stats.totalSubscribers },
    { id: 'areas', label: 'المناطق', icon: MapPin, count: stats.totalAreas },
    { id: 'consignments', label: 'مخزن الإرساليات', icon: Layers, count: (branch.consignments || []).length },
    { id: 'collectors', label: 'المحصلون', icon: Wallet, count: stats.totalCollectors },
    { id: 'writers', label: 'الكتّاب', icon: BookOpen, count: stats.totalWriters },
    { id: 'settings', label: 'الإعدادات و AI', icon: Settings }
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" dir="rtl">
      {/* الترويسة العلوية الفاتحة والمنسقة تماماً للموبايل والكمبيوتر */}
      <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-3.5 py-2.5 sm:py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white shadow-sm shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-base font-black text-slate-900 truncate">
                {branch.name}
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-md truncate max-w-[130px] sm:max-w-none">
                  {currentManager ? currentManager.name : 'مسؤول الفرع'}
                </span>
                <span className="hidden sm:inline text-[11px] text-slate-400 font-bold">• لوحة التحكم</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                setSelectedConsignmentForView(null)
                setActiveTab('consignments')
              }}
              style={{
                backgroundColor: activeTab === 'consignments' ? '#2563eb' : '#f8fafc',
                color: activeTab === 'consignments' ? '#ffffff' : '#1e293b',
                borderColor: '#cbd5e1'
              }}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 border rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>مخزن الإرساليات ({branch.consignments?.length || 0})</span>
            </button>

            <button
              onClick={() => {
                if (!hasLoadedSubscribers) {
                  fetchBranchSubscribers()
                }
                setSelectedConsignmentForView(null)
                setIsConsignmentA4Open(true)
              }}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>إنشاء إرسالية (A4)</span>
            </button>
          </div>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
        


        {/* شريط الأقسام (Tabs) انسيابي وخفيف للموبايل */}
        <div className="bg-white rounded-2xl p-1.5 border border-slate-200 shadow-sm overflow-x-auto flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`px-3 sm:px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* جسم الشاشة الرئيسي */}
        <main className="space-y-6">
          {/* تبويب المشتركين: سجل المشتركين مع وضع التحديد والتخصيص الجماعي */}
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
                    onClick={() => setActiveTab('settings')}
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

              {/* شريط التحكم السريع بوضع التحديد */}
              {isSelectMode && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-3.5 space-y-3 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-blue-950 text-sm">وضع التحديد نشط:</span>
                      <span className="px-3 py-1 rounded-full bg-blue-600 text-white font-black text-xs shadow-sm">
                        {selectedSubIds.size} مشترك محدد
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={selectAllVisibleSubscribers}
                        className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded-xl font-bold transition"
                      >
                        تحديد الصفحة الحالية ({paginatedSubscribers.length})
                      </button>
                      <button
                        type="button"
                        onClick={selectAllFilteredSubscribers}
                        className="px-3 py-1.5 bg-white hover:bg-blue-50 text-blue-800 border border-blue-200 rounded-xl font-bold transition"
                      >
                        تحديد كل نتائج البحث ({filteredSubscribers.length})
                      </button>
                      {selectedSubIds.size > 0 && (
                        <button
                          type="button"
                          onClick={clearSelectedSubscribers}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold transition"
                        >
                          إلغاء التحديد
                        </button>
                      )}
                    </div>
                  </div>

                  {/* أداة التحديد بنطاق الأرقام (مثلاً: من 1 إلى 1000) */}
                  <div className="bg-white p-3 sm:p-4 rounded-xl border-2 border-blue-300 shadow-sm space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <Hash className="w-5 h-5 font-black" />
                        </div>
                        <div>
                          <span className="font-black text-slate-900 text-xs sm:text-sm">تحديد المشتركين بالنطاق (من رقم إلى رقم)</span>
                          <p className="text-[11px] text-slate-500 font-bold">حدد مجموعة اشتراكات كاملة بنقرة واحدة (مثال: من 1 إلى 1000)</p>
                        </div>
                      </div>

                      {/* تبديل طريقة احتساب النطاق */}
                      <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setRangeMode('index')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            rangeMode === 'index'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="يحدد حسب ترتيب المشتركين في القائمة (مثلاً المشترك الأول إلى الألف)"
                        >
                          حسب تسلسل القائمة (1 إلى 1000)
                        </button>
                        <button
                          type="button"
                          onClick={() => setRangeMode('id')}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                            rangeMode === 'id'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                          title="يحدد حسب رقم اشتراك المشترك الفعلي (ID)"
                        >
                          حسب رقم المشترك (ID)
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      {/* حقل من رقم */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                        <span className="text-slate-700 font-black text-xs">مِـن رقم:</span>
                        <input
                          type="number"
                          min="1"
                          value={rangeFrom}
                          onChange={(e) => setRangeFrom(e.target.value)}
                          placeholder="1"
                          className="w-20 font-black text-slate-900 text-center outline-none bg-transparent text-sm"
                        />
                      </div>

                      {/* حقل إلى رقم */}
                      <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                        <span className="text-slate-700 font-black text-xs">إلـى رقم:</span>
                        <input
                          type="number"
                          min="1"
                          value={rangeTo}
                          onChange={(e) => setRangeTo(e.target.value)}
                          placeholder="1000"
                          className="w-24 font-black text-slate-900 text-center outline-none bg-transparent text-sm"
                        />
                      </div>

                      {/* زر تحديد هذا النطاق */}
                      <button
                        type="button"
                        onClick={() => handleSelectByRange()}
                        style={{ backgroundColor: '#2563eb', color: '#ffffff' }}
                        className="px-5 py-2 hover:bg-blue-700 font-black text-xs sm:text-sm rounded-xl transition shadow-md active:scale-95 flex items-center gap-2 cursor-pointer"
                      >
                        <CheckSquare className="w-4 h-4 text-white" />
                        <span>تحديد النطاق ({rangeFrom} ⬅ {rangeTo})</span>
                      </button>

                      {/* خيار الإبقاء على التحديد السابق */}
                      <label className="flex items-center gap-2 text-xs text-slate-700 font-bold cursor-pointer select-none bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition">
                        <input
                          type="checkbox"
                          checked={rangeKeepPrevious}
                          onChange={(e) => setRangeKeepPrevious(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
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
                        <span>الدفعة التالية ⏭</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {isLoadingSubscribers ? (
                <div className="py-12 text-center text-blue-600 font-bold bg-blue-50/50 rounded-xl">
                  <div className="text-xl mb-2">⏳</div>
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
              {/* ترويسة التبويب والتحكم */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-slate-900">المناطق المشمولة بالفرع</h3>
                    <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-black">
                      {(branch.areas || []).length} منطقة
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    انقر على أي منطقة لعرض مشتركيها وإضافة مشتركين إليها فورياً
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* شريط البحث في المناطق */}
                  <div className="relative min-w-[200px] sm:min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={areaSearchQuery}
                      onChange={(e) => setAreaSearchQuery(e.target.value)}
                      placeholder="بحث سريع في المناطق..."
                      className="w-full pl-3 pr-9 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
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

                  {/* زر التوجيه لخيارات الاستيراد في الإعدادات */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden sm:inline">الإعدادات والاستيراد</span>
                  </button>

                  {/* نموذج إضافة سريعة لمنطقة واحدة */}
                  <form onSubmit={handleAddArea} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="اسم منطقة جديدة..."
                      className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[150px]"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة</span>
                    </button>
                  </form>
                </div>
              </div>

              {/* شبكة المناطق المدمجة والأنيقة */}
              {filteredAreas.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm">لم يتم العثور على أي منطقة مطابقة لـ &quot;{areaSearchQuery}&quot;</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-2.5">
                  {filteredAreas.map((area) => {
                    const subsCount = areaSubscribersCountMap.get(area.id) || 0
                    const hasSubs = subsCount > 0

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
                        className={`group relative p-2.5 sm:p-3 rounded-2xl border text-right transition-all duration-150 cursor-pointer flex flex-col justify-between select-none ${
                          hasSubs
                            ? 'bg-white hover:bg-blue-50/50 border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-md'
                            : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200/60 hover:border-slate-300 text-slate-500'
                        }`}
                      >
                        {/* أعلى البطاقة: الاسم وأيقونة الحذف المصغرة */}
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <h4
                            className="font-black text-slate-900 text-xs sm:text-sm line-clamp-1 group-hover:text-blue-700 transition"
                            title={area.name}
                          >
                            {area.name}
                          </h4>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteArea(area.id, area.name)
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition shrink-0 -mt-1 -ml-1"
                            title="حذف المنطقة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* أسفل البطاقة: شارة المشتركين ومؤشر النقر */}
                        <div className="flex items-center justify-between mt-auto pt-1">
                          <span
                            className={`text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              hasSubs
                                ? 'bg-blue-50 text-blue-700 border border-blue-200/60'
                                : 'bg-slate-200/60 text-slate-500'
                            }`}
                          >
                            <Users className="w-3 h-3" />
                            <span>{subsCount} مشترك</span>
                          </span>

                          <span className="text-[10px] text-blue-600 font-bold opacity-0 group-hover:opacity-100 transition hidden sm:inline">
                            عرض التفاصيل ←
                          </span>
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

          {/* تبويب المحصلين */}
          {activeTab === 'collectors' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-5">
              {/* الرأسية مع شريط الإحصائيات وزر إضافة محصل */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-slate-900">كادر المحصلين</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-50 text-blue-700 border border-blue-200">
                      {branch.collectors?.length || 0} محصل
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إدارة وتخصيص صلاحيات المحصلين الميدانيين والمناطق المائية المسندة لكل محصل
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
                      setShowCollectorModal(true)
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>محصل جديد</span>
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
                        className="bg-slate-50/70 hover:bg-white rounded-2xl p-4 border border-slate-200/90 hover:border-blue-300 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3"
                      >
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
                        {collector.assignedSubscriberIds && collector.assignedSubscriberIds.length > 0 && (
                          <div className="p-2.5 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Users className="w-3.5 h-3.5 text-blue-700" />
                              <span className="font-black text-blue-950 text-[11px]">المشتركون المخصصون:</span>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-blue-100 text-blue-800">
                                {collector.assignedSubscriberIds.length} مشترك
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleClearCollectorSubscribers(collector.id, collector.name)}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
                              title="إزالة وتفريغ جميع المشتركين المخصصين لهذا المحصل بنقرة واحدة"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>إفراغ المشتركين</span>
                            </button>
                          </div>
                        )}

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
                                setShowCollectorModal(true)
                              }}
                              className="p-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl transition border border-slate-200 shadow-2xs"
                              title="تعديل بيانات المحصل ومناطقه"
                            >
                              <Edit3 className="w-4 h-4" />
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
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* تبويب الكتّاب */}
          {activeTab === 'writers' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-5">
              {/* الرأسية مع شريط الإحصائيات وزر إضافة كاتب */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base md:text-lg font-black text-slate-900">كادر الكتّاب</h3>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      {branch.writers?.length || 0} كاتب
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    إدارة صلاحيات إدخال وتحديث بيانات القراءات والمناطق المائية المسندة لكل كاتب
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setEditingWriter(null)
                      setWriterName('')
                      setWriterPhone('')
                      setSelectedWriterAreas([])
                      setWriterWorkHoursEnabled(false)
                      setWriterWorkHourStart('08:00')
                      setWriterWorkHourEnd('14:00')
                      setShowWriterModal(true)
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>كاتب جديد</span>
                  </button>
                </div>
              </div>

              {/* شريط البحث السريع في الكتّاب */}
              {branch.writers && branch.writers.length > 0 && (
                <div className="flex items-center justify-between gap-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="بحث باسم الكاتب أو رقم الهاتف أو المنطقة المسندة..."
                      value={writerSearch}
                      onChange={(e) => setWriterSearch(e.target.value)}
                      className="w-full pr-9 pl-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 shadow-2xs"
                    />
                  </div>
                  {writerSearch && (
                    <button
                      onClick={() => setWriterSearch('')}
                      className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1"
                    >
                      إلغاء البحث
                    </button>
                  )}
                </div>
              )}

              {/* قائمة وجدول الكتّاب المرتب والمدمج */}
              {(!branch.writers || branch.writers.length === 0) ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">لا يوجد كتاب مسجلون حالياً</p>
                </div>
              ) : filteredWriters.length === 0 ? (
                <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-200">
                  <p className="text-xs font-bold text-slate-500">لا توجد نتائج مطابقة لبحثك</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {filteredWriters.map((writer) => {
                    const assignedAreas = (branch.areas || []).filter(a => (writer.assignedAreaIds || []).includes(a.id))
                    const assignedCount = assignedAreas.length

                    return (
                      <div 
                        key={writer.id} 
                        className="bg-slate-50/70 hover:bg-white rounded-2xl p-4 border border-slate-200/90 hover:border-purple-300 shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col justify-between space-y-3"
                      >
                        {/* 1. رأس البطاقة: الاسم والهاتف */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <h4 className="font-black text-slate-900 text-sm sm:text-base">{writer.name}</h4>
                            </div>

                            <div className="flex items-center gap-1.5 text-slate-500 text-xs font-mono dir-ltr justify-end pr-1">
                              <span>{writer.phone}</span>
                              <Phone className="w-3 h-3 text-slate-400" />
                            </div>
                          </div>

                          <span className="text-[10px] px-2.5 py-1 rounded-full font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            كاتب معتمد
                          </span>
                        </div>

                        {/* 2. المناطق المسندة (تظهر فقط إذا كان لديه مناطق مسندة) */}
                        {assignedCount > 0 && (
                          <div className="p-2.5 bg-white rounded-xl border border-slate-100 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-black text-slate-700 flex items-center gap-1 text-[11px]">
                                <MapPin className="w-3.5 h-3.5 text-purple-600" />
                                <span>المناطق المسندة:</span>
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-purple-50 text-purple-700 border border-purple-200">
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
                                <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded-md border border-purple-200">
                                  +{assignedAreas.length - 4} أخرى
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* المشتركون المخصصون مباشرة للكاتب */}
                        {writer.assignedSubscriberIds && writer.assignedSubscriberIds.length > 0 && (
                          <div className="p-2.5 bg-purple-50/70 rounded-xl border border-purple-200/80 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs">
                              <Users className="w-3.5 h-3.5 text-purple-700" />
                              <span className="font-black text-purple-950 text-[11px]">المشتركون المخصصون:</span>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-purple-100 text-purple-800">
                                {writer.assignedSubscriberIds.length} مشترك
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleClearWriterSubscribers(writer.id, writer.name)}
                              className="px-2.5 py-1 bg-rose-100 hover:bg-rose-600 text-rose-700 hover:text-white rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer"
                              title="إزالة وتفريغ جميع المشتركين المخصصين لهذا الكاتب بنقرة واحدة"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>إفراغ المشتركين</span>
                            </button>
                          </div>
                        )}

                        {/* حالة ساعات العمل بالتوقيت العراقي */}
                        {(() => {
                          const workCheck = checkWriterWorkHours(writer)
                          return (
                            <div className="p-2.5 rounded-xl border text-xs space-y-1 bg-slate-50 border-slate-200">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px]">
                                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                                  <span>ساعات العمل (توقيت العراق):</span>
                                </span>
                                {writer.workHoursEnabled ? (
                                  workCheck.allowed ? (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                                      متاح للعمل الآن
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                                      خارج وقت العمل
                                    </span>
                                  )
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/80 text-slate-600">
                                    متاح 24 ساعة
                                  </span>
                                )}
                              </div>
                              {writer.workHoursEnabled && (
                                <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between pt-0.5">
                                  <span>
                                    من <span className="text-purple-700 font-black">{formatTimeArabic(writer.workHourStart || '08:00')}</span> إلى <span className="text-purple-700 font-black">{formatTimeArabic(writer.workHourEnd || '14:00')}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400">Asia/Baghdad</span>
                                </div>
                              )}
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
                                const directLink = `${origin}/?role=writer&token=${writer.token}&branch=${branch.id}`
                                window.open(directLink, '_blank')
                              }}
                              className="p-2 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white rounded-xl transition border border-blue-200 shadow-2xs group"
                              title="فتح حساب الكاتب في نافذة جديدة"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </button>

                            {/* زر نسخ الرابط - أيقونة */}
                            <button
                              type="button"
                              onClick={() => handleCopyWriterLink(writer)}
                              className={`p-2 rounded-xl transition border shadow-2xs ${
                                copiedWriterId === writer.id
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border-indigo-200'
                              }`}
                              title={copiedWriterId === writer.id ? 'تم نسخ الرابط!' : 'نسخ رابط الدخول المباشر'}
                            >
                              {copiedWriterId === writer.id ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>

                            {/* زر الواتساب - أيقونة */}
                            <button
                              type="button"
                              onClick={() => handleShareWriterWhatsApp(writer)}
                              className="p-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl transition border border-emerald-200 shadow-2xs"
                              title="مشاركة رابط الدخول عبر واتساب"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            {/* زر التعديل - أيقونة */}
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
                                setShowWriterModal(true)
                              }}
                              className="p-2 bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white rounded-xl transition border border-slate-200 shadow-2xs"
                              title="تعديل بيانات الكاتب ومناطقه"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* زر الحذف - أيقونة */}
                            <button
                              type="button"
                              onClick={() => handleDeleteWriter(writer.id, writer.name)}
                              className="p-2 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl transition border border-rose-200 shadow-2xs"
                              title="حذف الكاتب"
                            >
                              <Trash2 className="w-4 h-4" />
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
                    <span>{showSelectedOnlyCollector ? '✓ إظهار جميع المناطق' : 'المناطق المختارة فقط'}</span>
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
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-tight">
                      {editingWriter ? 'تعديل بيانات ومناطق الكاتب' : 'إضافة كاتب جديد'}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold leading-tight">حدد المناطق المخصصة لهذا الكاتب</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setShowWriterModal(false)
                    setShowSelectedOnlyWriter(false)
                  }}
                  className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* السطر الثاني: حقول الاسم والهاتف */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">اسم الكاتب:</label>
                  <input
                    type="text"
                    value={writerName}
                    onChange={(e) => setWriterName(e.target.value)}
                    placeholder="الاسم..."
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">رقم الهاتف:</label>
                  <input
                    type="text"
                    value={writerPhone}
                    onChange={(e) => setWriterPhone(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none dir-ltr text-right font-mono"
                  />
                </div>
              </div>

              {/* قسم تقييد ساعات العمل بالتوقيت العراقي */}
              <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-2.5 space-y-2">
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
                  <div className="flex flex-wrap items-center gap-3 pt-1.5 border-t border-amber-200/70">
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-700">مِـن الساعة:</span>
                      <input
                        type="time"
                        value={writerWorkHourStart}
                        onChange={(e) => setWriterWorkHourStart(e.target.value)}
                        className="text-xs font-black text-slate-900 outline-none bg-transparent cursor-pointer font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">({formatTimeArabic(writerWorkHourStart)})</span>
                    </div>

                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-amber-200 shadow-2xs">
                      <span className="text-[11px] font-bold text-slate-700">إلـى الساعة:</span>
                      <input
                        type="time"
                        value={writerWorkHourEnd}
                        onChange={(e) => setWriterWorkHourEnd(e.target.value)}
                        className="text-xs font-black text-slate-900 outline-none bg-transparent cursor-pointer font-mono"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">({formatTimeArabic(writerWorkHourEnd)})</span>
                    </div>

                    <span className="text-[11px] text-slate-600 font-bold">
                      الوقت الحالي في العراق: <strong className="text-amber-800 font-black">{getIraqCurrentTime().formatted12h}</strong>
                    </span>
                  </div>
                )}
              </div>

              {/* السطر الثالث: شريط البحث مع زر إظهار المناطق المختارة وأزرار التحديد السريع */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={writerAreaSearch}
                    onChange={(e) => setWriterAreaSearch(e.target.value)}
                    placeholder="ابحث عن اسم منطقة..."
                    className="w-full pr-7 pl-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[11px] font-bold shrink-0">
                  {/* زر إظهار المناطق المختارة فقط */}
                  <button
                    type="button"
                    onClick={() => setShowSelectedOnlyWriter(!showSelectedOnlyWriter)}
                    className={`px-3 py-1 rounded-lg transition border flex items-center gap-1.5 shadow-2xs ${
                      showSelectedOnlyWriter
                        ? 'bg-amber-600 border-amber-700 text-white font-black'
                        : 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
                    }`}
                  >
                    <span>{showSelectedOnlyWriter ? '✓ إظهار جميع المناطق' : 'المناطق المختارة فقط'}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      showSelectedOnlyWriter ? 'bg-white text-amber-700' : 'bg-amber-200 text-amber-900'
                    }`}>
                      {selectedWriterAreas.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const filteredIds = (branch.areas || [])
                        .filter(a => {
                          if (showSelectedOnlyWriter && !selectedWriterAreas.includes(a.id)) return false
                          if (writerAreaSearch && !a.name.toLowerCase().includes(writerAreaSearch.toLowerCase())) return false
                          return true
                        })
                        .map(a => a.id)
                      setSelectedWriterAreas(Array.from(new Set([...selectedWriterAreas, ...filteredIds])))
                    }}
                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition"
                  >
                    تحديد المعروض
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedWriterAreas([])}
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
                    if (showSelectedOnlyWriter && !selectedWriterAreas.includes(a.id)) return false
                    if (writerAreaSearch && !a.name.toLowerCase().includes(writerAreaSearch.toLowerCase())) return false
                    return true
                  })
                  .map(area => {
                    const isChecked = selectedWriterAreas.includes(area.id)
                    return (
                      <label
                        key={area.id}
                        className={`flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer transition border select-none text-[11px] ${
                          isChecked
                            ? 'bg-amber-50 border-amber-400 text-amber-950 font-black shadow-2xs'
                            : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 font-bold'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedWriterAreas([...selectedWriterAreas, area.id])
                            } else {
                              setSelectedWriterAreas(selectedWriterAreas.filter(id => id !== area.id))
                            }
                          }}
                          className="w-3 h-3 rounded text-amber-600 border-slate-300 cursor-pointer shrink-0"
                        />
                        <span className="truncate" title={area.name}>{area.name}</span>
                      </label>
                    )
                  })}
              </div>

              {/* رسائل التنبيه عند عدم وجود نتائج */}
              {(() => {
                const filteredCount = (branch.areas || []).filter(a => {
                  if (showSelectedOnlyWriter && !selectedWriterAreas.includes(a.id)) return false
                  if (writerAreaSearch && !a.name.toLowerCase().includes(writerAreaSearch.toLowerCase())) return false
                  return true
                }).length

                if (filteredCount === 0) {
                  return (
                    <div className="text-center py-10 text-slate-400 font-bold text-xs space-y-1">
                      {showSelectedOnlyWriter ? (
                        <>
                          <p className="text-slate-600 font-black">لم تقم بتحديد أي مناطق لهذا الكاتب حتى الآن</p>
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

            {/* أزرار الإجراءات في الأسفل مثبتة ومصغرة */}
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
                المحدد: <span className="text-amber-700 font-mono font-black text-xs">{selectedWriterAreas.length}</span> منطقة
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWriterModal(false)}
                  className="px-3.5 py-1.5 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-100 transition shadow-2xs"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveWriter}
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg transition shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>حفظ الكاتب</span>
                </button>
              </div>
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

    </div>
  )
}
