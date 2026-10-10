'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registerSW = async () => {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
          console.log('Service Worker Registered successfully:', reg.scope)

          // إذا كان هناك عامل خدمة بانتظار التفعيل، نفعله فوراً
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' })
          }

          reg.onupdatefound = () => {
            const installing = reg.installing
            if (installing) {
              installing.onstatechange = () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('New content is available; please refresh.')
                }
              }
            }
          }
        } catch (err) {
          console.warn('Service Worker registration failed:', err)
        }
      }

      // التسجيل فوراً إذا كانت الصفحة مكتملة أو بعد التحميل مباشرة
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerSW()
      } else {
        window.addEventListener('load', registerSW)
      }
    }
  }, [])

  return null
}
