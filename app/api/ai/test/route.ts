import { NextResponse } from 'next/server'

async function resolveGeminiModel(key: string, requestedModel?: string): Promise<{ modelName: string; availableModels: string[] }> {
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
    if (listRes.ok) {
      const data = await listRes.json()
      const models: any[] = data?.models || []
      const supported = models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))

      if (requestedModel && supported.includes(requestedModel)) {
        return { modelName: requestedModel, availableModels: supported }
      }

      // اختيار الموديل الأفضل تلقائياً
      const flash = supported.find((n) => n.includes('flash') && !n.includes('8b'))
      const anyFlash = supported.find((n) => n.includes('flash'))
      const pro = supported.find((n) => n.includes('pro'))
      const fallback = flash || anyFlash || pro || supported[0] || requestedModel || 'gemini-1.5-flash'
      return { modelName: fallback, availableModels: supported }
    }
  } catch {}
  return { modelName: requestedModel || 'gemini-1.5-flash', availableModels: [] }
}

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
      // 1. فحص صحة المفتاح أولاً وجلب الموديل المدعوم تلقائياً
      const { modelName, availableModels } = await resolveGeminiModel(key, model)

      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: 'اختبار الاتصال، أجب بكلمة: نعم' }]
            }
          ]
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const rawMsg = errData?.error?.message || `فشل الاتصال بـ Gemini (رمز: ${res.status})`

        // إذا كانت هناك موديلات أخرى متوفرة، نقترحها أو نجربها
        if (availableModels.length > 0) {
          return NextResponse.json({
            success: false,
            error: `${rawMsg} (الموديلات المتاحة لمفتاحك هي: ${availableModels.slice(0, 3).join(', ')})`
          }, { status: 400 })
        }
        return NextResponse.json({ success: false, error: rawMsg }, { status: 400 })
      }

      return NextResponse.json({
        success: true,
        message: `تم الاتصال بـ Gemini بنجاح والمفتاح يعمل 100%! (الموديل الفعال: ${modelName})`,
        detectedModel: modelName,
        availableModels
      })
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
