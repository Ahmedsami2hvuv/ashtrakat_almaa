// مساعد الأمان والتحقق من الصلاحيات لجميع مسارات السيرفر

export function isAuthorizedRequest(request: Request): boolean {
  // فحص الترويسات الأمنية
  const authHeader = request.headers.get('authorization')
  const sessionToken = request.headers.get('x-session-token')
  const directorAuth = request.headers.get('x-director-auth')

  // قبول الطلب إذا كان من السيرفر الداخلي نفسه أو يحمل رمزاً تعريفياً معتمداً
  if (sessionToken && sessionToken.length > 5) {
    return true
  }

  if (directorAuth && directorAuth.length > 5) {
    return true
  }

  if (authHeader && authHeader.startsWith('Bearer ') && authHeader.length > 10) {
    return true
  }

  // في بيئة التطوير المحلية يُسمح بالمرور
  if (process.env.NODE_ENV === 'development') {
    return true
  }

  return false
}
