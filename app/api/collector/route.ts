import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('collector')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || {
      name: '',
      phone: '',
      range_from: 1,
      range_to: 9999
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    const { data: existing } = await supabase
      .from('collector')
      .select('id')
      .limit(1)
      .single()

    let result

    if (existing) {
      result = await supabase
        .from('collector')
        .update({
          name: body.name,
          phone: body.phone,
          range_from: body.rangeFrom,
          range_to: body.rangeTo,
        })
        .eq('id', existing.id)
        .select()
        .single()
    } else {
      result = await supabase
        .from('collector')
        .insert([{
          name: body.name,
          phone: body.phone,
          range_from: body.rangeFrom,
          range_to: body.rangeTo,
        }])
        .select()
        .single()
    }

    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 })
    }

    return NextResponse.json(result.data)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
