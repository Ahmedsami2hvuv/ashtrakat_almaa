// أداة الذكاء الاصطناعي لقراءة ومعالجة وصولات الجباية واستخراج البيانات
export interface ScannedReceipt {
  id: string
  fileName: string
  imageUrl: string
  base64Data?: string
  mimeType?: string
  receiptNumber?: string
  subscriberId?: number
  subscriberName?: string
  amount?: number
  paymentDay?: number
  paymentMonth?: number
  paymentYear?: number
  periodIndex: number // 0 إلى 5
  targetYear: number
  status: 'pending' | 'processing' | 'success' | 'error'
  errorMessage?: string
  matchedSubscriber?: {
    id: number
    name: string
  }
}

// حساب فهرس الفترة من رقم الشهر (1 إلى 12)
// شهر 1 أو 2 => 0 (فترة 1 - 2)
// شهر 3 أو 4 => 1 (فترة 3 - 4)
// شهر 5 أو 6 => 2 (فترة 5 - 6)
// شهر 7 أو 8 => 3 (فترة 7 - 8)
// شهر 9 أو 10 => 4 (فترة 9 - 10)
// شهر 11 أو 12 => 5 (فترة 11 - 12)
export function getPeriodIndexFromMonth(month: number): number {
  if (!month || isNaN(month)) return 0
  const normalizedMonth = Math.max(1, Math.min(12, month))
  return Math.floor((normalizedMonth - 1) / 2)
}

// اختبار صلاحية مفتاح الذكاء الاصطناعي
export async function testGeminiApiKey(apiKey: string): Promise<{ success: boolean; message: string }> {
  if (!apiKey || apiKey.trim() === '') {
    return { success: false, message: 'مفتاح الـ API فارغ، يرجى إدخال مفتاح صالح' }
  }

  const cleanKey = apiKey.trim()
  const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'قل كلمة: ناجح' }] }]
        })
      })

      if (response.ok) {
        return { success: true, message: `المفتاح صالح والاتصال ناجح بالنموذج (${model})!` }
      }

      const errData = await response.json().catch(() => null)
      if (errData && errData.error && errData.error.message) {
        // إذا كان الخطأ بسبب عدم وجود هذا الموديل نجرب الموديل الآخر
        if (response.status === 404 || errData.error.message.includes('not found')) {
          continue
        }
        return { success: false, message: `خطأ من الخدمة: ${errData.error.message}` }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'فشل الاتصال'
      return { success: false, message: `تعذر الاتصال بالإنترنت أو الخادم: ${msg}` }
    }
  }

  return { success: false, message: 'تعذر الاتصال بالمفتاح، يرجى التأكد من صحة المفتاح' }
}

// قراءة وتحليل صورة الوصل باستخدام الذكاء الاصطناعي
export async function analyzeReceiptImage(
  base64Image: string,
  mimeType: string,
  apiKeys: string[]
): Promise<{
  receiptNumber?: string
  subscriberId?: number
  subscriberName?: string
  amount?: number
  paymentDay?: number
  paymentMonth?: number
  paymentYear?: number
  periodIndex: number
  targetYear: number
  rawResponse?: string
}> {
  const validKeys = apiKeys.map((k) => k.trim()).filter((k) => k.length > 0)
  if (validKeys.length === 0) {
    throw new Error('لا توجد مفاتيح ذكاء اصطناعي مضافة، يرجى إضافة مفتاح في الإعدادات أولاً')
  }

  const prompt = `
أنت خبير ذكاء اصطناعي متخصص في فحص وقراءة وصولات وقوائم جباية أجور الماء التابعة لـ (وزارة الإعمار والإسكان والبلديات العامة - المديرية العامة للماء - قائمة أجور الماء والمجاري).

المهمة:
افحص صورة الوصل واستخرج بدقة متناهية الحقول التالية من الكتابة المطبوعة وبخط اليد:
1. رقم المشترك (مكتوب بخط اليد بجانب "رقم المشترك"). انتبه للأرقام الهندية/العربية وحولها إلى أرقام إنجليزية (مثال: ٦٠٥٢ يصبح 6052).
2. اسم المشترك (مكتوب بخط اليد بجانب "اسم المشترك").
3. المبلغ المسدد (مكتوب في جدول المبالغ مثل خانة "اجور الماء الصافي" أو "الجباية الحالية" أو "المجموع"، ومكتوب أيضاً بالكلمات في خانة "فقط ... دينار"). استخرج المبلغ فقط كأرقام صحيحة (مثال: 24600 أو 73800).
4. رقم القائمة/الوصل (المطبوع باللون الأسود البارز، مثال: 1493602).
5. تاريخ الدفع (مكتوب في أسفل الوصل بجانب خانة "التاريخ" أو اسم وتوقيع الجابي، أو في خانة لغاية إذا لم يتوفر غيره):
   - اليوم: رقم اليوم.
   - الشهر: رقم الشهر (مثال: إذا كان التاريخ 26/8/2026 فالشهر هو 8).
   - السنة: رقم السنة (مثال: 2026).

أعد النتيجة حصراً وبدقة تامة بصيغة JSON فقط بهذا الشكل:
{
  "subscriber_number": 6052,
  "subscriber_name": "يوسف خليل عيسى",
  "amount_paid": 24600,
  "receipt_number": "1493602",
  "payment_day": 26,
  "payment_month": 8,
  "payment_year": 2026
}
ملاحظة هامة: أجب بكود JSON فقط بدون أي علامات ماركداون وبدون أي شروحات إضافية.
`

  // تنظيف base64 إذا كان يحتوي على رأس data:image/...;base64,
  let cleanBase64 = base64Image
  let detectedMime = mimeType || 'image/jpeg'
  if (base64Image.includes(',')) {
    const parts = base64Image.split(',')
    cleanBase64 = parts[1]
    const match = parts[0].match(/:(.*?);/)
    if (match) detectedMime = match[1]
  }

  let lastError: Error | null = null
  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

  // تجربة المفاتيح بالترتيب
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
            continue // تجربة موديل آخر
          }
          lastError = new Error(`خطأ من الذكاء الاصطناعي: ${errorMsg}`)
          break // تجربة المفتاح التالي
        }

        const data = await res.json()
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // استخراج كود JSON من الرد
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('لم يتمكن الذكاء الاصطناعي من توليد صيغة بيانات متوافقة من الوصل')
        }

        const parsed = JSON.parse(jsonMatch[0])

        // استخراج الحقول
        const subId = parsed.subscriber_number ? parseInt(String(parsed.subscriber_number).replace(/[^\d]/g, ''), 10) : undefined
        const subName = parsed.subscriber_name ? String(parsed.subscriber_name).trim() : undefined
        const amount = parsed.amount_paid ? parseInt(String(parsed.amount_paid).replace(/[^\d]/g, ''), 10) : undefined
        const receiptNo = parsed.receipt_number ? String(parsed.receipt_number).trim() : undefined

        const day = parsed.payment_day ? parseInt(String(parsed.payment_day), 10) : undefined
        const month = parsed.payment_month ? parseInt(String(parsed.payment_month), 10) : (new Date().getMonth() + 1)
        const year = parsed.payment_year ? parseInt(String(parsed.payment_year), 10) : new Date().getFullYear()

        const periodIdx = getPeriodIndexFromMonth(month)

        return {
          receiptNumber: receiptNo,
          subscriberId: subId && !isNaN(subId) ? subId : undefined,
          subscriberName: subName,
          amount: amount && !isNaN(amount) ? amount : undefined,
          paymentDay: day,
          paymentMonth: month,
          paymentYear: year,
          periodIndex: periodIdx,
          targetYear: year,
          rawResponse: textResponse
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  throw lastError || new Error('فشلت قراءة الوصل بالذكاء الاصطناعي، يرجى فحص المفتاح والاتصال')
}
