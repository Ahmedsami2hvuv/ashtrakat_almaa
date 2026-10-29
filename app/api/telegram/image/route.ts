import { NextResponse } from 'next/server'
import {
  buildTelegramFileDownloadUrl,
  getTelegramFilePath,
  isTelegramConfigured
} from '@/lib/telegram'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** بروكسي آمن: الموقع يطلب الصورة بـ file_id دون كشف توكن البوت للمتصفح */
export async function GET(request: Request) {
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({ success: false, error: 'تليجرام غير مضبوط' }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('file_id')
    if (!fileId) {
      return NextResponse.json({ success: false, error: 'file_id مطلوب' }, { status: 400 })
    }

    const filePath = await getTelegramFilePath(fileId)
    const downloadUrl = buildTelegramFileDownloadUrl(filePath)
    const fileRes = await fetch(downloadUrl)

    if (!fileRes.ok) {
      return NextResponse.json({ success: false, error: 'فشل جلب الصورة من تليجرام' }, { status: 502 })
    }

    const contentType = fileRes.headers.get('content-type') || 'image/jpeg'
    const buffer = await fileRes.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
        'Content-Disposition': 'inline'
      }
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في جلب صورة تليجرام'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
