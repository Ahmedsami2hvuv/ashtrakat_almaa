// إدارة وتخزين ومزامنة بيانات الكشوفات الفنية - سوبابيس والتخزين المحلي
import { InspectionRecord } from './inspectionTypes'
import QRCode from 'qrcode'

const LOCAL_STORAGE_KEY = 'ashtrakat_inspections_cache'
const LOCAL_META_KEY = 'ashtrakat_inspections_cache_meta'
const FETCH_TIMEOUT_MS = 18000
let inspectionsMemoryCache: InspectionRecord[] | null = null

function readLocalCache(): InspectionRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (cached) return JSON.parse(cached) as InspectionRecord[]
  } catch {}
  return []
}

function writeLocalCache(inspections: InspectionRecord[]) {
  if (typeof window === 'undefined') return
  try {
    // نخزّن النسخة الخفيفة فقط حتى لا نتجاوز حد المتصفح
    const lite = inspections.map((item) => ({
      ...item,
      images: Array.isArray(item.images)
        ? item.images.map((img) => ({
            id: img.id,
            name: img.name,
            createdAt: img.createdAt,
            sizeBytes: img.sizeBytes,
            telegramFileId: img.telegramFileId,
            telegramFileUniqueId: img.telegramFileUniqueId,
            telegramMessageId: img.telegramMessageId,
            dataUrl: ''
          }))
        : []
    }))
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lite))
    localStorage.setItem(LOCAL_META_KEY, JSON.stringify({ timestamp: Date.now() }))
  } catch (e) {
    console.warn('LocalStorage limit reached for inspections cache, skipping local storage', e)
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export type LoadInspectionsOptions = {
  /** true = مع صور base64 (للمزامنة فقط). الافتراضي قائمة خفيفة سريعة */
  full?: boolean
  /** تجاهل الكاش وجلب السحابة */
  forceRefresh?: boolean
}

/**
 * جلب الكشوفات:
 * - للقائمة (الافتراضي): نسخة خفيفة بدون صور حتى تظهر فوراً ولا تعلق الشاشة
 * - للمزامنة: full=true
 * - يعرض الكاش فوراً إن وُجد ثم يحدّث من السحابة
 */
export async function loadInspectionsFromCloud(
  forceRefreshOrOptions: boolean | LoadInspectionsOptions = false
): Promise<InspectionRecord[]> {
  const options: LoadInspectionsOptions =
    typeof forceRefreshOrOptions === 'boolean'
      ? { forceRefresh: forceRefreshOrOptions, full: false }
      : forceRefreshOrOptions || {}

  const forceRefresh = options.forceRefresh !== false // الافتراضي: نحدّث من السحابة
  const wantFull = options.full === true

  // نسخة الكاش السريعة للعرض الفوري (بدون صور)
  if (!wantFull && inspectionsMemoryCache) {
    // نكمل التحديث من السحابة في الخلفية عبر الاستدعاء أدناه إن forceRefresh
    if (!forceRefresh) return inspectionsMemoryCache
  }

  const localCache = readLocalCache()
  if (!wantFull && !forceRefresh && localCache.length > 0) {
    inspectionsMemoryCache = localCache
    return localCache
  }

  if (typeof window !== 'undefined' && navigator.onLine) {
    try {
      const url = wantFull ? '/api/inspections?full=1' : '/api/inspections'
      const res = await fetchWithTimeout(url, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
      })

      if (res.ok) {
        const json = await res.json()
        if (json.success && Array.isArray(json.data)) {
          const cloudData: InspectionRecord[] = json.data
          if (!wantFull) {
            inspectionsMemoryCache = cloudData
            writeLocalCache(cloudData)
          }
          return cloudData
        }
      }
    } catch (err) {
      console.error('Failed to load inspections from cloud API:', err)
    }
  }

  // فشل السحابة أو انقطاع: نرجع الكاش إن وُجد
  if (inspectionsMemoryCache && inspectionsMemoryCache.length > 0) {
    return inspectionsMemoryCache
  }
  inspectionsMemoryCache = localCache
  return localCache
}

/** جلب كشف واحد كاملاً مع الصور (لفتح المعرض أو الطباعة) */
export async function loadFullInspectionById(idOrToken: string): Promise<InspectionRecord | null> {
  try {
    const res = await fetchWithTimeout(`/api/inspections/${encodeURIComponent(idOrToken)}`, {
      cache: 'no-store'
    }, 45000)
    if (!res.ok) return null
    const json = await res.json()
    if (json.success && json.data) return json.data as InspectionRecord
  } catch (err) {
    console.error('Failed to load full inspection:', err)
  }
  return null
}

// حفظ وتحديث الكشوفات في السحابة والكاش المحلي
export async function saveInspectionsToCloud(inspections: InspectionRecord[]): Promise<void> {
  inspectionsMemoryCache = inspections.map((item) => ({
    ...item,
    images: Array.isArray(item.images)
      ? item.images.map((img) => ({
          ...img,
          dataUrl: '',
          telegramFileId: img.telegramFileId,
          telegramFileUniqueId: img.telegramFileUniqueId,
          telegramMessageId: img.telegramMessageId
        }))
      : []
  }))
  writeLocalCache(inspections)

  try {
    const res = await fetchWithTimeout(
      '/api/inspections',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: inspections })
      },
      60000
    )

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

// إضافة كشف جديد - يجلب أحدث نسخة كاملة أولاً لمنع ضياع كشوفات/صور الآخرين
export async function addInspectionRecord(record: InspectionRecord): Promise<void> {
  const current = await loadInspectionsFromCloud({ forceRefresh: true, full: true })
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
  const current = await loadInspectionsFromCloud({ forceRefresh: true, full: true })
  const updatedList = current.map((item) => (item.id === record.id ? record : item))
  await saveInspectionsToCloud(updatedList)
}

// حذف كشف
export async function deleteInspectionRecord(id: string): Promise<void> {
  const current = await loadInspectionsFromCloud({ forceRefresh: true, full: true })
  const updatedList = current.filter((item) => item.id !== id)
  await saveInspectionsToCloud(updatedList)
}

// جلب كشف محدد بواسطة المعرف أو التوكن
export async function getInspectionByIdOrToken(idOrToken: string): Promise<InspectionRecord | null> {
  const full = await loadFullInspectionById(idOrToken)
  if (full) return full
  const all = await loadInspectionsFromCloud({ forceRefresh: true, full: false })
  return all.find((i) => i.id === idOrToken || i.token === idOrToken) || null
}

// توليد صورة الباركود (QR Code) للكشف
export async function generateInspectionQRDataUrl(inspectionId: string, origin?: string): Promise<string> {
  const baseUrl =
    origin || (typeof window !== 'undefined' ? window.location.origin : 'https://ashtakat-almaa.vercel.app')
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
