'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => {
            console.log('Service Worker registered successfully with scope:', reg.scope)
          })
          .catch((err) => {
            console.warn('Service Worker registration failed:', err)
          })
      })
    }
  }, [])

  return null
}
