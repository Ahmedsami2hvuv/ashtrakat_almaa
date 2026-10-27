import { NextResponse } from 'next/server'
import { InspectionRecord } from '@/lib/inspectionTypes'

export const dynamic = 'force-dynamic'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://amqyttpcezmbsylsdgzd.supabase.co'
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Gn4ywDpWxxEtLPdtQVxxBA_yPNoEVgx'
const SYNC_ROW_KEY = 'inspections_data_v1'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) {
      return NextResponse.json({ success: false, error: 'المعرف مفقود' }, { status: 400 })
    }

    const res = await fetch(
      `${SB_URL}/rest/v1/app_sync?key=eq.${SYNC_ROW_KEY}&select=value`,
      {
        headers: {
          apikey: SB_KEY,
          Authorization: `Bearer ${SB_KEY}`
        },
        cache: 'no-store'
      }
    )

    if (res.ok) {
      const rows = await res.json()
      if (rows && rows[0]?.value) {
        const list: InspectionRecord[] = rows[0].value
        const found = list.find(item => item.id === id || item.token === id)
        if (found) {
          return NextResponse.json({ success: true, data: found })
        }
      }
    }

    return NextResponse.json({ success: false, error: 'لم يتم العثور على الكشف المطلوب' }, { status: 404 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'خطأ في جلب بيانات الكشف'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
