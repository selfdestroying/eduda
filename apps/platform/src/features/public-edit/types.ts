export type PublicParent = {
  id: number
  firstName: string
  lastName: string | null
  phone: string | null
  email: string | null
}

export type PublicStudentUpdate = {
  firstName: string
  lastName: string
  age: number | null
  birthDate: string | null
  dataActual: boolean
  dataActualizedAt: string | null
}
