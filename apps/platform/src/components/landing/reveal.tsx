'use client'

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/src/lib/utils'

type RevealProps = {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Задержка появления в секундах */
  delay?: number
  id?: string
}

/**
 * Обёртка, плавно проявляющая содержимое при попадании в область просмотра.
 * Если элемент уже виден при монтировании — показывается сразу без анимации ожидания.
 */
export function Reveal({ children, className, style, delay = 0, id }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (el.getBoundingClientRect().top < window.innerHeight) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      id={id}
      className={cn('eduda-reveal', visible && 'is-visible', className)}
      style={{ transitionDelay: delay ? `${delay}s` : undefined, ...style }}
    >
      {children}
    </div>
  )
}
