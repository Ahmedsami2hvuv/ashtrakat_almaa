// دوال التوقيت العراقي وفحص ساعات العمل

/**
 * الحصول على الوقت الحالي بتوقيت العراق (Asia/Baghdad)
 */
export function getIraqCurrentTime(): { hours: number; minutes: number; timeString: string; formatted12h: string } {
  const now = new Date()

  // استخراج الوقت بصيغة 24 ساعة بتوقيت بغداد
  const baghdadTime24 = now.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Baghdad',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })

  // استخراج الوقت بصيغة 12 ساعة مقروءة بالعربية
  const baghdadTime12 = now.toLocaleTimeString('ar-IQ', {
    timeZone: 'Asia/Baghdad',
    hour12: true,
    hour: 'numeric',
    minute: '2-digit'
  })

  const [hStr, mStr] = baghdadTime24.split(':')
  const hours = parseInt(hStr, 10) || 0
  const minutes = parseInt(mStr, 10) || 0

  return {
    hours,
    minutes,
    timeString: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
    formatted12h: baghdadTime12
  }
}

/**
 * تحويل صيغة "HH:mm" إلى نص مقروء بالعربية بنظام 12 ساعة
 */
export function formatTimeArabic(timeStr: string): string {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  let hours = parseInt(hStr, 10) || 0
  const minutes = parseInt(mStr, 10) || 0

  const period = hours >= 12 ? 'مساءً' : 'صباحاً'
  if (hours > 12) hours -= 12
  if (hours === 0) hours = 12

  const minFormatted = minutes > 0 ? `:${String(minutes).padStart(2, '0')}` : ''
  return `${hours}${minFormatted} ${period}`
}

/**
 * فحص ما إذا كان الكاتب حالياً ضمن ساعات العمل المسموح بها بالتوقيت العراقي
 */
export function checkWriterWorkHours(writer: {
  workHoursEnabled?: boolean
  workHourStart?: string
  workHourEnd?: string
}): {
  allowed: boolean
  isRestricted: boolean
  currentIraqTime: string
  startFormatted: string
  endFormatted: string
  rawStart: string
  rawEnd: string
} {
  const { hours, minutes, timeString, formatted12h } = getIraqCurrentTime()

  if (!writer.workHoursEnabled || !writer.workHourStart || !writer.workHourEnd) {
    return {
      allowed: true,
      isRestricted: false,
      currentIraqTime: formatted12h,
      startFormatted: '',
      endFormatted: '',
      rawStart: '',
      rawEnd: ''
    }
  }

  const currentMinutes = hours * 60 + minutes

  const [startH, startM] = writer.workHourStart.split(':').map(Number)
  const startMinutes = (startH || 0) * 60 + (startM || 0)

  const [endH, endM] = writer.workHourEnd.split(':').map(Number)
  const endMinutes = (endH || 0) * 60 + (endM || 0)

  let allowed = false
  if (startMinutes <= endMinutes) {
    // دوام بنفس اليوم (مثلاً من 08:00 إلى 15:00)
    allowed = currentMinutes >= startMinutes && currentMinutes <= endMinutes
  } else {
    // دوام عبر منتصف الليل (مثلاً من 20:00 إلى 04:00)
    allowed = currentMinutes >= startMinutes || currentMinutes <= endMinutes
  }

  return {
    allowed,
    isRestricted: true,
    currentIraqTime: formatted12h,
    startFormatted: formatTimeArabic(writer.workHourStart),
    endFormatted: formatTimeArabic(writer.workHourEnd),
    rawStart: writer.workHourStart,
    rawEnd: writer.workHourEnd
  }
}
