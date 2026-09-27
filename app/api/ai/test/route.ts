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

      if (requestedModel && requestedModel !== 'auto' && supported.includes(requestedModel)) {
        return { modelName: requestedModel, availableModels: supported }
      }

      // اختيار الموديل الأفضل تلقائياً
      const flash = supported.find((n) => n.includes('flash') && !n.includes('8b'))
      const anyFlash = supported.find((n) => n.includes('flash'))
      const pro = supported.find((n) => n.includes('pro'))
      const fallback = flash || anyFlash || pro || supported[0] || 'gemini-1.5-flash'
      return { modelName: fallback, availableModels: supported }
    }
  } catch {}
  return { modelName: requestedModel && requestedModel !== 'auto' ? requestedModel : 'gemini-1.5-flash', availableModels: [] }
}

async function testSingleKey(provider: string, key: string, model?: string): Promise<{ success: boolean; message: string; modelName?: string }> {
  try {
    if (provider === 'gemini') {
      const { modelName } = await resolveGeminiModel(key, model)
      const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'اختبار الاتصال، أجب بكلمة: نعم' }] }]
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const rawMsg = errData?.error?.message || `فشل الاتصال (رمز: ${res.status})`
        return { success: false, message: rawMsg }
      }
      return { success: true, message: 'يعمل بنجاح', modelName }
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
        return { success: false, message: errData?.error?.message || `خطأ ${res.status}` }
      }
      return { success: true, message: 'يعمل بنجاح' }
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
        return { success: false, message: errData?.error?.message || `خطأ ${res.status}` }
      }
      return { success: true, message: 'يعمل بنجاح' }
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
        return { success: false, message: errData?.error?.message || `خطأ ${res.status}` }
      }
      return { success: true, message: 'يعمل بنجاح' }
    }

    return { success: false, message: 'مزود غير مدعوم' }
  } catch (err: any) {
    return { success: false, message: err?.message || 'خطأ اتصال' }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { provider, apiKey, apiKeys, model } = body

    // تجميع المفاتيح سواء تم إرسال مفتاح واحد أو مصفوفة مفاتيح
    const keysList: string[] = []
    if (Array.isArray(apiKeys)) {
      apiKeys.forEach((k) => {
        if (typeof k === 'string' && k.trim()) keysList.push(k.trim())
      })
    }
    if (keysList.length === 0 && apiKey && typeof apiKey === 'string' && apiKey.trim()) {
      keysList.push(apiKey.trim())
    }

    if (keysList.length === 0) {
      return NextResponse.json(
        { success: false, error: 'يرجى إدخال مفتاح واحد على الأقل لفحصه' },
        { status: 400 }
      )
    }

    // فحص جميع المفاتيح
    const results = await Promise.all(
      keysList.map(async (key, idx) => {
        const res = await testSingleKey(provider, key, model)
        return {
          index: idx + 1,
          keyMasked: key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : '****',
          ...res
        }
      })
    )

    const workingKeys = results.filter((r) => r.success)
    const failedKeys = results.filter((r) => !r.success)

    if (workingKeys.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `جميع المفاتيح المدخلة (${results.length}) غير صالحة: ${failedKeys[0]?.message || ''}`,
          results
        },
        { status: 400 }
      )
    }

    let detectedModel = workingKeys[0]?.modelName

    let summaryMsg = ''
    if (results.length === 1) {
      summaryMsg = `تم الاتصال بنجاح والمفتاح يعمل 100%!${detectedModel ? ` (الموديل: ${detectedModel})` : ''}`
    } else {
      summaryMsg = `رائع جداً! تم فحص (${results.length}) مفاتيح: (${workingKeys.length}) مفاتيح تعمل بنجاح وفعالة! ليمت الاستخدام تضاعف بمقدار ${workingKeys.length} أضعاف 🚀`
      if (failedKeys.length > 0) {
        summaryMsg += ` (تنبيه: هناك ${failedKeys.length} مفاتيح بها مشكلة).`
      }
    }

    return NextResponse.json({
      success: true,
      message: summaryMsg,
      detectedModel,
      totalKeys: results.length,
      workingCount: workingKeys.length,
      results
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'حدث خطأ غير متوقع أثناء فحص المفاتيح' },
      { status: 500 }
    )
  }
}
