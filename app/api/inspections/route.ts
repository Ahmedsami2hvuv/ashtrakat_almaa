import { NextResponse } from 'next/server'
import { InspectionImage, InspectionRecord } from '@/lib/inspectionTypes'
import {
  isTelegramConfigured,
  notifyTelegramAdmin,
  publishInspectionImagesToChannel
} from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const SYNC_ROW_KEY = 'inspections_data_v1'

function imageHasPayload(img: InspectionImage): boolean {
  return Boolean(img.telegramFileId) || Boolean(img.dataUrl && img.dataUrl.length > 32)
}

/** قائمة خفيفة: بدون base64، مع الإبقاء على معرفات تليجرام لعرض الصور */
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
            telegramFileId: img.telegramFileId,
            telegramFileUniqueId: img.telegramFileUniqueId,
            telegramMessageId: img.telegramMessageId,
            dataUrl: ''
          })
        )
      : []
  }))
}

/** بعد النشر: لا نخزّن base64 في قاعدة البيانات */
function stripBase64Images(list: InspectionRecord[]): InspectionRecord[] {
  return list.map((item) => ({
    ...item,
    images: Array.isArray(item.images)
      ? item.images.map((img) => ({
          ...img,
          dataUrl: img.telegramFileId ? '' : img.dataUrl && img.dataUrl.length > 32 ? img.dataUrl : ''
        }))
      : []
  }))
}

async function fetchInspectionsFromSupabase(): Promise<InspectionRecord[]> {
  const res = await fetch(`${SB_URL}/rest/v1/app_sync?key=eq.${SYNC_ROW_KEY}&select=value`, {
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`
    },
    cache: 'no-store'
  })

  if (!res.ok) return []
  const rows = await res.json()
  if (rows && rows[0]?.value && Array.isArray(rows[0].value)) {
    return rows[0].value as InspectionRecord[]
  }
  return []
}

async function publishNewImagesIfNeeded(
  list: InspectionRecord[],
  requestUrl: string
): Promise<InspectionRecord[]> {
  if (!isTelegramConfigured()) return list

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(requestUrl).origin
  const out: InspectionRecord[] = []

  for (const item of list) {
    const needsPublish =
      Array.isArray(item.images) &&
      item.images.some((img) => img.dataUrl && img.dataUrl.length > 32 && !img.telegramFileId)

    if (!needsPublish) {
      out.push(item)
      continue
    }

    try {
      const published = await publishInspectionImagesToChannel(item, origin)
      const updated: InspectionRecord = {
        ...item,
        images: published.images,
        telegramMessageIds: published.messageIds.length
          ? published.messageIds
          : item.telegramMessageIds,
        telegramMediaGroupId: published.mediaGroupId || item.telegramMediaGroupId
      }
      out.push(updated)

      await notifyTelegramAdmin(
        `تم نشر كشف جديد بالقناة\nالمواطن: ${updated.citizenName || '—'}\nالصور: ${published.messageIds.length}\n${origin}/inspection/${updated.id}`
      )
    } catch (err) {
      console.error('Telegram publish failed for', item.id, err)
      // نحتفظ بالصور base64 كاحتياط إذا فشل النشر
      out.push(item)
    }
  }

  return out
}

// جلب قائمة الكشوفات
// ?full=1 = مع أي base64 قديم — الافتراضي قائمة خفيفة + معرفات تليجرام
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

// حفظ أو تحديث الكشوفات + نشر الصور الجديدة لقناة تليجرام
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { data } = body

    if (!data) {
      return NextResponse.json({ success: false, error: 'البيانات مطلوبة' }, { status: 400 })
    }

    const incoming = Array.isArray(data) ? (data as InspectionRecord[]) : []
    const existing = await fetchInspectionsFromSupabase()
    const existingById = new Map(existing.map((item) => [item.id, item]))

    const merged: InspectionRecord[] = incoming.map((item) => {
      const prev = existingById.get(item.id)
      const incomingHasImages = Array.isArray(item.images) && item.images.some(imageHasPayload)
      const prevHasImages = Array.isArray(prev?.images) && prev!.images.some(imageHasPayload)

      if (!incomingHasImages && prevHasImages) {
        return {
          ...item,
          images: prev!.images,
          telegramMessageIds: item.telegramMessageIds || prev!.telegramMessageIds,
          telegramMediaGroupId: item.telegramMediaGroupId || prev!.telegramMediaGroupId
        }
      }

      // دمج صورة بصورة: إذا الواردة بدون telegramFileId والقديمة لديها — نحتفظ به
      if (incomingHasImages && prevHasImages) {
        const prevById = new Map(prev!.images.map((img) => [img.id, img]))
        const images = item.images.map((img) => {
          const old = prevById.get(img.id)
          if (img.telegramFileId) return { ...img, dataUrl: '' }
          if (old?.telegramFileId && !(img.dataUrl && img.dataUrl.length > 32)) {
            return { ...old }
          }
          return img
        })
        return { ...item, images }
      }

      return item
    })

    const withTelegram = await publishNewImagesIfNeeded(merged, request.url)
    const toStore = stripBase64Images(withTelegram)

    const now = new Date().toISOString()
    const payload = {
      key: SYNC_ROW_KEY,
      value: toStore,
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
