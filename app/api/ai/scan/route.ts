import { NextResponse } from 'next/server'
import { analyzeReceiptImage } from '@/lib/aiReceiptScanner'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { imageBase64, mimeType, apiKeys } = await request.json()

    if (!imageBase64) {
      return NextResponse.json({ success: false, message: 'الصورة مطلوبة للتحليل' }, { status: 400 })
    }

    if (!apiKeys || !Array.isArray(apiKeys) || apiKeys.length === 0) {
      return NextResponse.json({ success: false, message: 'مفاتيح الـ API مطلوبة' }, { status: 400 })
    }

    const result = await analyzeReceiptImage(imageBase64, mimeType, apiKeys)
    return NextResponse.json({ success: true, data: result })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'فشل تحليل الصورة'
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
