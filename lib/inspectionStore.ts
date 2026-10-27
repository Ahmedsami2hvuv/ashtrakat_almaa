// إدارة وتخزين ومزامنة بيانات الكشوفات الفنية - سوبابيس والتخزين المحلي
import { InspectionRecord } from './inspectionTypes'
import QRCode from 'qrcode'

const LOCAL_STORAGE_KEY = 'ashtrakat_inspections_cache'
const SYNC_ROW_KEY = 'inspections_data_v1'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'

// جلب الكشوفات من السحابة أو الكاش المحلي
export async function loadInspectionsFromCloud(): Promise<InspectionRecord[]> {
  // 1. محاولة القراءة من الكاش المحلي أولاً للسرعة القصوى
  let localCache: InspectionRecord[] = []
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (cached) {
        localCache = JSON.parse(cached)
      }
    } catch {}
  }

  // 2. الجلب من سوبابيس
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return localCache
  }

  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${SYNC_ROW_KEY}&select=value`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        },
        cache: 'no-store'
      }
    )

    if (res.ok) {
      const rows = await res.json()
      if (rows && rows[0]?.value) {
        const cloudData: InspectionRecord[] = rows[0].value
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData))
          } catch {}
        }
        return cloudData
      }
    }
  } catch (err) {
    console.error('Failed to load inspections from cloud:', err)
  }

  return localCache
}

// حفظ وتحديث الكشوفات في السحابة والكاش المحلي
export async function saveInspectionsToCloud(inspections: InspectionRecord[]): Promise<void> {
  // حفظ في الكاش المحلي أولاً
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inspections))
    } catch (e) {
      console.warn('LocalStorage limit reached for inspections cache, skipping local storage', e)
    }
  }

  // حفظ في سوبابيس
  try {
    const now = new Date().toISOString()
    const payload = {
      key: SYNC_ROW_KEY,
      value: inspections,
      updated_at: now
    }

    await fetch(`${SB_URL}/rest/v1/app_sync`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.error('Failed to save inspections to cloud:', err)
  }
}

// إضافة كشف جديد
export async function addInspectionRecord(record: InspectionRecord): Promise<void> {
  const current = await loadInspectionsFromCloud()
  const existsIndex = current.findIndex(i => i.id === record.id)
  let updatedList: InspectionRecord[]
  if (existsIndex >= 0) {
    updatedList = [...current]
    updatedList[existsIndex] = record
  } else {
    updatedList = [record, ...current]
  }
  await saveInspectionsToCloud(updatedList)
}

// تحديث كشف قائم
export async function updateInspectionRecord(record: InspectionRecord): Promise<void> {
  const current = await loadInspectionsFromCloud()
  const updatedList = current.map(item => item.id === record.id ? record : item)
  await saveInspectionsToCloud(updatedList)
}

// حذف كشف
export async function deleteInspectionRecord(id: string): Promise<void> {
  const current = await loadInspectionsFromCloud()
  const updatedList = current.filter(item => item.id !== id)
  await saveInspectionsToCloud(updatedList)
}

// جلب كشف محدد بواسطة المعرف أو التوكن
export async function getInspectionByIdOrToken(idOrToken: string): Promise<InspectionRecord | null> {
  const all = await loadInspectionsFromCloud()
  return all.find(i => i.id === idOrToken || i.token === idOrToken) || null
}

// توليد صورة الباركود (QR Code) للكشف
export async function generateInspectionQRDataUrl(inspectionId: string, origin?: string): Promise<string> {
  const baseUrl = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://ashtrakat-almaa.vercel.app')
  const inspectionUrl = `${baseUrl}/inspection/${inspectionId}`

  try {
    const qrDataUrl = await QRCode.toDataURL(inspectionUrl, {
      width: 250,
      margin: 1,
      color: {
        dark: '#002663',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    })
    return qrDataUrl
  } catch (e) {
    console.error('Failed to generate QR code:', e)
    return ''
  }
}
