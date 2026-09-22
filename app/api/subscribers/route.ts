import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// جلب كل المشتركين
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    let query = supabase
      .from('subscribers')
      .select('*')
      .order('id', { ascending: true })

    if (from && to) {
      query = query.gte('id', parseInt(from)).lte('id', parseInt(to))
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// إضافة مشترك جديد
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('subscribers')
      .insert([{
        id: body.id,
        name: body.name,
        area_id: body.areaId,
        branch_id: body.branchId,
        phone: body.phone || null,
        property_type: body.propertyType || 'سكني',
        meter_type: body.meterType || '4 متر',
        detailed_address: body.detailedAddress || null,
        remaining_prev: 0,
        fee: 0,
      }])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
