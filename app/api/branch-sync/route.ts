import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const LEGACY_SYNC_KEY = 'main_data'

// جلب مشتركي وديون فرع معين من السيرفر (يدعم البيانات الكبيرة المقسمة إلى أجزاء)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const requestedChunk = searchParams.get('chunk')

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    // إذا طُلب جزء محدد بعينه
    if (requestedChunk !== null) {
      const chunkKey = `branch_subscribers_${branchId}_chunk_${requestedChunk}`
      const chunkRes = await fetch(
        `${SB_URL}/rest/v1/app_sync?key=eq.${chunkKey}&select=value`,
        {
          headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
          cache: 'no-store'
        }
      )
      if (chunkRes.ok) {
        const rows = await chunkRes.json()
        if (rows && rows[0]?.value) {
          return NextResponse.json({
            success: true,
            chunkIndex: parseInt(requestedChunk, 10),
            subscribers: rows[0].value.subscribers || [],
            billing: rows[0].value.billing || {}
          })
        }
      }
      return NextResponse.json({ success: false, error: 'الجزء غير موجود' }, { status: 404 })
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

    let subscribers: any[] = []
    let billing: any = {}

    if (res.ok) {
      const rows = await res.json()
      const rowVal = rows && rows[0]?.value

      if (rowVal) {
        // إذا كانت البيانات مقسمة إلى أجزاء سحابية
        if (rowVal.isChunked && rowVal.chunksCount > 0) {
          const chunksCount = rowVal.chunksCount as number
          
          // جلب جميع الأجزاء بالتوازي
          const chunkPromises = Array.from({ length: chunksCount }, (_, i) => {
            const cKey = `branch_subscribers_${branchId}_chunk_${i}`
            return fetch(`${SB_URL}/rest/v1/app_sync?key=eq.${cKey}&select=value`, {
              headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
              cache: 'no-store'
            }).then(r => r.ok ? r.json() : null)
          })

          const chunkResults = await Promise.all(chunkPromises)
          const allSubs: any[] = []
          const mergedBilling: any = {}

          chunkResults.forEach(r => {
            if (r && r[0]?.value) {
              const cSubs = r[0].value.subscribers || []
              const cBill = r[0].value.billing || {}
              allSubs.push(...cSubs)
              Object.assign(mergedBilling, cBill)
            }
          })

          return NextResponse.json({
            success: true,
            subscribers: allSubs,
            billing: mergedBilling,
            isChunked: true,
            totalSubscribers: allSubs.length
          })
        }

        // إذا كانت البيانات مخزنة في صف واحد عادي
        subscribers = rowVal.subscribers || []
        billing = rowVal.billing || {}
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

// حفظ مشتركي وديون الفرع عبر السيرفر بأمان (يدعم الدفعات والأجزاء)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { branchId, subscribers, billing, isChunk, chunkIndex, totalChunks, subscribersChunk, billingChunk, isFinalize } = body

    if (!branchId) {
      return NextResponse.json({ success: false, error: 'معرف الفرع مطلوب' }, { status: 400 })
    }

    const now = new Date().toISOString()

    // 1. إذا كان الطلب عبارة عن حفظ جزء محدد (Chunk)
    if (isChunk && typeof chunkIndex === 'number') {
      const chunkKey = `branch_subscribers_${branchId}_chunk_${chunkIndex}`
      const chunkPayload = {
        key: chunkKey,
        value: {
          branchId,
          chunkIndex,
          subscribers: subscribersChunk || [],
          billing: billingChunk || {},
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
        body: JSON.stringify(chunkPayload)
      })

      if (!res.ok) {
        const errText = await res.text()
        return NextResponse.json({ success: false, error: errText }, { status: 500 })
      }

      return NextResponse.json({ success: true, chunkIndex })
    }

    // 2. إذا كان الطلب لإنهاء وتثبيت الفهرس المجمع لجميع الأجزاء
    if (isFinalize) {
      const branchKey = `branch_subscribers_${branchId}`
      const metaPayload = {
        key: branchKey,
        value: {
          branchId,
          isChunked: true,
          chunksCount: totalChunks || 1,
          totalSubscribers: typeof body.totalSubscribers === 'number' ? body.totalSubscribers : 0,
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
        body: JSON.stringify(metaPayload)
      })

      if (!res.ok) {
        const errText = await res.text()
        return NextResponse.json({ success: false, error: errText }, { status: 500 })
      }

      return NextResponse.json({ success: true, finalized: true })
    }

    // 3. الحفظ المعتاد للبيانات الأحادية الصغيرة (أقل من حجم الحد الأقصى)
    const branchKey = `branch_subscribers_${branchId}`
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

    // إذا كان فرع أبي الخصيب وبياناته عادية، تحديث السجل التوافقي القديم أيضاً
    if (branchId === 'branch_abi_alkhaseeb' && (subscribers || []).length < 5000) {
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
