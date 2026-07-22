'use client'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/src/components/ui/combobox'
import { Item, ItemContent, ItemTitle } from '@/src/components/ui/item'
import { useStudentSearchQuery } from '@/src/features/students/queries'
import { getFullName } from '@/src/lib/utils'
import { debounce } from 'es-toolkit'
import { useMemo, useState } from 'react'

export type StudentOption = { id: number; firstName: string; lastName: string }

interface StudentSearchComboboxProps {
  /** Ученики, которых нужно скрыть из результатов (уже выбранные). */
  excludeIds: number[]
  /** Вызывается при выборе ученика. */
  onSelect: (student: StudentOption) => void
  disabled?: boolean
  id?: string
}

/** Async-комбобокс: ищет учеников на сервере по мере ввода (debounce 300мс). */
export function StudentSearchCombobox({
  excludeIds,
  onSelect,
  disabled,
  id,
}: StudentSearchComboboxProps) {
  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')
  const debouncedSetTerm = useMemo(() => debounce(setTerm, 300), [])

  const { data, isFetching } = useStudentSearchQuery(term)
  const hasQuery = term.trim().length > 0
  const results = hasQuery ? (data ?? []).filter((s) => !excludeIds.includes(s.id)) : []
  const emptyText = !hasQuery ? 'Введите имя для поиска' : isFetching ? 'Поиск…' : 'Не найдено'

  return (
    <Combobox<StudentOption>
      items={results}
      value={null}
      onValueChange={(student) => {
        if (!student) return
        onSelect(student)
        setInput('')
        setTerm('')
      }}
      inputValue={input}
      onInputValueChange={(value) => {
        setInput(value)
        debouncedSetTerm(value)
      }}
      filter={null}
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(s) => getFullName(s.firstName, s.lastName)}
    >
      <ComboboxInput id={id} placeholder="Поиск ученика по имени…" disabled={disabled} />
      <ComboboxContent side="top">
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(s: StudentOption) => (
            <ComboboxItem key={s.id} value={s}>
              <Item size="xs" className="p-0">
                <ItemContent>
                  <ItemTitle className="whitespace-nowrap">
                    {getFullName(s.firstName, s.lastName)}
                  </ItemTitle>
                </ItemContent>
              </Item>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
