const BRAZIL_COUNTRY_CODE = '55'

export const normalizeWhatsAppNumber = (value: string | null | undefined) => {
  let digits = (value || '').split('@')[0].replace(/\D/g, '')

  while (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  if (digits.length === 10 || digits.length === 11) {
    digits = `${BRAZIL_COUNTRY_CODE}${digits}`
  }

  return digits.length >= 12 && digits.length <= 15 ? digits : null
}

export const formatWhatsAppNumber = (value: string | null | undefined) => {
  const rawDigits = (value || '').split('@')[0].replace(/\D/g, '')
  const localDigits = rawDigits.startsWith(BRAZIL_COUNTRY_CODE) && rawDigits.length >= 12
    ? rawDigits.slice(BRAZIL_COUNTRY_CODE.length)
    : rawDigits

  if (localDigits.length === 11) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`
  }

  if (localDigits.length === 10) {
    return `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`
  }

  return value || 'Número não informado'
}

export const buildWhatsAppUrl = (
  phone: string | null | undefined,
  leadName?: string | null
) => {
  const normalizedPhone = normalizeWhatsAppNumber(phone)
  if (!normalizedPhone) return null

  const firstName = leadName?.trim().split(/\s+/)[0]
  const message = firstName
    ? `Olá, ${firstName}! Tudo bem?`
    : 'Olá! Tudo bem?'

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`
}

export const openWhatsApp = (
  phone: string | null | undefined,
  leadName?: string | null
) => {
  const url = buildWhatsAppUrl(phone, leadName)
  if (!url) return false

  window.open(url, '_blank', 'noopener,noreferrer')
  return true
}
