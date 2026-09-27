import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { provider, apiKey, model } = body

    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { success: false, error: 'يرجى إدخال مفتاح الـ API أولاً' },
        { status: 400 }
      )
    }

    const key = apiKey.trim()

    if (provider === 'gemini') {
      const selectedModel = model || 'gemini-1.5-flash'
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${key}`
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'اختبار الاتصال، أجب بكلمة واحدة: نعم' }]
            }
          ]
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = errData?.error?.message || `فشل الاتصال بـ Gemini (رمز الخطأ: ${res.status})`
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'تم الاتصال بـ Gemini بنجاح والمفتاح يعمل 100%!' })
    }

    if (provider === 'openai') {
      const selectedModel = model || 'gpt-4o-mini'
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: 'اختبار الاتصال' }],
          max_tokens: 5
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = errData?.error?.message || `فشل الاتصال بـ OpenAI (رمز الخطأ: ${res.status})`
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'تم الاتصال بـ OpenAI بنجاح والمفتاح يعمل 100%!' })
    }

    if (provider === 'grok') {
      const selectedModel = model || 'grok-2-vision-1212'
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: 'اختبار الاتصال' }],
          max_tokens: 5
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = errData?.error?.message || `فشل الاتصال بـ Grok (رمز الخطأ: ${res.status})`
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'تم الاتصال بـ Grok بنجاح والمفتاح يعمل 100%!' })
    }

    if (provider === 'deepseek') {
      const selectedModel = model || 'deepseek-chat'
      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: 'user', content: 'اختبار الاتصال' }],
          max_tokens: 5
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const msg = errData?.error?.message || `فشل الاتصال بـ DeepSeek (رمز الخطأ: ${res.status})`
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }

      return NextResponse.json({ success: true, message: 'تم الاتصال بـ DeepSeek بنجاح والمفتاح يعمل 100%!' })
    }

    return NextResponse.json({ success: false, error: 'مزود الذكاء الاصطناعي غير مدعوم' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'حدث خطأ غير متوقع أثناء فحص المفتاح' },
      { status: 500 }
    )
  }
}
