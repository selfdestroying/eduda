import {
  appendMessage,
  archiveThread,
  deleteThread,
  fetchThread,
  initializeThread,
  listThreads,
  loadMessages,
  renameThread,
  unarchiveThread,
} from './actions'
import type { AppendMessageSchemaType } from './schemas'

export async function listThreadsQuery() {
  const { data, serverError } = await listThreads()
  if (serverError) throw serverError
  return data ?? []
}

export async function fetchThreadQuery(remoteId: string) {
  const { data, serverError } = await fetchThread({ remoteId })
  if (serverError) throw serverError
  return data!
}

export async function loadMessagesQuery(remoteId: string) {
  const { data, serverError } = await loadMessages({ remoteId })
  if (serverError) throw serverError
  return data ?? []
}

export async function initializeThreadQuery(localId: string) {
  const { data, serverError } = await initializeThread({ localId })
  if (serverError) throw serverError
  return data!
}

export async function renameThreadQuery(remoteId: string, title: string) {
  const { serverError } = await renameThread({ remoteId, title })
  if (serverError) throw serverError
}

export async function archiveThreadQuery(remoteId: string) {
  const { serverError } = await archiveThread({ remoteId })
  if (serverError) throw serverError
}

export async function unarchiveThreadQuery(remoteId: string) {
  const { serverError } = await unarchiveThread({ remoteId })
  if (serverError) throw serverError
}

export async function deleteThreadQuery(remoteId: string) {
  const { serverError } = await deleteThread({ remoteId })
  if (serverError) throw serverError
}

export async function appendMessageQuery(input: AppendMessageSchemaType) {
  const { serverError } = await appendMessage(input)
  if (serverError) throw serverError
}
