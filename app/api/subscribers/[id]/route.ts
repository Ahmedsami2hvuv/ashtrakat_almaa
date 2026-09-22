import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// تعديل مشترك
export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const id = parseInt(params.id)

    const updateData: Record<string, unknown> = {}

    if (body.name !== undefined) updateData.name = body.name
    if (body.areaId !== undefined) updateData.area_id = body.areaId
    if (body.branchId !== undefined) updateData.branch_id = body.branchId
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.propertyType !== undefined) updateData.property_type = body.propertyType
    if (body.meterType !== undefined) updateData.meter_type = body.meterType
    if (body.detailedAddress !== undefined) updateData.detailed_address = body.detailedAddress
    if (body.locationLat !== undefined) updateData.location_lat = body.locationLat
    if (body.locationLng !== undefined) updateData.location_lng = body.locationLng
    if (body.locationLink !== undefined) updateData.location_link = body.locationLink
    if (body.doorImage !== undefined) updateData.door_image = body.doorImage
    if (body.remainingPrev !== undefined) updateData.remaining_prev = body.remainingPrev
    if (body.fee !== undefined) updateData.fee = body.fee

    const { data, error } = await supabase
      .from('subscribers')
      .update(updateData)
      .eq('id', id)
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

// حذف مشترك
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id)

    const { error } = await supabase
      .from('subscribers')
      .delete()
      .eq('id', id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'حدث خطأ غير متوقع'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
