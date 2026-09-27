import { NextResponse } from 'next/server'

interface PeriodData {
  periodIndex: number       // 0 to 5
  periodLabel: string       // "1 و 2", "3 و 4", etc.
  oldDebt: number           // الديون السابقة المكتوبة في السطر
  total: number             // المجموع المكتوب في السطر
  paid: number              // المبلغ المستحصل (المدفوع)
  receiptNo?: string        // رقم الوصل إن وجد
  receiptDate?: string      // تاريخ الوصل إن وجد
  notes?: string            // ملاحظات إضافية
}

interface ScanResult {
  detectedSubscriberName?: string
  detectedSubscriberId?: string
  detectedYear: number
  firstOldDebt: number      // الخلية الأولى بالديون السابقة (الفترة 1)
  periods: PeriodData[]     // الفترات الست (0 إلى 5)
  audit: {
    hasDiscrepancies: boolean
    notes: string[]
  }
  rawSummary: string
}

async function resolveGeminiModel(key: string, requestedModel?: string): Promise<string> {
  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
    if (listRes.ok) {
      const data = await listRes.json()
      const models: any[] = data?.models || []
      const supported = models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))

      if (requestedModel && supported.includes(requestedModel)) {
        return requestedModel
      }

      const flash = supported.find((n) => n.includes('flash') && !n.includes('8b'))
      const anyFlash = supported.find((n) => n.includes('flash'))
      const pro = supported.find((n) => n.includes('pro'))
      return flash || anyFlash || pro || supported[0] || requestedModel || 'gemini-1.5-flash'
    }
  } catch {}
  return requestedModel || 'gemini-1.5-flash'
}

export async function POST(req: Request) {

  try {
    const body = await req.json()
    const {
      imageBase64,
      targetYear = 2026,
      subscriberName = '',
      subscriberId = '',
      aiSettings
    } = body

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ success: false, error: 'لم يتم إرسال صورة للتحليل' }, { status: 400 })
    }

    // استخراج بيانات base64 ونوع الملف
    let mimeType = 'image/jpeg'
    let base64Clean = imageBase64
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,')
      const mimeMatch = parts[0].match(/data:(.*?);/)
      if (mimeMatch && mimeMatch[1]) mimeType = mimeMatch[1]
      base64Clean = parts[1]
    }

    const provider = aiSettings?.provider || 'gemini'
    const apiKey = (
      provider === 'gemini' ? (aiSettings?.geminiKey || process.env.GEMINI_API_KEY) :
      provider === 'openai' ? (aiSettings?.openaiKey || process.env.OPENAI_API_KEY) :
      provider === 'grok' ? (aiSettings?.grokKey || process.env.GROK_API_KEY) :
      (aiSettings?.deepseekKey || process.env.DEEPSEEK_API_KEY)
    )?.trim()

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: `لم يتم العثور على مفتاح API لمزود (${provider}). يرجى الدخول إلى "الإعدادات" ثم تبويب "الذكاء الاصطناعي" وإدخال المفتاح أولاً.`
        },
        { status: 400 }
      )
    }

    // التعليمات الاحترافية لنماذج الرؤية الحاسوبية بالذكاء الاصطناعي
    const systemPrompt = `
أنت خبير محترف ومحاسب تدقيق أول متخصص في قراءة وتحليل سجلات ودساتر جباية اشتراكات الماء اليدوية العراقية.
مهمتك هي فحص الصورة المرفقة واستخراج البيانات بدقة 100%، وخاصة:
1. "الخلية الأولى في عمود الديون السابقة" للسنة المطلوبة: (${targetYear}).
2. مبالغ عمود "المبلغ المستحصل" (أي المدفوعات) لكل فترة من الفترات الست (1 إلى 6).
3. فحص الأخطاء الحسابية أو التناقضات بين الديون السابقة والمجموع والمدفوعات.

معلومات مهمة جداً عن بنية السجل الورقي:
- أعلى الصفحة يحتوي على: اسم المشترك (قد يكون مطابقاً لـ: "${subscriberName}")، ورقم الاشتراك (قد يكون مطابقاً لـ: "${subscriberId}").
- الصفحة مقسمة إلى جداول للسنوات: (2026) و (2027) و (2028).
- ركّز تركيزاً تاماً على جدول السنة المطلوبة: (${targetYear}).
- كل جدول يحتوي على 6 أسطر (تمثل الفترات الست من 1 إلى 6).
- أعمدة الجدول من اليمين لليسار:
  1) القراءة السابقة
  2) القراءة الحالية
  3) الاستهلاك
  4) أجور الماء الصافي
  5) أجور المجاري
  6) أجور الماء الخام
  7) أمانات الهيئة
  8) النفايات (غالباً 3000)
  9) أخرى
  10) عمود [الديون السابقة] (هذا من أهم الأعمدة):
      - السطر الأول هو الخلية الأولى بالديون السابقة. إذا وجد خط أفقي "-" أو فراغ، فهذا يعني 0. وإذا وجد رقم (مثل 9000 أو 50000 أو 24600) فيجب قراءته بدقة.
  11) عمود [المجموع]
  12) عمود [المبلغ المستحصل] (هذا عمود المدفوعات المسددة من المشترك):
      - إذا سدد المشترك مبلغاً، يكتب في هذا العمود (مثلاً: 58200).
  13) رقم الوصل وتاريخه (إن وجد).

التدقيق الحسابي للسجل الورقي:
- تحقق من صحة العمليات الحسابية في الورقة:
  المجموع = الديون السابقة + الرسوم (الماء + النفايات).
  الرصيد/الدين للفترة اللاحقة = المجموع السابق - المبلغ المستحصل (المدفوع).
- إذا كان الكاتب في السجل الورقي قد ارتكب خطأ في الجمع أو نقل الأرقام أو تأخر في خصم الوصل، اكتب ذلك بوضوح في قائمة notes داخل قسم audit.

قواعد تحويل الأرقام:
- الأرقام المكتوبة بخط اليد قد تكون أرقاماً مشرقية (مثل ٠، ١، ٢، ٣، ٤، ٥، ٦، ٧، ٨، ٩) أو غربية (0-9). حوّلها جميعاً إلى أرقام إنجليزية قياسية في مخرجاتك (مثال: 58200).
- أي شرطة "-" تعني 0.

يجب أن تكون مخرجاتك بتنسيق JSON فقط بدون أي علامات markdown إضافية، بالشكل التالي:
{
  "detectedSubscriberName": "اسم المشترك المكتوب أعلى الورقة",
  "detectedSubscriberId": "رقم الاشتراك المكتوب بالورقة",
  "detectedYear": ${targetYear},
  "firstOldDebt": 0,
  "periods": [
    {
      "periodIndex": 0,
      "periodLabel": "1 و 2",
      "oldDebt": 0,
      "total": 9000,
      "paid": 0,
      "receiptNo": "",
      "receiptDate": "",
      "notes": ""
    },
    {
      "periodIndex": 1,
      "periodLabel": "3 و 4",
      "oldDebt": 9000,
      "total": 33600,
      "paid": 0,
      "receiptNo": "",
      "receiptDate": "",
      "notes": ""
    },
    {
      "periodIndex": 2,
      "periodLabel": "5 و 6",
      "oldDebt": 33600,
      "total": 58200,
      "paid": 58200,
      "receiptNo": "957504",
      "receiptDate": "2026/8/22",
      "notes": "تم تسديد وصل بمبلغ 58,200"
    },
    {
      "periodIndex": 3,
      "periodLabel": "7 و 8",
      "oldDebt": 58200,
      "total": 82800,
      "paid": 0,
      "receiptNo": "",
      "receiptDate": "",
      "notes": ""
    },
    {
      "periodIndex": 4,
      "periodLabel": "9 و 10",
      "oldDebt": 24600,
      "total": 49200,
      "paid": 0,
      "receiptNo": "",
      "receiptDate": "",
      "notes": ""
    },
    {
      "periodIndex": 5,
      "periodLabel": "11 و 12",
      "oldDebt": 0,
      "total": 0,
      "paid": 0,
      "receiptNo": "",
      "receiptDate": "",
      "notes": ""
    }
  ],
  "audit": {
    "hasDiscrepancies": false,
    "notes": [
      "ملاحظة أو تدقيق حسابي إن وجد"
    ]
  },
  "rawSummary": "شرح ملخص لما تم استخراجه من الورقة"
}
`

    let jsonResponseText = ''


    if (provider === 'gemini') {
      const selectedModel = await resolveGeminiModel(apiKey, aiSettings?.geminiModel)
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`

      const payload = {
        contents: [
          {
            parts: [
              { text: systemPrompt },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Clean
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json'
        }
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })


      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const errMsg = errJson?.error?.message || `فشل تحليل الصورة من Gemini (رمز: ${res.status})`
        return NextResponse.json({ success: false, error: errMsg }, { status: 400 })
      }

      const resData = await res.json()
      jsonResponseText = resData?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else if (provider === 'openai') {
      const selectedModel = aiSettings?.openaiModel || 'gpt-4o'
      const apiUrl = 'https://api.openai.com/v1/chat/completions'

      const payload = {
        model: selectedModel,
        messages: [
          {
            role: 'system',
            content: 'أنت محلل سجلات مالي تجيب بصيغة JSON فقط.'
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Clean}`
                }
              }
            ]
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1
      }

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        const errMsg = errJson?.error?.message || `فشل تحليل الصورة من OpenAI (رمز: ${res.status})`
        return NextResponse.json({ success: false, error: errMsg }, { status: 400 })
      }

      const resData = await res.json()
      jsonResponseText = resData?.choices?.[0]?.message?.content || ''
    } else {
      return NextResponse.json(
        { success: false, error: `المزود (${provider}) غير مهيأ لمعالجة الصور حالياً، يرجى اختيار Gemini أو OpenAI` },
        { status: 400 }
      )
    }

    // تنظيف النتيجة واستخراج كائن الـ JSON
    let parsedData: ScanResult
    try {
      const cleanJson = jsonResponseText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim()
      parsedData = JSON.parse(cleanJson)
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: 'تعذر تحويل استجابة الذكاء الاصطناعي إلى بيانات منظمة. يرجى إعادة التقاط الصورة بوضوح وإضاءة جيدة.'
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: parsedData
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'حدث خطأ غير متوقع أثناء معالجة الصورة بالذكاء الاصطناعي' },
      { status: 500 }
    )
  }
}
