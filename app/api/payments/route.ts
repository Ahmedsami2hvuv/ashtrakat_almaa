import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// جلب دفعات مشترك محدد
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const subscriberId = searchParams.get('subscriber_id')

    if (!subscriberId) {
      return NextResponse.json({ error: 'subscriber_id مطلوب' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .eq('subscriber_id', parseInt(subscriberId))
      .order('year', { ascending: true })
      .order('period', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// حفظ أو تحديث دفعة
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('payments')
      .upsert({
        subscriber_id: body.subscriberId,
        period: body.period,
        year: body.year,
        period_label: body.periodLabel,
        old_debt: body.oldDebt,
        paid: body.paid,
        remaining: body.remaining,
        is_manual: body.isManual || false,
      }, {
        onConflict: 'subscriber_id,period,year'
      })
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
