// معالج الذكاء الاصطناعي الهجين لاستخلاص وتنظيم تقارير الكشوفات الفنية - مديرية ماء البصرة
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
  aiMethodUsed: 'gemini' | 'builtin_nlp'
  aiSummary: string
}

// دالة التحليل اللغوي الذكي الداخلي كنسخة مدمجة فائقة الذكاء
export function extractWithBuiltinNLP(
  reportText: string,
  writerOrCollectorName?: string,
  branchName?: string
): ExtractedInspectionData {
  const text = reportText || ''

  // 1. استخراج اسم المواطن
  let citizen = ''
  // نمط 1: بين أقواس بعد المواطن أو الحصة (مثال: للمواطن (حسين قدوري) أو (عبود عبدالله محمد))
  const parenMatch = text.match(/(?:للمواطن|للمواطنة|المواطن|الحصة العائدة للمواطن|الدار العائدة للمواطن)\s*(?:\/ة)?\s*[\(\[«"']([^()\[\]»"']+)[\)\]»"']/i)
  if (parenMatch && parenMatch[1]) {
    citizen = parenMatch[1].trim()
  } else {
    // نمط 2: بدون أقواس
    const directMatch = text.match(/(?:للمواطن|للمواطنة|المواطن|العائدة للمواطن)\s*(?:\/ة)?\s*([ء-ي\s]{5,35}?)(?=\s+(?:الكائنة|الكائن|في|ضمن|بتاريخ|المذكورة|واتضح|وتبين))/i)
    if (directMatch && directMatch[1]) {
      citizen = directMatch[1].trim()
    }
  }

  // 2. استخراج المنطقة / المحلة / المقاطعة
  let neighborhood = ''
  let sectorNumber = ''
  let plotNumber = ''

  const areaMatch = text.match(/(?:منطقة|محلة|حي|مقاطعة)\s+([ء-ي\s]{3,30}?)(?=\s+(?:مقاطعة|رقم|قضاء|ضمن|قرب|شارع|وتبين|قمنا|,|،|\.))/i)
  if (areaMatch && areaMatch[1]) {
    neighborhood = areaMatch[1].trim()
  }

  // فحص مقاطعة إضافية
  const sectorMatch = text.match(/مقاطعة\s+([ء-ي0-9\s]{2,25}?)(?=\s+(?:رقم|ضمن|وتبين|,|،|\.))/i)
  if (sectorMatch && sectorMatch[1]) {
    const sVal = sectorMatch[1].trim()
    if (/^\d+$/.test(sVal)) {
      sectorNumber = sVal
    } else if (!neighborhood) {
      neighborhood = sVal
    }
  }

  // استخراج رقم القطعة
  const plotMatch = text.match(/(?:قطعة|رقم القطعة|عرصة)\s*(?:رقم)?\s*([0-9\/\-]+)/i)
  if (plotMatch && plotMatch[1]) {
    plotNumber = plotMatch[1].trim()
  }

  // 3. استخراج التاريخ
  let inspectionDate = ''
  const dateMatch = text.match(/(?:بتاريخ|التاريخ)\s*:?\s*([0-9]{1,4}[\s\/\.\-][0-9]{1,2}[\s\/\.\-][0-9]{1,4})/i)
  if (dateMatch && dateMatch[1]) {
    const rawD = dateMatch[1].replace(/\s+/g, '')
    const parts = rawD.split(/[\/\.\-]/)
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        inspectionDate = `${parts[0]}/${parts[1].padStart(2, '0')}/${parts[2].padStart(2, '0')}`
      } else if (parts[2].length === 4) {
        inspectionDate = `${parts[2]}/${parts[1].padStart(2, '0')}/${parts[0].padStart(2, '0')}`
      }
    }
  }

  if (!inspectionDate) {
    const now = new Date()
    inspectionDate = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  }

  // 4. استخراج اسم القائم بالكشف
  let inspectorName = ''
  const inspectorMatch = text.match(/(?:القائم بالكشف|موظف الكشف|الكاشف|الجابي|الكاتب)\s*:?\s*([ء-ي\s]{4,30})/i)
  if (inspectorMatch && inspectorMatch[1]) {
    inspectorName = inspectorMatch[1].trim()
  } else {
    inspectorName = writerOrCollectorName || ''
  }

  // 5. استخراج وصياغة نقاط تقرير الكشف مع تلوين العبارات المعنية باللون الأحمر
  let cleanBody = text
    .replace(/السيد مسؤول واردات[^\n.]*(?:المحترم)?/gi, '')
    .replace(/م\/[^\n]*/gi, '')
    .replace(/بناءً على طلب الكشف المقدم[^\n,.]*[\.,]/gi, '')
    .replace(/بالإشارة إلى الكشف الموقعي[^\n,.]*[\.,]/gi, '')
    .replace(/والتفضل بالاطلاع مع الشكر والتقدير[^\n]*/gi, '')
    .replace(/مع وافر الشكر[^\n]*/gi, '')
    .replace(/ولكم الامر[^\n]*/gi, '')
    .replace(/ولكم الأمر[^\n]*/gi, '')
    .replace(/القائم بالكشف[^\n]*/gi, '')
    .replace(/التاريخ[^\n]*/gi, '')
    .trim()

  const rawSentences = cleanBody
    .split(/(?:\r?\n|;|\.|\s{2,}|،(?=\s*(?:كما|علما|علماً|وقد|وتبين|واتضح)))/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15)

  let reportPoints: string[] = []

  // دالة ذكية لإحاطة الكلام المعني الذي يلي عبارة (العقار عبارة) أو (تبين انه) بوسم <red>
  const highlightKeyPhrase = (sentence: string): string => {
    let result = sentence

    // نمط 1: ما يلي (العقار عبارة عن) أو (العقار عبارة)
    if (/عبارة(?:\s+عن)?\s+/i.test(result) && !result.includes('<red>')) {
      result = result.replace(
        /(عبارة(?:\s+عن)?\s+)([\wء-ي0-9\s]{4,45}?)(?=\s+(?:ضمن|وخالية|علما|علماً|كما|ولا|وليس|في|,|،|\.|$))/i,
        '$1<red>$2</red>'
      )
    }

    // نمط 2: ما يلي (تبين انه) أو (تبين أنها)
    if (/تبين\s+أن(?:ه|ها)\s+/i.test(result) && !result.includes('<red>')) {
      result = result.replace(
        /(تبين\s+أن(?:ه|ها)\s+)([\wء-ي0-9\s]{3,35}?)(?=\s+(?:مشيدة|على|علما|علماً|كما|ولا|في|,|،|\.|$))/i,
        '$1<red>$2</red>'
      )
    }

    // نمط 3: ما بين الأقواس المعنية بوصف العقار
    result = result.replace(/\((بناية|دار|دارين|قطعة ارض|بستان|محطة|محل|مكتب)\)/gi, '(<red>$1</red>)')

    return result
  }

  if (rawSentences.length > 0) {
    reportPoints = rawSentences.map((s) => {
      let pt = s.replace(/^[0-9\-–\s\.\)]+/, '').trim()
      if (!pt.startsWith('تم ') && !pt.startsWith('تبين ') && !pt.startsWith('اتضح ') && !pt.startsWith('العقار ')) {
        pt = pt.charAt(0).toUpperCase() + pt.slice(1)
      }
      return highlightKeyPhrase(pt)
    })
  } else {
    reportPoints = [highlightKeyPhrase(text.trim())]
  }

  // دمج الجمل القصيرة جداً
  if (reportPoints.length > 3) {
    reportPoints = [
      reportPoints.slice(0, 2).join('، '),
      reportPoints.slice(2).join('، ')
    ]
  }

  const district = branchName
    ? branchName.replace('فرع واردات ', '').replace('مركز جباية واردات ', '').trim()
    : 'ابي الخصيب'

  return {
    citizenName: citizen || '',
    inspectionDate,
    tableData: {
      sequence: 1,
      governorate: 'البصرة',
      district: district || 'ابي الخصيب',
      neighborhood: neighborhood || 'شيخ ابراهيم',
      plotNumber: plotNumber || '',
      sectorNumber: sectorNumber || ''
    },
    reportPoints: reportPoints.length > 0 ? reportPoints : [highlightKeyPhrase(text.trim())],
    inspectorEmployeeName: inspectorName,
    networksManagerName: '',
    revenuesManagerName: 'حسين علي لفتة جابر',
    typistName: 'نور جبار',
    aiMethodUsed: 'builtin_nlp',
    aiSummary: `تم استخلاص اسم المواطن (${citizen || 'غير محدد'}) والمنطقة (${neighborhood || 'البصرة'}) وصياغة (${reportPoints.length}) نقاط رسمية مع تلوين وصف العقار باللون الأحمر.`
  }
}

// دالة المعالجة الرئيسية (تجمع بين Google Gemini والذكاء الداخلي)
export async function processInspectionReportWithAI(
  reportText: string,
  apiKeys: string[],
  writerOrCollectorName?: string,
  branchName?: string
): Promise<ExtractedInspectionData> {
  const validKeys = apiKeys.map((k) => k.trim()).filter((k) => k.length > 0)

  // إذا لم يتوفر مفتاح API، نستخدم فوراً المحلل الذكي الداخلي
  if (validKeys.length === 0) {
    return extractWithBuiltinNLP(reportText, writerOrCollectorName, branchName)
  }

  const prompt = `
أنت خبير إداري وفني ذكي متخصص في تنظيم وصياغة "استمارة الكشف الفني" الرسمية التابعة لـ (مديرية ماء البصرة - مركز جباية واردات أبي الخصيب).

المهمة:
حلل بدقة نص تقرير الكشف الميداني التالي واستخرج ورتب البيانات وفق النموذج الحكومي الرسمي بدقة متناهية:

1. صيغة النص التمهيدي:
"تم اجراء الكشف الفني على العقار العائد للمواطن /ة [اسم المواطن] بتاريخ [التاريخ بصيغة YYYY/MM/DD] حسب الجدول ادناه وفق سند الطابو المرفق مع المعاملة"

2. جدول العقار (حسب سند الطابو والموقع):
- ت: 1
- المحافظة: البصرة
- القضاء: ${branchName ? branchName.replace('فرع واردات ', '').replace('مركز جباية واردات ', '') : 'ابي الخصيب'}
- المحلة: اسم المحلة أو المنطقة (مثال: شيخ ابراهيم، العوجة، الصالحية، كوت الفداغ...)
- رقم القطعة: استخرج رقم القطعة إن وُجد (مثال: 80/185) أو اتركه فارغاً "" إذا لم يُذكر
- رقم المقاطعة: استخرج رقم المقاطعة إن وُجد (مثال: 20) أو اتركه فارغاً "" إذا لم يُذكر

3. فقرات "تقرير الكشف" وقاعدة اللون الأحمر الإلزامية:
- أعد صياغة نتائج الكشف الفني على شكل نقاط مرقمة بأسلوب إداري رصين ومختصر.
- شرط إلزامي ومهم جداً: قم بإحاطة الكلام المعني الذي يلي عبارة (العقار عبارة عن) أو (العقار عبارة) أو وصف حالة العقار (مثل: قطعة ارض فارغة بمساحة ١٥٠ متر، أو بناية، أو دار سكنية مهجورة) بوسم <red>...</red> ليتم تلوينها باللون الأحمر!
  مثال: "تبين أن موقع العقار عبارة <red>قطعة ارض فارغة بمساحة ١٥٠ متر</red> وخالية من المشيدات تماماً."
  مثال: "تم اجراء الكشف على العقار وتبين انه (<red>بناية</red>) مشيدة على عقارين..."

4. التواقيع الإدارية:
- موظف الكشف: اسم القائم بالكشف إذا ورد، وإلا اعتمد اسم: "${writerOrCollectorName || ''}".
- م. الشبكات: "".
- م. الواردات: "حسين علي لفتة جابر".
- منظم/طابع التقرير: "نور جبار".

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
    "تم اجراء الكشف على العقار وتبين انه (<red>بناية</red>) مشيدة على عقارين، وتحتوي على مكتب عقارات وصالون رجالي لا يتوفر فيه ماء اسالة.",
    "الطابق العلوي للبناية مشيد عليه قاعة وشقق سكنية."
  ],
  "inspector_name": "${writerOrCollectorName || ''}",
  "networks_manager": "",
  "revenues_manager": "حسين علي لفتة جابر",
  "typist_name": "نور جبار"
}
أجب بكود JSON الخالص فقط بدون أي نصوص تمهيدية.
`

  const models = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']

  for (const key of validKeys) {
    for (const model of models) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.15 }
          })
        })

        if (!res.ok) continue

        const data = await res.json()
        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const jsonMatch = textResponse.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue

        const parsed = JSON.parse(jsonMatch[0])
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
          reportPoints: Array.isArray(parsed.report_points) && parsed.report_points.length > 0 ? parsed.report_points : [reportText],
          inspectorEmployeeName: parsed.inspector_name || writerOrCollectorName || '',
          networksManagerName: parsed.networks_manager || '',
          revenuesManagerName: parsed.revenues_manager || 'حسين علي لفتة جابر',
          typistName: parsed.typist_name || 'نور جبار',
          aiMethodUsed: 'gemini',
          aiSummary: `قام الذكاء الاصطناعي (Gemini) بصياغة التقرير وتلوين وصف العقار باللون الأحمر واستخراج اسم المواطن (${parsed.citizen_name || 'غير محدد'}).`
        }
      } catch (e) {
        continue
      }
    }
  }

  // في حال فشلت المفاتيح نعود للمحلل الداخلي المطور
  return extractWithBuiltinNLP(reportText, writerOrCollectorName, branchName)
}
