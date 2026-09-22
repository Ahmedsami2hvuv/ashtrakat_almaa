import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('pricing')
      .select('*')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const pricing: Record<string, Record<string, number>> = {
      'سكني': {},
      'تجاري': {}
    }

    ;(data || []).forEach((row) => {
      if (!pricing[row.property_type]) {
        pricing[row.property_type] = {}
      }
      pricing[row.property_type][row.meter_type] = row.amount
    })

    return NextResponse.json(pricing)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    const { data, error } = await supabase
      .from('pricing')
      .upsert({
        property_type: body.propertyType,
        meter_type: body.meterType,
        amount: body.amount,
      }, {
        onConflict: 'property_type,meter_type'
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
