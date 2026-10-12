import { NextResponse } from 'next/server'
import { analyzeConsignmentImage } from '@/lib/aiConsignmentScanner'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, apiKeys } = await request.json()

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'صورة الإرسالية مطلوبة للتحليل' }, { status: 400 })
    }

    if (!apiKeys || !Array.isArray(apiKeys) || apiKeys.length === 0) {
      return NextResponse.json({ success: false, message: 'مفاتيح Google Gemini API مطلوبة للتحليل' }, { status: 400 })
    }

    const result = await analyzeConsignmentImage(imageBase64, mimeType, apiKeys)
    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'فشل تحليل وقراءة صورة الإرسالية'
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
