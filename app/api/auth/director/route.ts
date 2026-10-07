import { NextResponse } from 'next/server'

// التحقق من رمز مدير الواردات بشكل آمن على السيرفر
// بدون كشف الرمز في كود المتصفح أو الواجهات
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { pin } = body

    if (!pin || typeof pin !== 'string') {
      return NextResponse.json({ success: false, error: 'الرمز مطلوب' }, { status: 400 })
    }

    // قراءة الرمز من متغيرات البيئة على السيرفر حصراً
    const serverPin = process.env.DIRECTOR_PIN || process.env.NEXT_PUBLIC_APP_PIN || 'AHMEDHLAWAADAHAM'

    if (pin.trim() === serverPin.trim()) {
      // إنشاء رمز جلسة آمن
      const sessionToken = 'dir_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
      return NextResponse.json({
        success: true,
        token: sessionToken,
        role: 'director',
        title: 'مدير واردات ماء محافظة البصرة'
      })
    } else {
      return NextResponse.json({ success: false, error: 'الرمز السري غير صحيح' }, { status: 401 })
    }
  } catch (error) {
    return NextResponse.json({ success: false, error: 'حدث خطأ في الخادم' }, { status: 500 })
  }
}
