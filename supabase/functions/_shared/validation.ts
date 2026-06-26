import { ApiError } from './http.ts'

export const LEAD_STATUSES = [
  'novo_contato', 'em_qualificacao', 'quente', 'morno', 'frio', 'encaminhado',
  'primeiro_contato', 'proposta_enviada', 'follow_up', 'convertido',
  'sem_interesse', 'fora_horario', 'conversando',
] as const

export const normalizeWhatsApp = (value: unknown) => {
  if (typeof value !== 'string') {
    throw new ApiError(422, 'CAMPO_OBRIGATORIO_AUSENTE', 'O campo whatsapp e obrigatorio.')
  }

  let digits = value.split('@')[0].replace(/\D/g, '')
  while (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`

  if (digits.length < 12 || digits.length > 15) {
    throw new ApiError(422, 'WHATSAPP_INVALIDO', 'Informe o WhatsApp com DDI e DDD.')
  }
  return digits
}

export const requiredString = (body: Record<string, unknown>, field: string, maxLength = 5000) => {
  const value = body[field]
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApiError(422, 'CAMPO_OBRIGATORIO_AUSENTE', `O campo ${field} e obrigatorio.`)
  }
  if (value.length > maxLength) {
    throw new ApiError(422, 'CAMPO_INVALIDO', `O campo ${field} excede o limite permitido.`)
  }
  return value.trim()
}

export const optionalString = (value: unknown, field: string, maxLength = 5000) => {
  if (value == null) return undefined
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ApiError(422, 'CAMPO_INVALIDO', `O campo ${field} e invalido.`)
  }
  return value.trim() || null
}

const smallWords = new Set(['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'])

export const normalizeCityName = (value: unknown) => {
  const city = optionalString(value, 'cidade', 200)
  if (!city) return city

  return city
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && smallWords.has(word)) return word
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
    })
    .join(' ')
}

export const requiredUuid = (value: unknown, field = 'id') => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError(422, 'UUID_INVALIDO', `O campo ${field} deve ser um UUID valido.`)
  }
  return value
}

export const requiredFutureDate = (value: unknown) => {
  if (typeof value !== 'string') throw new ApiError(422, 'DATA_INVALIDA', 'Informe uma data ISO 8601 valida.')
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new ApiError(422, 'DATA_INVALIDA', 'Informe uma data ISO 8601 valida.')
  if (date.getTime() <= Date.now()) throw new ApiError(422, 'DATA_PASSADA', 'A data informada ja passou.')
  return date.toISOString()
}

export const pickFields = (body: Record<string, unknown>, allowed: readonly string[]) => {
  return Object.fromEntries(allowed.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]))
}
