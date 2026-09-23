'use client'

import React from 'react'
import { RealThreeDCanvas } from './RealThreeDCanvas'

interface ThreeDWrapperProps {
  children?: React.ReactNode
  variant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'indigo' | 'purple' | 'slate'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  animated?: boolean
  onClick?: () => void
}

const variantStyles = {
  cyan: {
    gradient: 'from-cyan-400 via-sky-500 to-blue-600',
    shadow: 'shadow-[0_12px_24px_rgba(14,165,233,0.45),inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(0,0,0,0.35)]',
    border: 'border-cyan-200/60',
    glow: '#0ea5e9'
  },
  emerald: {
    gradient: 'from-emerald-400 via-teal-500 to-green-600',
    shadow: 'shadow-[0_12px_24px_rgba(16,185,129,0.45),inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(0,0,0,0.35)]',
    border: 'border-emerald-200/60',
    glow: '#10b981'
  },
  amber: {
    gradient: 'from-amber-300 via-orange-400 to-amber-600',
    shadow: 'shadow-[0_12px_24px_rgba(245,158,11,0.45),inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(0,0,0,0.35)]',
    border: 'border-amber-200/60',
    glow: '#f59e0b'
  },
  rose: {
    gradient: 'from-rose-400 via-red-500 to-pink-600',
    shadow: 'shadow-[0_12px_24px_rgba(239,68,68,0.45),inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(0,0,0,0.35)]',
    border: 'border-rose-200/60',
    glow: '#ef4444'
  },
  indigo: {
    gradient: 'from-indigo-400 via-violet-500 to-purple-600',
    shadow: 'shadow-[0_12px_24px_rgba(99,102,241,0.45),inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(0,0,0,0.35)]',
    border: 'border-indigo-200/60',
    glow: '#6366f1'
  },
  purple: {
    gradient: 'from-fuchsia-400 via-purple-500 to-violet-700',
    shadow: 'shadow-[0_12px_24px_rgba(168,85,247,0.45),inset_0_2px_4px_rgba(255,255,255,0.8),inset_0_-4px_8px_rgba(0,0,0,0.35)]',
    border: 'border-purple-200/60',
    glow: '#a855f7'
  },
  slate: {
    gradient: 'from-slate-600 via-slate-700 to-slate-900',
    shadow: 'shadow-[0_12px_24px_rgba(15,23,42,0.45),inset_0_2px_4px_rgba(255,255,255,0.4),inset_0_-4px_8px_rgba(0,0,0,0.5)]',
    border: 'border-slate-400/40',
    glow: '#334155'
  }
}

const sizeStyles = {
  sm: { box: 'w-8 h-8 rounded-xl text-xs', px: 32 },
  md: { box: 'w-10 h-10 rounded-2xl text-sm', px: 40 },
  lg: { box: 'w-13 h-13 rounded-3xl text-base', px: 52 },
  xl: { box: 'w-16 h-16 rounded-3xl text-xl', px: 64 }
}

export function ThreeDBox({
  children,
  variant = 'cyan',
  size = 'md',
  className = '',
  animated = false,
  onClick
}: ThreeDWrapperProps) {
  const style = variantStyles[variant]
  const sz = sizeStyles[size]

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none preserve-3d transition-all duration-300 transform-gpu hover:-translate-y-1 hover:rotate-3 hover:scale-105 active:translate-y-0.5 active:scale-95 ${
        animated ? 'animate-float-3d' : ''
      } ${className}`}
      style={{ perspective: '800px' }}
    >
      {/* الظل ثلاثي الأبعاد الخلفي في الفضاء */}
      <div className="absolute inset-0 rounded-2xl bg-black/25 blur-md transform translate-y-2.5 scale-90 translate-z-[-12px]" />
      
      {/* الجسم ثلاثي الأبعاد 3D Glass Box */}
      <div
        className={`relative flex items-center justify-center bg-gradient-to-br ${style.gradient} ${style.shadow} ${style.border} border text-white font-bold ${sz.box} transform-gpu`}
        style={{
          transform: 'rotateX(10deg) rotateY(-10deg) translateZ(12px)',
          textShadow: '0 2px 4px rgba(0,0,0,0.5)'
        }}
      >
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent rounded-t-xl pointer-events-none" />
        {children}
      </div>
    </div>
  )
}

// 1. أيقونة ومجسم البحث ثلاثي الأبعاد الحقيقي 3D WebGL
export function ThreeDSearchIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="sphere" color="#0ea5e9" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  )
}

// 2. أيقونة ومجسم الفلتر ثلاثي الأبعاد الحقيقي 3D WebGL
export function ThreeDFilterIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="crystal" color="#6366f1" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    </div>
  )
}

// 3. أيقونة الاتصال ثلاثية الأبعاد الحقيقية 3D WebGL
export function ThreeDPhoneIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="phone" color="#10b981" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
      </svg>
    </div>
  )
}

// 4. أيقونة الواتساب ثلاثية الأبعاد الحقيقية 3D WebGL
export function ThreeDWhatsAppIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="phone" color="#059669" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="currentColor" viewBox="0 0 24 24">
        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.652zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.157 4.228 4.234-1.111z" />
      </svg>
    </div>
  )
}

// 5. أيقونة خريطة والموقع الجغرافي ثلاثية الأبعاد الحقيقية 3D WebGL
export function ThreeDLocationIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="location" color="#ef4444" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  )
}

// 6. أيقونة الصور ومعاينة الباب ثلاثية الأبعاد الحقيقية 3D WebGL
export function ThreeDImageIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="crystal" color="#f59e0b" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  )
}

// 7. أيقونة التعديل والقلم ثلاثية الأبعاد الحقيقية 3D WebGL
export function ThreeDEditIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="sphere" color="#06b6d4" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </div>
  )
}

// 8. أيقونة الإعدادات ثلاثية الأبعاد الحقيقية 3D WebGL
export function ThreeDSettingsIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="settings" color="#475569" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none animate-spin-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    </div>
  )
}

// 9. أيقونة الأسعار ثلاثية الأبعاد الحقيقية 3D WebGL
export function ThreeDPriceIcon({ className = '', size = 'md' }: { className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const sz = sizeStyles[size]
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      <RealThreeDCanvas type="price" color="#d97706" size={sz.px} animated={true} />
      <svg className="absolute w-4 h-4 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.7)] pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V6m0 8v2m0-6c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
  )
}

// 10. شارة أو كارت الحالة 3D مجسم لبطاقات العميل
export function ThreeDStatusBadge({ status }: { status: string }) {
  const configs: Record<string, { variant: 'rose' | 'emerald' | 'amber' | 'cyan' | 'indigo' | 'purple' | 'slate'; label: string }> = {
    'ممتنع': { variant: 'rose', label: 'ممتنع' },
    'مؤجر': { variant: 'cyan', label: 'مؤجر' },
    'مؤجر لا يعلم بالتفاصيل': { variant: 'amber', label: 'مؤجر لا يعلم' },
    'يدفع بالدائرة': { variant: 'indigo', label: 'يدفع بالدائرة' },
    'يجب فحص حسابه': { variant: 'purple', label: 'فحص الحساب' },
    'يدفع باستمرار': { variant: 'emerald', label: 'يدفع باستمرار' },
    'مفلش': { variant: 'slate', label: 'مفلش' }
  }

  const cfg = configs[status] || { variant: 'cyan', label: status }

  return (
    <ThreeDBox variant={cfg.variant} size="sm" className="px-2.5 py-0.5 !w-auto !h-auto text-[11px] font-bold">
      <span>{cfg.label}</span>
    </ThreeDBox>
  )
}
