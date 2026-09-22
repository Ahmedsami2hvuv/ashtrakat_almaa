import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// جلب كل المناطق مع الأفرع
export async function GET() {
  try {
    const [areasResult, branchesResult] = await Promise.all([
      supabase.from('areas').select('*').order('sort_order', { ascending: true }),
      supabase.from('branches').select('*').order('sort_order', { ascending: true })
    ])

    if (areasResult.error) {
      return NextResponse.json({ error: areasResult.error.message }, { status: 500 })
    }

    if (branchesResult.error) {
      return NextResponse.json({ error: branchesResult.error.message }, { status: 500 })
    }

    const areas = (areasResult.data || []).map((area) => ({
      id: area.id,
      name: area.name,
      branches: (branchesResult.data || [])
        .filter((b) => b.area_id === area.id)
        .map((b) => ({ id: b.id, name: b.name }))
    }))

    return NextResponse.json(areas)
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// إضافة منطقة أو فرع
export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (body.type === 'area') {
      const { data: existing } = await supabase
        .from('areas')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1

      const { data, error } = await supabase
        .from('areas')
        .insert([{ id: body.id, name: body.name, sort_order: nextOrder }])
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    if (body.type === 'branch') {
      const { data: existing } = await supabase
        .from('branches')
        .select('sort_order')
        .eq('area_id', body.areaId)
        .order('sort_order', { ascending: false })
        .limit(1)

      const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1

      const { data, error } = await supabase
        .from('branches')
        .insert([{ id: body.id, area_id: body.areaId, name: body.name, sort_order: nextOrder }])
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// تعديل اسم منطقة أو فرع
export async function PUT(request: Request) {
  try {
    const body = await request.json()

    if (body.type === 'area') {
      const { data, error } = await supabase
        .from('areas')
        .update({ name: body.name })
        .eq('id', body.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    if (body.type === 'branch') {
      const { data, error } = await supabase
        .from('branches')
        .update({ name: body.name })
        .eq('id', body.id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json(data)
    }

    return NextResponse.json({ error: 'نوع غير معروف' }, { status: 400 })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// حذف فرع أو منطقة
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const id = searchParams.get('id')

    if (!id) return NextResponse.json({ error: 'id مطلوب' }, { status: 400 })

    const table = type === 'area' ? 'areas' : 'branches'
    const { error } = await supabase.from(table).delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
