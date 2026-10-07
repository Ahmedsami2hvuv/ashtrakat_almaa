import { DirectorateData, DirectorateBranch, BranchManager, BranchCollector, BranchWriter, TreasuryManager, Consignment } from './directorateTypes'
import { Area, Subscriber, BillingRecords, Pricing } from '@/components/MainApp'

const SB_URL = 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const SYNC_ROW_KEY = 'directorate_data_v1'
const LEGACY_SYNC_KEY = 'main_data'
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

// توليد رمز فريد للرابط
export function generateSecureToken(prefix: string): string {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let res = prefix + '_'
  for (let i = 0; i < 12; i++) {
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

// قراءة بيانات المديرية من السحابة مع دعم نقل البيانات السابقة دون أي فقدان
export async function loadDirectorateFromCloud(): Promise<DirectorateData> {
  let cloudDirectorate: DirectorateData | null = null

  try {
    // 1. محاولة قراءة بيانات المديرية المهيكلة أولاً
    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${SYNC_ROW_KEY}&select=value`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    )
    if (res.ok) {
      const rows = await res.json()
      if (rows[0]?.value) {
        cloudDirectorate = rows[0].value as DirectorateData
      }
    }
  } catch (e) {
    console.error('Error fetching directorate data:', e)
  }

  // إذا لم نجد بيانات مهيكلة، نقرأ البيانات السابقة (1005 مشترك) ونحولها بسلامة تامة
  if (!cloudDirectorate || !cloudDirectorate.branches || cloudDirectorate.branches.length === 0) {
    let legacyData: any = null
    try {
      const resLegacy = await fetch(
        `${SB_URL}/rest/v1/app_sync?key=eq.${LEGACY_SYNC_KEY}&select=value`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
      )
      if (resLegacy.ok) {
        const rows = await resLegacy.json()
        legacyData = rows[0]?.value
      }
    } catch (e) {
      console.error('Error fetching legacy data:', e)
    }

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
          token: 'mgr_ali_07705666911',
          createdAt: new Date().toISOString()
        }
      ],
      collectors: [
        {
          id: 'col_ahmed_sami',
          name: 'احمد سامي عباس',
          phone: '07733921468',
          token: 'col_ahmed_07733921468',
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

// حفظ بيانات المديرية إلى السحابة في سوبابيس
export async function saveDirectorateToCloud(data: DirectorateData): Promise<void> {
  data.updatedAt = new Date().toISOString()

  // حفظ في الكاش المحلي أولاً
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
    } catch {}
  }

  try {
    await fetch(`${SB_URL}/rest/v1/app_sync`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        key: SYNC_ROW_KEY,
        value: data,
        updated_at: data.updatedAt
      })
    })

    // الحفاظ أيضاً على مزامنة الفرع الأول (أبي الخصيب) في الجدول القديم لضمان أمان التوافقية العكسية 100%
    const mainBranch = data.branches.find(b => b.id === 'branch_abi_alkhaseeb') || data.branches[0]
    if (mainBranch) {
      const legacyPayload = {
        subscribers: mainBranch.subscribers,
        areas: mainBranch.areas,
        billing: mainBranch.billing,
        pricing: mainBranch.pricing,
        aiApiKeys: mainBranch.aiApiKeys,
        collectorName: mainBranch.collectors[0]?.name || 'المحصل العام',
        collectorPhone: mainBranch.collectors[0]?.phone || '07700000000'
      }
      await fetch(`${SB_URL}/rest/v1/app_sync`, {
        method: 'POST',
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          key: LEGACY_SYNC_KEY,
          value: legacyPayload,
          updated_at: data.updatedAt
        })
      })
    }
  } catch (e) {
    console.error('Error saving directorate data:', e)
  }
}
