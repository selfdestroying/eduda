'use client'

import { AssistantModal } from '@/src/components/assistant-ui/assistant-modal'
import { remoteThreadListAdapter } from '@/src/features/assistant/components/thread-list-adapter'
import { AssistantRuntimeProvider, useRemoteThreadListRuntime } from '@assistant-ui/react'
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk'

function useThreadRuntime() {
  return useChatRuntime({
    transport: new AssistantChatTransport({ api: '/api/assistant' }),
  })
}

export function AssistantWidget() {
  const runtime = useRemoteThreadListRuntime({
    runtimeHook: useThreadRuntime,
    adapter: remoteThreadListAdapter,
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AssistantModal />
    </AssistantRuntimeProvider>
  )
}
