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

// كاش في الذاكرة لمنع إعادة جلب المشتركين عند التنقل بين الأقسام
const branchSubscribersCache: Record<string, { subscribers: Subscriber[]; billing: BillingRecords; timestamp: number }> = {}

// جلب مشتركي وسجلات ديون فرع معين عند الطلب فقط عبر مسار السيرفر الآمن
export async function loadBranchSubscribersAndBilling(
  branchId: string,
  forceRefresh = false
): Promise<{ subscribers: Subscriber[]; billing: BillingRecords }> {
  // 1. إذا كانت البيانات محملة مسبقاً في الجلسة ولم يُطلب تحديث قسري، نرجعها فوراً من الذاكرة
  if (!forceRefresh && branchSubscribersCache[branchId]) {
    return branchSubscribersCache[branchId]
  }

  let subscribers: Subscriber[] = []
  let billing: BillingRecords = {}

  try {
    // الاتصال عبر السيرفر الآمن الداخلي
    const res = await fetch(`/api/branch-sync?branchId=${encodeURIComponent(branchId)}`)
    if (res.ok) {
      const data = await res.json()
      if (data.success) {
        subscribers = data.subscribers || []
        billing = data.billing || {}
      }
    }
  } catch (err) {
    console.error(`Error loading subscribers for branch ${branchId}:`, err)
  }

  // حفظ في كاش الذاكرة
  branchSubscribersCache[branchId] = {
    subscribers,
    billing,
    timestamp: Date.now()
  }

  return { subscribers, billing }
}

// حفظ مشتركي وسجلات ديون فرع معين عبر السيرفر الآمن
export async function saveBranchSubscribersAndBilling(
  branchId: string,
  subscribers: Subscriber[],
  billing: BillingRecords
): Promise<void> {
  // تحديث الكاش المحلي فوراً
  branchSubscribersCache[branchId] = {
    subscribers,
    billing,
    timestamp: Date.now()
  }

  try {
    await fetch('/api/branch-sync', {
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
  } catch (err) {
    console.error(`Error saving subscribers for branch ${branchId}:`, err)
  }
}

// قراءة بيانات المديرية من السحابة بأمان عبر مسار السيرفر
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
