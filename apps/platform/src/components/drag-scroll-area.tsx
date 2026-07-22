'use client'
import { ReactNode, useEffect, useRef, useState } from 'react'

export default function DragScrollArea({
  children,
  initialScroll,
}: {
  children: ReactNode
  initialScroll?: 'start' | 'end' | number
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDown, setIsDown] = useState(false)
  const [startX, setStartX] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    setIsDown(true)
    setStartX(e.pageX - containerRef.current.offsetLeft)
    setScrollLeft(containerRef.current.scrollLeft)
  }

  const handleMouseLeave = () => setIsDown(false)
  const handleMouseUp = () => setIsDown(false)

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDown || !containerRef.current) return
    e.preventDefault()
    const x = e.pageX - containerRef.current.offsetLeft
    const walk = (x - startX) * 1 // множитель скорости (1 = 1:1)
    containerRef.current.scrollLeft = scrollLeft - walk
  }

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let targetScroll = 0

    if (initialScroll === 'end') {
      targetScroll = container.scrollWidth - container.clientWidth
    } else if (initialScroll === 'start') {
      targetScroll = 0
    } else if (typeof initialScroll === 'number') {
      targetScroll = initialScroll
    }

    // Плавно или мгновенно
    container.scrollTo({
      left: targetScroll,
      behavior: 'smooth',
    })
  }, [initialScroll, children])

  return (
    <div
      ref={containerRef}
      className="scrollbar-hide flex cursor-grab overflow-x-scroll select-none"
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
    >
      {children}
    </div>
  )
}
