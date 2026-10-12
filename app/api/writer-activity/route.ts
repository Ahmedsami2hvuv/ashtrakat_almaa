import { NextResponse } from 'next/server'
import { WriterActivityEvent } from '@/lib/directorateTypes'

export const dynamic = 'force-dynamic'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'

const getActivityKey = (branchId: string) => `writer_activity_v1_${branchId}`

// جلب سجلات نشاط الكاتب من السيرفر
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const writerId = searchParams.get('writerId')

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    const rowKey = getActivityKey(branchId)
    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${encodeURIComponent(rowKey)}&select=value`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        },
        cache: 'no-store'
      }
    )

    let events: WriterActivityEvent[] = []
    if (res.ok) {
      const rows = await res.json()
      if (rows && rows[0]?.value) {
        events = Array.isArray(rows[0].value) ? rows[0].value : []
      }
    }

    // تصفية حسب الكاتب إذا تم تمريره
    if (writerId) {
      events = events.filter(e => e.writerId === writerId)
    }

    return NextResponse.json({ success: true, events })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في جلب سجلات النشاط'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// تسجيل حدث نشاط جديد أو مجموعة أحداث في السيرفر
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { branchId, event, events } = body

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    const newEvents: WriterActivityEvent[] = events || (event ? [event] : [])
    if (newEvents.length === 0) {
      return NextResponse.json({ success: true, count: 0 })
    }

    const rowKey = getActivityKey(branchId)

    // 1. جلب السجلات الحالية
    const getRes = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${encodeURIComponent(rowKey)}&select=value`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        },
        cache: 'no-store'
      }
    )

    let existingEvents: WriterActivityEvent[] = []
    if (getRes.ok) {
      const rows = await getRes.json()
      if (rows && rows[0]?.value && Array.isArray(rows[0].value)) {
        existingEvents = rows[0].value
      }
    }

    // 2. دمج السجلات مع منع التكرار بناء على id السجل
    const existingIds = new Set(existingEvents.map(e => e.id))
    const trulyNew = newEvents.filter(e => !existingIds.has(e.id))

    // الاحتفاظ بأحدث 3000 عملية لمنع تضخم الحجم وضمان سرعة الأداء
    const combined = [...trulyNew, ...existingEvents].slice(0, 3000)

    const now = new Date().toISOString()
    const payload = {
      key: rowKey,
      value: combined,
      updated_at: now
    }

    const saveRes = await fetch(`${SB_URL}/rest/v1/app_sync`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(payload)
    })

    if (!saveRes.ok) {
      const errText = await saveRes.text()
      return NextResponse.json({ success: false, error: errText }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: trulyNew.length })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في تسجيل النشاط'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
