import React from 'react'

/** يحيط وصف العقار بعد «عبارة عن / عبارة» بوسم أحمر إن لم يكن موجوداً */
export function autoMarkPropertyRed(text: string): string {
  if (!text || text.includes('<red>')) return text

  let result = text

  result = result.replace(
    /(عبارة(?:\s*عن)?\s+)(.+?)(?=\s+(?:ضمن|وخالية|خالية|علماً|علما|كما|ولا|وليس|ويخلو|وتقع|وفي|في حي|في منطقة|حسب)|[.،,]|$)/,
    '$1<red>$2</red>'
  )

  if (!result.includes('<red>')) {
    result = result.replace(
      /\(([^)]*(?:بناية|دار|دارين|قطعة|ارض|أرض|بستان|محل|مكتب)[^)]*)\)/gi,
      '(<red>$1</red>)'
    )
  }

  return result
}

/** يعرض نص التقرير مع تلوين وصف العقار بالأحمر بدل إظهار وسوم &lt;red&gt; */
export function renderHighlightedInspectionText(text: string): React.ReactNode {
  if (!text) return null

  const marked = autoMarkPropertyRed(text)

  if (marked.includes('<red>')) {
    const parts = marked.split(/(<red>[\s\S]*?<\/red>)/gi)
    return (
      <>
        {parts.map((part, i) => {
          if (part.startsWith('<red>') && part.endsWith('</red>')) {
            const inner = part.replace(/<\/?red>/gi, '')
            return (
              <span
                key={i}
                className="font-black"
                style={{ color: '#dc2626' }}
              >
                {inner}
              </span>
            )
          }
          return <span key={i}>{part}</span>
        })}
      </>
    )
  }

  return <span>{text}</span>
}
