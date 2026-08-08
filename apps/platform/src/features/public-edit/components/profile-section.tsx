'use client'

import { getFullName } from '@/src/lib/utils'
import { Button } from '@repo/ui/components/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/dialog'
import { Input } from '@repo/ui/components/input'
import { Skeleton } from '@repo/ui/components/skeleton'
import { Loader } from 'lucide-react'
import { FormEvent, useState } from 'react'
import {
  useCreatePublicParentMutation,
  usePublicStudentDataQuery,
  useSelectedChild,
  useUpdatePublicParentMutation,
  useUpdatePublicStudentMutation,
} from '../queries'
import type { PublicParent } from '../types'
import { CabinetEmpty, NoChildren } from './cabinet-empty'

type NewParentState = {
  firstName: string
  lastName: string
  phone: string
  email: string
}

const emptyParent: NewParentState = { firstName: '', lastName: '', phone: '', email: '' }

export default function ProfileSection({ token }: { token: string }) {
  const { studentId, isPending: childPending } = useSelectedChild(token)

  if (!childPending && studentId == null) {
    return <NoChildren />
  }

  if (childPending || studentId == null) {
    return <ProfileSkeleton />
  }

  // key — чтобы локальное состояние форм сбрасывалось при смене ребёнка.
  return <ChildProfile key={studentId} token={token} studentId={studentId} />
}

// ─── Профиль выбранного ребёнка ─────────────────────────────────────

function ChildProfile({ token, studentId }: { token: string; studentId: number }) {
  const { data, isPending, isError } = usePublicStudentDataQuery(token, studentId)

  if (isPending) {
    return <ProfileSkeleton />
  }

  if (isError || !data) {
    return (
      <CabinetEmpty
        title="Не удалось загрузить данные ребёнка"
        description="Попробуйте обновить страницу."
      />
    )
  }

  return <ChildProfileForm token={token} studentId={studentId} data={data} />
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
      <Skeleton className="h-56 w-full rounded-xl" />
    </div>
  )
}

type ChildData = NonNullable<
  Awaited<ReturnType<(typeof import('../actions'))['getPublicStudentData']>>['data']
>

function ChildProfileForm({
  token,
  studentId,
  data,
}: {
  token: string
  studentId: number
  data: ChildData
}) {
  const [student, setStudent] = useState({
    firstName: data.firstName,
    lastName: data.lastName,
    age: data.age,
    birthDate: data.birthDate,
  })
  const [parents, setParents] = useState<PublicParent[]>(data.parents)
  const [newParent, setNewParent] = useState<NewParentState>(emptyParent)
  const [addParentOpen, setAddParentOpen] = useState(false)

  const updateStudentMutation = useUpdatePublicStudentMutation()
  const updateParentMutation = useUpdatePublicParentMutation()
  const createParentMutation = useCreatePublicParentMutation()

  const submitStudent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    updateStudentMutation.mutate(
      {
        token,
        studentId,
        firstName: String(form.get('studentFirstName') ?? ''),
        lastName: String(form.get('studentLastName') ?? ''),
        birthDate: String(form.get('studentBirthDate') ?? ''),
      },
      {
        onSuccess: (updated) => {
          if (updated)
            setStudent({
              firstName: updated.firstName,
              lastName: updated.lastName,
              age: updated.age,
              birthDate: updated.birthDate,
            })
        },
      },
    )
  }

  const updateParentField = (
    parentId: number,
    field: keyof Pick<PublicParent, 'firstName' | 'lastName' | 'phone' | 'email'>,
    value: string,
  ) => {
    setParents((current) =>
      current.map((parent) => (parent.id === parentId ? { ...parent, [field]: value } : parent)),
    )
  }

  const submitParent = (event: FormEvent<HTMLFormElement>, parentId: number) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    updateParentMutation.mutate(
      {
        token,
        studentId,
        parentId,
        firstName: String(form.get('parentFirstName') ?? ''),
        lastName: String(form.get('parentLastName') ?? ''),
        phone: String(form.get('parentPhone') ?? ''),
        email: String(form.get('parentEmail') ?? ''),
      },
      {
        onSuccess: (updated) => {
          if (updated) {
            setParents((current) =>
              current.map((parent) => (parent.id === parentId ? updated : parent)),
            )
          }
        },
      },
    )
  }

  const submitNewParent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    createParentMutation.mutate(
      { token, studentId, ...newParent },
      {
        onSuccess: (created) => {
          if (created) {
            setParents((current) => [...current, created])
            setNewParent(emptyParent)
            setAddParentOpen(false)
          }
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      {/* Дату берём из свежего ответа запроса, а не из локального стейта формы:
          после сохранения запрос инвалидируется и `data` приходит обновлённой. */}
      <p className="text-muted-foreground text-xs">
        {data.dataActualizedAt
          ? `Данные обновлялись ${formatActualizedAt(data.dataActualizedAt, data.timezone)}.`
          : 'Данные ещё ни разу не меняли.'}
      </p>

      <section className="space-y-3 rounded-xl border p-3 sm:p-4">
        <div>
          <h2 className="text-sm font-medium">Данные ребёнка</h2>
          <p className="text-muted-foreground text-xs">
            Минимальная информация, которая хранится в школе.
          </p>
        </div>
        <form onSubmit={submitStudent} className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="studentFirstName"
            name="studentFirstName"
            label="Имя ребёнка"
            value={student.firstName}
            onChange={(event) =>
              setStudent((current) => ({ ...current, firstName: event.target.value }))
            }
            required
          />
          <TextField
            id="studentLastName"
            name="studentLastName"
            label="Фамилия ребёнка"
            value={student.lastName}
            onChange={(event) =>
              setStudent((current) => ({ ...current, lastName: event.target.value }))
            }
            required
          />
          <TextField
            id="studentBirthDate"
            name="studentBirthDate"
            label="Дата рождения"
            type="date"
            value={student.birthDate ?? ''}
            onChange={(event) =>
              setStudent((current) => ({ ...current, birthDate: event.target.value || null }))
            }
            description={student.age ? `Возраст: ${student.age}` : 'Можно оставить пустым'}
          />

          <div className="sm:col-span-2">
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={updateStudentMutation.isPending}
            >
              {updateStudentMutation.isPending && <Loader className="animate-spin" />}
              Сохранить данные ребёнка
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-medium">Родители</h2>
            <p className="text-muted-foreground text-xs">
              Контактные данные родителей и опекунов для связи со школой.
            </p>
          </div>
          <Dialog open={addParentOpen} onOpenChange={setAddParentOpen}>
            <DialogTrigger render={<Button className="w-full sm:w-auto" />}>
              Добавить родителя
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Добавить родителя</DialogTitle>
                <DialogDescription>
                  {parents.length > 0
                    ? 'Если с ребёнком связан ещё один родитель или опекун, добавьте его контакты.'
                    : 'Родитель ещё не указан. Заполните данные, чтобы школа могла с вами связаться.'}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submitNewParent} id="create-parent-form" className="grid gap-4">
                <TextField
                  id="new-parent-firstName"
                  name="parentFirstName"
                  label="Имя родителя"
                  value={newParent.firstName}
                  onChange={(event) =>
                    setNewParent((current) => ({ ...current, firstName: event.target.value }))
                  }
                  required
                />
                <TextField
                  id="new-parent-lastName"
                  name="parentLastName"
                  label="Фамилия"
                  value={newParent.lastName}
                  onChange={(event) =>
                    setNewParent((current) => ({ ...current, lastName: event.target.value }))
                  }
                />
                <TextField
                  id="new-parent-phone"
                  name="parentPhone"
                  label="Телефон"
                  type="tel"
                  placeholder="+7 999 000-00-00"
                  value={newParent.phone}
                  onChange={(event) =>
                    setNewParent((current) => ({ ...current, phone: event.target.value }))
                  }
                />
                <TextField
                  id="new-parent-email"
                  name="parentEmail"
                  label="Email"
                  type="email"
                  placeholder="name@example.com"
                  value={newParent.email}
                  onChange={(event) =>
                    setNewParent((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </form>
              <DialogFooter>
                <DialogClose
                  render={<Button variant="outline" disabled={createParentMutation.isPending} />}
                >
                  Отмена
                </DialogClose>
                <Button
                  type="submit"
                  form="create-parent-form"
                  disabled={createParentMutation.isPending}
                >
                  {createParentMutation.isPending && <Loader className="animate-spin" />}
                  Добавить родителя
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex flex-col gap-4">
          {parents.length === 0 && (
            <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-xs">
              Родители ещё не указаны. Добавьте контактные данные родителя.
            </p>
          )}
          {parents.map((parent) => (
            <div key={parent.id} className="bg-muted/40 space-y-3 rounded-lg p-3">
              <p className="text-sm font-medium">
                {getFullName(parent.firstName, parent.lastName)}
              </p>
              <form
                onSubmit={(event) => submitParent(event, parent.id)}
                className="grid gap-4 sm:grid-cols-2"
              >
                <TextField
                  id={`parent-${parent.id}-firstName`}
                  name="parentFirstName"
                  label="Имя родителя"
                  value={parent.firstName}
                  onChange={(event) =>
                    updateParentField(parent.id, 'firstName', event.target.value)
                  }
                  required
                />
                <TextField
                  id={`parent-${parent.id}-lastName`}
                  name="parentLastName"
                  label="Фамилия родителя"
                  value={parent.lastName ?? ''}
                  onChange={(event) => updateParentField(parent.id, 'lastName', event.target.value)}
                />
                <TextField
                  id={`parent-${parent.id}-phone`}
                  name="parentPhone"
                  label="Телефон"
                  type="tel"
                  value={parent.phone ?? ''}
                  onChange={(event) => updateParentField(parent.id, 'phone', event.target.value)}
                  placeholder="+7 999 000-00-00"
                />
                <TextField
                  id={`parent-${parent.id}-email`}
                  name="parentEmail"
                  label="Email"
                  type="email"
                  value={parent.email ?? ''}
                  onChange={(event) => updateParentField(parent.id, 'email', event.target.value)}
                  placeholder="name@example.com"
                />

                <div className="sm:col-span-2">
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={updateParentMutation.isPending}
                  >
                    {updateParentMutation.isPending && <Loader className="animate-spin" />}
                    Сохранить данные родителя
                  </Button>
                </div>
              </form>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function TextField({
  id,
  name,
  label,
  description,
  ...props
}: {
  id: string
  name?: string
  label: string
  description?: string
} & React.ComponentProps<typeof Input>) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1.5 text-xs font-medium">
      {label}
      <Input id={id} name={name} {...props} />
      {description && <span className="text-muted-foreground font-normal">{description}</span>}
    </label>
  )
}

function formatActualizedAt(value: string, tz: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: tz,
  })
}
