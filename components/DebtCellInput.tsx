'use client'

import React, { memo, useState, useEffect, useRef } from 'react'
import { formatInputDisplay } from './MainApp'

interface DebtCellInputProps {
  id?: string
  initialValue: string | number | null | undefined
  placeholder?: string
  className?: string
  style?: React.CSSProperties
  isZeroEmpty?: boolean
  inputMode?: 'numeric' | 'text'
  onSave: (val: string) => void
}

/**
 * مكون خلية جدول الديون المعزول والمحسن فائق السرعة
 * يحتفظ بالحالة محلياً لمنع إعادة تصيير المكون الرئيسي بالكامل أثناء الكتابة
 * مما يمنح استجابة فورية 0 ميلي ثانية وبدون أي تأخير نهائياً
 */
const DebtCellInput = memo(function DebtCellInput({
  id,
  initialValue,
  placeholder = '0',
  className = '',
  style,
  isZeroEmpty = false,
  inputMode = 'numeric',
  onSave
}: DebtCellInputProps) {
  const formatVal = (v: string | number | null | undefined) => {
    if (isZeroEmpty && (v === 0 || v === '0')) return ''
    return formatInputDisplay(v)
  }

  const [localVal, setLocalVal] = useState<string>(() => formatVal(initialValue))
  const [isFocused, setIsFocused] = useState<boolean>(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedValRef = useRef<string>(formatVal(initialValue))
  const inputRef = useRef<HTMLInputElement>(null)

  // مزامنة القيمة عندما تتغير من الخارج والمستخدم لا يقوم بالكتابة حالياً في هذا الحقل
  useEffect(() => {
    if (!isFocused) {
      const nextDisplay = formatVal(initialValue)
      setLocalVal(nextDisplay)
      lastSavedValRef.current = nextDisplay
    }
  }, [initialValue, isFocused])

  // تنظيف أي مؤقت معلق عند إلغاء التركيب
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const commitSave = (rawVal: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const formatted = formatInputDisplay(rawVal)
    if (formatted !== lastSavedValRef.current) {
      lastSavedValRef.current = formatted
      onSave(formatted)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVal = e.target.value
    // تنسيق سريع محلي فوري دون إثقال الصفحة ككل
    const formatted = formatInputDisplay(newVal)
    setLocalVal(formatted)

    // تأخير الحفظ الفعلي بهدوء بعد توقف المستخدم
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      commitSave(formatted)
    }, 500)
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text')
    if (text) {
      e.preventDefault()
      const formatted = formatInputDisplay(text)
      setLocalVal(formatted)
      commitSave(formatted)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(false)
    commitSave(e.target.value)
  }

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true)
    setTimeout(() => {
      try {
        e.target.select()
      } catch {}
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitSave(localVal)
      inputRef.current?.blur()
    }
  }

  return (
    <input
      ref={inputRef}
      id={id}
      value={localVal}
      onChange={handleChange}
      onPaste={handlePaste}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      inputMode={inputMode}
      type="text"
      style={style}
    />
  )
})

export default DebtCellInput
