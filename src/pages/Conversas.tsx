import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search,
  MessageSquare,
  Bot,
  User,
  Info,
  Check,
  Flame,
  Clock,
  Phone,
  MapPin,
  ChevronRight,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  AlertCircle,
  Zap,
  FileText
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { ScoreBar } from '../components/ui/ScoreBar'
import { LeadTemperature } from '../components/ui/LeadTemperature'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'
import type { Lead, Interacao } from '../types'

// ── Status visual mapping ──
const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  novo_contato:    { label: 'Novo',           color: 'bg-blue-500',   icon: <Zap size={10} /> },
  em_qualificacao: { label: 'Qualificando',   color: 'bg-yellow-500', icon: <AlertCircle size={10} /> },
  follow_up:       { label: 'Follow-up',      color: 'bg-purple-500', icon: <Clock size={10} /> },
  encaminhado:     { label: 'Encaminhado',     color: 'bg-orange-500', icon: <ArrowUpRight size={10} /> },
  convertido:      { label: 'Convertido',      color: 'bg-emerald-500',icon: <CheckCircle2 size={10} /> },
}

const getStatusInfo = (lead: Lead) => {
  if (lead.convertido)           return STATUS_MAP['convertido']
  if (lead.encaminhado_vendedor) return STATUS_MAP['encaminhado']
  return STATUS_MAP[lead.status] || STATUS_MAP['novo_contato']
}

export const Conversas: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [interactions, setInteractions] = useState<Interacao[]>([])
  const [loading, setLoading] = useState(true)
  const [chatLoading, setChatLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('todos')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchLeads()
  }, [])

  useEffect(() => {
    if (selectedLead) {
      fetchInteractions(selectedLead.id)

      // Real-time subscription for messages
      const channel = supabaseAdmin.channel(`lead_messages_${selectedLead.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'interacoes',
          filter: `lead_id=eq.${selectedLead.id}`
        }, (payload) => {
          setInteractions(prev => [...prev, payload.new as Interacao])
        })
        .subscribe()

      return () => {
        supabaseAdmin.removeChannel(channel)
      }
    }
  }, [selectedLead])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [interactions])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .order('horario_contato', { ascending: false })

      if (error) throw error
      if (data) {
        setLeads(data as Lead[])
        if (data.length > 0 && !selectedLead) {
          setSelectedLead(data[0] as Lead)
        }
      }
    } catch (err) {
      console.error('Erro ao buscar leads:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchInteractions = async (leadId: string) => {
    setChatLoading(true)
    try {
      const { data, error } = await supabaseAdmin
        .from('interacoes')
        .select('*')
        .eq('lead_id', leadId)
        .order('criado_em', { ascending: true })

      if (error) throw error
      if (data) setInteractions(data as Interacao[])
    } catch (err) {
      console.error('Erro ao buscar interações:', err)
    } finally {
      setChatLoading(false)
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch =
        (l.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (l.whatsapp || '').includes(searchTerm)

      if (statusFilter === 'todos') return matchSearch

      const info = getStatusInfo(l)
      const statusLabel = info.label.toLowerCase()
      return matchSearch && statusLabel.includes(statusFilter.toLowerCase())
    })
  }, [leads, searchTerm, statusFilter])

  const formatWhatsApp = (num: string) => {
    const cleaned = num.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`
    }
    if (cleaned.length === 13) {
      return `+${cleaned.substring(0, 2)} (${cleaned.substring(2, 4)}) ${cleaned.substring(4, 9)}-${cleaned.substring(9)}`
    }
    return num
  }

  // ── Counters ──
  const counts = useMemo(() => {
    const c = { total: leads.length, novo: 0, qualificando: 0, followup: 0, encaminhado: 0, convertido: 0 }
    leads.forEach(l => {
      const info = getStatusInfo(l)
      if (info.label === 'Novo') c.novo++
      else if (info.label === 'Qualificando') c.qualificando++
      else if (info.label === 'Follow-up') c.followup++
      else if (info.label === 'Encaminhado') c.encaminhado++
      else if (info.label === 'Convertido') c.convertido++
    })
    return c
  }, [leads])

  return (
    <Layout title="Conversas">
      <div className="flex h-[calc(100vh-120px)] overflow-hidden gap-0">

        {/* ═══════════════════════════════════════════════════════ */}
        {/* LEFT PANEL: Contact List                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="w-[380px] flex flex-col bg-bg-card border-r border-border-card shrink-0">

          {/* Search & Filter Header */}
          <div className="p-4 space-y-3 border-b border-border-card">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main tracking-wide">Conversas</h3>
              <span className="text-[10px] font-bold text-text-muted bg-bg-base px-2 py-1 rounded-md">
                {filteredLeads.length} contatos
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={14} />
              <Input
                className="pl-9 h-9 text-xs bg-bg-base border-border-card"
                placeholder="Buscar por nome ou WhatsApp..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Quick status filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'todos', label: 'Todos', count: counts.total },
                { key: 'novo', label: 'Novos', count: counts.novo },
                { key: 'qualificando', label: 'Qualificando', count: counts.qualificando },
                { key: 'encaminhado', label: 'Encaminhados', count: counts.encaminhado },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-all ${
                    statusFilter === f.key
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-bg-base text-text-muted hover:text-text-main hover:bg-bg-base/80'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </div>

          {/* Leads List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex gap-3 p-3 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-bg-base/60" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-bg-base/60 rounded" />
                      <div className="h-2 w-32 bg-bg-base/40 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => {
                const statusInfo = getStatusInfo(lead)
                const isActive = selectedLead?.id === lead.id

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`
                      flex gap-3 px-4 py-3.5 cursor-pointer transition-all border-b border-border-card/50
                      ${isActive
                        ? 'bg-primary/8 border-l-[3px] border-l-primary'
                        : 'border-l-[3px] border-l-transparent hover:bg-bg-base/30'
                      }
                    `}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      <div className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                        ${isActive ? 'bg-primary/20 text-primary' : 'bg-bg-base border border-border-card text-text-muted'}
                      `}>
                        {lead.nome?.[0]?.toUpperCase() || <User size={16} />}
                      </div>
                      {(lead.score || 0) >= 80 && (
                        <div className="absolute -top-0.5 -right-0.5 bg-hot text-white p-0.5 rounded-full">
                          <Flame size={8} />
                        </div>
                      )}
                    </div>

                    {/* Lead Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-text-main'}`}>
                          {lead.nome || formatWhatsApp(lead.whatsapp)}
                        </p>
                        <span className="text-[9px] text-text-muted whitespace-nowrap ml-2">
                          {formatDistanceToNow(new Date(lead.horario_contato), { addSuffix: false, locale: ptBR })}
                        </span>
                      </div>

                      <p className="text-[11px] text-text-muted truncate mb-1.5">
                        {lead.resumo_conversa || 'Aguardando qualificação...'}
                      </p>

                      <div className="flex items-center gap-1.5">
                        {/* Status pill */}
                        <span className={`
                          inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white
                          ${statusInfo.color}
                        `}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>

                        <LeadTemperature temperature={lead.temperatura} className="text-[8px] py-0 px-1" />

                        <span className="text-[9px] font-bold text-text-muted ml-auto tabular-nums">
                          {lead.score || 0}pts
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-base flex items-center justify-center mb-4">
                  <MessageSquare size={28} className="text-text-muted/30" />
                </div>
                <p className="text-sm font-semibold text-text-main mb-1">Nenhuma conversa</p>
                <p className="text-xs text-text-muted">
                  {searchTerm ? 'Nenhum resultado para a busca.' : 'Os leads aparecerão aqui quando forem captados.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* CENTER PANEL: Chat / Messages                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        {selectedLead ? (
          <div className="flex-1 flex flex-col bg-bg-base overflow-hidden">

            {/* Chat Header */}
            <div className="px-5 py-3 bg-bg-card border-b border-border-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => setIsDrawerOpen(true)}>
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
                  {selectedLead.nome?.[0]?.toUpperCase() || <User size={16} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-text-main">
                      {selectedLead.nome || formatWhatsApp(selectedLead.whatsapp)}
                    </h4>
                    {(() => {
                      const si = getStatusInfo(selectedLead)
                      return (
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white ${si.color}`}>
                          {si.icon} {si.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {selectedLead.whatsapp && (
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Phone size={9} /> {formatWhatsApp(selectedLead.whatsapp)}
                      </span>
                    )}
                    {selectedLead.cidade && (
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <MapPin size={9} /> {selectedLead.cidade}
                      </span>
                    )}
                    {selectedLead.origem && (
                      <span className="text-[10px] text-text-muted">
                        via {selectedLead.origem.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 mr-2">
                  <ScoreBar score={selectedLead.score || 0} className="w-14 h-1.5" />
                  <span className="text-[10px] font-bold text-text-muted tabular-nums">{selectedLead.score || 0}%</span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="p-2 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-all"
                  title="Ver detalhes do lead"
                >
                  <Info size={18} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* AI Summary Card */}
              {selectedLead.resumo_conversa && (
                <div className="mx-auto max-w-lg w-full bg-primary/5 border border-primary/15 rounded-xl p-3.5 flex gap-3 items-start">
                  <div className="p-1.5 bg-primary rounded-lg text-white shrink-0">
                    <Bot size={14} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Resumo da IA</p>
                    <p className="text-xs text-text-main leading-relaxed">
                      {selectedLead.resumo_conversa}
                    </p>
                  </div>
                </div>
              )}

              {/* Date Divider */}
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-border-card/50" />
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide bg-bg-base px-3 py-1 rounded-full border border-border-card/50">
                  {format(new Date(selectedLead.horario_contato), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
                <div className="flex-1 h-px bg-border-card/50" />
              </div>

              {chatLoading ? (
                <div className="space-y-4 py-6">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className={`h-10 rounded-2xl animate-pulse bg-bg-card ${i % 2 === 0 ? 'w-40' : 'w-52'}`} />
                    </div>
                  ))}
                </div>
              ) : interactions.length > 0 ? (
                interactions.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.tipo === 'mensagem_lead' ? 'justify-end' :
                      msg.tipo === 'nota_vendedor' ? 'justify-center' : 'justify-start'
                    }`}
                  >
                    {/* Agent avatar */}
                    {msg.tipo === 'resposta_agente' && (
                      <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0 mr-2 mt-1">
                        <Bot size={12} />
                      </div>
                    )}

                    <div className="max-w-[70%]">
                      {/* Sender label */}
                      {msg.tipo === 'resposta_agente' && (
                        <span className="text-[9px] font-bold text-primary mb-0.5 block ml-1">Agente IA</span>
                      )}
                      {msg.tipo === 'mensagem_lead' && (
                        <span className="text-[9px] font-bold text-text-muted mb-0.5 block text-right mr-1">
                          {selectedLead.nome || 'Lead'}
                        </span>
                      )}

                      <div className={`
                        px-4 py-2.5 text-sm leading-relaxed
                        ${msg.tipo === 'mensagem_lead'
                          ? 'bg-primary text-white rounded-2xl rounded-br-md'
                          : msg.tipo === 'nota_vendedor'
                          ? 'bg-warning/8 border border-warning/20 text-warning text-center italic rounded-lg flex items-center gap-2 text-xs'
                          : 'bg-bg-card text-text-main border border-border-card rounded-2xl rounded-bl-md'
                        }
                      `}>
                        {msg.tipo === 'nota_vendedor' && <FileText size={12} className="shrink-0" />}
                        {msg.conteudo}
                      </div>

                      <div className={`
                        flex items-center gap-1 mt-1 px-1
                        ${msg.tipo === 'mensagem_lead' ? 'justify-end' : 'justify-start'}
                      `}>
                        <span className="text-[9px] text-text-muted/60">
                          {format(new Date(msg.criado_em), 'HH:mm')}
                        </span>
                        {msg.tipo === 'resposta_agente' && (
                          <Check size={10} className="text-primary/60" />
                        )}
                      </div>
                    </div>

                    {/* Lead avatar */}
                    {msg.tipo === 'mensagem_lead' && (
                      <div className="w-7 h-7 rounded-full bg-bg-card border border-border-card flex items-center justify-center text-text-muted shrink-0 ml-2 mt-5">
                        <User size={12} />
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-bg-card border border-border-card flex items-center justify-center mb-5">
                    <MessageSquare size={32} className="text-text-muted/20" />
                  </div>
                  <p className="text-base font-bold text-text-main mb-1">Sem mensagens</p>
                  <p className="text-xs text-text-muted max-w-[280px]">
                    Nenhuma interação registrada para este lead. Quando houver troca de mensagens, elas aparecerão aqui.
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Bar */}
            <div className="px-5 py-3 bg-bg-card border-t border-border-card flex items-center gap-3 shrink-0">
              <div className="flex-1 flex items-center gap-2 bg-bg-base rounded-lg px-4 py-2.5 border border-border-card">
                <Bot size={14} className="text-primary shrink-0" />
                <span className="text-xs text-text-muted">
                  A IA está monitorando esta conversa em tempo real.
                </span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="px-4 py-2.5 bg-primary/10 text-primary rounded-lg text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-1.5"
              >
                <Info size={14} />
                Detalhes
              </button>
            </div>
          </div>
        ) : (
          /* ─── Empty state ─── */
          <div className="flex-1 flex flex-col items-center justify-center bg-bg-base">
            <div className="text-center space-y-5">
              <div className="w-24 h-24 bg-bg-card rounded-3xl flex items-center justify-center mx-auto border border-border-card shadow-inner">
                <MessageSquare size={40} className="text-text-muted/20" />
              </div>
              <div className="space-y-2">
                <h4 className="text-xl font-bold text-text-main">Monitoramento de Conversas</h4>
                <p className="text-sm text-text-muted max-w-sm">
                  Selecione um lead na lista ao lado para visualizar o histórico de mensagens e monitorar o atendimento da IA em tempo real.
                </p>
              </div>
              <div className="flex items-center justify-center gap-6 text-text-muted/40">
                <div className="flex flex-col items-center gap-2">
                  <Bot size={20} />
                  <span className="text-[10px] font-semibold">Atendimento IA</span>
                </div>
                <ChevronRight size={16} />
                <div className="flex flex-col items-center gap-2">
                  <User size={20} />
                  <span className="text-[10px] font-semibold">Qualificação</span>
                </div>
                <ChevronRight size={16} />
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 size={20} />
                  <span className="text-[10px] font-semibold">Conversão</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <DrawerLead
        lead={selectedLead}
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onUpdate={fetchLeads}
        onEdit={(lead) => {
          setLeadToEdit(lead)
          setIsModalOpen(true)
          setIsDrawerOpen(false)
        }}
      />

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchLeads}
        lead={leadToEdit}
      />
    </Layout>
  )
}
