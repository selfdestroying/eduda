'use client'

import { Button } from '@/src/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/src/components/ui/dialog'
import { Input } from '@/src/components/ui/input'
import { Skeleton } from '@/src/components/ui/skeleton'
import { getFullName } from '@/src/lib/utils'
import { Check, Loader } from 'lucide-react'
import { FormEvent, useState } from 'react'
import {
  useConfirmPublicActualityMutation,
  useCreatePublicParentMutation,
  usePublicStudentDataQuery,
  useUpdatePublicParentMutation,
  useUpdatePublicStudentMutation,
} from '../queries'
import type { PublicParent } from '../types'

export type CabinetParent = {
  id: number
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
}

type NewParentState = {
  firstName: string
  lastName: string
  phone: string
  email: string
}

const emptyParent: NewParentState = { firstName: '', lastName: '', phone: '', email: '' }

export type ProfileTabProps = {
  token: string
  studentId: number
  parent: CabinetParent
}

export default function ProfileTab({ token, studentId }: ProfileTabProps) {
  return (
    <div className="flex flex-col gap-4">
      <ChildProfile key={studentId} token={token} studentId={studentId} />
    </div>
  )
}

// ─── Профиль выбранного ребёнка ─────────────────────────────────────

function ChildProfile({ token, studentId }: { token: string; studentId: number }) {
  const { data, isPending, isError } = usePublicStudentDataQuery(token, studentId)

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !data) {
    return (
      <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
        <CardContent className="text-muted-foreground py-8 text-center text-sm">
          Не удалось загрузить данные ребёнка. Попробуйте обновить страницу.
        </CardContent>
      </Card>
    )
  }

  return <ChildProfileForm token={token} studentId={studentId} data={data} />
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
    dataActual: data.dataActual,
    dataActualizedAt: data.dataActualizedAt,
  })
  const [parents, setParents] = useState<PublicParent[]>(data.parents)
  const [newParent, setNewParent] = useState<NewParentState>(emptyParent)
  const [addParentOpen, setAddParentOpen] = useState(false)

  const updateStudentMutation = useUpdatePublicStudentMutation()
  const updateParentMutation = useUpdatePublicParentMutation()
  const createParentMutation = useCreatePublicParentMutation()
  const confirmActualityMutation = useConfirmPublicActualityMutation()

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
              dataActual: updated.dataActual,
              dataActualizedAt: updated.dataActualizedAt,
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
            setStudent((current) => ({ ...current, dataActual: false, dataActualizedAt: null }))
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
            setStudent((current) => ({ ...current, dataActual: false, dataActualizedAt: null }))
            setNewParent(emptyParent)
            setAddParentOpen(false)
          }
        },
      },
    )
  }

  const confirmActuality = () => {
    confirmActualityMutation.mutate(
      { token, studentId },
      {
        onSuccess: (result) => {
          if (result)
            setStudent((current) => ({
              ...current,
              dataActual: result.dataActual,
              dataActualizedAt: result.dataActualizedAt,
            }))
        },
      },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
        <CardHeader>
          <CardTitle>Актуальность данных</CardTitle>
          <CardDescription>
            {student.dataActual && student.dataActualizedAt
              ? `Данные подтверждены ${formatActualizedAt(student.dataActualizedAt, data.timezone)}.`
              : 'После проверки данных подтвердите, что они актуальны.'}
          </CardDescription>
          <CardAction>
            <Button
              type="button"
              disabled={confirmActualityMutation.isPending}
              onClick={confirmActuality}
              className="bg-success/10 text-success hover:bg-success/20"
            >
              {confirmActualityMutation.isPending ? <Loader className="animate-spin" /> : <Check />}
              <span>Подтвердить</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">
            {student.dataActual ? (
              'Менеджер увидит дату последнего подтверждения.'
            ) : (
              <span>
                Если всё верно, нажмите <strong>Подтвердить</strong>. Если вы изменили данные,
                сначала сохраните формы.
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/80 shadow-xl shadow-black/5 backdrop-blur-xl dark:shadow-black/20">
        <CardHeader>
          <CardTitle>Данные ребёнка</CardTitle>
          <CardDescription>Минимальная информация, которая хранится в школе.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      <section className="border-border/80 bg-card/80 rounded-xl border p-3 shadow-xl shadow-black/5 backdrop-blur-xl sm:p-4 dark:shadow-black/20">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <Card key={parent.id}>
              <CardHeader>
                <CardTitle>Данные родителя</CardTitle>
                <CardDescription>
                  {getFullName(parent.firstName, parent.lastName)} — контактная информация для
                  связи.
                </CardDescription>
              </CardHeader>
              <CardContent>
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
                    onChange={(event) =>
                      updateParentField(parent.id, 'lastName', event.target.value)
                    }
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
              </CardContent>
            </Card>
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
