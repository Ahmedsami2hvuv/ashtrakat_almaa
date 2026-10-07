'use client'

import React, { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { DirectorateData, DirectorateBranch, BranchManager, BranchCollector, BranchWriter } from '@/lib/directorateTypes'
import { loadDirectorateFromCloud, saveDirectorateToCloud } from '@/lib/directorateStore'

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

  // حالة المشتركين المنفصلة
  const [subscriberAppProps, setSubscriberAppProps] = useState<{
    role: 'manager' | 'collector' | 'writer'
    userTitle: string
    canEdit: boolean
    assignedAreaIds?: string[]
    assignedSubscriberIds?: number[]
  } | null>(null)

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
          if (role === 'manager' && token) {
            const foundBranch = data.branches.find(b =>
              b.managers?.some(m => m.token === token) || (branchId && b.id === branchId)
            ) || data.branches[0]

            const foundManager = foundBranch?.managers?.find(m => m.token === token)
            if (foundBranch) {
              setSelectedBranch(foundBranch)
              setSelectedManager(foundManager || null)
              setActiveView('branch_manager')
              setIsLoading(false)
              return
            }
          }

          // إذا كان الرابط رابطاً مباشراً لمحصل
          if (role === 'collector' && token) {
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

            if (matchedBranch && matchedCollector) {
              setSelectedBranch(matchedBranch)
              setSubscriberAppProps({
                role: 'collector',
                userTitle: `محصل: ${matchedCollector.name} (${matchedBranch.name})`,
                canEdit: matchedCollector.canEdit,
                assignedAreaIds: matchedCollector.assignedAreaIds,
                assignedSubscriberIds: matchedCollector.assignedSubscriberIds
              })
              setActiveView('subscriber_app')
              setIsLoading(false)
              return
            }
          }

          // إذا كان الرابط رابطاً مباشراً لكاتب
          if (role === 'writer' && token) {
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

            if (matchedBranch && matchedWriter) {
              setSelectedBranch(matchedBranch)
              setSubscriberAppProps({
                role: 'writer',
                userTitle: `كاتب: ${matchedWriter.name} (${matchedBranch.name})`,
                canEdit: true,
                assignedAreaIds: matchedWriter.assignedAreaIds,
                assignedSubscriberIds: matchedWriter.assignedSubscriberIds
              })
              setActiveView('subscriber_app')
              setIsLoading(false)
              return
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
          setSelectedBranch(branch)
          setSelectedManager(manager)
          setActiveView('branch_manager')
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
          setSubscriberAppProps(params)
          setActiveView('subscriber_app')
        }}
        onBackToDirector={() => {
          const dirSession = localStorage.getItem('basra_director_session')
          if (dirSession) {
            setActiveView('director_dashboard')
          } else {
            setActiveView('director_login')
          }
        }}
      />
    )
  }

  // 3. تطبيق المشتركين المعتمد (MainApp)
  if (activeView === 'subscriber_app') {
    return (
      <MainApp
        branchId={selectedBranch?.id}
        initialSubscribers={selectedBranch?.subscribers || []}
        initialAreas={selectedBranch?.areas || []}
        initialBilling={selectedBranch?.billing || {}}
        initialPricing={selectedBranch?.pricing}
        initialAiApiKeys={selectedBranch?.aiApiKeys || []}
        onSaveBranchData={(branchData) => {
          if (!selectedBranch) return
          const updatedBranch: DirectorateBranch = {
            ...selectedBranch,
            subscribers: branchData.subscribers,
            areas: branchData.areas,
            billing: branchData.billing,
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
        onBack={() => {
          if (selectedBranch) {
            setActiveView('branch_manager')
          } else {
            setActiveView('director_login')
          }
        }}
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
