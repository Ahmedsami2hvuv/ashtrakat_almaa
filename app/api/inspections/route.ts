import { NextResponse } from 'next/server'
import { InspectionImage, InspectionRecord } from '@/lib/inspectionTypes'

export const dynamic = 'force-dynamic'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const SYNC_ROW_KEY = 'inspections_data_v1'

/** إزالة صور base64 من القائمة حتى لا تعلق لوحة المدير عند الجلب */
function toLiteList(list: InspectionRecord[]): InspectionRecord[] {
  return list.map((item) => ({
    ...item,
    images: Array.isArray(item.images)
      ? item.images.map(
          (img: InspectionImage): InspectionImage => ({
            id: img.id,
            name: img.name,
            createdAt: img.createdAt,
            sizeBytes: img.sizeBytes,
            dataUrl: ''
          })
        )
      : []
  }))
}

async function fetchInspectionsFromSupabase(): Promise<InspectionRecord[]> {
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

  if (!res.ok) return []
  const rows = await res.json()
  if (rows && rows[0]?.value && Array.isArray(rows[0].value)) {
    return rows[0].value as InspectionRecord[]
  }
  return []
}

// جلب قائمة الكشوفات
// ?full=1 = مع الصور (للمزامنة والحفظ) — الافتراضي قائمة خفيفة بدون dataUrl
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const wantFull = searchParams.get('full') === '1'

    const list = await fetchInspectionsFromSupabase()
    const data = wantFull ? list : toLiteList(list)

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في جلب بيانات الكشوفات'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// حفظ أو تحديث الكشوفات
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ success: false, error: 'البيانات مطلوبة' }, { status: 400 })
    }

    // دمج آمن: إذا السجل الوارد بدون صور والقديم فيه صور — نحافظ على الصور القديمة
    const incoming = Array.isArray(data) ? (data as InspectionRecord[]) : []
    const existing = await fetchInspectionsFromSupabase()
    const existingById = new Map(existing.map((item) => [item.id, item]))

    const merged: InspectionRecord[] = incoming.map((item) => {
      const prev = existingById.get(item.id)
      const incomingHasImages =
        Array.isArray(item.images) && item.images.some((img) => !!(img.dataUrl && img.dataUrl.length > 32))
      if (!incomingHasImages && prev?.images?.some((img) => !!(img.dataUrl && img.dataUrl.length > 32))) {
        return { ...item, images: prev.images }
      }
      return item
    })

    const now = new Date().toISOString()
    const payload = {
      key: SYNC_ROW_KEY,
      value: merged,
      updated_at: now
    }

    const res = await fetch(`${SB_URL}/rest/v1/app_sync`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ success: false, error: errText }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في حفظ بيانات الكشوفات'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
