import { source } from '@/src/lib/source'
import { getLLMText } from '@/src/lib/get-llm-text'

// Только раздел «Для пользователей» — из него платформа собирает system-prompt
// AI-помощника (apps/platform/src/features/assistant/system-prompt.ts).
// cached forever
export const revalidate = false

export async function GET() {
  const pages = source.getPages().filter((page) => page.url.startsWith('/user'))
  const scanned = await Promise.all(pages.map(getLLMText))

  return new Response(scanned.join('\n\n'))
}
