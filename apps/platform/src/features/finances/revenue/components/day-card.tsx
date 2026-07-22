'use client'

import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/src/components/ui/collapsible'
import { DayGroup } from '../types'

import { Badge } from '@/src/components/ui/badge'
import { Button } from '@/src/components/ui/button'
import { formatDate } from '@/src/lib/timezone'
import { Calendar, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import LessonCard from './lesson-card'
import { formatCurrency } from '@/src/lib/utils'

interface DayCardProps {
  day: DayGroup
  allCardsOpen: boolean
}

export default function DayCard({ day, allCardsOpen }: DayCardProps) {
  const [isOpen, setIsOpen] = useState(allCardsOpen)
  const [prevAllCardsOpen, setPrevAllCardsOpen] = useState(allCardsOpen)
  if (prevAllCardsOpen !== allCardsOpen) {
    setPrevAllCardsOpen(allCardsOpen)
    setIsOpen(allCardsOpen)
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="text-muted-foreground size-4" />
            <div className="flex gap-2 text-sm font-medium">
              {formatDate(day.date)}
              <span className="text-muted-foreground font-normal capitalize">{day.dayOfWeek}</span>

              <Badge variant="secondary">
                {day.lessons.length}{' '}
                {day.lessons.length === 1 ? 'урок' : day.lessons.length < 5 ? 'урока' : 'уроков'}
              </Badge>
            </div>
          </CardTitle>
          <CardAction>
            <CollapsibleTrigger
              render={
                <Button size="icon" variant="ghost">
                  {isOpen ? <ChevronUp /> : <ChevronDown />}
                </Button>
              }
            />
          </CardAction>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
            <div className="space-y-2">
              {day.lessons.map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} allCardsOpen={allCardsOpen} />
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
        <CardFooter>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground text-right text-xs">Итого за день:</span>
            <span className="text-right text-xs font-semibold tabular-nums">
              {formatCurrency(day.dayRevenue)}
            </span>
          </div>
        </CardFooter>
      </Card>
    </Collapsible>
  )
}
