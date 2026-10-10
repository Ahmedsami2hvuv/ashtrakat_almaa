'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { DirectorateData, DirectorateBranch, BranchManager, BranchCollector, BranchWriter } from '@/lib/directorateTypes'
import { loadDirectorateFromCloud, saveDirectorateToCloud, loadBranchSubscribersAndBilling, saveBranchSubscribersAndBilling } from '@/lib/directorateStore'
import { Subscriber, BillingRecords } from '@/components/MainApp'

const DirectorDashboard = dynamic(() => import('./DirectorDashboard'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white font-black" dir="rtl">
      جاري تحميل لوحة التحكم...
    </div>
  )
})

const BranchManagerDashboard = dynamic(() => import('./BranchManagerDashboard'), { ssr: false })
const MainApp = dynamic(() => import('./MainApp'), { ssr: false })

type ActiveView =
  | 'director_login'
  | 'director_dashboard'
  | 'branch_manager'
  | 'subscriber_app'

export default function DirectorateRootApp() {
  const [directorateData, setDirectorateData] = useState<DirectorateData | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('basra_water_directorate_cache')
        if (cached) return JSON.parse(cached)
      } catch {}
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return !localStorage.getItem('basra_water_directorate_cache')
      } catch {}
    }
    return true
  })

  // عرض الشاشة الحالي - الرابط الرئيسي يبدأ بصفحة مدير الواردات
  const [activeView, setActiveView] = useState<ActiveView>('director_login')

  // حقول دخول مدير الواردات
  const [directorPin, setDirectorPin] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // المدير الحالي أو الفرع المختار
  const [selectedBranch, setSelectedBranch] = useState<DirectorateBranch | null>(null)
  const [selectedManager, setSelectedManager] = useState<BranchManager | null>(null)

  // بيانات المشتركين الخاصة بالفرع المحملة عند الطلب فقط
  const [subscriberAppData, setSubscriberAppData] = useState<{
    subscribers: Subscriber[]
    billing: BillingRecords
  }>({ subscribers: [], billing: {} })
  const [isLoadingSubscriberApp, setIsLoadingSubscriberApp] = useState(false)

  // حالة المشتركين المنفصلة
  const [subscriberAppProps, setSubscriberAppProps] = useState<{
    role: 'manager' | 'collector' | 'writer'
    userTitle: string
    canEdit: boolean
    assignedAreaIds?: string[]
    assignedSubscriberIds?: number[]
  } | null>(null)

  // دالة فتح تطبيق المشتركين مع جلب بيانات هذا الفرع حصراً عند الطلب
  const handleOpenSubscriberApp = async (branch: DirectorateBranch, params: any) => {
    setIsLoadingSubscriberApp(true)
    setSelectedBranch(branch)
    setSubscriberAppProps(params)
    try {
      const data = await loadBranchSubscribersAndBilling(branch.id)
      setSubscriberAppData({
        subscribers: data.subscribers,
        billing: data.billing
      })
      setActiveView('subscriber_app')
    } catch (err) {
      console.error('Failed to load subscriber app data:', err)
    } finally {
      setIsLoadingSubscriberApp(false)
    }
  }

  // 1. تحميل بيانات المديرية من السحابة وفحص الرابط المباشر
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        const data = await loadDirectorateFromCloud()
        setDirectorateData(data)

        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const role = params.get('role')
          const token = params.get('token')
          const branchId = params.get('branch')

          // إذا كان الرابط رابطاً مباشراً لمسؤول فرع
          if (role === 'manager') {
            if (!token) {
              window.history.replaceState({}, '', '/')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }

            // حظر فوري وقاطع للرابط القديم الذي يحتوي على رقم الهاتف لأسباب أمنية
            if (token === 'mgr_ali_07705666911' || token.includes('07705666911')) {
              window.history.replaceState({}, '', '/')
              alert('تم إلغاء وحرق هذا الرابط القديم المكشوف نهائياً لأسباب أمنية!\nيرجى استخدام الرابط الجديد المشفر من لوحة تحكم مدير الواردات.')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }

            // البحث الصارم عن الفرع الذي يحمل هذا التوكن السري حصراً
            const foundBranch = data.branches.find(b =>
              b.managers?.some(m => m.token === token)
            )

            // التحقق القاطع: يجب أن يتطابق التوكن مع الفرع المخصص له تحديداً
            if (foundBranch && (!branchId || foundBranch.id === branchId)) {
              const foundManager = foundBranch.managers?.find(m => m.token === token)
              setSelectedBranch(foundBranch)
              setSelectedManager(foundManager || null)
              setActiveView('branch_manager')
              setIsLoading(false)
              return
            } else {
              // تم التلاعب باسم الفرع أو أن التوكن غير صحيح: حظر الدخول فوراً
              window.history.replaceState({}, '', '/')
              alert('عفواً، رابط الدخول غير صالح أو تم التلاعب بمعلومات الفرع!')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }
          }

          // إذا كان الرابط رابطاً مباشراً لمحصل
          if (role === 'collector') {
            if (!token) {
              window.history.replaceState({}, '', '/')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }

            // حظر فوري وقاطع للرابط القديم الذي يحتوي على رقم الهاتف لأسباب أمنية
            if (token === 'col_ahmed_07733921468' || token.includes('07733921468')) {
              window.history.replaceState({}, '', '/')
              alert('تم إلغاء وحرق هذا الرابط القديم المكشوف نهائياً لأسباب أمنية!\nيرجى استخدام الرابط الجديد المشفر من لوحة تحكم مدير الواردات.')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }

            let matchedBranch: DirectorateBranch | null = null
            let matchedCollector: BranchCollector | null = null

            for (const b of data.branches) {
              const col = b.collectors?.find(c => c.token === token)
              if (col) {
                matchedBranch = b
                matchedCollector = col
                break
              }
            }

            if (matchedBranch && matchedCollector && (!branchId || matchedBranch.id === branchId)) {
              setSelectedBranch(matchedBranch)
              const subsData = await loadBranchSubscribersAndBilling(matchedBranch.id)
              setSubscriberAppData(subsData)
              const props = {
                role: 'collector' as const,
                userTitle: `محصل: ${matchedCollector.name}`,
                canEdit: false,
                assignedAreaIds: matchedCollector.assignedAreaIds,
                assignedSubscriberIds: matchedCollector.assignedSubscriberIds
              }
              setSubscriberAppProps(props)

              // حفظ جلسة المحصل بالهاتف لفتح التطبيق بدون إنترنت دائماً
              try {
                localStorage.setItem(
                  'ashtrakat_collector_session',
                  JSON.stringify({
                    branchId: matchedBranch.id,
                    token: matchedCollector.token,
                    name: matchedCollector.name,
                    branchName: matchedBranch.name,
                    canEdit: false,
                    assignedAreaIds: matchedCollector.assignedAreaIds,
                    assignedSubscriberIds: matchedCollector.assignedSubscriberIds
                  })
                )
              } catch {}

              setActiveView('subscriber_app')
              setIsLoading(false)
              return
            } else {
              window.history.replaceState({}, '', '/')
              alert('عفواً، رابط الدخول غير صالح أو تم التلاعب بمعلومات الفرع!')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }
          }

          // إذا كان الرابط رابطاً مباشراً لكاتب
          if (role === 'writer') {
            if (!token) {
              window.history.replaceState({}, '', '/')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }

            let matchedBranch: DirectorateBranch | null = null
            let matchedWriter: BranchWriter | null = null

            for (const b of data.branches) {
              const w = b.writers?.find(x => x.token === token)
              if (w) {
                matchedBranch = b
                matchedWriter = w
                break
              }
            }

            if (matchedBranch && matchedWriter && (!branchId || matchedBranch.id === branchId)) {
              setSelectedBranch(matchedBranch)
              const subsData = await loadBranchSubscribersAndBilling(matchedBranch.id)
              setSubscriberAppData(subsData)
              setSubscriberAppProps({
                role: 'writer',
                userTitle: `كاتب: ${matchedWriter.name}`,
                canEdit: true,
                assignedAreaIds: matchedWriter.assignedAreaIds,
                assignedSubscriberIds: matchedWriter.assignedSubscriberIds
              })
              setActiveView('subscriber_app')
              setIsLoading(false)
              return
            } else {
              window.history.replaceState({}, '', '/')
              alert('عفواً، رابط الدخول غير صالح أو تم التلاعب بمعلومات الفرع!')
              setActiveView('director_login')
              setIsLoading(false)
              return
            }
          }

          // فحص جلسة المحصل المحفوظة بالهاتف أولاً (لتمكين الفتح المباشر دون نت)
          const savedCollectorStr = localStorage.getItem('ashtrakat_collector_session')
          if (savedCollectorStr) {
            try {
              const colSess = JSON.parse(savedCollectorStr)
              const foundBranch = data.branches.find(b => b.id === colSess.branchId) || data.branches[0]
              if (foundBranch) {
                setSelectedBranch(foundBranch)
                const subsData = await loadBranchSubscribersAndBilling(foundBranch.id)
                setSubscriberAppData(subsData)
                setSubscriberAppProps({
                  role: 'collector',
                  userTitle: `محصل: ${colSess.name}`,
                  canEdit: false,
                  assignedAreaIds: colSess.assignedAreaIds,
                  assignedSubscriberIds: colSess.assignedSubscriberIds
                })
                setActiveView('subscriber_app')
                setIsLoading(false)
                return
              }
            } catch (e) {
              console.error('Error loading saved collector session:', e)
            }
          }

          // فحص جلسة مدير الواردات المحفوظة
          const dirSession = localStorage.getItem('basra_director_session')
          if (dirSession) {
            setActiveView('director_dashboard')
            setIsLoading(false)
            return
          } else {
            // الرابط الرئيسي بدون توكن يفتح صفحة دخول مدير الواردات حصراً
            setActiveView('director_login')
            setIsLoading(false)
            return
          }
        }
      } catch (err) {
        console.error('Initialization error:', err)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  // دالة تسجيل دخول مدير الواردات بالرمز فقط
  const handleDirectorLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!directorPin.trim()) {
      setLoginError('يرجى إدخال الرمز')
      return
    }

    setIsLoggingIn(true)
    setLoginError(null)

    try {
      const res = await fetch('/api/auth/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: directorPin.trim() })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        localStorage.setItem('basra_director_session', data.token)
        setActiveView('director_dashboard')
      } else {
        setLoginError('الرمز غير صحيح')
      }
    } catch {
      setLoginError('خطأ في الاتصال')
    } finally {
      setIsLoggingIn(false)
    }
  }

  // تحديث بيانات المديرية وحفظها سحابياً
  const handleUpdateDirectorate = async (updatedData: DirectorateData) => {
    setDirectorateData(updatedData)
    await saveDirectorateToCloud(updatedData)
  }

  // تحديث فرع معين
  const handleUpdateBranch = async (updatedBranch: DirectorateBranch) => {
    if (!directorateData) return
    const updatedBranches = directorateData.branches.map(b =>
      b.id === updatedBranch.id ? updatedBranch : b
    )
    const updatedDirectorate: DirectorateData = {
      ...directorateData,
      branches: updatedBranches
    }
    setDirectorateData(updatedDirectorate)
    setSelectedBranch(updatedBranch)
    await saveDirectorateToCloud(updatedDirectorate)
  }

  // شاشة التحميل
  if (isLoading || !directorateData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-2xl shadow-xl animate-pulse mb-4">
          ماء
        </div>
        <h2 className="text-xl font-black">مديرية ماء محافظة البصرة</h2>
      </div>
    )
  }

  // 1. لوحة تحكم مدير الواردات
  if (activeView === 'director_dashboard') {
    return (
      <DirectorDashboard
        directorateData={directorateData}
        onUpdateDirectorate={handleUpdateDirectorate}
        onVisitBranchManager={(branch, manager) => {
          const origin = typeof window !== 'undefined' ? window.location.origin : ''
          const directLink = `${origin}/?role=manager&token=${manager.token}&branch=${branch.id}`
          window.open(directLink, '_blank')
        }}
        onLogout={() => {
          localStorage.removeItem('basra_director_session')
          setDirectorPin('')
          setActiveView('director_login')
        }}
      />
    )
  }

  // 2. لوحة تحكم مسؤول الفرع
  if (activeView === 'branch_manager' && selectedBranch) {
    return (
      <BranchManagerDashboard
        branch={selectedBranch}
        currentManager={selectedManager || selectedBranch.managers[0]}
        onUpdateBranch={handleUpdateBranch}
        onOpenSubscriberApp={(params) => {
          handleOpenSubscriberApp(selectedBranch, params)
        }}
      />
    )
  }

  // شاشة تحميل نظام المشتركين عند الطلب
  if (isLoadingSubscriberApp) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-2xl shadow-xl animate-pulse mb-4">
          ماء
        </div>
        <h2 className="text-xl font-black">جارِ تحميل قاعدة بيانات المشتركين...</h2>
        <p className="text-sm text-slate-400 mt-2">يتم استدعاء بيانات الفرع المختار فقط من السحابة</p>
      </div>
    )
  }

  // 3. تطبيق المشتركين المعتمد (MainApp)
  if (activeView === 'subscriber_app') {
    return (
      <MainApp
        branchId={selectedBranch?.id}
        initialSubscribers={subscriberAppData.subscribers}
        initialAreas={selectedBranch?.areas || []}
        initialBilling={subscriberAppData.billing}
        initialPricing={selectedBranch?.pricing}
        initialAiApiKeys={selectedBranch?.aiApiKeys || []}
        onSaveBranchData={async (branchData) => {
          if (!selectedBranch) return
          // حفظ المشتركين في المفتاح السحابي المنفصل للفرع حصراً دون إثقال قاعدة البيانات
          await saveBranchSubscribersAndBilling(selectedBranch.id, branchData.subscribers, branchData.billing)
          setSubscriberAppData({
            subscribers: branchData.subscribers,
            billing: branchData.billing
          })
          const updatedBranch: DirectorateBranch = {
            ...selectedBranch,
            subscribersCount: branchData.subscribers.length,
            subscribers: [],
            areas: branchData.areas,
            billing: {},
            pricing: branchData.pricing,
            aiApiKeys: branchData.aiApiKeys
          }
          handleUpdateBranch(updatedBranch)
        }}
        userRole={subscriberAppProps?.role || 'collector'}
        canEdit={subscriberAppProps?.canEdit ?? true}
        assignedAreaIds={subscriberAppProps?.assignedAreaIds}
        assignedSubscriberIds={subscriberAppProps?.assignedSubscriberIds}
        customHeaderTitle={subscriberAppProps?.userTitle || 'نظام الاشتراكات'}
        bypassAuth={true}
        onBack={
          subscriberAppProps?.role === 'manager'
            ? () => {
                if (selectedBranch) {
                  setActiveView('branch_manager')
                } else {
                  setActiveView('director_login')
                }
              }
            : undefined
        }
      />
    )
  }

  // 4. الرابط الرئيسي: صفحة مدير واردات البصرة حصراً (طلب الرمز فقط)
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 font-sans text-white select-none" dir="rtl">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-black text-2xl mx-auto mb-4 shadow-lg shadow-blue-600/30">
          ماء
        </div>

        <h1 className="text-xl font-black text-white">مديرية ماء محافظة البصرة</h1>
        <h2 className="text-xs font-bold text-blue-400 mt-1 mb-6">مدير الواردات</h2>

        <form onSubmit={handleDirectorLoginSubmit} className="space-y-4">
          <div className="text-right">
            <input
              type="password"
              value={directorPin}
              onChange={(e) => setDirectorPin(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-center font-mono text-lg text-white focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {loginError && (
            <div className="p-2.5 bg-rose-950/60 border border-rose-800 text-rose-300 text-xs font-bold rounded-xl text-center">
              {loginError}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-sm rounded-2xl shadow-lg transition disabled:opacity-50"
          >
            {isLoggingIn ? 'جارِ التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
