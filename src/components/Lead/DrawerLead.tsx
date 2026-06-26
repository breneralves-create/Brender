import React, { useCallback, useState, useEffect } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { 
  Phone, 
  MapPin, 
  Calendar, 
  Clock, 
  MessageSquare, 
  CheckCircle, 
  Edit3, 
  FileText, 
  Bot, 
  BotOff,
  BotMessageSquare,
  Trophy,
  Plus,
  Check,
  MessageCircle,
  ExternalLink
} from 'lucide-react'
import { supabaseAdmin } from '../../lib/supabase'
import type { Lead, Interacao, FollowUp } from '../../types'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { ScoreBar } from '../ui/ScoreBar'
import { LeadTemperature } from '../ui/LeadTemperature'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import { buildWhatsAppUrl, formatWhatsAppNumber, openWhatsApp } from '../../lib/whatsapp'

interface DrawerLeadProps {
  lead: Lead | null
  isOpen: boolean
  onClose: () => void
  onUpdate?: () => void
  onEdit?: (lead: Lead) => void
}

const dateTimeLocalValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const tomorrowAtNine = () => {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return dateTimeLocalValue(date)
}

export const DrawerLead: React.FC<DrawerLeadProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdate,
  onEdit
}) => {
  const [interactions, setInteractions] = useState<Interacao[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [copied, setCopied] = useState(false)
  const [botLoading, setBotLoading] = useState(false)
  const [botAtivo, setBotAtivo] = useState<boolean>(true)
  const [botError, setBotError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [isScheduleOpen, setIsScheduleOpen] = useState(false)
  const [scheduleAt, setScheduleAt] = useState(tomorrowAtNine)
  const [scheduleReason, setScheduleReason] = useState('Retornar com o lead para avancar a negociacao.')
  const [isNoteOpen, setIsNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')

  const fetchLeadDetails = useCallback(async () => {
    if (!lead) return
    try {
      // Fetch Interactions
      const { data: interactionData } = await supabaseAdmin
        .from('interacoes')
        .select('*')
        .eq('lead_id', lead.id)
        .order('criado_em', { ascending: true })
      
      if (interactionData) setInteractions(interactionData)

      // Fetch Follow-ups
      const { data: followUpData } = await supabaseAdmin
        .from('follow_ups')
        .select('*')
        .eq('lead_id', lead.id)
        .order('agendado_para', { ascending: true })
      
      if (followUpData) setFollowUps(followUpData)
    } catch (error) {
      console.error('Erro ao buscar detalhes do lead:', error)
    }
  }, [lead])

  useEffect(() => {
    if (isOpen && lead) {
      void fetchLeadDetails()
      setBotAtivo(lead.bot_ativo ?? true)
      setBotError(null)
      setScheduleAt(tomorrowAtNine())
      setScheduleReason('Retornar com o lead para avancar a negociacao.')
      setNoteText('')
      setIsScheduleOpen(false)
      setIsNoteOpen(false)
    }
  }, [fetchLeadDetails, isOpen, lead])

  const handleConversion = async () => {
    if (!lead) return
    try {
      const { error } = await supabaseAdmin
        .from('leads')
        .update({ 
          convertido: true,
          data_conversao: new Date().toISOString(),
          status: 'convertido'
        })
        .eq('id', lead.id)
      
      if (error) throw error
      if (onUpdate) onUpdate()
      onClose()
    } catch (error) {
      console.error('Erro ao converter lead:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const toggleBot = async (ativar: boolean) => {
    if (!lead) return
    setBotLoading(true)
    setBotError(null)
    try {
      const { data, error } = await supabaseAdmin.functions.invoke<{
        lead?: { bot_ativo?: boolean | null }
        mensagem?: string
      }>('bot-control', {
        body: {
          lead_id: lead.id,
          ativo: ativar,
        },
      })

      if (error) throw error
      if (data?.lead?.bot_ativo !== ativar) throw new Error(data?.mensagem || 'A alteracao nao foi confirmada pelo servidor.')

      setBotAtivo(ativar)
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Erro ao alterar bot:', error)
      setBotError(error instanceof Error ? error.message : 'Nao foi possivel alterar o agente. Tente novamente.')
    } finally {
      setBotLoading(false)
    }
  }

  const handleCreateFollowUp = async () => {
    if (!lead || !scheduleAt || !scheduleReason.trim()) return
    const scheduledDate = new Date(scheduleAt)
    if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
      setBotError('Escolha uma data futura para o follow-up.')
      return
    }

    setActionLoading(true)
    setBotError(null)
    try {
      const isoDate = scheduledDate.toISOString()
      const reason = scheduleReason.trim()
      const { error: followUpError } = await supabaseAdmin.from('follow_ups').insert({
        lead_id: lead.id,
        agendado_para: isoDate,
        motivo: reason,
        realizado: false,
        criado_por: 'vendedor',
      })
      if (followUpError) throw followUpError

      const { error: leadError } = await supabaseAdmin
        .from('leads')
        .update({
          status: 'follow_up',
          data_followup_1: isoDate,
          followup_1_enviado: 'pendente',
          ultima_atividade: new Date().toISOString(),
        })
        .eq('id', lead.id)
      if (leadError) throw leadError

      await supabaseAdmin.from('interacoes').insert({
        lead_id: lead.id,
        tipo: 'nota_vendedor',
        conteudo: `Follow-up agendado: ${reason}`,
      })

      setIsScheduleOpen(false)
      await fetchLeadDetails()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Erro ao agendar follow-up:', error)
      setBotError(error instanceof Error ? error.message : 'Nao foi possivel agendar o follow-up.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleAddNote = async () => {
    if (!lead || !noteText.trim()) return
    setActionLoading(true)
    setBotError(null)
    try {
      const { error } = await supabaseAdmin.from('interacoes').insert({
        lead_id: lead.id,
        tipo: 'nota_vendedor',
        conteudo: noteText.trim(),
      })
      if (error) throw error
      setNoteText('')
      setIsNoteOpen(false)
      await fetchLeadDetails()
    } catch (error) {
      console.error('Erro ao adicionar nota:', error)
      setBotError(error instanceof Error ? error.message : 'Nao foi possivel adicionar a nota.')
    } finally {
      setActionLoading(false)
    }
  }

  if (!lead) return null
  const whatsappUrl = buildWhatsAppUrl(lead.whatsapp, lead.nome)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={lead.nome || 'Lead sem nome'}
      size="xl"
    >
      <div className="space-y-8 pb-10">
        {/* Header Section */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-text-muted flex items-center gap-2 bg-bg-base px-3 py-1.5 rounded-full border border-border-card text-sm font-medium">
              <Phone size={14} />
              {formatWhatsAppNumber(lead.whatsapp)}
              <button 
                onClick={() => copyToClipboard(lead.whatsapp)}
                className="hover:text-primary transition-colors ml-1"
              >
                {copied ? <Check size={14} className="text-success" /> : <Plus size={14} className="rotate-45" />}
              </button>
            </span>
            <LeadTemperature temperature={lead.temperatura} className="text-sm py-1.5" />
            <span className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${
              botAtivo
                ? 'bg-primary/10 border-primary/30 text-primary'
                : 'bg-error/10 border-error/30 text-error'
            }`}>
              {botAtivo ? <BotMessageSquare size={14} /> : <BotOff size={14} />}
              {botAtivo ? 'IA ativa' : 'IA pausada'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => openWhatsApp(lead.whatsapp, lead.nome)}
            disabled={!whatsappUrl}
            className="group flex w-full items-center justify-between gap-4 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-3.5 text-left text-[#159447] transition-all hover:border-[#25D366]/50 hover:bg-[#25D366]/15 hover:shadow-[0_10px_30px_rgba(37,211,102,0.12)] disabled:cursor-not-allowed disabled:border-border-card disabled:bg-bg-base/40 disabled:text-text-muted disabled:shadow-none"
          >
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white shadow-sm">
                <MessageCircle size={21} />
              </span>
              <span>
                <span className="block text-sm font-bold">Conversar no WhatsApp</span>
                <span className="mt-0.5 block text-xs opacity-75">
                  {whatsappUrl ? 'Abrir conversa com mensagem inicial' : 'Número inválido ou não informado'}
                </span>
              </span>
            </span>
            <ExternalLink size={18} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
          
          <div className="p-4 bg-bg-base/30 rounded-xl border border-border-card space-y-3">
            <div className="flex justify-between items-center text-sm font-medium text-text-muted">
              <span>Score de Qualificação</span>
              <span className="text-text-main">{lead.score || 0}%</span>
            </div>
            <ScoreBar score={lead.score || 0} />
          </div>
        </div>

        {/* Qualification Grid */}
        <section className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted px-1">Qualificação</h4>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3 bg-bg-base/20 space-y-1">
              <span className="text-[10px] uppercase tracking-tighter text-text-muted">Intenção de Compra</span>
              <div className="flex items-center gap-2">
                <Badge variant={lead.intencao_compra === 'alta' ? 'success' : 'muted'}>
                  {lead.intencao_compra || 'N/A'}
                </Badge>
              </div>
            </Card>
            <Card className="p-3 bg-bg-base/20 space-y-1">
              <span className="text-[10px] uppercase tracking-tighter text-text-muted">Urgência</span>
              <div className="text-sm font-semibold capitalize">{lead.urgencia?.replace('_', ' ') || 'N/A'}</div>
            </Card>
            <Card className="p-3 bg-bg-base/20 col-span-2 space-y-1">
              <span className="text-[10px] uppercase tracking-tighter text-text-muted">Produto de Interesse</span>
              <div className="text-sm font-semibold text-primary">{lead.produto_interesse || 'Não informado'}</div>
            </Card>
            <Card className="p-3 bg-bg-base/20 space-y-1">
              <span className="text-[10px] uppercase tracking-tighter text-text-muted">Origem</span>
              <Badge variant="muted" className="text-[10px]">{lead.origem || 'Direto'}</Badge>
            </Card>
            <Card className="p-3 bg-bg-base/20 space-y-1">
              <span className="text-[10px] uppercase tracking-tighter text-text-muted">Cidade</span>
              <div className="text-sm font-semibold flex items-center gap-1">
                <MapPin size={12} className="text-text-muted" />
                {lead.cidade || 'N/A'}
              </div>
            </Card>
          </div>
        </section>

        {/* IA Summary */}
        <section className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted px-1 flex items-center gap-2">
            <Bot size={16} className="text-primary" />
            Resumo da Conversa (IA)
          </h4>
          <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <p className="text-sm text-text-main leading-relaxed italic">
              {lead.resumo_conversa ? `"${lead.resumo_conversa}"` : 'O resumo ainda não foi gerado pela Inteligência Artificial.'}
            </p>
          </div>
          {lead.observacoes_agente && (
            <div className="p-4 bg-bg-base/40 rounded-xl border border-border-card space-y-2">
              <span className="text-[10px] font-bold uppercase text-text-muted">Observações do Agente</span>
              <p className="text-xs text-text-muted leading-relaxed">
                {lead.observacoes_agente}
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted px-1 flex items-center gap-2">
            <Bot size={16} className="text-primary" />
            Controle do Agente IA
          </h4>
          <div className={`p-5 rounded-xl border flex flex-col gap-4 ${
            botAtivo
              ? 'border-primary/30 bg-primary/5'
              : 'border-error/30 bg-error/5'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${botAtivo ? 'bg-primary/20 text-primary' : 'bg-error/20 text-error'}`}>
                {botAtivo ? <BotMessageSquare size={22} /> : <BotOff size={22} />}
              </div>
              <div>
                <p className="text-base font-bold text-text-main">
                  {botAtivo ? 'Agente IA respondendo este lead' : 'Atendimento humano assumido'}
                </p>
                <p className="text-sm text-text-muted">
                  {botAtivo ? 'Clique para assumir a conversa' : 'Clique para devolver à IA'}
                </p>
              </div>
            </div>
            <div className="flex gap-2 sm:justify-end">
              {botAtivo ? (
                <Button
                  variant="danger"
                  size="md"
                  className="shrink-0 gap-2"
                  onClick={() => toggleBot(false)}
                  disabled={botLoading}
                >
                  <BotOff size={16} />
                  {botLoading ? 'Aguarde...' : 'Pausar IA'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="shrink-0 gap-2"
                  onClick={() => toggleBot(true)}
                  disabled={botLoading}
                >
                  <BotMessageSquare size={16} />
                  {botLoading ? 'Aguarde...' : 'Retomar IA'}
                </Button>
              )}
            </div>
            </div>
            {botError && (
              <p className="text-xs font-medium text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                {botError}
              </p>
            )}
          </div>
        </section>

        {/* Encaminhamento */}
        <section className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted px-1">Encaminhamento e Vendas</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-bg-base/20 rounded-xl border border-border-card">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${lead.encaminhado_vendedor ? 'bg-success/20 text-success' : 'bg-text-muted/10 text-text-muted'}`}>
                  <CheckCircle size={20} />
                </div>
                <div>
                  <p className={`text-sm font-bold ${lead.encaminhado_vendedor ? 'text-success' : 'text-text-main'}`}>
                    {lead.encaminhado_vendedor ? 'Encaminhado ao Vendedor' : 'Ainda não encaminhado'}
                  </p>
                  <p className="text-xs text-text-muted">
                    {lead.encaminhado_vendedor && lead.data_encaminhamento
                      ? format(new Date(lead.data_encaminhamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                      : lead.encaminhado_vendedor
                        ? 'Encaminhamento confirmado'
                        : 'Este lead continua no atendimento da IA'}
                  </p>
                </div>
              </div>
            </div>

            {lead.convertido && (
              <div className="flex items-center justify-between p-4 bg-success/10 rounded-xl border border-success/30">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success text-white">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-success">Lead Convertido</p>
                    <p className="text-xs text-success/80">
                      {lead.data_conversao 
                        ? format(new Date(lead.data_conversao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                        : '-'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Follow-up Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted">Agendamentos e Follow-ups</h4>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setIsScheduleOpen((open) => !open)}>
              <Plus size={14} /> Agendar
            </Button>
          </div>
          {isScheduleOpen && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
                <input
                  type="datetime-local"
                  className="rounded-lg border border-border-card bg-bg-card px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                />
                <input
                  className="rounded-lg border border-border-card bg-bg-card px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
                  value={scheduleReason}
                  onChange={(event) => setScheduleReason(event.target.value)}
                  placeholder="Motivo do follow-up"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsScheduleOpen(false)}>Cancelar</Button>
                <Button variant="primary" size="sm" onClick={handleCreateFollowUp} disabled={actionLoading}>
                  {actionLoading ? 'Salvando...' : 'Salvar follow-up'}
                </Button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {followUps.length > 0 ? (
              followUps.map((fu) => (
                <div key={fu.id} className={`p-3 rounded-lg border flex items-start gap-3 ${fu.realizado ? 'bg-bg-base/10 opacity-60 border-border-card' : 'bg-bg-card border-primary/20 shadow-sm'}`}>
                  <div className={`mt-1 p-1.5 rounded-full ${fu.realizado ? 'bg-text-muted/20 text-text-muted' : 'bg-primary/20 text-primary animate-pulse'}`}>
                    <Calendar size={12} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold ${fu.realizado ? 'text-text-muted line-through' : 'text-text-main'}`}>
                        {format(new Date(fu.agendado_para), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {fu.realizado && <Badge variant="muted" className="text-[8px]">Realizado</Badge>}
                    </div>
                    <p className={`text-xs mt-0.5 ${fu.realizado ? 'text-text-muted line-through' : 'text-text-muted'}`}>{fu.motivo}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 border-2 border-dashed border-border-card rounded-xl text-text-muted">
                <Clock size={24} className="mx-auto mb-2 opacity-20" />
                <p className="text-xs">Nenhum follow-up agendado.</p>
              </div>
            )}
          </div>
        </section>

        {/* Interaction History */}
        <section className="space-y-4">
          <h4 className="text-sm font-bold uppercase tracking-widest text-text-muted px-1 flex items-center gap-2">
            <MessageSquare size={16} />
            Histórico de Mensagens
          </h4>
          <div className="space-y-4 bg-bg-base/30 p-4 rounded-2xl border border-border-card max-h-[400px] overflow-y-auto">
            {interactions.length > 0 ? (
              interactions.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex flex-col ${
                    msg.tipo === 'mensagem_lead' ? 'items-end' : 
                    msg.tipo === 'nota_vendedor' ? 'items-center' : 'items-start'
                  }`}
                >
                  <div className={`
                    max-w-[85%] px-4 py-2.5 rounded-2xl text-sm
                    ${msg.tipo === 'mensagem_lead' ? 'bg-primary text-white rounded-tr-none' : 
                      msg.tipo === 'nota_vendedor' ? 'bg-warning/10 border border-warning/20 text-warning text-center italic rounded-lg w-full' :
                      'bg-bg-card text-text-main border border-border-card rounded-tl-none'}
                  `}>
                    {msg.tipo === 'nota_vendedor' && <FileText size={12} className="inline mr-1 -mt-1" />}
                    {msg.conteudo}
                  </div>
                  <span className="text-[10px] text-text-muted mt-1 px-1">
                    {formatDistanceToNow(new Date(msg.criado_em), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-10 opacity-30">
                <MessageSquare size={32} className="mx-auto mb-2" />
                <p className="text-xs">Nenhuma mensagem registrada.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-4">
        <Button 
          variant="ghost" 
          className="gap-2"
          onClick={() => { if (lead && onEdit) onEdit(lead) }}
        >
          <Edit3 size={16} /> Editar Lead
        </Button>
        <Button 
          variant="primary" 
          className="gap-2" 
          disabled={lead.convertido}
          onClick={handleConversion}
        >
          <Trophy size={16} /> {lead.convertido ? 'Lead Convertido' : 'Marcar Conversão'}
        </Button>
        <Button variant="ghost" className="col-span-2 mt-1 gap-2 border-dashed border-border-card border" onClick={() => setIsNoteOpen((open) => !open)}>
          <FileText size={16} /> Adicionar Nota do Vendedor
        </Button>
        {isNoteOpen && (
          <div className="col-span-2 space-y-3 rounded-xl border border-border-card bg-bg-base/30 p-4">
            <textarea
              className="min-h-24 w-full rounded-lg border border-border-card bg-bg-card px-3 py-2 text-sm text-text-main outline-none focus:border-primary"
              value={noteText}
              onChange={(event) => setNoteText(event.target.value)}
              placeholder="Digite uma nota interna sobre este lead..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setIsNoteOpen(false)}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handleAddNote} disabled={actionLoading || !noteText.trim()}>
                {actionLoading ? 'Salvando...' : 'Salvar nota'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
