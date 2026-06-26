const SMALL_WORDS = new Set(['da', 'de', 'di', 'do', 'du', 'das', 'dos', 'e'])

export const formatCityName = (value?: string | null) => {
  if (!value) return ''

  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word
      return word.charAt(0).toLocaleUpperCase('pt-BR') + word.slice(1)
    })
    .join(' ')
}
