import * as z from 'zod'

export const CreateWalletSchema = z.object({
  studentId: z.number().int().positive(),
  name: z.string().optional(),
})

// Схемы правки баланса и объединения кошельков здесь нет намеренно: остаток
// кошелька складывается из оплат и посещений, руками он не назначается. Перенос —
// не исключение из этого правила, а его частный случай: переезжает целый пакет со
// своей ценой, и баланс едет следом за ним.

export const TransferPackagesSchema = z.object({
  packageIds: z.array(z.number().int().positive()).min(1, 'Выберите хотя бы один пакет'),
  toWalletId: z.number().int().positive(),
})

export const WalletPackagesSchema = z.object({
  walletId: z.number().int().positive(),
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
export type LinkGroupToWalletSchemaType = z.infer<typeof LinkGroupToWalletSchema>
export type RenameWalletSchemaType = z.infer<typeof RenameWalletSchema>
export type ArchiveWalletSchemaType = z.infer<typeof ArchiveWalletSchema>
export type TransferPackagesSchemaType = z.infer<typeof TransferPackagesSchema>
export type WalletPackagesSchemaType = z.infer<typeof WalletPackagesSchema>
