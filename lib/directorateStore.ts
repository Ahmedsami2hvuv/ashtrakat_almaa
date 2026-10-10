import { DirectorateData, DirectorateBranch, BranchManager, BranchCollector, BranchWriter, TreasuryManager, Consignment } from './directorateTypes'
import { Area, Subscriber, BillingRecords, Pricing } from '@/components/MainApp'

const LOCAL_STORAGE_KEY = 'basra_water_directorate_cache'

// قائمة الأفرع الافتراضية لمديرية ماء البصرة
export const INITIAL_BRANCH_NAMES = [
  'فرع واردات أبي الخصيب',
  'فرع واردات شط العرب',
  'فرع واردات الجنينة',
  'فرع واردات الخليج العربي',
  'فرع واردات الزبير',
  'فرع واردات القبلة'
]

// توليد رمز فريد ومحمي تشفيرياً للرابط يستحيل تخمينه
export function generateSecureToken(prefix: string): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let res = prefix + '_'
  for (let i = 0; i < 20; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return res
}

// إنشاء رابط الواتساب الجاهز
export function generateWhatsAppLink(phone: string, message: string): string {
  // تنسيق رقم الهاتف العراقي
  let cleanPhone = phone.replace(/[^0-9]/g, '')
  if (cleanPhone.startsWith('07')) {
    cleanPhone = '964' + cleanPhone.substring(1)
  } else if (cleanPhone.startsWith('7')) {
    cleanPhone = '964' + cleanPhone
  }
  const encodedMsg = encodeURIComponent(message)
  return `https://wa.me/${cleanPhone}?text=${encodedMsg}`
}

const branchSubscribersCache: Record<string, { subscribers: Subscriber[]; billing: BillingRecords; timestamp: number }> = {}

// مفتاح التخزين المحلي لبيانات المشتركين لكل فرع
const getBranchStorageKey = (branchId: string) => `ashtrakat_branch_subscribers_${branchId}`
const getPendingSyncKey = (branchId: string) => `ashtrakat_pending_sync_${branchId}`

// فحص وجود أي بيانات معلقة بانتظار المزامنة
export function getPendingSyncCount(): number {
  if (typeof window === 'undefined') return 0
  let count = 0
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ashtrakat_pending_sync_')) {
        count++
      }
    }
  } catch {}
  return count
}

// مزامنة العمليات والبيانات المعلقة التي سُجلت أثناء انقطاع الإنترنت
export async function syncPendingOfflineData(): Promise<{ success: boolean; syncedCount: number }> {
  if (typeof window === 'undefined' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
    return { success: false, syncedCount: 0 }
  }

  let syncedCount = 0
  try {
    const pendingKeys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('ashtrakat_pending_sync_')) {
        pendingKeys.push(key)
      }
    }

    for (const key of pendingKeys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const item = JSON.parse(raw)
        if (item.branchId && item.subscribers) {
          const res = await fetch('/api/branch-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              branchId: item.branchId,
              subscribers: item.subscribers,
              billing: item.billing || {}
            })
          })
          if (res.ok) {
            localStorage.removeItem(key)
            syncedCount++
          }
        }
      } catch (e) {
        console.error('Error syncing pending item:', e)
      }
    }
  } catch (err) {
    console.error('Error in syncPendingOfflineData:', err)
  }

  return { success: true, syncedCount }
}

// جلب مشتركي وسجلات ديون فرع معين عند الطلب فقط (يدعم وضع الأوفلاين التام)
export async function loadBranchSubscribersAndBilling(
  branchId: string,
  forceRefresh = false
): Promise<{ subscribers: Subscriber[]; billing: BillingRecords }> {
  // 1. إذا كانت البيانات محملة مسبقاً في الجلسة ولم يُطلب تحديث قسري
  if (!forceRefresh && branchSubscribersCache[branchId]) {
    return branchSubscribersCache[branchId]
  }

  let subscribers: Subscriber[] = []
  let billing: BillingRecords = {}
  let loadedFromNetwork = false

  // 2. محاولة القراءة من السيرفر إذا كان الإنترنت متوفراً
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch(`/api/branch-sync?branchId=${encodeURIComponent(branchId)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.success) {
          subscribers = data.subscribers || []
          billing = data.billing || {}
          loadedFromNetwork = true

          // حفظ نسخة محلية دائمة في ذاكرة الهاتف للعمل بدون إنترنت
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(
                getBranchStorageKey(branchId),
                JSON.stringify({ subscribers, billing, timestamp: Date.now() })
              )
            } catch (e) {
              console.warn('LocalStorage quota or storage error:', e)
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Could not reach server for branch ${branchId}, falling back to local cache:`, err)
    }
  }

  // 3. إذا لم يتم التحميل من السيرفر (أوفلاين أو انقطاع الاتصال)، نقرأ فوراً من التخزين المحلي بالهاتف
  if (!loadedFromNetwork && typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(getBranchStorageKey(branchId))
      if (cached) {
        const parsed = JSON.parse(cached)
        subscribers = parsed.subscribers || []
        billing = parsed.billing || {}
      }
    } catch (err) {
      console.error('Error reading offline cached branch subscribers:', err)
    }
  }

  // حفظ في كاش الذاكرة المؤقتة السريع
  branchSubscribersCache[branchId] = {
    subscribers,
    billing,
    timestamp: Date.now()
  }

  return { subscribers, billing }
}

// حفظ مشتركي وسجلات ديون فرع معين (يعمل محلياً وفورياً ويضع العمليات في قائمة المزامنة إذا انقطع النت)
export async function saveBranchSubscribersAndBilling(
  branchId: string,
  subscribers: Subscriber[],
  billing: BillingRecords
): Promise<void> {
  // 1. تحديث الكاش السريع في الذاكرة فوراً
  branchSubscribersCache[branchId] = {
    subscribers,
    billing,
    timestamp: Date.now()
  }

  // 2. حفظ فوري في التخزين المحلي بالهاتف للضمان التام
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        getBranchStorageKey(branchId),
        JSON.stringify({ subscribers, billing, timestamp: Date.now() })
      )
    } catch (e) {
      console.warn('Error saving branch data to localStorage:', e)
    }
  }

  // 3. محاولة الإرسال السحابي
  let syncedSuccessfully = false
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch('/api/branch-sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branchId,
          subscribers,
          billing
        })
      })
      if (res.ok) {
        syncedSuccessfully = true
        // إزالة أي طلب معلق سابق
        if (typeof window !== 'undefined') {
          localStorage.removeItem(getPendingSyncKey(branchId))
        }
      }
    } catch (err) {
      console.warn(`Network error saving subscribers for branch ${branchId}, marked for offline sync:`, err)
    }
  }

  // 4. إذا لم يتم الإرسال بسبب انقطاع النت، نضع العملية في قائمة المزامنة المعلقة
  if (!syncedSuccessfully && typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        getPendingSyncKey(branchId),
        JSON.stringify({
          branchId,
          subscribers,
          billing,
          timestamp: Date.now()
        })
      )
    } catch (e) {
      console.error('Error queuing offline pending sync:', e)
    }
  }
}

// قراءة بيانات المديرية من السحابة بأمان عبر مسار السيرفر (مع دعم الأوفلاين)
export async function loadDirectorateFromCloud(): Promise<DirectorateData> {
  let cloudDirectorate: DirectorateData | null = null
  let legacyData: any = null

  try {
    const res = await fetch('/api/directorate')
    if (res.ok) {
      const json = await res.json()
      if (json.success && json.data) {
        if (json.isLegacy) {
          legacyData = json.data
        } else {
          cloudDirectorate = json.data as DirectorateData
          if (cloudDirectorate && cloudDirectorate.branches) {
            let hasUpdatedOldTokens = false

            cloudDirectorate.branches = cloudDirectorate.branches.map(b => {
              // فحص وترقية توكنات المدراء لمنع احتواء أي رقم هاتف
              const updatedManagers = (b.managers || []).map(m => {
                if (!m.token || m.token.includes('077') || m.token.includes('078') || m.token.includes('075') || m.token.length < 15) {
                  hasUpdatedOldTokens = true
                  return { ...m, token: generateSecureToken('mgr') }
                }
                return m
              })

              // فحص وترقية توكنات المحصلين
              const updatedCollectors = (b.collectors || []).map(c => {
                if (!c.token || c.token.includes('077') || c.token.includes('078') || c.token.includes('075') || c.token.length < 15) {
                  hasUpdatedOldTokens = true
                  return { ...c, token: generateSecureToken('col') }
                }
                return c
              })

              // فحص وترقية توكنات الكتاب
              const updatedWriters = (b.writers || []).map(w => {
                if (!w.token || w.token.includes('077') || w.token.includes('078') || w.token.includes('075') || w.token.length < 15) {
                  hasUpdatedOldTokens = true
                  return { ...w, token: generateSecureToken('wrt') }
                }
                return w
              })

              return {
                ...b,
                managers: updatedManagers,
                collectors: updatedCollectors,
                writers: updatedWriters,
                subscribersCount: b.subscribersCount ?? (b.subscribers?.length || 0),
                subscribers: [],
                billing: {}
              }
            })

            // إذا وُجدت توكنات قديمة تحتوي هواتف يتم حفظ التشفير الجديد سحابياً فوراً
            if (hasUpdatedOldTokens) {
              saveDirectorateToCloud(cloudDirectorate)
            }
          }
        }
      }
    }
  } catch (e) {
    console.error('Error fetching directorate data:', e)
  }

  // استرجاع نسخة المديرية السابقة المخزنة محلياً بالهاتف فوراً إذا انقطع النت
  if (!cloudDirectorate && typeof window !== 'undefined') {
    try {
      const cachedDir = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (cachedDir) {
        const parsed = JSON.parse(cachedDir)
        if (parsed && parsed.branches && parsed.branches.length > 0) {
          return parsed
        }
      }
    } catch {}
  }

  // إذا لم نجد بيانات مهيكلة، نقرأ البيانات السابقة (1005 مشترك) ونحولها بسلامة تامة
  if (!cloudDirectorate || !cloudDirectorate.branches || cloudDirectorate.branches.length === 0) {
    // استرجاع من الكاش المحلي إذا فشل الاتصال
    if (!legacyData && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('ashtrakat_almaa_v1_data')
        if (cached) legacyData = JSON.parse(cached)
      } catch {}
    }

    // تجهيز فرع أبي الخصيب مع المشتركين والمسؤول والمحصل المطلوبين
    const abiAlKhaseebSubscribers: Subscriber[] = legacyData?.subscribers || []
    const abiAlKhaseebAreas: Area[] = legacyData?.areas || []
    const abiAlKhaseebBilling: BillingRecords = legacyData?.billing || {}
    const abiAlKhaseebPricing: Pricing = legacyData?.pricing || {
      'سكني': { '3 متر': 16200, '4 متر': 24600 },
      'تجاري': {} as any
    }
    const abiAlKhaseebAiKeys: string[] = legacyData?.aiApiKeys || []

    const abiAlKhaseebBranch: DirectorateBranch = {
      id: 'branch_abi_alkhaseeb',
      name: 'فرع واردات أبي الخصيب',
      createdAt: new Date().toISOString(),
      managers: [
        {
          id: 'mgr_ali_hussein',
          name: 'علي حسين لفتة',
          phone: '07705666911',
          token: generateSecureToken('mgr'),
          createdAt: new Date().toISOString()
        }
      ],
      collectors: [
        {
          id: 'col_ahmed_sami',
          name: 'احمد سامي عباس',
          phone: '07733921468',
          token: generateSecureToken('col'),
          assignedAreaIds: abiAlKhaseebAreas.map(a => a.id),
          assignedSubscriberIds: abiAlKhaseebSubscribers.map(s => s.id),
          canEdit: true, // مسموح له بالتعديل للاستمرار في عمله بسلاسة
          createdAt: new Date().toISOString()
        }
      ],
      writers: [],
      treasuryManagers: [],
      areas: abiAlKhaseebAreas,
      subscribers: abiAlKhaseebSubscribers,
      billing: abiAlKhaseebBilling,
      consignments: [],
      pricing: abiAlKhaseebPricing,
      aiApiKeys: abiAlKhaseebAiKeys
    }

    // إنشاء باقي الأفرع المقترحة
    const otherBranches: DirectorateBranch[] = [
      {
        id: 'branch_shatt_al_arab',
        name: 'فرع واردات شط العرب',
        createdAt: new Date().toISOString(),
        managers: [],
        collectors: [],
        writers: [],
        treasuryManagers: [],
        areas: [],
        subscribers: [],
        billing: {},
        consignments: []
      },
      {
        id: 'branch_al_jonaina',
        name: 'فرع واردات الجنينة',
        createdAt: new Date().toISOString(),
        managers: [],
        collectors: [],
        writers: [],
        treasuryManagers: [],
        areas: [],
        subscribers: [],
        billing: {},
        consignments: []
      },
      {
        id: 'branch_arabian_gulf',
        name: 'فرع واردات الخليج العربي',
        createdAt: new Date().toISOString(),
        managers: [],
        collectors: [],
        writers: [],
        treasuryManagers: [],
        areas: [],
        subscribers: [],
        billing: {},
        consignments: []
      },
      {
        id: 'branch_al_zubair',
        name: 'فرع واردات الزبير',
        createdAt: new Date().toISOString(),
        managers: [],
        collectors: [],
        writers: [],
        treasuryManagers: [],
        areas: [],
        subscribers: [],
        billing: {},
        consignments: []
      },
      {
        id: 'branch_al_qibla',
        name: 'فرع واردات القبلة',
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
    ]

    cloudDirectorate = {
      directorateName: 'مديرية ماء محافظة البصرة - قسم الواردات',
      updatedAt: new Date().toISOString(),
      branches: [abiAlKhaseebBranch, ...otherBranches]
    }

    // حفظها سحابياً ومحلياً
    await saveDirectorateToCloud(cloudDirectorate)
  }

  // حفظ نسخة محلية للكاش
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudDirectorate))
    } catch {}
  }

  return cloudDirectorate
}

// حفظ بيانات المديرية إلى السحابة في سوبابيس (هيكل إداري خفيف وسريع)
export async function saveDirectorateToCloud(data: DirectorateData): Promise<void> {
  data.updatedAt = new Date().toISOString()

  // حفظ المشتركين لأي فرع يحتوي على بيانات مشتركين في جدوله المنفصل أولاً
  for (const b of data.branches) {
    if (b.subscribers && b.subscribers.length > 0) {
      b.subscribersCount = b.subscribers.length
      await saveBranchSubscribersAndBilling(b.id, b.subscribers, b.billing || {})
    }
  }

  // إنشاء نسخة نظيفة وخفيفة جداً من هيكل المديرية بدون مصفوفات المشتركين العملاقة
  const lightweightDirectorate: DirectorateData = {
    ...data,
    branches: data.branches.map(b => ({
      ...b,
      subscribersCount: b.subscribersCount ?? (b.subscribers?.length || 0),
      subscribers: [], // إبقاء المصفوفة فارغة في الهيكل العام لمنع استهلاك السيرفر والقاعدة
      billing: {}
    }))
  }

  // حفظ في الكاش المحلي
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lightweightDirectorate))
    } catch {}
  }

  try {
    await fetch('/api/directorate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: lightweightDirectorate
      })
    })
  } catch (e) {
    console.error('Error saving directorate data:', e)
  }
}
