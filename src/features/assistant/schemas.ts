import * as z from 'zod'

export const RemoteIdSchema = z.object({
  remoteId: z.string().min(1),
})
export type RemoteIdSchemaType = z.infer<typeof RemoteIdSchema>

export const InitializeThreadSchema = z.object({
  localId: z.string().min(1),
})
export type InitializeThreadSchemaType = z.infer<typeof InitializeThreadSchema>

export const RenameThreadSchema = z.object({
  remoteId: z.string().min(1),
  title: z.string(),
})
export type RenameThreadSchemaType = z.infer<typeof RenameThreadSchema>

export const AppendMessageSchema = z.object({
  remoteId: z.string().min(1),
  messageId: z.string().min(1),
  parentId: z.string().nullable(),
  format: z.string().min(1),
  content: z.unknown(),
})
export type AppendMessageSchemaType = z.infer<typeof AppendMessageSchema>
