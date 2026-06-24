import getSystemPrompt from '@/src/features/assistant/system-prompt'
import { auth } from '@/src/lib/auth/server'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { convertToModelMessages, streamText, type UIMessage } from 'ai'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { messages }: { messages: UIMessage[] } = await req.json()
  const apiKey = process.env.OPENROUTER_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'OPENROUTER_API_KEY is not configured' }, { status: 500 })
  }

  const systemPrompt = await getSystemPrompt()

  const openrouter = createOpenRouter({ apiKey })
  const result = streamText({
    model: openrouter(process.env.ASSISTANT_MODEL ?? 'openai/gpt-4o-mini'),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
  })

  return result.toUIMessageStreamResponse()
}
