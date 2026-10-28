// إدارة وتخزين ومزامنة بيانات الكشوفات الفنية - سوبابيس والتخزين المحلي
import { InspectionRecord } from './inspectionTypes'
import QRCode from 'qrcode'

const LOCAL_STORAGE_KEY = 'ashtrakat_inspections_cache'
const LOCAL_META_KEY = 'ashtrakat_inspections_cache_meta'
let inspectionsMemoryCache: InspectionRecord[] | null = null

// جلب الكشوفات المباشرة من السحابة دائمًا لضمان وصول تقارير الكُتّاب والمحصلين للمدير فوراً
export async function loadInspectionsFromCloud(forceRefresh = true): Promise<InspectionRecord[]> {
  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      const res = await fetch('/api/inspections', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      })

      if (res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const cloudData: InspectionRecord[] = json.data
          inspectionsMemoryCache = cloudData
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cloudData))
              localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ timestamp: Date.now() }))
            } catch (e) {
              console.warn('LocalStorage limit reached for inspections, continuing in memory', e)
            }
          }
          return cloudData
        }
      }
    } catch (err) {
      console.error('Failed to load inspections from cloud API:', err)
    }
  }

  // في حال انقطاع الإنترنت نلجأ للكاش المحلي
  let localCache: InspectionRecord[] = []
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
      if (cached) {
        localCache = JSON.parse(cached)
      }
    } catch {}
  }

  inspectionsMemoryCache = localCache
  return localCache
}

// حفظ وتحديث الكشوفات في السحابة والكاش المحلي
export async function saveInspectionsToCloud(inspections: InspectionRecord[]): Promise<void> {
  inspectionsMemoryCache = inspections

  // 1. حفظ في الكاش المحلي أولاً
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(inspections))
      localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ timestamp: Date.now() }))
    } catch (e) {
      console.warn('LocalStorage limit reached for inspections cache, skipping local storage', e)
    }
  }

  // 2. رفع ومزامنة فورية للسحابة ليراها المدير ومسؤول الفرع فوراً
  try {
    const res = await fetch('/api/inspections', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: inspections
      })
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => null)
      console.error('API failed to save inspections:', errJson)
      throw new Error(errJson?.error || 'فشل المزامنة مع السحابة')
    }
  } catch (err) {
    console.error('Failed to save inspections to cloud API:', err)
    throw err
  }
}

// إضافة كشف جديد - يجلب أحدث نسخة سحابية أولاً لمنع ضياع كشوفات الكُتّاب الآخرين
export async function addInspectionRecord(record: InspectionRecord): Promise<void> {
  const current = await loadInspectionsFromCloud(true)
  const existsIndex = current.findIndex((i) => i.id === record.id)
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
  const current = await loadInspectionsFromCloud(true)
  const updatedList = current.map((item) => (item.id === record.id ? record : item))
  await saveInspectionsToCloud(updatedList)
}

// حذف كشف
export async function deleteInspectionRecord(id: string): Promise<void> {
  const current = await loadInspectionsFromCloud(true)
  const updatedList = current.filter((item) => item.id !== id)
  await saveInspectionsToCloud(updatedList)
}

// جلب كشف محدد بواسطة المعرف أو التوكن
export async function getInspectionByIdOrToken(idOrToken: string): Promise<InspectionRecord | null> {
  const all = await loadInspectionsFromCloud(true)
  return all.find((i) => i.id === idOrToken || i.token === idOrToken) || null
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
