import * as z from 'zod'

export const CreateWalletSchema = z.object({
  studentId: z.number().int().positive(),
  name: z.string().optional(),
})

// Схем правки баланса, перевода между кошельками и объединения здесь нет намеренно:
// остаток кошелька складывается из оплат и посещений, руками он не назначается.

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
export type LinkGroupToWalletSchemaType = z.infer<typeof LinkGroupToWalletSchema>
export type RenameWalletSchemaType = z.infer<typeof RenameWalletSchema>
export type ArchiveWalletSchemaType = z.infer<typeof ArchiveWalletSchema>
