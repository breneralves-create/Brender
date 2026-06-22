import type { Lead, LeadScoreConfig, LeadTemperatureValue } from '../types'

export const getLeadTemperature = (
  lead: Pick<Lead, 'score' | 'temperatura'>,
  scoreConfig: LeadScoreConfig
): LeadTemperatureValue => {
  if (lead.temperatura) return lead.temperatura

  const score = lead.score ?? 0
  if (score >= scoreConfig.score_minimo_quente) return 'quente'
  if (score >= scoreConfig.score_minimo_morno) return 'morno'
  return 'frio'
}
