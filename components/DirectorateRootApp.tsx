'use client'

import React, { useState, useEffect } from 'react'
import { DirectorateData, DirectorateBranch, BranchManager, BranchCollector, BranchWriter } from '@/lib/directorateTypes'
import { loadDirectorateFromCloud, saveDirectorateToCloud } from '@/lib/directorateStore'
import DirectorDashboard from './DirectorDashboard'
import BranchManagerDashboard from './BranchManagerDashboard'
import DirectorLoginModal from './DirectorLoginModal'
import MainApp from './MainApp'

type ActiveView =
  | 'director_dashboard'
  | 'branch_manager'
  | 'subscriber_app'
  | 'landing'

export default function DirectorateRootApp() {
  const [directorateData, setDirectorateData] = useState<DirectorateData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // عرض الشاشة الحالي
  const [activeView, setActiveView] = useState<ActiveView>('landing')

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

  // نافذة دخول مدير الواردات
  const [showDirectorLoginModal, setShowDirectorLoginModal] = useState(false)

  // 1. تحميل بيانات المديرية من السحابة وفحص الرابط المباشر
  useEffect(() => {
    async function init() {
      setIsLoading(true)
      try {
        const data = await loadDirectorateFromCloud()
        setDirectorateData(data)

        // فحص معلمات الرابط
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search)
          const role = params.get('role')
          const token = params.get('token')
          const branchId = params.get('branch')

          // إذا كان الرابط يحمل توكن مسؤول فرع
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

          // إذا كان الرابط يحمل توكن محصل
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

          // إذا كان الرابط يحمل توكن كاتب
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
                canEdit: true, // الكاتب يملك صلاحية التعديل دائماً
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

  // دالة تحديث بيانات المديرية ككل وحفظها سحابياً
  const handleUpdateDirectorate = async (updatedData: DirectorateData) => {
    setDirectorateData(updatedData)
    await saveDirectorateToCloud(updatedData)
  }

  // دالة تحديث فرع معين
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

  // شاشة التحميل الأولية
  if (isLoading || !directorateData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white font-sans" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center font-black text-2xl shadow-xl animate-pulse mb-4">
          ماء
        </div>
        <h2 className="text-xl font-black">مديرية ماء محافظة البصرة</h2>
        <p className="text-xs text-slate-400 mt-2">جارِ تحميل البيانات السحابية والمزامنة...</p>
      </div>
    )
  }

  // 1. عرض لوحة تحكم مدير الواردات
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
          setActiveView('landing')
        }}
      />
    )
  }

  // 2. عرض لوحة تحكم مسؤول الفرع
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
          // إذا كان المدير العام يتفقد الفرع، يمكنه العودة
          const dirSession = localStorage.getItem('basra_director_session')
          if (dirSession) {
            setActiveView('director_dashboard')
          } else {
            setActiveView('landing')
          }
        }}
      />
    )
  }

  // 3. عرض تطبيق المشتركين المعتمد (MainApp) ببيانات الفرع المعزولة تماماً
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
            setActiveView('landing')
          }
        }}
      />
    )
  }

  // 4. الشاشة الرئيسية والمدخل العام لمديرية ماء البصرة
  const defaultBranch = directorateData.branches.find(b => b.id === 'branch_abi_alkhaseeb') || directorateData.branches[0]
  const defaultManager = defaultBranch?.managers[0]
  const defaultCollector = defaultBranch?.collectors[0]

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col font-sans relative overflow-hidden" dir="rtl">
      {/* خلفية جمالية */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-blue-950 opacity-90 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* الشريط العلوي */}
      <header className="relative z-10 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center font-black text-white text-lg shadow-lg">
            ماء
          </div>
          <div>
            <h1 className="text-base font-black">مديرية ماء محافظة البصرة</h1>
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowDirectorLoginModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            دخول مدير الواردات
          </button>
        </div>
      </header>

      {/* المحتوى الرئيسي */}
      <main className="relative z-10 flex-1 max-w-4xl mx-auto w-full px-4 py-12 flex flex-col justify-center">
        <div className="text-center space-y-3 mb-10">
          <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
            مديرية ماء محافظة البصرة
          </h2>
        </div>

        {/* كروت الوصول المباشر */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {defaultBranch && (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl backdrop-blur-sm space-y-4 hover:border-blue-500/50 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-cyan-400 bg-cyan-950/60 px-2.5 py-1 rounded-lg border border-cyan-800/50">
                  {defaultBranch.name}
                </span>
                <span className="text-xs text-slate-400 font-bold">
                  {defaultBranch.subscribers?.length || 0} مشترك
                </span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white">{defaultBranch.name}</h3>
                <p className="text-xs text-slate-300 mt-1">
                  المسؤول: {defaultManager ? defaultManager.name : 'علي حسين لفتة'} ({defaultManager ? defaultManager.phone : '07705666911'})
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSelectedBranch(defaultBranch)
                    setSelectedManager(defaultManager || null)
                    setActiveView('branch_manager')
                  }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black shadow-md transition flex items-center justify-center gap-2"
                >
                  فتح صفحة مسؤول الفرع
                </button>
              </div>
            </div>
          )}

          {defaultCollector && (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-3xl p-6 shadow-xl backdrop-blur-sm space-y-4 hover:border-emerald-500/50 transition">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-800/50">
                  المحصل
                </span>
                <span className="text-xs text-emerald-400 font-bold">تعديل مفعل</span>
              </div>

              <div>
                <h3 className="text-xl font-black text-white">{defaultCollector.name}</h3>
                <p className="text-xs text-slate-300 mt-1">
                  {defaultCollector.phone} - {defaultBranch?.name}
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (defaultBranch) setSelectedBranch(defaultBranch)
                    setSubscriberAppProps({
                      role: 'collector',
                      userTitle: `محصل: ${defaultCollector.name}`,
                      canEdit: true,
                      assignedAreaIds: defaultCollector.assignedAreaIds,
                      assignedSubscriberIds: defaultCollector.assignedSubscriberIds
                    })
                    setActiveView('subscriber_app')
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black shadow-md transition flex items-center justify-center gap-2"
                >
                  فتح صفحة المحصل
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={() => setShowDirectorLoginModal(true)}
            className="text-xs text-slate-400 hover:text-white underline underline-offset-4 transition"
          >
            دخول مدير الواردات
          </button>
        </div>
      </main>

      {/* نافذة دخول مدير الواردات بالرمز فقط */}
      {showDirectorLoginModal && (
        <DirectorLoginModal
          onSuccess={() => {
            setShowDirectorLoginModal(false)
            setActiveView('director_dashboard')
          }}
          onCancel={() => setShowDirectorLoginModal(false)}
        />
      )}
    </div>
  )
}
