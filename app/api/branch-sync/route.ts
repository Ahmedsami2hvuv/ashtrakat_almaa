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

    // نسخة بيانات الفرع في السحابة (وقت آخر حفظ) حتى يعرف الهاتف إن كانت نسخته المحلية قديمة
    if (searchParams.get('meta') === '1') {
      const metaRes = await fetch(
        `${SB_URL}/rest/v1/app_sync?key=eq.branch_subscribers_${branchId}&select=updated_at`,
        { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, cache: 'no-store' }
      )
      if (!metaRes.ok) {
        return NextResponse.json({ success: false, error: 'قاعدة البيانات غير متاحة حالياً' }, { status: 503 })
      }
      const metaRows = await metaRes.json()
      return NextResponse.json({ success: true, updatedAt: metaRows?.[0]?.updated_at || null })
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

    // قاعدة البيانات غير متاحة (متوقفة أو قيد الاستعادة): لا نرجع قائمة فارغة كأنها ناجحة
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `قاعدة البيانات غير متاحة حالياً (${res.status})` },
        { status: 503 }
      )
    }

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

// عدد المشتركين المحفوظين حالياً في السحابة لهذا الفرع (لمنع استبدالهم بنسخة قديمة ناقصة)
async function getExistingSubscribersCount(branchId: string): Promise<number> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.branch_subscribers_${branchId}&select=value`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, cache: 'no-store' }
    )
    if (!res.ok) return 0
    const rows = await res.json()
    const v = rows && rows[0]?.value
    if (!v) return 0
    if (v.isChunked) return Number(v.totalSubscribers) || 0
    return Array.isArray(v.subscribers) ? v.subscribers.length : 0
  } catch {
    return 0
  }
}

// نسخة بيانات الفرع الحالية في السحابة (وقت آخر حفظ)
async function getCurrentBranchVersion(branchId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.branch_subscribers_${branchId}&select=updated_at`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }, cache: 'no-store' }
    )
    if (!res.ok) return null
    const rows = await res.json()
    return rows?.[0]?.updated_at || null
  } catch {
    return null
  }
}

// منع جهاز يحمل نسخة قديمة من الكتابة فوق نسخة أحدث في السحابة
async function versionConflictResponse(branchId: string, baseVersion: unknown) {
  const current = await getCurrentBranchVersion(branchId)
  if (!current) return null
  const same = typeof baseVersion === 'string' && Date.parse(baseVersion) === Date.parse(current)
  if (same) return null
  return NextResponse.json(
    {
      success: false,
      code: 'version_conflict',
      error: 'تم إيقاف الحفظ: بيانات المشتركين تغيّرت في السحابة بعد فتح هذه الصفحة. حدّث الصفحة لتنزيل النسخة الأحدث ثم أعد التعديل.'
    },
    { status: 409 }
  )
}

// رفض الحفظ إذا كانت النسخة المرسلة أقل من نصف المحفوظ (نسخة قديمة في هاتف)
function shrinkBlocked(existing: number, incoming: number, allowShrink: unknown): boolean {
  return allowShrink !== true && existing >= 2000 && incoming < existing * 0.5
}

function shrinkResponse(existing: number, incoming: number) {
  return NextResponse.json(
    {
      success: false,
      error: `تم إيقاف الحفظ: نسخة هذا الجهاز فيها ${incoming} مشترك فقط بينما السحابة فيها ${existing}. حدّث الصفحة لتنزيل النسخة الكاملة أولاً.`
    },
    { status: 409 }
  )
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

    // 0. مسح جميع مشتركي الفرع وديونهم بطلب صريح من مسؤول الفرع (لا يمس الكتاب والمناطق والإعدادات)
    if (body.wipe === true) {
      if (body.confirm !== 'مسح') {
        return NextResponse.json({ success: false, error: 'يجب كتابة كلمة "مسح" للتأكيد' }, { status: 400 })
      }
      const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' }
      const delRes = await fetch(
        `${SB_URL}/rest/v1/app_sync?key=like.${encodeURIComponent(`branch_subscribers_${branchId}_chunk_*`)}`,
        { method: 'DELETE', headers: sbHeaders }
      )
      if (!delRes.ok) {
        return NextResponse.json({ success: false, error: await delRes.text() }, { status: 500 })
      }
      const emptyRes = await fetch(`${SB_URL}/rest/v1/app_sync`, {
        method: 'POST',
        headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          key: `branch_subscribers_${branchId}`,
          value: { branchId, subscribers: [], billing: {}, updatedAt: now },
          updated_at: now
        })
      })
      if (!emptyRes.ok) {
        return NextResponse.json({ success: false, error: await emptyRes.text() }, { status: 500 })
      }
      if (branchId === 'branch_abi_alkhaseeb') {
        try {
          await fetch(`${SB_URL}/rest/v1/app_sync`, {
            method: 'POST',
            headers: { ...sbHeaders, Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({ key: LEGACY_SYNC_KEY, value: { subscribers: [], billing: {}, updatedAt: now }, updated_at: now })
          })
        } catch {}
      }
      return NextResponse.json({ success: true, wiped: true, updatedAt: now })
    }

    // 1. إذا كان الطلب عبارة عن حفظ جزء محدد (Chunk)
    if (isChunk && typeof chunkIndex === 'number') {
      if (chunkIndex === 0) {
        const conflict = await versionConflictResponse(branchId, body.baseVersion)
        if (conflict) return conflict
        const existing = await getExistingSubscribersCount(branchId)
        const incomingMax = (Number(totalChunks) || 1) * 2000
        if (shrinkBlocked(existing, incomingMax, body.allowShrink)) {
          return shrinkResponse(existing, incomingMax)
        }
      }
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
      const finalizeConflict = await versionConflictResponse(branchId, body.baseVersion)
      if (finalizeConflict) return finalizeConflict
      const existingBeforeFinalize = await getExistingSubscribersCount(branchId)
      const incomingTotal = typeof body.totalSubscribers === 'number' ? body.totalSubscribers : 0
      if (shrinkBlocked(existingBeforeFinalize, incomingTotal, body.allowShrink)) {
        return shrinkResponse(existingBeforeFinalize, incomingTotal)
      }
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

      return NextResponse.json({ success: true, finalized: true, updatedAt: now })
    }

    // 3. الحفظ المعتاد للبيانات الأحادية الصغيرة (أقل من حجم الحد الأقصى)
    const plainConflict = await versionConflictResponse(branchId, body.baseVersion)
    if (plainConflict) return plainConflict
    const existingCount = await getExistingSubscribersCount(branchId)
    const incomingCount = Array.isArray(subscribers) ? subscribers.length : 0
    if (shrinkBlocked(existingCount, incomingCount, body.allowShrink)) {
      return shrinkResponse(existingCount, incomingCount)
    }
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

    return NextResponse.json({ success: true, updatedAt: now })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في حفظ بيانات الفرع'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
