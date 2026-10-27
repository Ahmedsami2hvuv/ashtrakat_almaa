'use client'

// نوع إعدادات موضع وحجم كل عنصر في استمارة الكشف الفني
export interface ElementLayoutSettings {
  x: number // إزاحة أفقية بالبكسل
  y: number // إزاحة عمودية بالبكسل
  scale?: number // نسبة الحجم (1 = 100%)
  fontSize?: number // حجم الخط بالبكسل
}

export interface InspectionLayoutConfig {
  version: number
  logo: ElementLayoutSettings
  qrCode: ElementLayoutSettings
  headerText: ElementLayoutSettings
  titleBadge: ElementLayoutSettings
  citizenRow: ElementLayoutSettings
  dateRow: ElementLayoutSettings
  table: ElementLayoutSettings
  reportBadge: ElementLayoutSettings
  reportPoints: ElementLayoutSettings
  signatures: ElementLayoutSettings
  inspectorSign: ElementLayoutSettings
  networksSign: ElementLayoutSettings
  revenuesSign: ElementLayoutSettings
}

export const DEFAULT_LAYOUT_CONFIG: InspectionLayoutConfig = {
  version: 1,
  logo: { x: 0, y: 0, scale: 1 },
  qrCode: { x: 0, y: 0, scale: 1 },
  headerText: { x: 0, y: 0, fontSize: 16 },
  titleBadge: { x: 0, y: 0, scale: 1, fontSize: 16 },
  citizenRow: { x: 0, y: 0, fontSize: 17 },
  dateRow: { x: 0, y: 0, fontSize: 15 },
  table: { x: 0, y: 0, fontSize: 15 },
  reportBadge: { x: 0, y: 0, scale: 1, fontSize: 14 },
  reportPoints: { x: 0, y: 0, fontSize: 17 },
  signatures: { x: 0, y: 0, fontSize: 16 },
  inspectorSign: { x: 0, y: 0 },
  networksSign: { x: 0, y: 0 },
  revenuesSign: { x: 0, y: 0 }
}

const STORAGE_KEY = 'ashtrakat_inspection_layout_v1'

// قراءة التصميم المخزن محلياً وسحابياً
export function loadSavedLayoutConfig(): InspectionLayoutConfig {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT_CONFIG
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return { ...DEFAULT_LAYOUT_CONFIG, ...parsed }
    }
  } catch (e) {
    console.error('Failed to load layout config:', e)
  }
  return DEFAULT_LAYOUT_CONFIG
}

// حفظ التصميم في التخزين المحلي والسحابي
export async function saveLayoutConfigToStorage(config: InspectionLayoutConfig): Promise<boolean> {
  if (typeof window === 'undefined') return false
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    // محاولة حفظ في السحابة أيضاً
    try {
      await fetch('/api/inspections?type=layout_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layoutConfig: config })
      })
    } catch {
      // الاستمرار في حال تعذر السيرفر، التخزين المحلي فعال
    }
    return true
  } catch (e) {
    console.error('Failed to save layout config:', e)
    return false
  }
}
