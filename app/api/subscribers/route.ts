import { NextResponse } from 'next/server'
import { supabase, supabaseConfigurationError } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// جلب كل المشتركين
export async function GET(request: Request) {
  try {
    if (supabaseConfigurationError) {
      return NextResponse.json({ error: supabaseConfigurationError }, { status: 503 })
    }

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
    if (supabaseConfigurationError) {
      return NextResponse.json({ error: supabaseConfigurationError }, { status: 503 })
    }

    const body = await request.json()

    if (!Number.isInteger(Number(body.id)) || Number(body.id) <= 0 || !body.name?.trim()) {
      return NextResponse.json({ error: 'رقم واسم المشترك مطلوبان' }, { status: 400 })
    }

    // المناطق الافتراضية كانت موجودة في واجهة المستخدم فقط، لذلك كان قيد
    // foreign key يمنع حفظ أول مشترك على قاعدة بيانات جديدة.
    if (body.areaId && body.areaName) {
      const { error: areaError } = await supabase
        .from('areas')
        .upsert(
          { id: body.areaId, name: body.areaName, sort_order: body.areaOrder || 1 },
          { onConflict: 'id' }
        )

      if (areaError) {
        return NextResponse.json({ error: areaError.message }, { status: 500 })
      }
    }

    if (body.branchId && body.areaId && body.branchName) {
      const { error: branchError } = await supabase
        .from('branches')
        .upsert(
          {
            id: body.branchId,
            area_id: body.areaId,
            name: body.branchName,
            sort_order: body.branchOrder || 1
          },
          { onConflict: 'id' }
        )

      if (branchError) {
        return NextResponse.json({ error: branchError.message }, { status: 500 })
      }
    }

    const { data, error } = await supabase
      .from('subscribers')
      .insert([{
        id: Number(body.id),
        name: body.name.trim(),
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
