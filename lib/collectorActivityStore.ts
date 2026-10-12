import { CollectorActivityEvent } from './directorateTypes'
import { getIraqDateAndTimeString } from './iraqTime'

const getCollectorLocalKey = (branchId: string) => `ashtrakat_collector_activity_cache_${branchId}`

/**
 * تسجيل نشاط أو عملية قام بها المحصل (فتح نظام، معاينة مشترك، استلام مدفوعات، تعديل)
 */
export async function logCollectorActivity(params: {
  branchId: string
  collectorId: string
  collectorName: string
  actionType: 'login' | 'view_subscriber' | 'add_payment' | 'edit_subscriber'
  subscriberId?: number
  subscriberName?: string
  details?: string
  amount?: number
}): Promise<CollectorActivityEvent> {
  const iraqInfo = getIraqDateAndTimeString()

  const event: CollectorActivityEvent = {
    id: `col_act_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    collectorId: params.collectorId,
    collectorName: params.collectorName,
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

  // 1. حفظ فوري في التخزين المحلي لضمان عدم ضياع أي حركة
  if (typeof window !== 'undefined') {
    try {
      const localKey = getCollectorLocalKey(params.branchId)
      const existingStr = localStorage.getItem(localKey)
      const existing: CollectorActivityEvent[] = existingStr ? JSON.parse(existingStr) : []
      const updated = [event, ...existing].slice(0, 1500)
      localStorage.setItem(localKey, JSON.stringify(updated))
    } catch (err) {
      console.warn('Could not save collector activity to localStorage:', err)
    }
  }

  // 2. إرسال إلى السحابة في الخلفية
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      fetch('/api/collector-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId: params.branchId,
          event
        })
      }).catch(e => console.warn('Background collector activity push failed:', e))
    } catch {}
  }

  return event
}

/**
 * جلب سجلات نشاط المحصل لفرع أو محصل معين
 */
export async function loadCollectorActivities(branchId: string, collectorId?: string): Promise<CollectorActivityEvent[]> {
  let events: CollectorActivityEvent[] = []

  // 1. كاش محلي
  if (typeof window !== 'undefined') {
    try {
      const localKey = getCollectorLocalKey(branchId)
      const raw = localStorage.getItem(localKey)
      if (raw) {
        events = JSON.parse(raw)
      }
    } catch {}
  }

  // 2. جلب من السيرفر
  try {
    const url = `/api/collector-activity?branchId=${encodeURIComponent(branchId)}${collectorId ? `&collectorId=${encodeURIComponent(collectorId)}` : ''}`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      if (data.success && Array.isArray(data.events)) {
        events = data.events
        if (typeof window !== 'undefined' && !collectorId) {
          try {
            localStorage.setItem(getCollectorLocalKey(branchId), JSON.stringify(events))
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn('Failed to fetch collector activities from server:', err)
  }

  if (collectorId) {
    events = events.filter(e => e.collectorId === collectorId)
  }

  return events
}

export interface CollectorPeriodStats {
  loginCount: number
  viewedSubscribersCount: number // كم اسم مختلف تم الدخول عليه ومعاينته
  uniqueViewedSubscribers: Array<{ id?: number; name?: string }>
  paymentSubscribersCount: number // كم اسم مختلف دفع للمحصل
  totalPaymentAmount: number
  paymentTransactionsCount: number
  uniquePaymentSubscribers: Array<{ id?: number; name?: string; amount?: number }>
  editedSubscribersCount: number // كم اسم مختلف تم تعديله
  uniqueEditedSubscribers: Array<{ id?: number; name?: string }>
  totalOperations: number
}

export interface CollectorComprehensiveStats {
  today: CollectorPeriodStats
  thisMonth: CollectorPeriodStats
  thisYear: CollectorPeriodStats
  allTime: CollectorPeriodStats
  lastLogin?: CollectorActivityEvent
}

/**
 * حساب إحصائيات المحصل الشاملة (اليوم، هذا الشهر، هذه السنة، والكل)
 */
export function computeCollectorComprehensiveStats(
  events: CollectorActivityEvent[],
  collectorId: string
): CollectorComprehensiveStats {
  const collectorEvents = events.filter(e => e.collectorId === collectorId)
  const iraqInfo = getIraqDateAndTimeString()
  const todayDate = iraqInfo.date
  const currentMonth = iraqInfo.month
  const currentYear = iraqInfo.year

  const buildStatsForSubset = (subset: CollectorActivityEvent[]): CollectorPeriodStats => {
    let loginCount = 0
    let totalPaymentAmount = 0
    let paymentTransactionsCount = 0

    const viewedSubsMap = new Map<number | string, { id?: number; name?: string }>()
    const paymentSubsMap = new Map<number | string, { id?: number; name?: string; amount: number }>()
    const editedSubsMap = new Map<number | string, { id?: number; name?: string }>()

    for (const ev of subset) {
      const subKey = ev.subscriberId ?? ev.subscriberName ?? ev.id

      if (ev.actionType === 'login') {
        loginCount++
      } else if (ev.actionType === 'view_subscriber') {
        if (!viewedSubsMap.has(subKey)) {
          viewedSubsMap.set(subKey, { id: ev.subscriberId, name: ev.subscriberName })
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
      } else if (ev.actionType === 'edit_subscriber') {
        if (!editedSubsMap.has(subKey)) {
          editedSubsMap.set(subKey, { id: ev.subscriberId, name: ev.subscriberName })
        }
      }
    }

    return {
      loginCount,
      viewedSubscribersCount: viewedSubsMap.size,
      uniqueViewedSubscribers: Array.from(viewedSubsMap.values()),
      paymentSubscribersCount: paymentSubsMap.size,
      totalPaymentAmount,
      paymentTransactionsCount,
      uniquePaymentSubscribers: Array.from(paymentSubsMap.values()),
      editedSubscribersCount: editedSubsMap.size,
      uniqueEditedSubscribers: Array.from(editedSubsMap.values()),
      totalOperations: subset.length
    }
  }

  const todayEvents = collectorEvents.filter(e => e.date === todayDate)
  const monthEvents = collectorEvents.filter(e => e.year === currentYear && e.month === currentMonth)
  const yearEvents = collectorEvents.filter(e => e.year === currentYear)

  const logins = collectorEvents.filter(e => e.actionType === 'login')
  const lastLogin = logins.length > 0 ? logins[0] : undefined

  return {
    today: buildStatsForSubset(todayEvents),
    thisMonth: buildStatsForSubset(monthEvents),
    thisYear: buildStatsForSubset(yearEvents),
    allTime: buildStatsForSubset(collectorEvents),
    lastLogin
  }
}
