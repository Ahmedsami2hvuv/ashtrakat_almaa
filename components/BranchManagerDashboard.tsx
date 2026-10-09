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
  X
} from 'lucide-react'

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

type TabType = 'subscribers' | 'areas' | 'collectors' | 'writers' | 'settings'

export default function BranchManagerDashboard({
  branch,
  currentManager,
  onUpdateBranch,
  onOpenSubscriberApp
}: BranchManagerDashboardProps) {
  // التبويب الافتراضي يبدأ بالمناطق لمنع تحميل ملايين المشتركين تلقائياً عند فتح الحساب
  const [activeTab, setActiveTab] = useState<TabType>('areas')
  const [isConsignmentA4Open, setIsConsignmentA4Open] = useState(false)
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

  // تحميل المشتركين تلقائياً فقط إذا فتح المسؤول تبويب المشتركين
  useEffect(() => {
    if (activeTab === 'subscribers' && !hasLoadedSubscribers) {
      fetchBranchSubscribers()
    }
  }, [activeTab, hasLoadedSubscribers])

  // حالات المناطق
  const [newAreaName, setNewAreaName] = useState('')
  const [showAreasListModal, setShowAreasListModal] = useState(false)
  const [areasListText, setAreasListText] = useState('')

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

  // حالات الكتاب
  const [showWriterModal, setShowWriterModal] = useState(false)
  const [editingWriter, setEditingWriter] = useState<BranchWriter | null>(null)
  const [writerName, setWriterName] = useState('')
  const [writerPhone, setWriterPhone] = useState('')
  const [selectedWriterAreas, setSelectedWriterAreas] = useState<string[]>([])


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
          // استخراج اسم المشترك
          const nameVal = extractFieldValue(row, [
            'اسم المشترك', 'اسم_المشترك', 'الاسم المشترك', 'الاسم الثلاثي', 'اسم', 'الاسم', 'المشترك', 'name', 'subscriber'
          ])
          const name = String(nameVal || '').trim()

          // استخراج رقم المشترك
          const idVal = extractFieldValue(row, [
            'رقم المشترك', 'رقم_المشترك', 'الرقم', 'التسلسل', 'تسلسل', 'ت', 'رقم', 'رمز المشترك', 'رمز', 'id', 'sub_id', 'no'
          ])
          
          let subId: number
          const parsedId = parseInt(String(idVal).replace(/[^\d]/g, ''), 10)
          if (!isNaN(parsedId) && parsedId > 0) {
            subId = parsedId
          } else if (name) {
            maxSubId++
            subId = maxSubId
          } else {
            // سطر فارغ تماماً نتجاهله
            return
          }

          // إذا لم يكن هناك اسم، نضع اسماً افتراضياً برقم المشترك
          const finalName = name || `مشترك رقم ${subId}`

          // استخراج المنطقة
          const areaVal = extractFieldValue(row, [
            'المنطقة', 'منطقة', 'اسم المنطقة', 'الحي', 'حي', 'المحلة', 'محلة', 'الشارع', 'area'
          ])
          const areaName = String(areaVal || '').trim()
          let assignedAreaId = ''

          if (areaName) {
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

          // استخراج اسم الكاتب
          const writerVal = extractFieldValue(row, [
            'اسم الكاتب', 'اسم_الكاتب', 'الكاتب', 'القارئ', 'الجابي', 'الموظف', 'writer', 'reader'
          ])
          const writerName = String(writerVal || '').trim()

          if (writerName) {
            const lowerWriter = writerName.toLowerCase()
            let writerObj = writerMap.get(lowerWriter)
            if (!writerObj) {
              // إنشاء حساب كاتب جديد تلقائياً
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
              // تحديث الكاتب القائم لربط المنطقة والمشترك
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

          // استخراج نوع العقار (سكني / تجاري)
          const propVal = extractFieldValue(row, [
            'نوع العقار', 'العقار', 'الصنف', 'النوع', 'سكني/تجاري', 'نوع الاشتراك', 'property', 'type'
          ])
          const propText = String(propVal || '').trim()
          let propertyType: any = 'سكني'
          if (propText.includes('تجاري')) propertyType = 'تجاري'
          else if (propText.includes('حكومي')) propertyType = 'حكومي'
          else if (propText.includes('صناعي')) propertyType = 'صناعي'

          // استخراج العداد / عدد المتر
          const meterVal = extractFieldValue(row, [
            'عدد المتر', 'المتر', 'العداد', 'نوع العداد', 'قطر العداد', 'القطر', 'meter'
          ])
          const meterText = String(meterVal || '').trim() || 'نصف انج'

          // استخراج الهاتف
          const phoneVal = extractFieldValue(row, [
            'الهاتف', 'رقم الهاتف', 'الموبايل', 'الجوال', 'phone', 'mobile'
          ])
          const phoneText = String(phoneVal || '').trim()

          // استخراج الدين السابق
          const debtVal = extractFieldValue(row, [
            'الدين السابق', 'الديون السابقة', 'المتبقي السابق', 'الرصيد السابق', 'المتبقي', 'الدين', 'الذمة', 'debt', 'balance'
          ])
          const cleanDebt = parseFloat(String(debtVal).replace(/[^\d.-]/g, '')) || 0

          // استخراج الحالات (مغلق، مهدوم، إيقاف حساب، إلخ)
          const allRowText = Object.values(row).join(' ')
          const statuses: string[] = []

          if (allRowText.includes('مغلق')) statuses.push('مغلق')
          if (allRowText.includes('مهدوم')) statuses.push('مهدوم')
          if (allRowText.includes('إيقاف') || allRowText.includes('ايقاف')) statuses.push('إيقاف حساب')
          if (allRowText.includes('متجاوز')) statuses.push('متجاوز')
          if (allRowText.includes('لا يوجد عداد')) statuses.push('لا يوجد عداد')
          if (allRowText.includes('عشوائي')) statuses.push('عشوائي')
          if (allRowText.includes('متروك')) statuses.push('متروك')

          const existingSub = subscriberIdMap.get(subId)
          if (existingSub) {
            // تحديث بيانات المشترك
            existingSub.name = finalName
            if (phoneText) existingSub.phone = phoneText
            if (assignedAreaId) existingSub.areaId = assignedAreaId
            existingSub.propertyType = propertyType
            existingSub.meterType = meterText as any
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
              detailedAddress: areaName ? `المنطقة: ${areaName}` : 'تم الاستيراد من ملف إكسل',
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

          if (previewRows.length < 8) {
            previewRows.push({
              id: subId,
              name: finalName,
              area: areaName || 'بدون منطقة',
              writer: writerName || 'بدون كاتب',
              property: propertyType,
              meter: meterText,
              debt: cleanDebt,
              statuses: statuses.join(', ') || 'طبيعي'
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

  // تأكيد حفظ بيانات الإكسل في الفرع
  const handleConfirmExcelImport = () => {
    if (!excelPreviewResult) return

    const newSubs = excelPreviewResult.subscribers
    setLoadedSubscribers(newSubs)
    setHasLoadedSubscribers(true)
    saveBranchSubscribersAndBilling(branch.id, newSubs, loadedBilling)

    onUpdateBranch({
      ...branch,
      areas: excelPreviewResult.areas,
      writers: excelPreviewResult.writers,
      subscribersCount: newSubs.length,
      subscribers: []
    })

    const msg = `تم الاستيراد بنجاح!
• المشتركون الجدد: ${excelPreviewResult.newSubscribersCount}
• المشتركون المحدثون: ${excelPreviewResult.updatedSubscribersCount}
• المناطق الجديدة المضافة: ${excelPreviewResult.newAreasCount}
• حسابات الكتاب الجديدة المنشأة: ${excelPreviewResult.newWritersCount}`

    alert(msg)
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
              assignedAreaIds: selectedWriterAreas
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

  if (isConsignmentA4Open) {
    return (
      <ConsignmentsA4Page
        branch={branch}
        onSaveConsignment={handleSaveConsignmentA4}
        onClose={() => setIsConsignmentA4Open(false)}
      />
    )
  }

  const navItems = [
    { id: 'subscribers', label: 'المشتركون', icon: Users, count: stats.totalSubscribers },
    { id: 'areas', label: 'المناطق', icon: MapPin, count: stats.totalAreas },
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

          <button
            onClick={() => setIsConsignmentA4Open(true)}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>طباعة الإرساليات (A4)</span>
          </button>
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
                    <span>🔄</span>
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

                  {/* بلوك الأزرار التفاعلي للمشتركين المحددين (يظهر فوراً هنا أمام المسؤول) */}
                  {selectedSubIds.size > 0 && (
                    <div
                      style={{
                        padding: '12px 16px',
                        backgroundColor: '#ffffff',
                        border: '2px solid #3b82f6',
                        borderRadius: '16px',
                        boxShadow: '0 4px 16px rgba(59, 130, 246, 0.18)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '18px' }}>⚡</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a' }}>
                            خيارات التعامل مع المشتركين المحددين ({selectedSubIds.size} مشترك):
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700 }}>
                            انقر على أي خيار أدناه لتخصيصهم فوراً:
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                        {/* 1. تخصيص لمناطق */}
                        <button
                          type="button"
                          onClick={() => {
                            setBulkSelectedAreaIds([])
                            setBulkAreaSearch('')
                            setShowAssignAreasModal(true)
                          }}
                          style={{
                            padding: '9px 18px',
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
                            boxShadow: '0 2px 8px rgba(5, 150, 105, 0.35)'
                          }}
                        >
                          <MapPin style={{ width: '16px', height: '16px' }} />
                          <span>تخصيص لمناطق</span>
                        </button>

                        {/* 2. تخصيص لكتّاب */}
                        <button
                          type="button"
                          onClick={() => {
                            setBulkSelectedWriterIds([])
                            setShowAssignWritersModal(true)
                          }}
                          style={{
                            padding: '9px 18px',
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
                            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.35)'
                          }}
                        >
                          <BookOpen style={{ width: '16px', height: '16px' }} />
                          <span>تخصيص لكتّاب</span>
                        </button>

                        {/* 3. تخصيص لمحصلين */}
                        <button
                          type="button"
                          onClick={() => {
                            setBulkSelectedCollectorIds([])
                            setShowAssignCollectorsModal(true)
                          }}
                          style={{
                            padding: '9px 18px',
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
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)'
                          }}
                        >
                          <Wallet style={{ width: '16px', height: '16px' }} />
                          <span>تخصيص لمحصلين</span>
                        </button>
                      </div>
                    </div>
                  )}
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
                          <th className="p-3">النوع/العداد</th>
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
                                if (isSelectMode) toggleSelectSubscriber(sub.id)
                              }}
                              className={`font-bold transition ${
                                isSelectMode ? 'cursor-pointer select-none' : ''
                              } ${
                                isSelected
                                  ? 'bg-blue-50/90 text-blue-950 ring-1 ring-inset ring-blue-300'
                                  : 'hover:bg-slate-50'
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
                                <div>{sub.name}</div>
                                {sub.phone && <div className="text-[10px] text-slate-400 font-mono font-normal">{sub.phone}</div>}
                              </td>
                              <td className="p-3 text-slate-600">
                                <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md text-[11px]">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{assignedAreaNames}</span>
                                </span>
                              </td>
                              <td className="p-3 text-slate-500">{sub.propertyType} - {sub.meterType}</td>
                              <td className="p-3 text-rose-600 font-mono">{(sub.remainingPrev || 0).toLocaleString('ar-IQ')} د.ع</td>
                            </tr>
                          )
                        })}
                        {filteredSubscribers.length === 0 && (
                          <tr>
                            <td colSpan={isSelectMode ? 6 : 5} className="text-center py-8 text-slate-400 font-bold">
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
                          <span>✅ تم تحديد</span>
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

          {/* تبويب المناطق */}
          {activeTab === 'areas' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">المناطق المشمولة بالفرع</h3>
                  <p className="text-xs text-slate-500">إدارة وتقسيم مناطق الجباية (إجمالي المناطق: {(branch.areas || []).length})</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setExcelPreviewResult(null)
                      setExcelError(null)
                      setShowExcelModal(true)
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>استيراد من إكسل</span>
                  </button>

                  {/* زر إضافة قائمة مناطق بسطور متعددة */}
                  <button
                    onClick={() => setShowAreasListModal(true)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    <span>إضافة قائمة مناطق (كل منطقة بسطر)</span>
                  </button>

                  {/* نموذج إضافة سريعة لمنطقة واحدة */}
                  <form onSubmit={handleAddArea} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newAreaName}
                      onChange={(e) => setNewAreaName(e.target.value)}
                      placeholder="اسم منطقة مفردة..."
                      className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shrink-0 shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة</span>
                    </button>
                  </form>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {(branch.areas || []).map((area) => {
                  const subsInArea = (branch.subscribers || []).filter(s => s.areaId === area.id).length
                  return (
                    <div
                      key={area.id}
                      className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-100 text-blue-700 rounded-xl">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900 text-sm">{area.name}</h4>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5">{subsInArea} مشترك مسجل</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteArea(area.id, area.name)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition"
                        title="حذف المنطقة"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* تبويب المحصلين */}
          {activeTab === 'collectors' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">كادر المحصلين</h3>
                  <p className="text-xs text-slate-500">إدارة وتخصيص صلاحيات المحصلين الميدانيين</p>
                </div>

                <button
                  onClick={() => {
                    setEditingCollector(null)
                    setCollectorName('')
                    setCollectorPhone('')
                    setCollectorCanEdit(false)
                    setSelectedCollectorAreas([])
                    setShowCollectorModal(true)
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>محصل جديد</span>
                </button>
              </div>

              {(!branch.collectors || branch.collectors.length === 0) ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Wallet className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">لا يوجد محصلون مسجلون حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branch.collectors.map((collector) => (
                    <div
                      key={collector.id}
                      className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <h4 className="font-black text-slate-900 text-sm">{collector.name}</h4>
                          <p className="text-xs font-mono text-slate-500 dir-ltr text-right">{collector.phone}</p>
                          <div className="flex items-center gap-1.5 pt-1">
                            {collector.canEdit ? (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                <CheckCircle2 className="w-3 h-3" /> مسموح بالتعديل
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">
                                <XCircle className="w-3 h-3" /> للقراءة فقط
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleToggleCollectorEdit(collector.id, collector.canEdit)}
                          className={`text-[10px] px-2.5 py-1 rounded-xl font-bold transition border ${
                            collector.canEdit
                              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {collector.canEdit ? 'إيقاف التعديل' : 'سماح بالتعديل'}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() =>
                            onOpenSubscriberApp({
                              role: 'collector',
                              userTitle: `محصل: ${collector.name}`,
                              canEdit: collector.canEdit,
                              assignedAreaIds: collector.assignedAreaIds,
                              assignedSubscriberIds: collector.assignedSubscriberIds
                            })
                          }
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح الحساب</span>
                        </button>

                        <button
                          onClick={() => handleShareCollectorWhatsApp(collector)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>مشاركة</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingCollector(collector)
                            setCollectorName(collector.name)
                            setCollectorPhone(collector.phone)
                            setCollectorCanEdit(collector.canEdit)
                            setSelectedCollectorAreas(collector.assignedAreaIds || [])
                            setShowCollectorModal(true)
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => handleDeleteCollector(collector.id, collector.name)}
                          className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* تبويب الكتّاب */}
          {activeTab === 'writers' && (
            <div className="bg-white rounded-2xl p-4 md:p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base md:text-lg font-black text-slate-900">كادر الكتّاب</h3>
                  <p className="text-xs text-slate-500">إدارة صلاحيات إدخال وتحديث بيانات القراءات</p>
                </div>

                <button
                  onClick={() => {
                    setEditingWriter(null)
                    setWriterName('')
                    setWriterPhone('')
                    setSelectedWriterAreas([])
                    setShowWriterModal(true)
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>كاتب جديد</span>
                </button>
              </div>

              {(!branch.writers || branch.writers.length === 0) ? (
                <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <BookOpen className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-500">لا يوجد كتاب مسجلون حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branch.writers.map((writer) => (
                    <div
                      key={writer.id}
                      className="bg-slate-50 p-4.5 rounded-2xl border border-slate-200 space-y-4"
                    >
                      <div className="space-y-1">
                        <h4 className="font-black text-slate-900 text-sm">{writer.name}</h4>
                        <p className="text-xs font-mono text-slate-500 dir-ltr text-right">{writer.phone}</p>
                        <span className="inline-block text-[10px] bg-purple-100 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-bold">
                          صلاحية تعديل الديون
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                        <button
                          onClick={() =>
                            onOpenSubscriberApp({
                              role: 'writer',
                              userTitle: `كاتب: ${writer.name}`,
                              canEdit: true,
                              assignedAreaIds: writer.assignedAreaIds,
                              assignedSubscriberIds: writer.assignedSubscriberIds
                            })
                          }
                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>فتح الحساب</span>
                        </button>

                        <button
                          onClick={() => handleShareWriterWhatsApp(writer)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>مشاركة</span>
                        </button>

                        <button
                          onClick={() => {
                            setEditingWriter(writer)
                            setWriterName(writer.name)
                            setWriterPhone(writer.phone)
                            setSelectedWriterAreas(writer.assignedAreaIds || [])
                            setShowWriterModal(true)
                          }}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>

                        <button
                          onClick={() => handleDeleteWriter(writer.id, writer.name)}
                          className="px-3 py-1.5 bg-rose-100 text-rose-700 hover:bg-rose-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  ))}
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
                className="text-slate-400 hover:text-slate-600 font-black text-lg p-1"
              >
                ✕
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
                className="w-8 h-8 flex items-center justify-center bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition font-black text-sm shadow-sm"
                title="إغلاق النافذة"
              >
                ✕
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
                          <th className="p-2">الرقم</th>
                          <th className="p-2">الاسم</th>
                          <th className="p-2">المنطقة</th>
                          <th className="p-2">الكاتب</th>
                          <th className="p-2">العقار/العداد</th>
                          <th className="p-2">الحالة</th>
                          <th className="p-2">الدين السابق</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {excelPreviewResult.previewRows.map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50 font-bold">
                            <td className="p-2 font-mono text-blue-700">{r.id}</td>
                            <td className="p-2 text-slate-900">{r.name}</td>
                            <td className="p-2 text-slate-600">{r.area}</td>
                            <td className="p-2 text-slate-600">{r.writer}</td>
                            <td className="p-2 text-slate-500">{r.property} - {r.meter}</td>
                            <td className="p-2 text-amber-700">{r.statuses}</td>
                            <td className="p-2 font-mono text-rose-600">{r.debt.toLocaleString('ar-IQ')} د.ع</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* أزرار الإجراءات */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setExcelPreviewResult(null)}
                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                  >
                    اختيار ملف آخر
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowExcelModal(false)
                        setExcelPreviewResult(null)
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
                    >
                      إلغاء
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmExcelImport}
                      className="px-4.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>تأكيد واستيراد</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل محصل */}
      {showCollectorModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-black text-slate-900">
              {editingCollector ? 'تعديل بيانات المحصل' : 'إضافة محصل جديد'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الثلاثي:</label>
                <input
                  type="text"
                  value={collectorName}
                  onChange={(e) => setCollectorName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={collectorPhone}
                  onChange={(e) => setCollectorPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={collectorCanEdit}
                    onChange={(e) => setCollectorCanEdit(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded bg-white border-slate-300"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    السماح بالتعديل على المشتركين والديون
                  </span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المناطق المخصصة:</label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  {(branch.areas || []).map(area => (
                    <label key={area.id} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedCollectorAreas.includes(area.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCollectorAreas([...selectedCollectorAreas, area.id])
                          } else {
                            setSelectedCollectorAreas(selectedCollectorAreas.filter(id => id !== area.id))
                          }
                        }}
                        className="rounded text-blue-600 bg-white border-slate-300"
                      />
                      <span>{area.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowCollectorModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCollector}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                حفظ المحصل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* نافذة إضافة / تعديل كاتب */}
      {showWriterModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-base font-black text-slate-900">
              {editingWriter ? 'تعديل بيانات الكاتب' : 'إضافة كاتب جديد'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الكاتب:</label>
                <input
                  type="text"
                  value={writerName}
                  onChange={(e) => setWriterName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف:</label>
                <input
                  type="text"
                  value={writerPhone}
                  onChange={(e) => setWriterPhone(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none dir-ltr text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المناطق المخصصة:</label>
                <div className="max-h-32 overflow-y-auto space-y-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                  {(branch.areas || []).map(area => (
                    <label key={area.id} className="flex items-center gap-2 cursor-pointer font-bold text-slate-700">
                      <input
                        type="checkbox"
                        checked={selectedWriterAreas.includes(area.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedWriterAreas([...selectedWriterAreas, area.id])
                          } else {
                            setSelectedWriterAreas(selectedWriterAreas.filter(id => id !== area.id))
                          }
                        }}
                        className="rounded text-blue-600 bg-white border-slate-300"
                      />
                      <span>{area.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => setShowWriterModal(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveWriter}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition"
              >
                حفظ الكاتب
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignWritersModal(false)}
                disabled={isBulkSaving}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleBulkAssignWriters}
                disabled={isBulkSaving || bulkSelectedWriterIds.length === 0}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-amber-900/20"
              >
                {isBulkSaving ? <span>جارِ الحفظ...</span> : <span>تطبيق التخصيص للكتّاب ({bulkSelectedWriterIds.length})</span>}
              </button>
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

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAssignCollectorsModal(false)}
                disabled={isBulkSaving}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleBulkAssignCollectors}
                disabled={isBulkSaving || bulkSelectedCollectorIds.length === 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-blue-900/20"
              >
                {isBulkSaving ? <span>جارِ الحفظ...</span> : <span>تطبيق التخصيص للمحصلين ({bulkSelectedCollectorIds.length})</span>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
