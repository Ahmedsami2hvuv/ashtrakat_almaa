import { NextResponse } from 'next/server'
import { testGeminiApiKey } from '@/lib/aiReceiptScanner'

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json()
    if (!apiKey) {
      return NextResponse.json({ success: false, message: 'مفتاح الـ API مطلوب' }, { status: 400 })
    }

    const result = await testGeminiApiKey(apiKey)
    return NextResponse.json(result)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'حدث خطأ في الخادم'
    return NextResponse.json({ success: false, message: msg }, { status: 500 })
  }
}
