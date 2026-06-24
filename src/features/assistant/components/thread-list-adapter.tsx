'use client'

import {
  RuntimeAdapterProvider,
  useAui,
  type RemoteThreadListAdapter,
  type ThreadHistoryAdapter,
} from '@assistant-ui/react'
import { createAssistantStream } from 'assistant-stream'
import { useMemo, type PropsWithChildren } from 'react'
import {
  appendMessageQuery,
  archiveThreadQuery,
  deleteThreadQuery,
  fetchThreadQuery,
  initializeThreadQuery,
  listThreadsQuery,
  loadMessagesQuery,
  renameThreadQuery,
  unarchiveThreadQuery,
} from '../queries'

function HistoryProvider({ children }: PropsWithChildren) {
  const aui = useAui()

  const history = useMemo<ThreadHistoryAdapter>(
    () => ({
      // Верхнеуровневые load/append не используются на AI-SDK пути,
      // но обязательны по типу — реальная работа в withFormat.
      async load() {
        return { headId: null, messages: [] }
      },
      async append() {},
      withFormat: (fmt) => ({
        async load() {
          const { remoteId } = aui.threadListItem().getState()
          if (!remoteId) return { messages: [] }
          const rows = await loadMessagesQuery(remoteId)
          return {
            messages: rows.map((row) => fmt.decode(row as Parameters<typeof fmt.decode>[0])),
          }
        },
        async append(item) {
          // Дожидаемся initialize() до записи — иначе гонка теряет первое сообщение.
          const { remoteId } = await aui.threadListItem().initialize()
          await appendMessageQuery({
            remoteId,
            messageId: fmt.getId(item.message),
            parentId: item.parentId,
            format: fmt.format,
            content: fmt.encode(item),
          })
        },
      }),
    }),
    [aui],
  )

  return <RuntimeAdapterProvider adapters={{ history }}>{children}</RuntimeAdapterProvider>
}

export const remoteThreadListAdapter: RemoteThreadListAdapter = {
  unstable_Provider: HistoryProvider,

  async list() {
    const threads = await listThreadsQuery()
    return {
      threads: threads.map((t) => ({
        status: t.archived ? 'archived' : 'regular',
        remoteId: t.remoteId,
        title: t.title,
        lastMessageAt: t.lastMessageAt ?? undefined,
      })),
    }
  },

  async initialize(localId) {
    const { remoteId } = await initializeThreadQuery(localId)
    return { remoteId, externalId: undefined }
  },

  async rename(remoteId, newTitle) {
    await renameThreadQuery(remoteId, newTitle)
  },

  async archive(remoteId) {
    await archiveThreadQuery(remoteId)
  },

  async unarchive(remoteId) {
    await unarchiveThreadQuery(remoteId)
  },

  async delete(remoteId) {
    await deleteThreadQuery(remoteId)
  },

  async fetch(remoteId) {
    const t = await fetchThreadQuery(remoteId)
    return {
      status: t.archived ? 'archived' : 'regular',
      remoteId: t.remoteId,
      title: t.title,
      lastMessageAt: t.lastMessageAt ?? undefined,
    }
  },

  async generateTitle() {
    // Заголовки пока не генерируем — пустой стрим.
    return createAssistantStream(() => {})
  },
}
