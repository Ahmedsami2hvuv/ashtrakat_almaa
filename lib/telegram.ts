/**
 * بوت تليجرام — نشر صور الكشوفات كألبوم في القناة واسترجاعها لاحقاً
 *
 * متغيرات البيئة المطلوبة (Vercel):
 * - TELEGRAM_BOT_TOKEN
 * - TELEGRAM_CHANNEL_ID   (مثل @my_channel أو -100xxxxxxxxxx)
 * - TELEGRAM_ADMIN_ID     (رقم حسابك الشخصي في تليجرام)
 * - TELEGRAM_CHANNEL_LINK (اختياري: https://t.me/...)
 */

import { InspectionImage, InspectionRecord } from './inspectionTypes'

const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || ''
const CHANNEL_ID = () => process.env.TELEGRAM_CHANNEL_ID || ''
const ADMIN_ID = () => process.env.TELEGRAM_ADMIN_ID || ''

export function isTelegramConfigured(): boolean {
  return Boolean(BOT_TOKEN() && CHANNEL_ID())
}

export function isTelegramAdmin(userId: string | number | undefined | null): boolean {
  const admin = ADMIN_ID().trim()
  if (!admin || userId === undefined || userId === null) return false
  return String(userId) === admin
}

function apiUrl(method: string) {
  return `https://api.telegram.org/bot${BOT_TOKEN()}/${method}`
}

type TgPhotoSize = { file_id: string; file_unique_id: string; width: number; height: number; file_size?: number }
type TgMessage = {
  message_id: number
  media_group_id?: string
  photo?: TgPhotoSize[]
  document?: { file_id: string; file_unique_id: string; file_size?: number; mime_type?: string }
  caption?: string
}

type TgApiResult<T> = { ok: boolean; description?: string; result?: T }

async function tgCall<T>(method: string, body?: FormData | Record<string, unknown>): Promise<T> {
  const init: RequestInit =
    body instanceof FormData
      ? { method: 'POST', body }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined
        }

  const res = await fetch(apiUrl(method), init)
  const json = (await res.json()) as TgApiResult<T>
  if (!json.ok || json.result === undefined) {
    throw new Error(json.description || `Telegram API error: ${method}`)
  }
  return json.result
}

function parseDataUrl(dataUrl: string): { buffer: Buffer; mime: string; ext: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) throw new Error('صيغة الصورة غير صالحة')
  const mime = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  let ext = 'jpg'
  if (mime.includes('png')) ext = 'png'
  else if (mime.includes('webp')) ext = 'webp'
  else if (mime.includes('gif')) ext = 'gif'
  else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg'
  return { buffer, mime, ext }
}

function largestPhotoFileId(msg: TgMessage): { file_id: string; file_unique_id: string; size?: number } | null {
  if (msg.photo && msg.photo.length > 0) {
    const best = msg.photo[msg.photo.length - 1]
    return { file_id: best.file_id, file_unique_id: best.file_unique_id, size: best.file_size }
  }
  if (msg.document?.file_id) {
    return {
      file_id: msg.document.file_id,
      file_unique_id: msg.document.file_unique_id,
      size: msg.document.file_size
    }
  }
  return null
}

/** بناء نص تفاصيل الكشف المنشور مع الألبوم */
export function buildInspectionCaption(record: InspectionRecord, siteOrigin?: string): string {
  const origin = siteOrigin || process.env.NEXT_PUBLIC_SITE_URL || 'https://ashtakat-almaa.vercel.app'
  const lines = [
    '📋 كشف فني — مديرية ماء البصرة',
    `👤 المواطن: ${record.citizenName || '—'}`,
    `📅 التاريخ: ${record.inspectionDate || '—'}`,
    `🏢 الفرع: ${record.branchName || '—'}`,
    `✍️ مقدّم التقرير: ${record.writerOrCollectorName || '—'}`,
    `🆔 المعرف: ${record.id}`,
    `🔑 الرمز: ${record.token}`,
    `🔗 الرابط: ${origin}/inspection/${record.id}`
  ]
  const text = lines.join('\n')
  return text.length > 1024 ? text.slice(0, 1020) + '…' : text
}

/**
 * نشر صور الكشف كتكتّل واحد (ألبوم). إن كانت صورة واحدة تُرسل منفردة.
 * يُرجع file_id لكل صورة لاستخدامها لاحقاً من الموقع.
 */
export async function publishInspectionImagesToChannel(
  record: InspectionRecord,
  siteOrigin?: string
): Promise<{ images: InspectionImage[]; messageIds: number[]; mediaGroupId?: string }> {
  if (!isTelegramConfigured()) {
    throw new Error('إعدادات تليجرام غير مكتملة (TELEGRAM_BOT_TOKEN / TELEGRAM_CHANNEL_ID)')
  }

  const pending = (record.images || []).filter((img) => img.dataUrl && img.dataUrl.length > 32)
  if (pending.length === 0) {
    return { images: record.images || [], messageIds: [] }
  }

  const caption = buildInspectionCaption(record, siteOrigin)
  const chatId = CHANNEL_ID()
  const allMessages: TgMessage[] = []
  const updatedImages: InspectionImage[] = [...(record.images || [])]

  // تليجرام: الألبوم من 2 إلى 10؛ نجزّئ إن زادت
  const chunks: InspectionImage[][] = []
  for (let i = 0; i < pending.length; i += 10) {
    chunks.push(pending.slice(i, i + 10))
  }

  let captionUsed = false

  for (const chunk of chunks) {
    if (chunk.length === 1) {
      const img = chunk[0]
      const { buffer, mime, ext } = parseDataUrl(img.dataUrl)
      const form = new FormData()
      form.append('chat_id', chatId)
      form.append('photo', new Blob([new Uint8Array(buffer)], { type: mime }), `insp_${img.id}.${ext}`)
      if (!captionUsed) {
        form.append('caption', caption)
        captionUsed = true
      }
      const msg = await tgCall<TgMessage>('sendPhoto', form)
      allMessages.push(msg)
      const file = largestPhotoFileId(msg)
      const idx = updatedImages.findIndex((x) => x.id === img.id)
      if (idx >= 0 && file) {
        updatedImages[idx] = {
          ...updatedImages[idx],
          telegramFileId: file.file_id,
          telegramFileUniqueId: file.file_unique_id,
          telegramMessageId: msg.message_id,
          dataUrl: '',
          sizeBytes: file.size || updatedImages[idx].sizeBytes
        }
      }
      continue
    }

    const form = new FormData()
    form.append('chat_id', chatId)
    const media = chunk.map((img, i) => {
      const attachName = `photo${i}`
      const { buffer, mime, ext } = parseDataUrl(img.dataUrl)
      form.append(attachName, new Blob([new Uint8Array(buffer)], { type: mime }), `insp_${img.id}.${ext}`)
      const item: Record<string, string> = {
        type: 'photo',
        media: `attach://${attachName}`
      }
      if (!captionUsed && i === 0) {
        item.caption = caption
        captionUsed = true
      }
      return item
    })
    form.append('media', JSON.stringify(media))

    const messages = await tgCall<TgMessage[]>('sendMediaGroup', form)
    allMessages.push(...messages)

    // ترتيب الرد يطابق ترتيب الوسائط
    for (let i = 0; i < chunk.length; i++) {
      const img = chunk[i]
      const msg = messages[i]
      if (!msg) continue
      const file = largestPhotoFileId(msg)
      const idx = updatedImages.findIndex((x) => x.id === img.id)
      if (idx >= 0 && file) {
        updatedImages[idx] = {
          ...updatedImages[idx],
          telegramFileId: file.file_id,
          telegramFileUniqueId: file.file_unique_id,
          telegramMessageId: msg.message_id,
          dataUrl: '',
          sizeBytes: file.size || updatedImages[idx].sizeBytes
        }
      }
    }
  }

  return {
    images: updatedImages,
    messageIds: allMessages.map((m) => m.message_id),
    mediaGroupId: allMessages.find((m) => m.media_group_id)?.media_group_id
  }
}

/** جلب رابط تحميل مؤقت من تليجرام عبر file_id */
export async function getTelegramFilePath(fileId: string): Promise<string> {
  if (!BOT_TOKEN()) throw new Error('TELEGRAM_BOT_TOKEN غير مضبوط')
  const file = await tgCall<{ file_path?: string; file_id: string }>('getFile', { file_id: fileId })
  if (!file.file_path) throw new Error('تعذر الحصول على مسار الملف من تليجرام')
  return file.file_path
}

export function buildTelegramFileDownloadUrl(filePath: string): string {
  return `https://api.telegram.org/file/bot${BOT_TOKEN()}/${filePath}`
}

/** إرسال رسالة نصية للمسؤول فقط */
export async function notifyTelegramAdmin(text: string): Promise<void> {
  const admin = ADMIN_ID().trim()
  if (!admin || !BOT_TOKEN()) return
  try {
    await tgCall('sendMessage', { chat_id: admin, text: text.slice(0, 4000) })
  } catch (e) {
    console.warn('Failed to notify Telegram admin:', e)
  }
}

export function getTelegramPublicChannelLink(): string {
  return process.env.TELEGRAM_CHANNEL_LINK || ''
}
