/**
 * Телефоны в базе заполнены как попало: `+7 (999) 123-45-67`, `89991234567`,
 * `9991234567`. Сравнивать их строкой бессмысленно, поэтому и в базе, и в том,
 * что прислал мессенджер, оставляем одни цифры и приводим к одному виду.
 */

/** `null` — на российский номер не похоже, сравнивать нечего. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')

  // 8XXXXXXXXXX → 7XXXXXXXXXX; XXXXXXXXXX (без кода страны) → 7XXXXXXXXXX.
  const full =
    digits.length === 11 && digits.startsWith('8')
      ? `7${digits.slice(1)}`
      : digits.length === 10
        ? `7${digits}`
        : digits

  return full.length === 11 && full.startsWith('7') ? full : null
}

/**
 * Номер из vCard, которую MAX кладёт в `payload.vcf_info` вложения `contact`.
 *
 * Строка `TEL` бывает с параметрами (`TEL;TYPE=CELL:+7999…`), поэтому до
 * двоеточия пропускаем что угодно, кроме перевода строки. Берём первый
 * телефон: у карточки, которой человек делится о себе, он один.
 */
export function phoneFromVCard(vcf: string): string | null {
  const match = vcf.match(/^TEL[^:\r\n]*:(.+)$/im)
  return match ? normalizePhone(match[1]!) : null
}
