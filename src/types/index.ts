// ==============================
// ENUMS / TIPOS ESCALARES
// ==============================

export type LeadStatus =
  | 'novo_contato'
  | 'em_qualificacao'
  | 'quente'
  | 'morno'
  | 'frio'
  | 'encaminhado'
  | 'primeiro_contato'
  | 'proposta_enviada'
  | 'follow_up'
  | 'convertido'
  | 'sem_interesse'
  | 'fora_horario'
  | 'conversando'

export type LeadTemperatureValue = 'quente' | 'morno' | 'frio'

export type LeadOrigem =
  | 'instagram'
  | 'google'
  | 'tiktok'
  | 'indicacao'
  | 'whatsapp_direto'
  | 'site'
  | 'outro'

export type IntencaoCompra = 'alta' | 'media' | 'baixa'
export type UrgenciaTipo = 'imediato' | 'curto_prazo' | 'sem_urgencia'
export type InteracaoTipo = 'mensagem_lead' | 'resposta_agente' | 'nota_vendedor'
export type FollowupCriador = 'agente_ia' | 'vendedor'
export type UserRole = 'admin' | 'vendedor'
export type DiaSemana = 'domingo' | 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado'

// ==============================
// TABELAS PRINCIPAIS
// ==============================

export interface Lead {
  id: string
  created_at: string

  // Identificação
  whatsapp: string
  nome: string | null

  // Status e qualificação
  status: LeadStatus
  temperatura: LeadTemperatureValue | null
  score: number | null

  // Dados da conversa
  resumo_conversa: string | null
  observacoes_agente: string | null
  produto_interesse: string | null
  origem: LeadOrigem | null
  cidade: string | null

  // Qualificação comercial
  intencao_compra: IntencaoCompra | null
  urgencia: UrgenciaTipo | null
  orcamento_informado: boolean

  // Encaminhamento
  encaminhado_vendedor: boolean
  data_encaminhamento: string | null

  // Conversão
  convertido: boolean
  data_conversao: string | null
  valor_pago: number | null

  // Controle de horário
  horario_contato?: string | null
  dentro_horario_comercial: boolean
  minutos_desde_contato: number | null

  // Follow-up (espelho)
  follow_up_agendado: boolean
  data_follow_up: string | null
  followup_1enviado?: string | null
  inicio_atendimento_em?: string | null
  followup_1_enviado?: string | null
  data_followup_1?: string | null
  followup_2_enviado?: string | null
  data_followup_2?: string | null
  followup_3_enviado?: string | null
  data_followup_3?: string | null
  sintese_ia?: string | null
  ultima_atividade?: string | null

  // Segurança
  usuario_id: string | null
  bot_ativo?: boolean | null
  ultima_resposta_lead?: string | null
}

export interface Interacao {
  id: string
  lead_id: string
  tipo: InteracaoTipo
  conteudo: string
  criado_em: string
}

export interface FollowUp {
  id: string
  lead_id: string
  agendado_para: string
  motivo: string
  realizado: boolean
  realizado_em: string | null
  criado_por: FollowupCriador
  created_at: string
}

// ==============================
// CONFIGURAÇÕES
// ==============================

export interface CompanyConfig {
  id: number
  nome: string
  logo_url: string | null
  automacao_ativa: boolean
  updated_at: string
}

export interface LeadScoreConfig {
  id: number
  score_minimo_morno: number
  score_minimo_quente: number
  updated_at: string
}

export interface BusinessHours {
  id: string
  dia: DiaSemana
  aberto: boolean
  hora_inicio: string | null
  hora_fim: string | null
}

// ==============================
// USUÁRIOS E TOKENS
// ==============================

export interface UserProfile {
  id: string
  name: string | null
  role: UserRole
  created_at: string
}

export interface ApiToken {
  id: string
  label: string
  token_hash: string
  ativo: boolean
  created_by: string | null
  created_at: string
}
