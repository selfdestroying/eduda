'use client'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@repo/ui/components/combobox'
import { Item, ItemContent, ItemTitle } from '@repo/ui/components/item'
import { useStudentSearchQuery } from '@/src/features/students/queries'
import { getFullName } from '@/src/lib/utils'
import { debounce } from 'es-toolkit'
import { useEffect, useMemo, useState } from 'react'

export type StudentOption = { id: number; firstName: string; lastName: string }

interface StudentSearchComboboxProps {
  /** Ученики, которых нужно скрыть из результатов (уже выбранные). */
  excludeIds: number[]
  /** Вызывается при выборе ученика. */
  onSelect: (student: StudentOption) => void
  /**
   * Выбранный ученик, если поле его держит. Пропуск этого пропа переводит
   * комбобокс в режим «добавить в список»: после выбора он очищается и готов к
   * следующему. С ним — обычное поле выбора, в котором выбранный остаётся.
   */
  value?: StudentOption | null
  disabled?: boolean
  id?: string
  ariaInvalid?: boolean
  /**
   * Куда раскрывать список. По умолчанию вверх — поле стоит последним в форме
   * создания группы, и вниз ему некуда. Первым полем в панели наоборот: вверх
   * список накрывает заголовок.
   */
  side?: 'top' | 'bottom'
}

/** Async-комбобокс: ищет учеников на сервере по мере ввода (debounce 300мс). */
export function StudentSearchCombobox({
  excludeIds,
  onSelect,
  value,
  disabled,
  id,
  ariaInvalid,
  side = 'top',
}: StudentSearchComboboxProps) {
  const holdsValue = value !== undefined
  const valueLabel = value ? getFullName(value.firstName, value.lastName) : ''

  const [input, setInput] = useState(valueLabel)
  const [term, setTerm] = useState('')
  const debouncedSetTerm = useMemo(() => debounce(setTerm, 300), [])

  // Внешние изменения — сброс формы после сохранения, подстановка извне — должны
  // доезжать до поля. На набор это не влияет: эффект срабатывает только когда
  // сменился сам выбранный ученик.
  useEffect(() => {
    if (holdsValue) setInput(valueLabel)
  }, [holdsValue, valueLabel])

  const { data, isFetching } = useStudentSearchQuery(term)
  const hasQuery = term.trim().length > 0
  const results = hasQuery ? (data ?? []).filter((s) => !excludeIds.includes(s.id)) : []
  const emptyText = !hasQuery ? 'Введите имя для поиска' : isFetching ? 'Поиск…' : 'Не найдено'

  return (
    <Combobox<StudentOption>
      items={results}
      value={value ?? null}
      onValueChange={(student) => {
        if (!student) return
        onSelect(student)
        setInput(holdsValue ? getFullName(student.firstName, student.lastName) : '')
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
      <ComboboxInput
        id={id}
        placeholder="Поиск ученика по имени…"
        disabled={disabled}
        aria-invalid={ariaInvalid}
      />
      <ComboboxContent side={side}>
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
