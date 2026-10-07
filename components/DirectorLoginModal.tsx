'use client'

import React, { useState } from 'react'

interface DirectorLoginModalProps {
  onSuccess: (token: string) => void
  onCancel?: () => void
}

export default function DirectorLoginModal({ onSuccess, onCancel }: DirectorLoginModalProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin.trim()) {
      setError('يرجى إدخال الرمز السري')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // إرسال الطلب للسيرفر للتحقق الآمن دون كشف الرمز في كود المتصفح
      const res = await fetch('/api/auth/director', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pin.trim() })
      })

      const data = await res.json()

      if (res.ok && data.success) {
        // حفظ رمز الجلسة
        localStorage.setItem('basra_director_session', data.token)
        onSuccess(data.token)
      } else {
        setError(data.error || 'رمز الدخول غير صحيح، يرجى المحاولة ثانية')
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 font-sans" dir="rtl">
      <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-100 text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-blue-700 to-cyan-500 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/30">
          ماء
        </div>

        <h2 className="text-xl font-black text-slate-900">مديرية ماء محافظة البصرة</h2>
        <p className="text-xs font-bold text-blue-700 mt-1 mb-6">تسجيل دخول مدير الواردات</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-right">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              أدخل الرمز السري للمديرية:
            </label>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-blue-600 focus:ring-4 focus:ring-blue-100 text-center font-mono text-lg tracking-widest outline-none transition"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl text-center animate-shake">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-500/25 transition disabled:opacity-50"
          >
            {isLoading ? 'جارِ التحقق...' : 'دخول لوحة التحكم'}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2.5 text-xs text-slate-500 hover:text-slate-700 font-bold"
            >
              إلغاء
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
