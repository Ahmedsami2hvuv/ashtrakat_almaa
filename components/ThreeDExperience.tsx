'use client'

import { useMemo, useState, type CSSProperties } from 'react'

type PropertyType = 'سكني' | 'تجاري'

interface Branch {
  id: string
  name: string
}

interface Area {
  id: string
  name: string
  branches: Branch[]
}

interface Subscriber {
  id: number
  name: string
  areaId: string
  branchId: string
  propertyType: PropertyType
  meterType: string
  statuses?: string[]
}

interface ThreeDExperienceProps {
  areas: Area[]
  subscribers: Subscriber[]
  rangeFrom: number
  rangeTo: number
  collectorName: string
  currentDue: (id: number) => number
  selectedSubscriber?: Subscriber | null
}

const statusColors: Record<string, string> = {
  ممتنع: '#ef4444',
  مؤجر: '#38bdf8',
  'يدفع باستمرار': '#34d399',
  مفلش: '#a1a1aa'
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US')
}

export default function ThreeDExperience({
  areas,
  subscribers,
  rangeFrom,
  rangeTo,
  collectorName,
  currentDue,
  selectedSubscriber
}: ThreeDExperienceProps) {
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(areas[0]?.id || null)
  const inRange = useMemo(
    () => subscribers.filter((subscriber) => subscriber.id >= rangeFrom && subscriber.id <= rangeTo),
    [subscribers, rangeFrom, rangeTo]
  )
  const selectedArea = areas.find((area) => area.id === selectedAreaId) || null
  const areaSubscribers = inRange.filter((subscriber) => subscriber.areaId === selectedAreaId)
  const debt = inRange.reduce((sum, subscriber) => sum + Math.max(0, currentDue(subscriber.id)), 0)
  const paidCount = inRange.filter((subscriber) => currentDue(subscriber.id) <= 0).length
  const lateCount = inRange.filter((subscriber) => (subscriber.statuses || []).includes('ممتنع')).length
  const mapItems = areas.slice(0, 6)

  return (
    <section className="three-d-shell" dir="rtl">
      <div className="three-d-header">
        <div>
          <div className="three-d-kicker">● 3D ACTIVE · لوحة ثلاثية الأبعاد</div>
          <h2>مركز المناطق والتحصيل</h2>
          <p>خريطة المناطق، حالة العدادات، ومؤشرات المحصل في مساحة واحدة.</p>
        </div>
        <div className="three-d-collector">
          <span className="three-d-status-dot" />
          <span>{collectorName || 'المحصل العام'}</span>
          <strong>{formatNumber(inRange.length)} اشتراك</strong>
        </div>
      </div>

      <div className="three-d-stats">
        <div className="three-d-stat"><span>إجمالي المتبقي</span><strong>{formatNumber(debt)}</strong><small>دينار</small></div>
        <div className="three-d-stat"><span>مسددون</span><strong>{formatNumber(paidCount)}</strong><small>مشترك</small></div>
        <div className="three-d-stat three-d-stat-alert"><span>ممتنعون</span><strong>{formatNumber(lateCount)}</strong><small>يحتاج متابعة</small></div>
        <div className="three-d-stat"><span>نطاق المحصل</span><strong>{formatNumber(rangeFrom)} - {formatNumber(rangeTo)}</strong><small>رقم اشتراك</small></div>
      </div>

      <div className="three-d-grid">
        <div className="three-d-map-card">
          <div className="three-d-card-heading"><span>خريطة المناطق</span><small>اضغط على المنطقة</small></div>
          <div className="three-d-map">
            <div className="three-d-cube" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            {mapItems.map((area, index) => {
              const count = inRange.filter((subscriber) => subscriber.areaId === area.id).length
              const active = area.id === selectedAreaId
              return (
                <button
                  key={area.id}
                  className={`three-d-terrain terrain-${index + 1} ${active ? 'is-active' : ''}`}
                  onClick={() => setSelectedAreaId(area.id)}
                  type="button"
                >
                  <span>{area.name}</span>
                  <b>{count}</b>
                </button>
              )
            })}
            <div className="three-d-map-water" />
          </div>
          <div className="three-d-branch-row">
            {(selectedArea?.branches || []).map((branch) => {
              const count = areaSubscribers.filter((subscriber) => subscriber.branchId === branch.id).length
              return <span key={branch.id}>{branch.name} <b>{count}</b></span>
            })}
          </div>
        </div>

        <div className="three-d-meter-card">
          <div className="three-d-card-heading"><span>عداد التحصيل</span><small>{selectedArea?.name || 'كل المناطق'}</small></div>
          <div className="three-d-meter-scene">
            <div className="three-d-meter">
              <div className="three-d-meter-face">
                <span>WATER</span>
                <strong>{formatNumber(areaSubscribers.reduce((sum, subscriber) => sum + Math.max(0, currentDue(subscriber.id)), 0))}</strong>
                <small>دينار متبقي</small>
              </div>
              <div className="three-d-meter-ring" />
              <div className="three-d-meter-pipe" />
            </div>
          </div>
          <div className="three-d-meter-legend"><span><i className="meter-green" /> مسدد</span><span><i className="meter-yellow" /> قيد المتابعة</span><span><i className="meter-red" /> متأخر</span></div>
        </div>
      </div>

      <div className="three-d-bottom-grid">
        <div className="three-d-building-card">
          <div className="three-d-card-heading"><span>نموذج العقار</span><small>{selectedSubscriber ? `#${selectedSubscriber.id}` : 'آخر اختيار'}</small></div>
          {selectedSubscriber ? (
            <div className="three-d-building-scene">
              <div className={`three-d-building ${selectedSubscriber.propertyType === 'تجاري' ? 'commercial' : ''}`}>
                <div className="building-roof" />
                <div className="building-face"><span>{selectedSubscriber.name}</span><b>{selectedSubscriber.meterType}</b><i>{selectedSubscriber.propertyType}</i></div>
              </div>
              <div className="building-info"><strong>{formatNumber(currentDue(selectedSubscriber.id))}</strong><span>المبلغ الحالي</span></div>
            </div>
          ) : <div className="three-d-empty">اختر مشتركاً لعرض العقار ثلاثي الأبعاد</div>}
        </div>
        <div className="three-d-progress-card">
          <div className="three-d-card-heading"><span>إنجاز المحصل</span><small>ضمن النطاق الحالي</small></div>
          <div className="three-d-progress-ring" style={{ '--progress': `${inRange.length ? Math.round((paidCount / inRange.length) * 100) : 0}%` } as CSSProperties}>
            <strong>{inRange.length ? Math.round((paidCount / inRange.length) * 100) : 0}%</strong>
          </div>
          <div className="three-d-progress-copy"><span>تمت المتابعة</span><b>{formatNumber(paidCount)} / {formatNumber(inRange.length)}</b></div>
        </div>
      </div>
    </section>
  )
}
