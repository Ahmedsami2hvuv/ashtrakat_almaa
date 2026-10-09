import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const LEGACY_SYNC_KEY = 'main_data'

// جلب مشتركي وديون فرع معين من السيرفر
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    const branchKey = `branch_subscribers_${branchId}`

    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${branchKey}&select=value`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        },
        cache: 'no-store'
      }
    )

    let subscribers = []
    let billing = {}

    if (res.ok) {
      const rows = await res.json()
      if (rows && rows[0]?.value) {
        subscribers = rows[0].value.subscribers || []
        billing = rows[0].value.billing || {}
        return NextResponse.json({ success: true, subscribers, billing })
      }
    }

    // فرع أبي الخصيب: فحص البيانات القديمة إذا لم نجد في الجدول المنفصل
    if (branchId === 'branch_abi_alkhaseeb' || branchId.includes('abi_al')) {
      try {
        const legacyRes = await fetch(
          `${SB_URL}/rest/v1/app_sync?key=eq.${LEGACY_SYNC_KEY}&select=value`,
          {
            headers: {
              apikey: SB_KEY,
              Authorization: `Bearer ${SB_KEY}`
            },
            cache: 'no-store'
          }
        )
        if (legacyRes.ok) {
          const rowsLegacy = await legacyRes.json()
          if (rowsLegacy && rowsLegacy[0]?.value?.subscribers) {
            subscribers = rowsLegacy[0].value.subscribers || []
            billing = rowsLegacy[0].value.billing || {}
          }
        }
      } catch {}
    }

    return NextResponse.json({ success: true, subscribers, billing })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في جلب بيانات الفرع'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// حفظ مشتركي وديون الفرع عبر السيرفر بأمان
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { branchId, subscribers, billing } = body

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    const branchKey = `branch_subscribers_${branchId}`
    const now = new Date().toISOString()

    const payload = {
      key: branchKey,
      value: {
        branchId,
        subscribers: subscribers || [],
        billing: billing || {},
        updatedAt: now
      },
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

    // إذا كان فرع أبي الخصيب، تحديث السجل التوافقي القديم أيضاً
    if (branchId === 'branch_abi_alkhaseeb') {
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
            key: LEGACY_SYNC_KEY,
            value: {
              subscribers: subscribers || [],
              billing: billing || {},
              updatedAt: now
            },
            updated_at: now
          })
        })
      } catch {}
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في حفظ بيانات الفرع'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
