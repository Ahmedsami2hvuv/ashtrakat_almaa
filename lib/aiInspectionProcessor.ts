// معالج الذكاء الاصطناعي لاستخلاص وتنظيم تقارير الكشوفات الفنية - مديرية ماء البصرة
import { TechnicalReportTable } from './inspectionTypes'

export interface ExtractedInspectionData {
  citizenName: string
  inspectionDate: string
  tableData: TechnicalReportTable
  reportPoints: string[]
  inspectorEmployeeName: string
  networksManagerName: string
  revenuesManagerName: string
  typistName: string
}

export async function processInspectionReportWithAI(
  reportText: string,
  apiKeys: string[],
  writerOrCollectorName?: string,
  branchName?: string
): Promise<ExtractedInspectionData> {
  const validKeys = apiKeys.map((k) => k.trim()).filter((k) => k.length > 0)
  if (validKeys.length === 0) {
    throw new Error('لا يوجد مفتاح ذكاء اصطناعي مضاف، يرجى إضافة مفتاح Google Gemini في النظام أولاً')
  }

  const prompt = `
أنت خبير إداري وفني ذكي متخصص في تنظيم وصياغة "استمارة الكشف الفني" الرسمية التابعة لـ (جمهورية العراق - محافظة البصرة - مديرية ماء البصرة - مركز جباية واردات أبي الخصيب).

المهمة:
حلل بدقة نص تقرير الكشف الميداني الذي كتبه الكاتب أو المحصل، واستخرج ورتب البيانات الرسمية وفق النموذج الحكومي الرسمي التالي:

1. صيغة النص التمهيدي:
"تم اجراء الكشف الفني على العقار العائد للمواطن /ة [اسم المواطن] بتاريخ [التاريخ بصيغة YYYY/MM/DD] حسب الجدول ادناه وفق سند الطابو المرفق مع المعاملة"

2. جدول العقار (حسب سند الطابو والموقع):
- ت: 1
- المحافظة: البصرة
- القضاء: ابي الخصيب (أو القضاء المذكور)
- المحلة: اسم المحلة أو المنطقة (مثال: شيخ ابراهيم، العوجة، الصالحية، كوت الفداغ...)
- رقم القطعة: استخرج رقم القطعة إن وُجد (مثال: 80/185) أو اتركه فارغاً "" إذا لم يُذكر
- رقم المقاطعة: استخرج رقم المقاطعة إن وُجد (مثال: 20) أو اتركه فارغاً "" إذا لم يُذكر

3. فقرات "تقرير الكشف" (مرتبة بدقة متناهية كنقاط واضحة ومقتضبة ومطابقة للأسلوب الإداري الرسمي):
- أعد صياغة نتائج الكشف الفني على شكل نقاط مرقمة بأسلوب إداري رصين ومختصر مثل:
  نقطة 1: "تم اجراء الكشف على العقار وتبين انه (بناية / دار / قطعة ارض فارغة) مشيدة بمساحة ... ولا يوجد فيها ماء اسالة..."
  نقطة 2: أي تفاصيل إضافية عن المشيدات أو الحصص أو مصادر المياه أو خطوط الأنابيب.
- احذف صيغ المخاطبة مثل (السيد مسؤول واردات المحترم، ولكم الأمر، مع التقدير...) وضع جوهر الوقائع فقط داخل النقاط.

4. التواقيع الإدارية:
- موظف الكشف: استخرج اسم القائم بالكشف إذا ورد في النص، وإلا اعتمد اسم: "${writerOrCollectorName || ''}".
- م. الشبكات: "" (تترك فارغة لتوقيع مسؤول الشبكات).
- م. الواردات: "حسين علي لفتة جابر" (أو مسؤول الواردات لمركز جباية أبي الخصيب).
- منظم/طابع التقرير: "${writerOrCollectorName || ''}".

النص المطلوب تحليله:
"""
${reportText}
"""

أعد النتيجة حصراً وبدقة تامة ككائن JSON نظيف تماماً بالشكل التالي:
{
  "citizen_name": "اسم المواطن هنا",
  "inspection_date": "2026/10/26",
  "governorate": "البصرة",
  "district": "ابي الخصيب",
  "neighborhood": "شيخ ابراهيم",
  "plot_number": "80/185",
  "sector_number": "20",
  "report_points": [
    "تم اجراء الكشف على العقار وتبين انه بناية مشيدة على عقارين، وتحتوي على مكتب عقارات وصالون رجالي لا يتوفر فيه ماء اسالة.",
    "الطابق العلوي للبناية مشيد عليه قاعة وشقق سكنية."
  ],
  "inspector_name": "${writerOrCollectorName || ''}",
  "networks_manager": "",
  "revenues_manager": "حسين علي لفتة جابر",
  "typist_name": "${writerOrCollectorName || ''}"
}

تنبيه هام جداً:
- أجب فقط بكود JSON الخالص بدون أي وسوم markdown وبدون أي شروحات خارج JSON.
- إذا لم يُذكر التاريخ، ضع تاريخ اليوم الحالي بصيغة YYYY/MM/DD.
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
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.2
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

        const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          throw new Error('لم يقم الذكاء الاصطناعي بإرجاع صيغة JSON صالحة')
        }

        const parsed = JSON.parse(jsonMatch[0])

        // تاريخ اليوم التلقائي في حال عدم وجود تاريخ
        const now = new Date()
        const defaultDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`

        return {
          citizenName: parsed.citizen_name || '',
          inspectionDate: parsed.inspection_date || defaultDate,
          tableData: {
            sequence: 1,
            governorate: parsed.governorate || 'البصرة',
            district: parsed.district || (branchName ? branchName.replace('فرع واردات ', '').replace('مركز جباية واردات ', '') : 'ابي الخصيب'),
            neighborhood: parsed.neighborhood || '',
            plotNumber: parsed.plot_number || '',
            sectorNumber: parsed.sector_number || ''
          },
          reportPoints: Array.isArray(parsed.report_points) && parsed.report_points.length > 0
            ? parsed.report_points
            : [reportText.trim()],
          inspectorEmployeeName: parsed.inspector_name || writerOrCollectorName || '',
          networksManagerName: parsed.networks_manager || '',
          revenuesManagerName: parsed.revenues_manager || 'حسين علي لفتة جابر',
          typistName: parsed.typist_name || writerOrCollectorName || ''
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }
  }

  throw lastError || new Error('فشلت معالجة التقرير بالذكاء الاصطناعي، يرجى فحص المفتاح والاتصال')
}
