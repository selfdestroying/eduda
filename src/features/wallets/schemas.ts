import * as z from 'zod'

export const CreateWalletSchema = z.object({
  studentId: z.number().int().positive(),
  name: z.string().optional(),
})

export const UpdateWalletBalanceSchema = z.object({
  walletId: z.number().int().positive(),
  data: z.any(),
  audit: z.any(),
})

export const MergeWalletsSchema = z.object({
  sourceWalletId: z.number().int().positive(),
  targetWalletId: z.number().int().positive(),
})

export const TransferWalletBalanceSchema = z.object({
  sourceWalletId: z.number().int().positive(),
  targetWalletId: z.number().int().positive(),
  lessonsBalance: z.number().int().min(0).optional().default(0),
  totalLessons: z.number().int().min(0).optional().default(0),
  totalPayments: z.number().int().min(0).optional().default(0),
})

export const LinkGroupToWalletSchema = z.object({
  studentId: z.number().int().positive(),
  groupId: z.number().int().positive(),
  walletId: z.number().int().positive(),
})

export const RenameWalletSchema = z.object({
  walletId: z.number().int().positive(),
  name: z.string().optional(),
})

export const ArchiveWalletSchema = z.object({
  walletId: z.number().int().positive(),
})

export type CreateWalletSchemaType = z.infer<typeof CreateWalletSchema>
export type UpdateWalletBalanceSchemaType = z.infer<typeof UpdateWalletBalanceSchema>
export type MergeWalletsSchemaType = z.infer<typeof MergeWalletsSchema>
export type TransferWalletBalanceSchemaType = z.infer<typeof TransferWalletBalanceSchema>
export type LinkGroupToWalletSchemaType = z.infer<typeof LinkGroupToWalletSchema>
export type RenameWalletSchemaType = z.infer<typeof RenameWalletSchema>
export type ArchiveWalletSchemaType = z.infer<typeof ArchiveWalletSchema>
