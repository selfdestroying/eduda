import { auth } from '@/src/lib/auth/server'
import prisma from '@/src/lib/db/prisma'
import { headers } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  })

  if (!session?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dateParam = request.nextUrl.searchParams.get('date')
  if (!dateParam) {
    return NextResponse.json({ error: 'Missing date parameter' }, { status: 400 })
  }

  // Date-only фильтр хранится как строка `YYYY-MM-DD`.
  if (isNaN(new Date(dateParam).getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
  }

  const lessons = await prisma.lesson.findMany({
    where: {
      date: dateParam,
      organizationId: session.organizationId,
    },
    include: {
      attendance: true,
      group: { include: { course: true, location: true, schedules: true } },
      teachers: { include: { teacher: true } },
    },
    orderBy: { time: 'asc' },
  })

  return NextResponse.json(lessons)
}
