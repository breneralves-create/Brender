import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bot,
  CalendarClock,
  Check,
  CheckCircle2,
  Clipboard,
  Clock,
  Flame,
  Info,
  ListChecks,
  MessageSquare,
  Phone,
  PlayCircle,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  Trophy,
  User,
  Zap,
} from 'lucide-react'
import { differenceInHours, differenceInMinutes, format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Input } from '../components/ui/Input'
import { ScoreBar } from '../components/ui/ScoreBar'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'
import type { FollowUp, Lead } from '../types'

type MissionKind =
  | 'salvar_venda'
  | 'fechar_proposta'
  | 'followup'
  | 'assumir_agora'
  | 'qualificar'
  | 'nutrir'
  | 'monitorar'

type FilterKind = 'todas' | 'risco' | MissionKind

type IconComponent = React.ComponentType<{ size?: number; className?: string }>

type MissionStyle = {
  label: string
  shortLabel: string
  icon: IconComponent
  text: string
  bg: string
  border: string
  dot: string
  hex: string
}

type LeadDb = Lead & {
  sintese_ia?: string | null
  ultima_atividade?: string | null
  inicio_atendimento_em?: string | null
  followup_1_enviado?: string | null
  data_followup_1?: string | null
  followup_2_enviado?: string | null
  data_followup_2?: string | null
  followup_3_enviado?: string | null
  data_followup_3?: string | null
}

type Mission = {
  id: string
  lead: LeadDb
  kind: MissionKind
  priority: number
  riskScore: number
  headline: string
  reason: string
  nextAction: string
  buySignal: string
  lossRisk: string
  suggestedMessage: string
  staleHours: number
  dueLabel: string
}

const MISSION_STYLES: Record<MissionKind, MissionStyle> = {
  salvar_venda: {
    label: 'Salvar venda',
    shortLabel: 'Salvar',
    icon: Flame,
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/25',
    dot: 'bg-red-500',
    hex: '#ef4444',
  },
  fechar_proposta: {
    label: 'Fechar proposta',
    shortLabel: 'Fechar',
    icon: Trophy,
    text: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/25',
    dot: 'bg-purple-500',
    hex: '#a855f7',
  },
  followup: {
    label: 'Follow-up vencido',
    shortLabel: 'Follow-up',
    icon: CalendarClock,
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    dot: 'bg-amber-500',
    hex: '#f59e0b',
  },
  assumir_agora: {
    label: 'Assumir agora',
    shortLabel: 'Assumir',
    icon: ShieldAlert,
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/25',
    dot: 'bg-cyan-500',
    hex: '#06b6d4',
  },
  qualificar: {
    label: 'Qualificar melhor',
    shortLabel: 'Qualificar',
    icon: Sparkles,
    text: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/25',
    dot: 'bg-blue-500',
    hex: '#3b82f6',
  },
  nutrir: {
    label: 'Nutrir lead',
    shortLabel: 'Nutrir',
    icon: Bot,
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    dot: 'bg-emerald-500',
    hex: '#10b981',
  },
  monitorar: {
    label: 'Monitorar',
    shortLabel: 'Monitorar',
    icon: Activity,
    text: 'text-text-muted',
    bg: 'bg-bg-base',
    border: 'border-border-card',
    dot: 'bg-text-muted',
    hex: '#7A7F99',
  },
}

const FILTERS: Array<{ key: FilterKind; label: string }> = [
  { key: 'todas', label: 'Todas' },
  { key: 'risco', label: 'Em risco' },
  { key: 'salvar_venda', label: 'Salvar venda' },
  { key: 'fechar_proposta', label: 'Fechar' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'assumir_agora', label: 'Assumir' },
  { key: 'qualificar', label: 'Qualificar' },
]

const sentValues = ['feito', 'enviado', 'realizado', 'sim', 'ok']

const parseDate = (value: string | null | undefined) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const hoursSince = (value: string | null | undefined) => {
  const date = parseDate(value)
  if (!date) return 0
  return Math.max(0, differenceInHours(new Date(), date))
}

const getLeadName = (lead: LeadDb) => lead.nome?.trim() || formatWhatsApp(lead.whatsapp)

const getFirstName = (lead: LeadDb) => {
  const name = lead.nome?.trim()
  if (!name) return ''
  return name.split(/\s+/)[0]
}

const getSummary = (lead: LeadDb) => {
  return lead.sintese_ia || lead.resumo_conversa || lead.observacoes_agente || ''
}

const getActivityDate = (lead: LeadDb) => {
  return (
    lead.ultima_atividade ||
    lead.ultima_resposta_lead ||
    lead.horario_contato ||
    lead.data_encaminhamento ||
    lead.created_at
  )
}

const isSent = (value: string | null | undefined) => {
  const normalized = (value || '').trim().toLowerCase()
  return sentValues.some((sent) => normalized.includes(sent))
}

const isPastOrNow = (value: string | null | undefined) => {
  const date = parseDate(value)
  return !!date && date.getTime() <= Date.now()
}

const formatWhatsApp = (num: string | null | undefined) => {
  const cleaned = (num || '').replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`
  }
  if (cleaned.length === 13) {
    return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`
  }
  return num || 'Sem WhatsApp'
}

const safeDistance = (dateStr: string | null | undefined) => {
  const date = parseDate(dateStr)
  if (!date) return 'sem data'
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR })
}

const makeDateTimeLocalValue = (date: Date) => {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

const getTomorrowAtNine = () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  return tomorrow
}

const getTemperatureLabel = (lead: LeadDb) => {
  if (lead.temperatura) return lead.temperatura
  const score = lead.score || 0
  if (score >= 70) return 'quente'
  if (score >= 40) return 'morno'
  return 'frio'
}

const getStatusLabel = (lead: LeadDb) => {
  if (lead.convertido) return 'Convertido'
  if (lead.encaminhado_vendedor) return 'Encaminhado'
  if (lead.status === 'follow_up') return 'Follow-up'
  if (lead.status === 'em_qualificacao') return 'Qualificacao'
  if (lead.status === 'proposta_enviada') return 'Proposta'
  if (lead.status === 'sem_interesse') return 'Sem interesse'
  return 'Novo contato'
}

const getDueFollowUp = (lead: LeadDb, followUps: FollowUp[]) => {
  const explicitFollowUps = followUps
    .filter((item) => item.lead_id === lead.id && !item.realizado && isPastOrNow(item.agendado_para))
    .map((item) => ({
      date: item.agendado_para,
      reason: item.motivo || 'Follow-up agendado',
    }))

  const columnFollowUps = [
    {
      date: lead.data_followup_1 || lead.data_follow_up,
      sent: lead.followup_1_enviado || lead.followup_1enviado,
      reason: 'Primeiro follow-up pendente',
    },
    {
      date: lead.data_followup_2,
      sent: lead.followup_2_enviado,
      reason: 'Segundo follow-up pendente',
    },
    {
      date: lead.data_followup_3,
      sent: lead.followup_3_enviado,
      reason: 'Terceiro follow-up pendente',
    },
  ].filter((item) => item.date && isPastOrNow(item.date) && !isSent(item.sent))

  return [...explicitFollowUps, ...columnFollowUps].sort((a, b) => {
    return (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0)
  })[0]
}

const makeMessage = (lead: LeadDb, kind: MissionKind) => {
  const firstName = getFirstName(lead)
  const greeting = firstName ? `${firstName}, ` : ''
  const product = lead.produto_interesse ? ` sobre ${lead.produto_interesse}` : ''

  if (kind === 'salvar_venda') {
    return `${greeting}vi que voce demonstrou interesse${product}. Faz sentido eu te passar o proximo passo agora para a gente avancar?`
  }

  if (kind === 'fechar_proposta') {
    return `${greeting}passando para confirmar se a proposta fez sentido para voce. Se quiser, eu ja te ajudo a seguir com o proximo passo hoje.`
  }

  if (kind === 'followup') {
    return `${greeting}combinamos de retomar esse assunto. Ainda faz sentido para voce seguir com isso agora?`
  }

  if (kind === 'assumir_agora') {
    return `${greeting}eu vi seu atendimento aqui e consigo te ajudar pessoalmente agora. Me fala so uma coisa: voce quer avancar ainda hoje?`
  }

  if (kind === 'qualificar') {
    return `${greeting}para eu te orientar melhor, me confirma rapidinho: o que voce procura e para quando precisa disso?`
  }

  return `${greeting}passando para saber se ainda posso te ajudar com isso. Se fizer sentido, eu te mostro o melhor caminho.`
}

const makeMission = (lead: LeadDb, followUps: FollowUp[]): Mission | null => {
  if (lead.convertido) return null

  const score = lead.score || 0
  const temp = getTemperatureLabel(lead)
  const activityDate = getActivityDate(lead)
  const staleHours = hoursSince(activityDate)
  const dueFollowUp = getDueFollowUp(lead, followUps)
  const highIntent = lead.intencao_compra === 'alta' || lead.urgencia === 'imediato' || lead.orcamento_informado
  const hot = score >= 70 || temp === 'quente' || highIntent
  const summary = getSummary(lead)

  let kind: MissionKind = 'monitorar'
  let priority = 10
  let headline = 'Manter no radar'
  let reason = 'Lead sem sinal critico neste momento.'
  let nextAction = 'Acompanhar sem pressa e manter a IA ativa.'
  let buySignal = summary || 'Ainda faltam sinais claros de compra.'
  let lossRisk = 'Risco baixo enquanto nao houver urgencia ou score alto.'

  if (hot && staleHours >= 3) {
    kind = 'salvar_venda'
    priority = 100 + score + Math.min(staleHours, 48)
    headline = 'Venda quente parada'
    reason = `Lead quente ficou ${staleHours}h sem movimento.`
    nextAction = 'Retomar agora com abordagem direta de fechamento.'
    buySignal = summary || 'Score alto, temperatura quente ou intencao forte.'
    lossRisk = 'Quanto mais tempo parado, maior a chance de esfriar e comprar de outro.'
  } else if (lead.encaminhado_vendedor && !lead.convertido) {
    kind = 'fechar_proposta'
    priority = 92 + score + Math.min(staleHours, 24)
    headline = 'Proposta precisa de dono'
    reason = 'Lead ja foi encaminhado, mas ainda nao virou conversao.'
    nextAction = 'Confirmar se a proposta fez sentido e pedir decisao.'
    buySignal = summary || 'Ja passou da etapa de qualificacao e chegou no vendedor.'
    lossRisk = 'Sem follow-up humano, a proposta perde forca.'
  } else if (dueFollowUp) {
    kind = 'followup'
    priority = 86 + score
    headline = 'Retorno prometido vencido'
    reason = dueFollowUp.reason
    nextAction = 'Cumprir o retorno combinado e puxar a proxima decisao.'
    buySignal = summary || 'Existe um follow-up registrado para este lead.'
    lossRisk = 'Quando o retorno atrasa, o cliente sente abandono.'
  } else if (hot && lead.bot_ativo) {
    kind = 'assumir_agora'
    priority = 78 + score
    headline = 'Humano deve entrar'
    reason = 'Lead forte ainda esta com a IA ativa.'
    nextAction = 'Assumir o atendimento ou abrir a ficha para pausar a IA.'
    buySignal = summary || 'A IA trouxe um lead com bom potencial comercial.'
    lossRisk = 'A IA qualifica, mas a conversao pode precisar de vendedor.'
  } else if (!summary || score === 0 || !lead.intencao_compra) {
    kind = 'qualificar'
    priority = 50 + Math.min(staleHours, 24)
    headline = 'Faltam dados para vender'
    reason = 'Lead ainda nao tem diagnostico comercial suficiente.'
    nextAction = 'Descobrir necessidade, prazo, produto e poder de compra.'
    buySignal = 'Pode haver oportunidade escondida, mas a qualificacao esta incompleta.'
    lossRisk = 'Sem contexto, o vendedor nao sabe como atacar.'
  } else if (staleHours >= 24 && score < 40) {
    kind = 'nutrir'
    priority = 35 + Math.min(staleHours, 24)
    headline = 'Nutrir sem gastar energia'
    reason = 'Lead frio ficou parado e nao merece foco de fechamento.'
    nextAction = 'Manter a IA nutrindo ou retomar com mensagem leve.'
    buySignal = summary || 'Existe algum historico, mas sem forca comercial.'
    lossRisk = 'Gastar tempo demais aqui tira energia dos leads quentes.'
  }

  const riskScore = Math.min(99, Math.max(5, Math.round(priority / 2)))
  const dueLabel = staleHours > 0
    ? `${staleHours}h parado`
    : safeDistance(activityDate)

  return {
    id: `${kind}-${lead.id}`,
    lead,
    kind,
    priority,
    riskScore,
    headline,
    reason,
    nextAction,
    buySignal,
    lossRisk,
    suggestedMessage: makeMessage(lead, kind),
    staleHours,
    dueLabel,
  }
}

const getFilterCount = (missions: Mission[], filter: FilterKind) => {
  return missions.filter((mission) => matchesMissionFilter(mission, filter)).length
}

const matchesMissionFilter = (mission: Mission, filter: FilterKind) => {
  if (filter === 'todas') return true
  if (filter === 'risco') return ['salvar_venda', 'fechar_proposta', 'followup'].includes(mission.kind)
  return mission.kind === filter
}

export const Conversas: React.FC = () => {
  const [leads, setLeads] = useState<LeadDb[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterKind>('todas')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState(() => makeDateTimeLocalValue(getTomorrowAtNine()))
  const [scheduleReason, setScheduleReason] = useState('Retomar contato e confirmar proximo passo comercial.')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null)

  useEffect(() => {
    fetchRadarData()

    const leadsChannel = supabaseAdmin
      .channel('radar_leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, fetchRadarData)
      .subscribe()

    const followUpsChannel = supabaseAdmin
      .channel('radar_followups')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, fetchRadarData)
      .subscribe()

    return () => {
      supabaseAdmin.removeChannel(leadsChannel)
      supabaseAdmin.removeChannel(followUpsChannel)
    }
  }, [])

  const fetchRadarData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .order('ultima_atividade', { ascending: false, nullsFirst: false })

      if (error) throw error
      setLeads((data || []) as LeadDb[])

      const { data: followUpData, error: followUpError } = await supabaseAdmin
        .from('follow_ups')
        .select('*')
        .eq('realizado', false)

      if (!followUpError && followUpData) {
        setFollowUps(followUpData as FollowUp[])
      }
    } catch (err) {
      console.error('Erro ao carregar radar comercial:', err)
    } finally {
      setLoading(false)
    }
  }

  const missions = useMemo(() => {
    return leads
      .map((lead) => makeMission(lead, followUps))
      .filter((mission): mission is Mission => !!mission)
      .sort((a, b) => b.priority - a.priority)
  }, [leads, followUps])

  const filteredMissions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return missions.filter((mission) => {
      const lead = mission.lead
      const matchesFilter = matchesMissionFilter(mission, activeFilter)
      const matchesSearch =
        !term ||
        (lead.nome || '').toLowerCase().includes(term) ||
        (lead.whatsapp || '').includes(term) ||
        (lead.produto_interesse || '').toLowerCase().includes(term) ||
        mission.headline.toLowerCase().includes(term)

      return matchesFilter && matchesSearch
    })
  }, [activeFilter, missions, searchTerm])

  const selectedMission = useMemo(() => {
    return filteredMissions.find((mission) => mission.lead.id === selectedLeadId) || filteredMissions[0] || null
  }, [filteredMissions, selectedLeadId])

  useEffect(() => {
    setIsScheduleOpen(false)
    setActionFeedback(null)
    setScheduleAt(makeDateTimeLocalValue(getTomorrowAtNine()))
    setScheduleReason('Retomar contato e confirmar proximo passo comercial.')
  }, [selectedMission?.lead.id])

  useEffect(() => {
    if (!selectedLeadId && filteredMissions[0]) {
      setSelectedLeadId(filteredMissions[0].lead.id)
    }
  }, [filteredMissions, selectedLeadId])

  const metrics = useMemo(() => {
    const hotStalled = missions.filter((mission) => mission.kind === 'salvar_venda').length
    const closing = missions.filter((mission) => mission.kind === 'fechar_proposta').length
    const dueFollowUps = missions.filter((mission) => mission.kind === 'followup').length
    const aiHot = missions.filter((mission) => mission.kind === 'assumir_agora').length
    const nonConverted = leads.filter((lead) => !lead.convertido).length

    return [
      {
        label: 'Vendas em risco',
        value: hotStalled + closing + dueFollowUps,
        hint: 'pedem acao hoje',
        icon: AlertTriangle,
        filter: 'risco' as FilterKind,
        className: 'text-red-400 bg-red-500/10 border-red-500/20',
      },
      {
        label: 'Quentes parados',
        value: hotStalled,
        hint: 'score alto sem movimento',
        icon: Flame,
        filter: 'salvar_venda' as FilterKind,
        className: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      },
      {
        label: 'Follow-ups vencidos',
        value: dueFollowUps,
        hint: 'retornos prometidos',
        icon: CalendarClock,
        filter: 'followup' as FilterKind,
        className: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      },
      {
        label: 'Oportunidades abertas',
        value: nonConverted,
        hint: 'ainda podem virar venda',
        icon: Target,
        filter: 'todas' as FilterKind,
        className: 'text-primary bg-primary/10 border-primary/20',
      },
      {
        label: 'IA com lead forte',
        value: aiHot,
        hint: 'humano pode assumir',
        icon: Bot,
        filter: 'assumir_agora' as FilterKind,
        className: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
      },
    ]
  }, [leads, missions])

  const selectFilter = (filter: FilterKind) => {
    setSearchTerm('')
    setActiveFilter(filter)
    const firstMission = missions.find((mission) => matchesMissionFilter(mission, filter))
    setSelectedLeadId(firstMission?.lead.id || null)
  }

  const selectTopMission = () => {
    setSearchTerm('')
    setActiveFilter('todas')
    setSelectedLeadId(missions[0]?.lead.id || null)
  }

  const handleCopyMessage = async () => {
    if (!selectedMission) return
    await navigator.clipboard.writeText(selectedMission.suggestedMessage)
    setCopied(true)
    setActionFeedback({ type: 'success', text: 'Mensagem copiada. Agora e so colar no WhatsApp ou abrir a ficha.' })
    setTimeout(() => setCopied(false), 1800)
  }

  const registerLeadNote = async (leadId: string, content: string, createdAt = new Date().toISOString()) => {
    const { error } = await supabaseAdmin
      .from('interacoes')
      .insert({
        lead_id: leadId,
        tipo: 'nota_vendedor',
        conteudo: content,
        criado_em: createdAt,
      })

    if (error) throw error
  }

  const handleMarkConverted = async () => {
    if (!selectedMission) return
    setActionLoading('convert')
    setActionFeedback(null)
    const now = new Date().toISOString()

    try {
      const { error } = await supabaseAdmin
        .from('leads')
        .update({
          convertido: true,
          status: 'convertido',
          data_conversao: now,
          ultima_atividade: now,
        })
        .eq('id', selectedMission.lead.id)

      if (error) throw error
      await registerLeadNote(
        selectedMission.lead.id,
        `Lead marcado como convertido no Radar IA. Missao: ${selectedMission.headline}.`,
        now
      )

      await fetchRadarData()
      setActionFeedback({ type: 'success', text: 'Lead marcado como convertido e historico atualizado.' })
    } catch (err) {
      console.error('Erro ao marcar conversao:', err)
      setActionFeedback({ type: 'error', text: 'Nao consegui marcar como convertido. Tente novamente.' })
    } finally {
      setActionLoading(null)
    }
  }

  const openSchedulePanel = () => {
    setIsScheduleOpen(true)
    setActionFeedback(null)
  }

  const handleScheduleNextAction = async () => {
    if (!selectedMission) return
    const scheduledDate = new Date(scheduleAt)

    if (Number.isNaN(scheduledDate.getTime())) {
      setActionFeedback({ type: 'error', text: 'Escolha uma data e horario validos para a proxima acao.' })
      return
    }

    if (scheduledDate.getTime() <= Date.now()) {
      setActionFeedback({ type: 'error', text: 'A proxima acao precisa ficar em um horario futuro.' })
      return
    }

    setActionLoading('schedule')
    setActionFeedback(null)
    const now = new Date().toISOString()
    const scheduledAt = scheduledDate.toISOString()
    const reason = scheduleReason.trim() || 'Retomar contato e confirmar proximo passo comercial.'

    try {
      const { error } = await supabaseAdmin
        .from('leads')
        .update({
          status: 'follow_up',
          data_followup_1: scheduledAt,
          followup_1_enviado: 'pendente',
          ultima_atividade: now,
        })
        .eq('id', selectedMission.lead.id)

      if (error) throw error

      const { error: followUpError } = await supabaseAdmin
        .from('follow_ups')
        .insert({
          lead_id: selectedMission.lead.id,
          agendado_para: scheduledAt,
          motivo: reason,
          realizado: false,
          criado_por: 'vendedor',
        })

      if (followUpError) throw followUpError

      await registerLeadNote(
        selectedMission.lead.id,
        `Proxima acao agendada para ${format(scheduledDate, "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })}. Motivo: ${reason}`,
        now
      )

      await fetchRadarData()
      setIsScheduleOpen(false)
      setActionFeedback({ type: 'success', text: 'Proxima acao agendada e registrada no historico do lead.' })
    } catch (err) {
      console.error('Erro ao agendar retorno:', err)
      setActionFeedback({ type: 'error', text: 'Nao consegui agendar a proxima acao. Tente novamente.' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkHandled = async () => {
    if (!selectedMission) return
    setActionLoading('handled')
    setActionFeedback(null)
    const now = new Date().toISOString()
    const lead = selectedMission.lead
    const updates: Partial<LeadDb> & Record<string, string | boolean> = {
      ultima_atividade: now,
    }

    if (selectedMission.kind === 'assumir_agora') {
      updates.bot_ativo = false
      updates.status = 'em_qualificacao'
    }

    if (selectedMission.kind === 'followup') {
      updates.status = 'em_qualificacao'
      if (isPastOrNow(lead.data_followup_1 || lead.data_follow_up) && !isSent(lead.followup_1_enviado || lead.followup_1enviado)) {
        updates.followup_1_enviado = 'feito'
      }
      if (isPastOrNow(lead.data_followup_2) && !isSent(lead.followup_2_enviado)) {
        updates.followup_2_enviado = 'feito'
      }
      if (isPastOrNow(lead.data_followup_3) && !isSent(lead.followup_3_enviado)) {
        updates.followup_3_enviado = 'feito'
      }
    }

    try {
      const { error } = await supabaseAdmin
        .from('leads')
        .update(updates)
        .eq('id', selectedMission.lead.id)

      if (error) throw error

      await supabaseAdmin
        .from('follow_ups')
        .update({ realizado: true, realizado_em: now })
        .eq('lead_id', selectedMission.lead.id)
        .eq('realizado', false)
        .lte('agendado_para', now)

      await registerLeadNote(
        selectedMission.lead.id,
        `Missao tratada no Radar IA. Missao: ${selectedMission.headline}.`,
        now
      )

      await fetchRadarData()
      setActionFeedback({ type: 'success', text: 'Missao marcada como tratada e registrada no historico.' })
    } catch (err) {
      console.error('Erro ao marcar missao como tratada:', err)
      setActionFeedback({ type: 'error', text: 'Nao consegui marcar a missao como tratada. Tente novamente.' })
    } finally {
      setActionLoading(null)
    }
  }

  const selectedLead = selectedMission?.lead || null

  return (
    <Layout title="Radar Comercial">
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          {metrics.map((metric) => {
            const metricActive = activeFilter === metric.filter
            return (
            <button
              key={metric.label}
              type="button"
              onClick={() => selectFilter(metric.filter)}
              className={`rounded-[10px] border bg-bg-card p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
                metricActive ? 'border-primary/60 ring-2 ring-primary/10' : 'border-border-card'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className={`h-10 w-10 rounded-xl border flex items-center justify-center ${metric.className}`}>
                  <metric.icon size={19} />
                </div>
                <span className="text-3xl font-black text-text-main tabular-nums">{metric.value}</span>
              </div>
              <div className="mt-3">
                <p className="text-xs font-black uppercase tracking-wider text-text-main">{metric.label}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{metric.hint}</p>
              </div>
            </button>
            )
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[430px_minmax(0,1fr)] gap-5 min-h-[650px] h-[calc(100vh-260px)]">
          <aside className="flex min-h-0 flex-col rounded-[10px] border border-border-card bg-bg-card shadow-card overflow-hidden">
            <div className="border-b border-border-card p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Fila de missoes</p>
                  <h2 className="mt-1 text-lg font-black text-text-main">Onde o dinheiro pode escapar</h2>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary">
                    {filteredMissions.length} ativas
                  </div>
                  <button
                    type="button"
                    onClick={selectTopMission}
                    disabled={missions.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border-card bg-bg-base px-3 py-1.5 text-[11px] font-black text-text-main transition-all hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlayCircle size={13} />
                    Proxima missao
                  </button>
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
                <Input
                  className="pl-9 h-10 bg-bg-base"
                  placeholder="Buscar lead, produto ou missao..."
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                {FILTERS.map((filter) => {
                  const isActive = activeFilter === filter.key
                  const count = getFilterCount(missions, filter.key)
                  return (
                    <button
                      key={filter.key}
                      onClick={() => selectFilter(filter.key)}
                      className={`shrink-0 rounded-lg border px-3 py-2 text-[11px] font-black transition-all ${
                        isActive
                          ? 'border-primary bg-primary text-[#0F1117] shadow-sm'
                          : 'border-border-card bg-bg-base text-text-muted hover:border-primary/30 hover:text-text-main'
                      }`}
                    >
                      {filter.label}
                      <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] ${isActive ? 'bg-black/10' : 'bg-border-card/70'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
              {loading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map((item) => (
                    <div key={item} className="h-32 rounded-xl bg-bg-base animate-pulse" />
                  ))}
                </div>
              ) : filteredMissions.length > 0 ? (
                <div className="space-y-2">
                  {filteredMissions.map((mission) => {
                    const style = MISSION_STYLES[mission.kind]
                    const Icon = style.icon
                    const active = selectedMission?.lead.id === mission.lead.id

                    return (
                      <button
                        key={mission.id}
                        type="button"
                        onClick={() => setSelectedLeadId(mission.lead.id)}
                        className={`w-full rounded-xl border p-3 text-left transition-all ${
                          active
                            ? `${style.bg} ${style.border} shadow-lg shadow-black/10`
                            : 'border-transparent hover:border-border-card hover:bg-bg-base/50'
                        }`}
                      >
                        <div className="flex gap-3">
                          <div className={`relative h-11 w-11 shrink-0 rounded-xl border flex items-center justify-center ${style.bg} ${style.border} ${style.text}`}>
                            <Icon size={18} />
                            {mission.kind === 'salvar_venda' && (
                              <span className={`absolute -right-1 -top-1 h-3 w-3 rounded-full ${style.dot} animate-ping`} />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-text-main">{getLeadName(mission.lead)}</p>
                                <p className={`mt-0.5 text-[10px] font-black uppercase tracking-wider ${style.text}`}>
                                  {style.label}
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="block text-sm font-black text-text-main tabular-nums">{mission.lead.score || 0}</span>
                                <span className="block text-[9px] font-bold text-text-muted">pts</span>
                              </div>
                            </div>

                            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">
                              {mission.reason}
                            </p>

                            <div className="mt-3 flex items-center justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-2">
                                <ScoreBar score={mission.lead.score || 0} className="h-1.5 w-24" />
                                <span className="truncate text-[10px] font-bold text-text-muted">{mission.dueLabel}</span>
                              </div>
                              <span className={`rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-wider ${style.bg} ${style.text}`}>
                                {style.shortLabel}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-8 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border-card bg-bg-base text-text-muted">
                    <ListChecks size={28} />
                  </div>
                  <p className="text-sm font-bold text-text-main">Nenhuma missao encontrada</p>
                  <p className="mt-2 text-xs leading-relaxed text-text-muted">
                    Ajuste o filtro ou aguarde novos sinais comerciais chegarem pelo agente.
                  </p>
                </div>
              )}
            </div>
          </aside>

          <section className="min-h-0 overflow-hidden rounded-[10px] border border-border-card bg-[#1E2435] shadow-card">
            {selectedMission ? (
              <div className="flex h-full min-h-0 flex-col">
                <MissionHeader
                  mission={selectedMission}
                  onOpenDrawer={() => setIsDrawerOpen(true)}
                />

                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                  <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_360px] gap-5">
                    <div className="space-y-5">
                      <DecisionCard mission={selectedMission} />

                      <div className="rounded-[10px] border border-white/10 bg-[#252D40] p-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#00C48C]">Mensagem pronta</p>
                            <h3 className="mt-1 text-lg font-black text-white">Resposta sugerida pela IA</h3>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyMessage}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#00C48C]/25 bg-[#00C48C]/10 px-3 py-2 text-xs font-black text-[#00C48C] transition-all hover:bg-[#00C48C] hover:text-[#0F1117]"
                          >
                            {copied ? <Check size={15} /> : <Clipboard size={15} />}
                            {copied ? 'Copiada' : 'Copiar'}
                          </button>
                        </div>

                        <div className="mt-4 rounded-xl border border-white/10 bg-[#1E2435] p-4">
                          <p className="text-sm leading-relaxed text-white/90">
                            {selectedMission.suggestedMessage}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <button
                          type="button"
                          onClick={handleMarkConverted}
                          disabled={actionLoading === 'convert'}
                          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-left text-emerald-300 transition-all hover:bg-emerald-500 hover:text-[#0F1117] disabled:opacity-60"
                        >
                          <Trophy size={20} />
                          <p className="mt-3 text-sm font-black">Marcar convertido</p>
                          <p className="mt-1 text-xs opacity-75">Fecha a oportunidade no radar.</p>
                        </button>

                        <button
                          type="button"
                          onClick={openSchedulePanel}
                          disabled={actionLoading === 'schedule'}
                          className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-left text-amber-300 transition-all hover:bg-amber-500 hover:text-[#0F1117] disabled:opacity-60"
                        >
                          <CalendarClock size={20} />
                          <p className="mt-3 text-sm font-black">Agendar proxima acao</p>
                          <p className="mt-1 text-xs opacity-75">Cria follow-up real e nota no historico.</p>
                        </button>

                        <button
                          type="button"
                          onClick={handleMarkHandled}
                          disabled={actionLoading === 'handled'}
                          className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 p-4 text-left text-cyan-300 transition-all hover:bg-cyan-500 hover:text-[#0F1117] disabled:opacity-60"
                        >
                          <CheckCircle2 size={20} />
                          <p className="mt-3 text-sm font-black">Missao tratada</p>
                          <p className="mt-1 text-xs opacity-75">Registra que o vendedor agiu.</p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsDrawerOpen(true)}
                          className="rounded-xl border border-white/10 bg-white/5 p-4 text-left text-white/75 transition-all hover:border-[#00C48C]/40 hover:text-[#00C48C]"
                        >
                          <Info size={20} />
                          <p className="mt-3 text-sm font-black">Abrir ficha completa</p>
                          <p className="mt-1 text-xs opacity-75">Ver historico, IA e controles.</p>
                        </button>
                      </div>

                      {actionFeedback && (
                        <div
                          className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                            actionFeedback.type === 'success'
                              ? 'border-[#00C48C]/25 bg-[#00C48C]/10 text-[#00C48C]'
                              : 'border-red-500/25 bg-red-500/10 text-red-300'
                          }`}
                        >
                          {actionFeedback.text}
                        </div>
                      )}

                      {isScheduleOpen && (
                        <div className="rounded-[10px] border border-amber-500/25 bg-amber-500/10 p-5 text-amber-50">
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Proxima acao</p>
                              <h3 className="mt-1 text-lg font-black text-white">Agendar retorno comercial</h3>
                              <p className="mt-1 text-xs leading-relaxed text-white/55">
                                Isso nao envia WhatsApp sozinho. O lead volta para o radar no horario escolhido.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsScheduleOpen(false)}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/60 transition-all hover:text-white"
                            >
                              Fechar
                            </button>
                          </div>

                          <div className="mt-4 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-3">
                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white/45">Data e hora</span>
                              <input
                                type="datetime-local"
                                value={scheduleAt}
                                onChange={(event) => setScheduleAt(event.target.value)}
                                className="mt-1 h-11 w-full rounded-lg border border-white/10 bg-[#1E2435] px-3 text-sm font-bold text-white outline-none transition-all focus:border-amber-400/60"
                              />
                            </label>

                            <label className="block">
                              <span className="text-[10px] font-black uppercase tracking-wider text-white/45">Motivo</span>
                              <textarea
                                value={scheduleReason}
                                onChange={(event) => setScheduleReason(event.target.value)}
                                rows={2}
                                className="mt-1 min-h-11 w-full resize-none rounded-lg border border-white/10 bg-[#1E2435] px-3 py-2 text-sm font-semibold text-white outline-none transition-all placeholder:text-white/30 focus:border-amber-400/60"
                                placeholder="Ex: confirmar proposta, cobrar documentos, validar prazo..."
                              />
                            </label>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setScheduleAt(makeDateTimeLocalValue(getTomorrowAtNine()))
                                setScheduleReason('Retomar contato e confirmar proximo passo comercial.')
                              }}
                              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-black text-white/60 transition-all hover:text-white"
                            >
                              Amanha 9h
                            </button>
                            <button
                              type="button"
                              onClick={handleScheduleNextAction}
                              disabled={actionLoading === 'schedule'}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400 px-4 py-2 text-xs font-black text-[#0F1117] transition-all hover:brightness-110 disabled:opacity-60"
                            >
                              <CalendarClock size={15} />
                              {actionLoading === 'schedule' ? 'Agendando...' : 'Salvar proxima acao'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <LeadIntelPanel mission={selectedMission} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-white/35">
                  <Target size={34} />
                </div>
                <h3 className="text-2xl font-black text-white">Radar sem missoes</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/55">
                  Quando houver lead quente, follow-up vencido ou proposta sem resposta, a IA vai trazer a prioridade para ca.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>

      <DrawerLead
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdate={fetchRadarData}
        onEdit={(lead) => {
          setLeadToEdit(lead)
          setIsModalOpen(true)
          setIsDrawerOpen(false)
        }}
      />

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchRadarData}
        lead={leadToEdit}
      />
    </Layout>
  )
}

const MissionHeader: React.FC<{ mission: Mission; onOpenDrawer: () => void }> = ({ mission, onOpenDrawer }) => {
  const lead = mission.lead
  const style = MISSION_STYLES[mission.kind]
  const Icon = style.icon

  return (
    <div className="shrink-0 border-b border-white/10 bg-[#252D40] px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div
            className="flex h-13 w-13 items-center justify-center rounded-2xl text-lg font-black text-white shadow-lg"
            style={{ background: `linear-gradient(135deg, ${style.hex}, ${style.hex}bb)` }}
          >
            {lead.nome?.[0]?.toUpperCase() || <User size={22} />}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-black text-white">{getLeadName(lead)}</h2>
              <span className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}>
                <Icon size={12} />
                {style.label}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold text-white/55">
              <span className="inline-flex items-center gap-1">
                <Phone size={12} />
                {formatWhatsApp(lead.whatsapp)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} />
                {safeDistance(getActivityDate(lead))}
              </span>
              {lead.bot_ativo && (
                <span className="inline-flex items-center gap-1 text-[#00C48C]">
                  <Bot size={12} />
                  IA ativa
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenDrawer}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/75 transition-all hover:border-[#00C48C]/30 hover:bg-[#00C48C]/10 hover:text-[#00C48C]"
        >
          <ArrowUpRight size={16} />
          Ficha
        </button>
      </div>
    </div>
  )
}

const DecisionCard: React.FC<{ mission: Mission }> = ({ mission }) => {
  const style = MISSION_STYLES[mission.kind]
  const Icon = style.icon

  return (
    <div className={`rounded-[10px] border bg-[#252D40] p-5 ${style.border}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${style.bg} ${style.border} ${style.text}`}>
            <Icon size={22} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Diagnostico comercial</p>
            <h3 className="mt-1 text-2xl font-black text-white">{mission.headline}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65">{mission.reason}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-[#1E2435] px-4 py-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Risco</p>
          <p className={`mt-1 text-3xl font-black tabular-nums ${style.text}`}>{mission.riskScore}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-3 gap-3">
        <IntelBlock
          icon={CheckCircle2}
          title="Por que pode comprar"
          text={mission.buySignal}
          tone="success"
        />
        <IntelBlock
          icon={AlertTriangle}
          title="Onde pode perder"
          text={mission.lossRisk}
          tone="warning"
        />
        <IntelBlock
          icon={Zap}
          title="Proxima melhor acao"
          text={mission.nextAction}
          tone="primary"
        />
      </div>
    </div>
  )
}

const IntelBlock: React.FC<{
  icon: IconComponent
  title: string
  text: string
  tone: 'success' | 'warning' | 'primary'
}> = ({ icon: Icon, title, text, tone }) => {
  const classes = {
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    primary: 'border-[#00C48C]/20 bg-[#00C48C]/10 text-[#00C48C]',
  }[tone]

  return (
    <div className={`rounded-xl border p-4 ${classes}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <p className="text-[10px] font-black uppercase tracking-wider">{title}</p>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-white/75">{text}</p>
    </div>
  )
}

const LeadIntelPanel: React.FC<{ mission: Mission }> = ({ mission }) => {
  const lead = mission.lead
  const summary = getSummary(lead)
  const activityDate = parseDate(getActivityDate(lead))
  const minutes = activityDate ? differenceInMinutes(new Date(), activityDate) : 0

  const facts = [
    { label: 'Status', value: getStatusLabel(lead), icon: Target },
    { label: 'Temperatura', value: getTemperatureLabel(lead), icon: Flame },
    { label: 'Intencao', value: lead.intencao_compra || 'Nao informada', icon: Sparkles },
    { label: 'Urgencia', value: lead.urgencia?.replace('_', ' ') || 'Nao informada', icon: Clock },
    { label: 'Orcamento', value: lead.orcamento_informado ? 'Informado' : 'Nao informado', icon: Clipboard },
    { label: 'Origem', value: lead.origem || 'Nao informada', icon: ArrowUpRight },
  ]

  return (
    <aside className="space-y-4">
      <div className="rounded-[10px] border border-white/10 bg-[#252D40] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Score de fechamento</p>
        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-5xl font-black text-white tabular-nums">{lead.score || 0}</p>
            <p className="mt-1 text-xs font-bold text-white/45">pontos de qualificacao</p>
          </div>
          <div className="mb-2 rounded-xl border border-[#00C48C]/20 bg-[#00C48C]/10 px-3 py-2 text-right">
            <p className="text-[10px] font-black uppercase text-[#00C48C]">Parado</p>
            <p className="text-sm font-black text-white">
              {minutes < 60 ? `${Math.max(0, minutes)}min` : `${mission.staleHours}h`}
            </p>
          </div>
        </div>
        <ScoreBar score={lead.score || 0} className="mt-4 h-2" />
      </div>

      <div className="rounded-[10px] border border-white/10 bg-[#252D40] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Dados que importam</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {facts.map((fact) => (
            <div key={fact.label} className="rounded-xl border border-white/10 bg-[#1E2435] p-3">
              <fact.icon size={14} className="text-[#00C48C]" />
              <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-white/35">{fact.label}</p>
              <p className="mt-1 truncate text-xs font-bold capitalize text-white/85">{fact.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[10px] border border-white/10 bg-[#252D40] p-5">
        <div className="flex items-center gap-2 text-[#00C48C]">
          <MessageSquare size={16} />
          <p className="text-[10px] font-black uppercase tracking-[0.22em]">Sintese IA</p>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-white/75">
          {summary || 'Ainda nao existe sintese suficiente. A missao principal e qualificar melhor este lead.'}
        </p>
      </div>

      <div className="rounded-[10px] border border-white/10 bg-[#252D40] p-5">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Produto e contexto</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/45">Produto</span>
            <span className="text-right font-bold text-white">{lead.produto_interesse || 'Nao informado'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/45">Cidade</span>
            <span className="text-right font-bold text-white">{lead.cidade || 'Nao informada'}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/45">Ultima atividade</span>
            <span className="text-right font-bold text-white">
              {activityDate ? format(activityDate, "dd/MM 'as' HH:mm", { locale: ptBR }) : 'Sem data'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  )
}
