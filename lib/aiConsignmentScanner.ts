// أداة الذكاء الاصطناعي المتخصصة لقراءة استمارات وإرساليات الجباية الرسمية (محافظة البصرة - مديرية ماء البصرة)
export interface ScannedConsignmentRow {
  rowNumber: number
  subscriberId?: number
  subscriberName?: string
  areaName?: string
  amount?: number
  waterAmount?: number
  municipalityAmount?: number
  receiptNumber?: string
  isVoid?: boolean
  notes?: string
}

export interface ScannedConsignmentResult {
  serialNumber?: string // رقم الورقة المطبوع مثل 02951
  paperRefNumber?: string
  branchName?: string // اسم الفرع المكتوب بجانب واردات / مثل أبي الخصيب
  consignmentType?: string // نوع الإرسالية مثل المشروع
  collectorName?: string // اسم الجابي / المحصل
  date?: string // تاريخ الإرسالية YYYY-MM-DD
  totalAmount?: number // مجموع المبالغ المسددة المكتوب في أسفل الورقة
  rows: ScannedConsignmentRow[]
  rawResponse?: string
}

// دالة تحليل وقراءة صورة استمارة الإرسالية
export async function analyzeConsignmentImage(
  base64Image: string,
  mimeType: string,
  apiKeys: string[]
): Promise<ScannedConsignmentResult> {
  const validKeys = apiKeys.map((k) => k.trim()).filter((k) => k.length > 0)
  if (validKeys.length === 0) {
    throw new Error('لا توجد مفاتيح ذكاء اصطناعي مضافة، يرجى إضافة مفتاح Google Gemini في الإعدادات أولاً')
  }

  // تنظيف base64
  let cleanBase64 = base64Image
  let detectedMime = mimeType || 'image/jpeg'
  if (base64Image.includes(',')) {
    const parts = base64Image.split(',')
    cleanBase64 = parts[1]
    const match = parts[0].match(/:(.*?);/)
    if (match) detectedMime = match[1]
  }

  const prompt = `
أنت خبير ذكاء اصطناعي متخصص وقارئ فائق الدقة لاستمارات وقوائم "إرسالية جباية" التابعة لـ (جمهورية العراق - محافظة البصرة - مديرية ماء البصرة).

افحص صورة ورقة الإرسالية الرسمية المرفقة بعناية فائقة، واستخرج جميع البيانات المطبوعة والمكتوبة بخط اليد بدقة متناهية:

1. بيانات رأس الورقة والتذييل:
- الرقم التسلسلي المطبوع في أعلى الورقة (مثال: 02951 أو ما يماثله).
- واردات / اسم الفرع أو القضاء (مثال: أبي الخصيب، العشار، الهارثة...).
- إرسالية جباية / نوع الإرسالية أو المشروع (مثال: المشروع، الصالحية...).
- التاريخ المكتوب في الأسفل أو الأعلى (حول التاريخ إلى صيغة YYYY-MM-DD، مثال: 2026-02-15).
- اسم الجابي أو مسؤول الواردات (المكتوب في أسفل الورقة بجانب الجابي أو مسؤول الواردات، مثال: حسين علي لفته أو أحمد سامي).
- المجموع الكلي النهائي المكتوب في أسفل جدول المبالغ المستلمة (مثال: 61000).

2. بيانات أسطر جدول الجباية (اقرأ كل سطر من الأسطر المكتوبة سطراً بسطر):
- عمود "ت" (أقصى اليمين): يمثل "رقم المشترك" (Subscriber ID)، انتبه للأرقام المكتوبة بخط اليد مثل (8701، 5912، 18857، 4708، 3731...). حول أي أرقام هندية/مشرقية إلى أرقام إنجليزية (مثال: ٨٧٠١ يصبح 8701).
- عمود "اسم المشترك": الاسم الكامل المكتوب بخط اليد (مثال: قاسم محمد، عيسى عباس، جودت كاظم...).
- عمود "المنطقة": اسم المنطقة المكتوب (مثال: العوجة، عويسان، أبو الخصيب...).
- عمود "مجموع المبالغ المستلمة": المبلغ المسدد بالأرقام (مثال: 9000، 20000، 3000، 10000...). إذا كانت هناك خانات للماء والمجاري، استخرج ماء ومجاري أيضاً.
- عمود "رقم الوصل" (أقصى اليسار): رقم الوصل المكون من 7 أرقام (مثال: 4575068، 4575069...).
- إذا كان السطر مكتوباً عليه كلمة "بطال" أو مشطوباً بدون تسديد، ضع خاصية is_void: true.

أعد النتيجة حصراً بصيغة JSON نظيفة وصالحة فقط بالشكل التالي:
{
  "serial_number": "02951",
  "branch_name": "أبي الخصيب",
  "consignment_type": "المشروع",
  "collector_name": "حسين علي لفته",
  "date": "2026-02-15",
  "total_amount": 61000,
  "rows": [
    {
      "row_number": 1,
      "subscriber_id": 8701,
      "subscriber_name": "قاسم محمد",
      "area_name": "العوجة",
      "amount": 9000,
      "water_amount": 6800,
      "sewage_amount": 2200,
      "receipt_number": "4575068",
      "is_void": false
    },
    {
      "row_number": 2,
      "subscriber_id": null,
      "subscriber_name": "",
      "area_name": "",
      "amount": 0,
      "receipt_number": "4575069",
      "is_void": true,
      "notes": "بطال"
    }
  ]
}

تنبيه هام جداً:
- أجب فقط بكود JSON الخالص بدون أي نصوص تمهيدية وبدون أي وسوم markdown مثل \`\`\`json.
- انتبه جداً للأرقام المكتوبة بخط اليد وحولها بدقة تامة.
`

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
  let lastError: Error | null = null

  for (const key of validKeys) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType: detectedMime,
                      data: cleanBase64
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              temperature: 0.1
            }
          })
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => null)
          const errorMsg = errBody?.error?.message || `HTTP ${res.status}`
          if (res.status === 404 || errorMsg.includes('not found')) {
            continue
          }
          lastError = new Error(`خطأ من الذكاء الاصطناعي (${model}): ${errorMsg}`)
          break
        }

        const data = await res.json()
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // استخراج كود JSON
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('لم يقم الذكاء الاصطناعي بإرجاع صيغة JSON صالحة للاستمارة')
        }

        const parsed = JSON.parse(jsonMatch[0])

        // معالجة وتنظيف الأسطر
        const rows: ScannedConsignmentRow[] = (parsed.rows || []).map((r: any, idx: number) => {
          const subId = r.subscriber_id ? parseInt(String(r.subscriber_id).replace(/[^\d]/g, ''), 10) : undefined
          const amount = r.amount ? parseFloat(String(r.amount).replace(/[^\d.]/g, '')) : 0
          const waterAmount = r.water_amount ? parseFloat(String(r.water_amount).replace(/[^\d.]/g, '')) : undefined
          const sewageAmount = r.sewage_amount ? parseFloat(String(r.sewage_amount).replace(/[^\d.]/g, '')) : undefined
          const receiptNo = r.receipt_number ? String(r.receipt_number).trim() : undefined

          return {
            rowNumber: r.row_number || idx + 1,
            subscriberId: subId && !isNaN(subId) ? subId : undefined,
            subscriberName: r.subscriber_name ? String(r.subscriber_name).trim() : undefined,
            areaName: r.area_name ? String(r.area_name).trim() : undefined,
            amount: !isNaN(amount) ? amount : 0,
            waterAmount: waterAmount && !isNaN(waterAmount) ? waterAmount : undefined,
            municipalityAmount: sewageAmount && !isNaN(sewageAmount) ? sewageAmount : undefined,
            receiptNumber: receiptNo,
            isVoid: Boolean(r.is_void),
            notes: r.notes ? String(r.notes).trim() : undefined
          }
        })

        return {
          serialNumber: parsed.serial_number ? String(parsed.serial_number).trim() : '02951',
          branchName: parsed.branch_name ? String(parsed.branch_name).trim() : undefined,
          consignmentType: parsed.consignment_type ? String(parsed.consignment_type).trim() : undefined,
          collectorName: parsed.collector_name ? String(parsed.collector_name).trim() : undefined,
          date: parsed.date ? String(parsed.date).trim() : new Date().toISOString().split('T')[0],
          totalAmount: parsed.total_amount ? parseFloat(String(parsed.total_amount).replace(/[^\d.]/g, '')) : undefined,
          rows,
          rawResponse: textResponse
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  throw lastError || new Error('فشلت قراءة ورقة الإرسالية بالذكاء الاصطناعي، يرجى فحص جودة الصورة والاتصال')
}
