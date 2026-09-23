'use client'

import React, { useEffect, useRef } from 'react'

interface RealThreeDProps {
  type: 'sphere' | 'crystal' | 'phone' | 'location' | 'filter' | 'settings' | 'price'
  color?: string
  size?: number
  className?: string
  animated?: boolean
}

export function RealThreeDCanvas({
  type = 'sphere',
  color = '#0ea5e9',
  size = 48,
  className = '',
  animated = true
}: RealThreeDProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let angleX = 0.2
    let angleY = 0.3
    let time = 0

    // زوايا وإحداثيات ثلاثية الأبعاد 3D
    const render = () => {
      ctx.clearRect(0, 0, size, size)
      const cx = size / 2
      const cy = size / 2
      const radius = size * 0.38

      time += 0.03
      if (animated) {
        angleY += 0.02
        angleX += 0.01
      }

      ctx.save()
      ctx.translate(cx, cy)

      // رسم مجسم ثلاثي الأبعاد بالعمق والضوء
      if (type === 'sphere') {
        // كرة ثلاثية الأبعاد تفاعلية 3D Sphere مع إضاءة حية
        const lightX = Math.cos(time) * 0.4 - 0.3
        const lightY = Math.sin(time * 0.8) * 0.4 - 0.4

        const grad = ctx.createRadialGradient(
          lightX * radius, lightY * radius, radius * 0.1,
          0, 0, radius
        )
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.3, color)
        grad.addColorStop(0.85, '#0f172a')
        grad.addColorStop(1, '#020617')

        // ظل ثلاثي الأبعاد سفلي
        ctx.beginPath()
        ctx.ellipse(0, radius * 0.9, radius * 0.7, radius * 0.2, 0, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'
        ctx.fill()

        // رسم الجسم الكروي 3D
        ctx.beginPath()
        ctx.arc(0, 0, radius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // لمعة كريستالية مائية ثلاثية الأبعاد 3D Highlight
        ctx.beginPath()
        ctx.ellipse(lightX * radius * 0.8, lightY * radius * 0.8, radius * 0.3, radius * 0.15, Math.PI / 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.fill()

      } else if (type === 'crystal') {
        // كريستال ثلاثي الأبعاد 3D Gem / Octahedron
        const vertices = [
          [0, -radius, 0],
          [radius * Math.cos(angleY), 0, radius * Math.sin(angleY)],
          [radius * Math.cos(angleY + Math.PI / 2), 0, radius * Math.sin(angleY + Math.PI / 2)],
          [radius * Math.cos(angleY + Math.PI), 0, radius * Math.sin(angleY + Math.PI)],
          [radius * Math.cos(angleY + 3 * Math.PI / 2), 0, radius * Math.sin(angleY + 3 * Math.PI / 2)],
          [0, radius, 0]
        ]

        // إسقاط الزوايا ثلاثية الأبعاد
        const projected = vertices.map(([x, y, z]) => {
          const rotX = y * Math.sin(angleX) + z * Math.cos(angleX)
          const rotY = x
          return [rotY, rotX]
        })

        // رسم أوجه الكريستال 3D
        const faces = [
          [0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
          [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]
        ]

        faces.forEach(([i, j, k], idx) => {
          ctx.beginPath()
          ctx.moveTo(projected[i][0], projected[i][1])
          ctx.lineTo(projected[j][0], projected[j][1])
          ctx.lineTo(projected[k][0], projected[k][1])
          ctx.closePath()

          const alpha = 0.4 + (idx % 4) * 0.15
          ctx.fillStyle = color
          ctx.globalAlpha = alpha
          ctx.fill()
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
          ctx.lineWidth = 1.2
          ctx.stroke()
        })
        ctx.globalAlpha = 1.0

      } else if (type === 'phone' || type === 'location' || type === 'filter' || type === 'settings' || type === 'price') {
        // مجسم كروي متوهج ثلاثي الأبعاد مع حلق ضوئي 3D Floating Ring
        const grad = ctx.createRadialGradient(
          -radius * 0.3, -radius * 0.3, radius * 0.1,
          0, 0, radius
        )
        grad.addColorStop(0, '#ffffff')
        grad.addColorStop(0.4, color)
        grad.addColorStop(1, '#090d16')

        // حلقة ثلاثية الأبعاد تدور في الفضاء 3D Ring
        ctx.save()
        ctx.rotate(angleY)
        ctx.beginPath()
        ctx.ellipse(0, 0, radius * 1.25, radius * 0.4, angleX, 0, Math.PI * 2)
        ctx.strokeStyle = color
        ctx.lineWidth = 2.5
        ctx.shadowColor = color
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.restore()

        // الجسم الكروي الرئيسي
        ctx.beginPath()
        ctx.arc(0, 0, radius * 0.75, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()
      }

      ctx.restore()

      if (animated) {
        animFrameRef.current = requestAnimationFrame(render)
      }
    }

    render()

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [type, color, size, animated])

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="transform-gpu transition-transform hover:scale-110 active:scale-95 cursor-pointer"
        style={{ width: `${size}px`, height: `${size}px` }}
      />
    </div>
  )
}
