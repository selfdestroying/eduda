'use client'

import { Button } from '@/src/components/ui/button'
import { Label } from '@/src/components/ui/label'
import { formatDate } from '@/src/lib/timezone'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader } from 'lucide-react'
import { useMemo, useState, useTransition } from 'react'
import type { DayGroup } from '../types'
import DayCard from './day-card'

interface RevenueTimelineProps {
  days: DayGroup[]
}

const DEFAULT_PAGE_SIZE = 7

export default function RevenueTimeline({ days }: RevenueTimelineProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [isPaginationTransitioning, startPaginationTransition] = useTransition()
  const [isCardsOpenTransitioning, startCardsOpenTransition] = useTransition()
  const [allCardsOpen, setAllCardsOpen] = useState(false)

  const totalPages = Math.ceil(days.length / DEFAULT_PAGE_SIZE)
  const safePage = Math.min(currentPage, totalPages || 1)

  const pageDays = useMemo(
    () => days.slice((safePage - 1) * DEFAULT_PAGE_SIZE, safePage * DEFAULT_PAGE_SIZE),
    [days, safePage],
  )

  const canPrevious = safePage > 1
  const canNext = safePage < totalPages

  const goToPage = (page: number) => {
    startPaginationTransition(() => {
      setCurrentPage(page)
    })
  }

  const pageFrom = pageDays[0]
  const pageTo = pageDays[pageDays.length - 1]

  return (
    <div className="space-y-2">
      {/* Top pagination */}
      {totalPages > 0 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => startCardsOpenTransition(() => setAllCardsOpen((o) => !o))}
            disabled={isCardsOpenTransitioning}
          >
            {isCardsOpenTransitioning && <Loader className="animate-spin" />}
            {allCardsOpen ? 'Свернуть все' : 'Развернуть все'}
          </Button>

          <TimelinePagination
            pageFrom={pageFrom?.date}
            pageTo={pageTo?.date}
            currentPage={safePage}
            totalPages={totalPages}
            canPrevious={canPrevious}
            canNext={canNext}
            onPageChange={goToPage}
            isTransitioning={isPaginationTransitioning}
          />
        </div>
      )}

      {/* Content with transition overlay */}
      <div className="space-y-2">
        {pageDays.map((day) => (
          <DayCard key={day.date.toString()} day={day} allCardsOpen={allCardsOpen} />
        ))}
      </div>

      {/* Bottom pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-end">
          <TimelinePagination
            pageFrom={pageFrom?.date}
            pageTo={pageTo?.date}
            currentPage={safePage}
            totalPages={totalPages}
            canPrevious={canPrevious}
            canNext={canNext}
            onPageChange={goToPage}
          />
        </div>
      )}
    </div>
  )
}

// ─── Pagination control (matches DataTable style) ───────────────────

interface TimelinePaginationProps {
  pageFrom?: string
  pageTo?: string
  currentPage: number
  totalPages: number
  canPrevious: boolean
  canNext: boolean
  onPageChange: (page: number) => void
  isTransitioning?: boolean
}

function TimelinePagination({
  pageFrom,
  pageTo,
  currentPage,
  totalPages,
  canPrevious,
  canNext,
  onPageChange,
  isTransitioning,
}: TimelinePaginationProps) {
  return (
    <div className="flex items-center gap-2">
      <Label className="flex w-fit items-center justify-center">
        Страница {currentPage} из {totalPages}{' '}
        {pageFrom && pageTo && `(${formatDate(pageFrom)} - ${formatDate(pageTo)})`}
      </Label>
      <Button
        variant="outline"
        className="hidden lg:flex"
        size="icon"
        onClick={() => onPageChange(1)}
        disabled={!canPrevious || isTransitioning}
      >
        {isTransitioning ? <Loader className="animate-spin" /> : <ChevronsLeft />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={!canPrevious || isTransitioning}
      >
        {isTransitioning ? <Loader className="animate-spin" /> : <ChevronLeft />}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={!canNext || isTransitioning}
      >
        {isTransitioning ? <Loader className="animate-spin" /> : <ChevronRight />}
      </Button>
      <Button
        variant="outline"
        className="hidden lg:flex"
        size="icon"
        onClick={() => onPageChange(totalPages)}
        disabled={!canNext || isTransitioning}
      >
        {isTransitioning ? <Loader className="animate-spin" /> : <ChevronsRight />}
      </Button>
    </div>
  )
}
