import type { CalendarEvent, LayoutSlot } from '../types'

/**
 * Раскладка пересекающихся по времени событий по колонкам-дорожкам.
 *
 * Сортирует события, объединяет транзитивно пересекающиеся в кластеры,
 * жадно назначает каждому свободную колонку и возвращает `{ lane, lanes }`
 * на событие. Блок рендерится как `left = lane / lanes`, `width = 1 / lanes`.
 */
export function layout(events: CalendarEvent[]): Record<string, LayoutSlot> {
  const sorted = [...events].sort((a, b) => a.start - b.start || a.end - b.end)
  const res: Record<string, LayoutSlot> = {}
  let cluster: CalendarEvent[] = []
  let clusterEnd = -1

  const flush = () => {
    const cols: number[] = []
    cluster.forEach((e) => {
      let placed = false
      for (let i = 0; i < cols.length; i++) {
        if (e.start >= cols[i]!) {
          cols[i] = e.end
          res[e.id] = { lane: i, lanes: 0 }
          placed = true
          break
        }
      }
      if (!placed) {
        cols.push(e.end)
        res[e.id] = { lane: cols.length - 1, lanes: 0 }
      }
    })
    const total = cols.length
    cluster.forEach((e) => {
      res[e.id]!.lanes = total
    })
    cluster = []
    clusterEnd = -1
  }

  sorted.forEach((e) => {
    if (cluster.length && e.start >= clusterEnd) flush()
    cluster.push(e)
    clusterEnd = Math.max(clusterEnd, e.end)
  })
  flush()
  return res
}
