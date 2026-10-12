import { WriterActivityEvent } from './directorateTypes'
import { getIraqDateAndTimeString } from './iraqTime'

const getLocalKey = (branchId: string) => `ashtrakat_writer_activity_cache_${branchId}`

/**
 * تسجيل نشاط أو عملية قام بها الكاتب (فتح نظام، تعديل اسم، تنزيل ديون، تنزيل مدفوعات)
 */
export async function logWriterActivity(params: {
  branchId: string
  writerId: string
  writerName: string
  actionType: 'login' | 'edit_subscriber' | 'update_debt' | 'add_payment'
  subscriberId?: number
  subscriberName?: string
  details?: string
  amount?: number
}): Promise<WriterActivityEvent> {
  const iraqInfo = getIraqDateAndTimeString()

  const event: WriterActivityEvent = {
    id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    writerId: params.writerId,
    writerName: params.writerName,
    branchId: params.branchId,
    actionType: params.actionType,
    subscriberId: params.subscriberId,
    subscriberName: params.subscriberName,
    details: params.details,
    amount: params.amount,
    timestamp: iraqInfo.iso,
    date: iraqInfo.date,
    time: iraqInfo.time12h,
    year: iraqInfo.year,
    month: iraqInfo.month
  }

  // 1. حفظ فوري في التخزين المحلي للمتصفح
  if (typeof window !== 'undefined') {
    try {
      const localKey = getLocalKey(params.branchId)
      const existingStr = localStorage.getItem(localKey)
      const existing: WriterActivityEvent[] = existingStr ? JSON.parse(existingStr) : []
      const updated = [event, ...existing].slice(0, 1500)
      localStorage.setItem(localKey, JSON.stringify(updated))
    } catch (err) {
      console.warn('Could not save activity to localStorage:', err)
    }
  }

  // 2. إرسال الحدث إلى السحابة في الخلفية
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      fetch('/api/writer-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: params.branchId,
          event
        })
      }).catch(e => console.warn('Background activity push failed:', e))
    } catch {}
  }

  return event
}

/**
 * جلب جميع سجلات النشاط لفرع أو كاتب معين
 */
export async function loadWriterActivities(branchId: string, writerId?: string): Promise<WriterActivityEvent[]> {
  let events: WriterActivityEvent[] = []

  // 1. قراءة الكاش المحلي أولاً كاحتياط سريع
  if (typeof window !== 'undefined') {
    try {
      const localKey = getLocalKey(branchId)
      const raw = localStorage.getItem(localKey)
      if (raw) {
        events = JSON.parse(raw)
      }
    } catch {}
  }

  // 2. جلب أحدث البيانات من السيرفر
  try {
    const url = `/api/writer-activity?branchId=${encodeURIComponent(branchId)}${writerId ? `&writerId=${encodeURIComponent(writerId)}` : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.events)) {
        events = data.events
        // تحديث الكاش المحلي
        if (typeof window !== 'undefined' && !writerId) {
          try {
            localStorage.setItem(getLocalKey(branchId), JSON.stringify(events))
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('Failed to fetch writer activity from server:', err)
  }

  if (writerId) {
    events = events.filter(e => e.writerId === writerId)
  }

  return events
}

export interface PeriodStats {
  loginCount: number
  editedSubscribersCount: number // كم اسم مختلف تم تعديله
  uniqueEditedSubscribers: Array<{ id?: number; name?: string }>
  debtSubscribersCount: number // كم اسم مختلف تم تنزيل/تعديل ديون له
  totalDebtAmount: number
  uniqueDebtSubscribers: Array<{ id?: number; name?: string; amount?: number }>
  paymentSubscribersCount: number // كم اسم مختلف تم تنزيل مدفوعات له
  totalPaymentAmount: number
  paymentTransactionsCount: number
  uniquePaymentSubscribers: Array<{ id?: number; name?: string; amount?: number }>
  totalOperations: number
}

export interface WriterComprehensiveStats {
  today: PeriodStats
  thisMonth: PeriodStats
  thisYear: PeriodStats
  allTime: PeriodStats
  lastLogin?: WriterActivityEvent
}

/**
 * حساب إحصائيات الكاتب الشاملة (اليوم، هذا الشهر، هذه السنة، والكل)
 */
export function computeWriterComprehensiveStats(
  events: WriterActivityEvent[],
  writerId: string
): WriterComprehensiveStats {
  const writerEvents = events.filter(e => e.writerId === writerId)
  const iraqInfo = getIraqDateAndTimeString()
  const todayDate = iraqInfo.date // "YYYY-MM-DD"
  const currentMonth = iraqInfo.month
  const currentYear = iraqInfo.year

  const buildStatsForSubset = (subset: WriterActivityEvent[]): PeriodStats => {
    let loginCount = 0
    let totalDebtAmount = 0
    let totalPaymentAmount = 0
    let paymentTransactionsCount = 0

    const editedSubsMap = new Map<number | string, { id?: number; name?: string }>()
    const debtSubsMap = new Map<number | string, { id?: number; name?: string; amount?: number }>()
    const paymentSubsMap = new Map<number | string, { id?: number; name?: string; amount: number }>()

    for (const ev of subset) {
      const subKey = ev.subscriberId ?? ev.subscriberName ?? ev.id

      if (ev.actionType === 'login') {
        loginCount++
      } else if (ev.actionType === 'edit_subscriber') {
        if (!editedSubsMap.has(subKey)) {
          editedSubsMap.set(subKey, { id: ev.subscriberId, name: ev.subscriberName })
        }
      } else if (ev.actionType === 'update_debt') {
        const amt = ev.amount || 0
        totalDebtAmount += amt
        if (!debtSubsMap.has(subKey)) {
          debtSubsMap.set(subKey, { id: ev.subscriberId, name: ev.subscriberName, amount: amt })
        } else {
          const current = debtSubsMap.get(subKey)!
          current.amount = (current.amount || 0) + amt
        }
      } else if (ev.actionType === 'add_payment') {
        paymentTransactionsCount++
        const amt = ev.amount || 0
        totalPaymentAmount += amt
        if (!paymentSubsMap.has(subKey)) {
          paymentSubsMap.set(subKey, { id: ev.subscriberId, name: ev.subscriberName, amount: amt })
        } else {
          const current = paymentSubsMap.get(subKey)!
          current.amount += amt
        }
      }
    }

    return {
      loginCount,
      editedSubscribersCount: editedSubsMap.size,
      uniqueEditedSubscribers: Array.from(editedSubsMap.values()),
      debtSubscribersCount: debtSubsMap.size,
      totalDebtAmount,
      uniqueDebtSubscribers: Array.from(debtSubsMap.values()),
      paymentSubscribersCount: paymentSubsMap.size,
      totalPaymentAmount,
      paymentTransactionsCount,
      uniquePaymentSubscribers: Array.from(paymentSubsMap.values()),
      totalOperations: subset.length
    }
  }

  // أحداث اليوم
  const todayEvents = writerEvents.filter(e => e.date === todayDate)
  // أحداث هذا الشهر
  const monthEvents = writerEvents.filter(e => e.year === currentYear && e.month === currentMonth)
  // أحداث هذه السنة
  const yearEvents = writerEvents.filter(e => e.year === currentYear)

  const logins = writerEvents.filter(e => e.actionType === 'login')
  const lastLogin = logins.length > 0 ? logins[0] : undefined

  return {
    today: buildStatsForSubset(todayEvents),
    thisMonth: buildStatsForSubset(monthEvents),
    thisYear: buildStatsForSubset(yearEvents),
    allTime: buildStatsForSubset(writerEvents),
    lastLogin
  }
}
