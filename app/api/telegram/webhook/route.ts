import { NextResponse } from 'next/server'
import { InspectionRecord } from '@/lib/inspectionTypes'
import { isTelegramAdmin, isTelegramConfigured, notifyTelegramAdmin } from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const SYNC_ROW_KEY = 'inspections_data_v1'
const BOT_TOKEN = () => process.env.TELEGRAM_BOT_TOKEN || ''

async function fetchInspections(): Promise<InspectionRecord[]> {
  const res = await fetch(`${SB_URL}/rest/v1/app_sync?key=eq.${SYNC_ROW_KEY}&select=value`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    cache: 'no-store'
  })
  if (!res.ok) return []
  const rows = await res.json()
  if (rows?.[0]?.value && Array.isArray(rows[0].value)) return rows[0].value
  return []
}

async function reply(chatId: number | string, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: text.slice(0, 4000) })
  })
}

/**
 * Webhook البوت — يستجيب فقط لحساب المسؤول (TELEGRAM_ADMIN_ID)
 * أوامر:
 * /start — ترحيب
 * /status — هل الإعدادات شغّالة
 * أي معرف كشف أو رمز tok_... — يعيد ملخص الكشف ورابطه
 */
export async function POST(request: Request) {
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({ ok: true })
    }

    const update = await request.json()
    const message = update?.message
    if (!message?.chat?.id || typeof message.text !== 'string') {
      return NextResponse.json({ ok: true })
    }

    const fromId = message.from?.id
    const chatId = message.chat.id
    const text = String(message.text).trim()

    if (!isTelegramAdmin(fromId)) {
      await reply(chatId, '⛔ هذا البوت مخصص لمسؤول النظام فقط.')
      return NextResponse.json({ ok: true })
    }

    if (text === '/start' || text === '/help') {
      await reply(
        chatId,
        [
          '✅ أهلاً بك يا مسؤول النظام.',
          '',
          'الأوامر:',
          '/status — حالة الربط مع القناة',
          'أرسل معرف كشف (insp_...) أو رمز (tok_...) لعرض ملخصه ورابطه.'
        ].join('\n')
      )
      return NextResponse.json({ ok: true })
    }

    if (text === '/status') {
      const channel = process.env.TELEGRAM_CHANNEL_ID || '—'
      const link = process.env.TELEGRAM_CHANNEL_LINK || '—'
      await reply(
        chatId,
        [
          '📡 حالة تليجرام',
          `القناة: ${channel}`,
          `الرابط: ${link}`,
          `التوكن: ${BOT_TOKEN() ? 'مضبوط ✓' : 'ناقص ✗'}`,
          `رقم المسؤول: ${process.env.TELEGRAM_ADMIN_ID || '—'}`
        ].join('\n')
      )
      return NextResponse.json({ ok: true })
    }

    const query = text.replace(/^\//, '').trim()
    const list = await fetchInspections()
    const found = list.find((i) => i.id === query || i.token === query || i.id.includes(query))

    if (!found) {
      await reply(chatId, 'لم يُعثر على كشف بهذا الرمز. أرسل المعرف كاملاً مثل insp_... أو tok_...')
      return NextResponse.json({ ok: true })
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'https://ashtrakat-almaa.vercel.app'
    const imgCount = found.images?.filter((img) => img.telegramFileId || (img.dataUrl && img.dataUrl.length > 32)).length || 0

    await reply(
      chatId,
      [
        '📋 ملخص الكشف',
        `المواطن: ${found.citizenName || '—'}`,
        `التاريخ: ${found.inspectionDate || '—'}`,
        `الفرع: ${found.branchName || '—'}`,
        `الصور: ${imgCount} (منشورة بالقناة: ${found.telegramMessageIds?.length ? 'نعم' : imgCount ? 'جزئياً/قديم' : 'لا'})`,
        `المعرف: ${found.id}`,
        `الرابط: ${origin}/inspection/${found.id}`
      ].join('\n')
    )

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Telegram webhook error:', error)
    return NextResponse.json({ ok: true })
  }
}

/** ربط الـ webhook من المتصفح أو بعد النشر — للمسؤول فقط عبر السرّ */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const secret = searchParams.get('setup')
    const expected = process.env.TELEGRAM_ADMIN_ID || ''
    if (!secret || !expected || secret !== expected) {
      return NextResponse.json({ success: false, error: 'غير مصرح' }, { status: 401 })
    }
    if (!isTelegramConfigured()) {
      return NextResponse.json({ success: false, error: 'أضف TELEGRAM_BOT_TOKEN و TELEGRAM_CHANNEL_ID أولاً' }, { status: 503 })
    }

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
    const webhookUrl = `${origin}/api/telegram/webhook`
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN()}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    })
    const json = await res.json()

    await notifyTelegramAdmin(`تم ضبط Webhook البوت على:\n${webhookUrl}`)

    return NextResponse.json({ success: Boolean(json.ok), webhookUrl, telegram: json })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'فشل ضبط الـ webhook'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
