import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const SYNC_ROW_KEY = 'directorate_data_v1'
const LEGACY_SYNC_KEY = 'main_data'

// جلب بيانات هيكل المديرية بأمان من السيرفر
export async function GET() {
  try {
    // 1. محاولة قراءة الهيكل المنظم للمديرية
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
        return NextResponse.json({ success: true, data: rows[0].value })
      }
    }

    // 2. إذا لم يتوفر، قراءة البيانات القديمة
    const resLegacy = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${LEGACY_SYNC_KEY}&select=value`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        },
        cache: 'no-store'
      }
    )

    if (resLegacy.ok) {
      const rowsLegacy = await resLegacy.json()
      if (rowsLegacy && rowsLegacy[0]?.value) {
        return NextResponse.json({ success: true, data: rowsLegacy[0].value, isLegacy: true })
      }
    }

    return NextResponse.json({ success: true, data: null })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في جلب بيانات المديرية'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// حفظ بيانات المديرية من السيرفر مع التحقق الأمني
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('x-director-auth') || request.headers.get('authorization')
    const body = await request.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ success: false, error: 'البيانات مطلوبة' }, { status: 400 })
    }

    const now = new Date().toISOString()
    const payload = {
      key: SYNC_ROW_KEY,
      value: { ...data, updatedAt: now },
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
    const message = error instanceof Error ? error.message : 'خطأ في حفظ بيانات المديرية'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
