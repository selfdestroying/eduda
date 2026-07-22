'use client'

import { Badge } from '@/src/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/src/components/ui/popover'
import { Progress } from '@/src/components/ui/progress'
import { cn } from '@/src/lib/utils'
import { Lightbulb } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Tips ──────────────────────────────────────────────────────────────

const TICK_MS = 100
const CYCLE_MS = 10000
const MAX_TICKS = CYCLE_MS / TICK_MS
const FADE_MS = 200

const TIPS = [
  // Навигация
  'Нажмите Ctrl+B, чтобы быстро свернуть или развернуть боковую панель.',
  'Фильтры таблиц сохраняются в URL - скопируйте ссылку и отправьте коллеге, чтобы он увидел ту же выборку.',
  'На панели управления отображаются уроки на выбранный день. Используйте фильтры по курсу, локации и учителю.',

  // Посещаемость и уроки
  'Галочка ✓ рядом с уроком означает, что все ученики отмечены. Крестик ✗ - есть неотмеченные.',
  'Если ученик пропустил урок без предупреждения - списывается 1 занятие. С предупреждением - баланс не меняется.',
  'Пропущенный урок можно отработать.',
  'Алерт «Посещаемость» появляется через 2 часа после окончания урока, если остались неотмеченные ученики.',
  'Два пропуска подряд - ученик попадает в «Зону риска». Обратите внимание на таких учеников.',

  // Кошельки и баланс
  'У ученика может быть несколько кошельков - по одному на каждую группу с независимым балансом.',
  'Баланс можно перенести между кошельками одного ученика или объединить два кошелька в один.',

  // Умная лента
  'Надоедливый алерт можно отложить на 2 дня. Он вернётся автоматически.',
  'Переключайтесь между вкладками «Активные» и «Отложенные», чтобы управлять всеми алертами.',

  // Группы и расписание
  'Тип группы определяет ставку учителя за урок. Настройте типы в разделе «Школа → Ставки».',
  'В карточке группы видны расписание, все уроки, учителя и ученики - всё в одном месте.',

  // Финансы
  'Ставка учителя = базовая сумма + бонус за каждого присутствующего ученика.',

  // Ученики
  'Используйте вкладки «Активные», «Отсутствующие» и «Отчисленные» для быстрой фильтрации учеников.',
  'Кликните по заголовку столбца таблицы для сортировки. Повторный клик - обратный порядок.',

  // Магазин
  'В магазине можно создавать товары с картинками, ценами и категориями, а заказы отслеживать на отдельной странице.',

  // Дополнительно
  'Расписание группы задаётся при создании - дни недели и время автоматически подставляются в новые уроки.',
  'На странице статистики можно отслеживать динамику учеников: сколько пришло, сколько ушло, и как меняется база.',
  'Учитель может видеть свои начисления в разделе «Зарплаты».',
  'Переключите тему оформления (светлая/тёмная) кнопкой в боковой панели.',
  'Платежи ученика привязываются к конкретному кошельку - так баланс пополняется точечно по группам.',
  'В карточке ученика видны все его группы, кошельки, история посещений и платежей.',
] as const

// ─── Component ─────────────────────────────────────────────────────────

function getRandomIndex(exclude?: number) {
  let next: number
  do {
    next = Math.floor(Math.random() * TIPS.length)
  } while (TIPS.length > 1 && next === exclude)
  return next
}

export function QuickTip() {
  const [open, setOpen] = useState(false)
  const [tipIndex, setTipIndex] = useState(() => getRandomIndex())
  const [progress, setProgress] = useState(0)
  const [animating, setAnimating] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    intervalRef.current = null
    timeoutRef.current = null
  }, [])

  const startCycle = useCallback(() => {
    clearTimers()
    intervalRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev + 1 >= MAX_TICKS) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          intervalRef.current = null

          setAnimating(true)
          return MAX_TICKS
        }
        return prev + 1
      })
    }, TICK_MS)
  }, [clearTimers])

  useEffect(() => {
    if (!animating) return

    timeoutRef.current = setTimeout(() => {
      setTipIndex((prev) => getRandomIndex(prev))
      setProgress(0)
      setAnimating(false)
      startCycle()
    }, FADE_MS)

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [animating, startCycle])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setTipIndex((prev) => getRandomIndex(prev))
      setProgress(0)
      setAnimating(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      startCycle()
    } else {
      clearTimers()
    }

    return clearTimers
  }, [open, startCycle, clearTimers])

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        render={<Badge className="bg-primary/10 hover:bg-primary/20 cursor-pointer select-none" />}
        nativeButton={false}
      >
        <Lightbulb className="text-primary" />
      </PopoverTrigger>

      <PopoverContent align="start" className="w-72">
        <PopoverHeader>
          <PopoverTitle className="flex items-center gap-2">
            <Lightbulb className="text-primary size-4" />
            Быстрый совет
          </PopoverTitle>

          <PopoverDescription
            className={cn(
              'text-muted-foreground text-xs leading-relaxed transition-all',
              animating
                ? 'translate-y-1 opacity-0 duration-200'
                : 'translate-y-0 opacity-100 duration-300',
            )}
          >
            {TIPS[tipIndex]}
          </PopoverDescription>

          <Progress value={progress} max={MAX_TICKS} />
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
