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
  FileText,
  MessageCircle
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Input } from '../components/ui/Input'
import { ScoreBar } from '../components/ui/ScoreBar'
import { LeadTemperature } from '../components/ui/LeadTemperature'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'
import type { Lead, Interacao } from '../types'

// ── Status visual mapping ──
const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  novo_contato:    { label: 'Novo',           color: 'text-blue-500',   bg: 'bg-blue-500/10',    icon: <Zap size={10} /> },
  em_qualificacao: { label: 'Qualificando',   color: 'text-yellow-500', bg: 'bg-yellow-500/10',  icon: <AlertCircle size={10} /> },
  follow_up:       { label: 'Follow-up',      color: 'text-purple-500', bg: 'bg-purple-500/10',  icon: <Clock size={10} /> },
  encaminhado:     { label: 'Encaminhado',    color: 'text-orange-500', bg: 'bg-orange-500/10',  icon: <ArrowUpRight size={10} /> },
  convertido:      { label: 'Convertido',     color: 'text-emerald-500',bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={10} /> },
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
          fetchLeads() // Fetch leads again to update order and last message snippet if needed
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
        // Auto-select first lead if none selected and not searching
        if (data.length > 0 && !selectedLead && !searchTerm && statusFilter === 'todos') {
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
      <div className="flex h-[calc(100vh-110px)] overflow-hidden rounded-2xl border border-border-card bg-bg-base shadow-2xl">
        {/* ═══════════════════════════════════════════════════════ */}
        {/* LEFT PANEL: Contact List                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        <div className="w-[400px] flex flex-col bg-bg-sidebar border-r border-border-card shrink-0 z-10 shadow-[4px_0_24px_-12px_rgba(0,0,0,0.5)]">
          {/* Search & Filter Header */}
          <div className="p-5 pb-4 space-y-4 border-b border-border-card/50 bg-bg-sidebar sticky top-0 z-20">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-text-main flex items-center gap-2">
                <MessageCircle size={18} className="text-primary" />
                Interações Recentes
              </h3>
              <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
                {filteredLeads.length} de {counts.total}
              </span>
            </div>
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={16} />
              <Input
                className="pl-10 h-10 text-sm bg-bg-base border-border-card/60 focus:border-primary/50 transition-all rounded-xl shadow-inner"
                placeholder="Buscar conversa..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Quick status filter pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              {[
                { key: 'todos', label: 'Todos', count: counts.total },
                { key: 'novo', label: 'Novos', count: counts.novo },
                { key: 'qualificando', label: 'Qualific.', count: counts.qualificando },
                { key: 'encaminhado', label: 'Encam.', count: counts.encaminhado },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                    statusFilter === f.key
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'bg-bg-base text-text-muted border border-border-card hover:border-text-muted/30 hover:text-text-main'
                  }`}
                >
                  {f.label}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${statusFilter === f.key ? 'bg-black/20' : 'bg-border-card'}`}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Leads List */}
          <div className="flex-1 overflow-y-auto bg-bg-sidebar custom-scrollbar p-2 space-y-1">
            {loading ? (
              <div className="p-3 space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex gap-4 p-4 bg-bg-card/40 rounded-xl animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-border-card/50" />
                    <div className="flex-1 space-y-3 py-1">
                      <div className="flex justify-between">
                        <div className="h-3.5 w-28 bg-border-card/50 rounded-full" />
                        <div className="h-2 w-10 bg-border-card/30 rounded-full" />
                      </div>
                      <div className="h-2.5 w-full max-w-[180px] bg-border-card/40 rounded-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredLeads.length > 0 ? (
              filteredLeads.map((lead) => {
                const statusInfo = getStatusInfo(lead)
                const isActive = selectedLead?.id === lead.id
                const leadInitial = lead.nome ? lead.nome[0].toUpperCase() : <User size={16} />

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`
                      relative flex gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all duration-300 group
                      ${isActive
                        ? 'bg-primary/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] border-transparent'
                        : 'bg-transparent hover:bg-bg-card border border-transparent hover:border-border-card/50'
                      }
                    `}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_8px_rgba(0,200,150,0.6)]" />
                    )}

                    {/* Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className={`
                        w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                        ${isActive 
                          ? 'bg-primary text-white shadow-lg shadow-primary/30' 
                          : 'bg-bg-base border border-border-card text-text-muted group-hover:border-primary/30 group-hover:text-primary'
                        }
                      `}>
                        {leadInitial}
                      </div>
                      {(lead.score || 0) >= 80 && (
                        <div className="absolute -bottom-1 -right-1 bg-hot text-white p-1 rounded-full shadow-lg border-2 border-bg-sidebar">
                          <Flame size={10} />
                        </div>
                      )}
                    </div>

                    {/* Lead Info */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className="flex justify-between items-center mb-1">
                        <p className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-text-main' : 'text-text-main/90 group-hover:text-text-main'}`}>
                          {lead.nome || formatWhatsApp(lead.whatsapp)}
                        </p>
                        <span className={`text-[10px] font-medium whitespace-nowrap ml-2 ${isActive ? 'text-primary' : 'text-text-muted/60'}`}>
                          {formatDistanceToNow(new Date(lead.horario_contato), { addSuffix: false, locale: ptBR })}
                        </span>
                      </div>

                      <p className={`text-xs truncate mb-2 leading-relaxed ${isActive ? 'text-text-main/80 font-medium' : 'text-text-muted/80'}`}>
                        {lead.resumo_conversa || lead.motivo_contato || 'Aguardando interação...'}
                      </p>

                      <div className="flex items-center gap-2">
                        {/* Status pill */}
                        <span className={`
                          inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider
                          ${statusInfo.bg} ${statusInfo.color}
                        `}>
                          {statusInfo.icon}
                          {statusInfo.label}
                        </span>

                        <div className="w-1 h-1 rounded-full bg-border-card" />
                        
                        <div className="flex items-center gap-1">
                           <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider tabular-nums">
                            {lead.score || 0} pts
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-6 text-center h-full">
                <div className="w-20 h-20 rounded-3xl bg-bg-card/50 border border-border-card/50 flex items-center justify-center mb-5 shadow-inner">
                  <MessageSquare size={32} className="text-text-muted/40" />
                </div>
                <p className="text-base font-bold text-text-main mb-2">Nenhuma conversa encontrada</p>
                <p className="text-xs text-text-muted leading-relaxed max-w-[240px]">
                  {searchTerm 
                    ? 'Tente limpar os filtros ou usar outros termos na busca.' 
                    : 'Os leads aparecerão aqui assim que ocorrer a primeira interação.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* CENTER PANEL: Chat / Messages                          */}
        {/* ═══════════════════════════════════════════════════════ */}
        {selectedLead ? (
          <div className="flex-1 flex flex-col bg-bg-base/50 relative">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Chat Header Premium */}
            <div className="px-6 py-4 bg-bg-card/90 backdrop-blur-md border-b border-border-card flex items-center justify-between shrink-0 z-10 shadow-sm">
              <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setIsDrawerOpen(true)}>
                <div className="relative">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-primary-hover flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                    {selectedLead.nome?.[0]?.toUpperCase() || <User size={20} />}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-success border-2 border-bg-card rounded-full" />
                </div>
                
                <div>
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-base font-bold text-text-main group-hover:text-primary transition-colors">
                      {selectedLead.nome || formatWhatsApp(selectedLead.whatsapp)}
                    </h4>
                    {(() => {
                      const si = getStatusInfo(selectedLead)
                      return (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${si.bg} ${si.color} border border-current/10`}>
                          {si.icon} {si.label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    {selectedLead.whatsapp && (
                      <span className="text-[11px] text-text-muted/80 flex items-center gap-1 font-medium">
                        <Phone size={10} className="text-text-muted/60" /> {formatWhatsApp(selectedLead.whatsapp)}
                      </span>
                    )}
                    {selectedLead.cidade && (
                      <span className="text-[11px] text-text-muted/80 flex items-center gap-1 font-medium">
                        <MapPin size={10} className="text-text-muted/60" /> {selectedLead.cidade}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end mr-2">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Score</span>
                    <span className="text-xs font-black text-text-main tabular-nums">{selectedLead.score || 0}%</span>
                  </div>
                  <ScoreBar score={selectedLead.score || 0} className="w-24 h-1.5 rounded-full" />
                </div>
                <div className="w-px h-8 bg-border-card mx-1" />
                <button
                  onClick={() => setIsDrawerOpen(true)}
                  className="p-2.5 rounded-xl text-text-muted hover:text-white hover:bg-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
                  title="Ver detalhes completos do lead"
                >
                  <Info size={20} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 z-10 custom-scrollbar">

              {/* AI Summary Card Premium */}
              {selectedLead.resumo_conversa && (
                <div className="mx-auto max-w-2xl w-full bg-primary/5 border border-primary/20 rounded-2xl p-5 flex gap-4 items-start shadow-lg shadow-primary/5 backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Bot size={80} />
                  </div>
                  <div className="p-2.5 bg-gradient-to-br from-primary to-primary-hover rounded-xl text-white shrink-0 shadow-lg shadow-primary/30 relative z-10">
                    <Bot size={20} />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-1.5">
                      <p className="text-[11px] font-black text-primary uppercase tracking-widest">Resumo da IA</p>
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    </div>
                    <p className="text-sm text-text-main/90 leading-relaxed font-medium">
                      {selectedLead.resumo_conversa}
                    </p>
                  </div>
                </div>
              )}

              {/* Date Divider */}
              <div className="flex items-center gap-4 py-4 max-w-3xl mx-auto">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-border-card to-transparent opacity-50" />
                <span className="text-[10px] font-bold text-text-muted/60 uppercase tracking-[0.2em] bg-bg-base/50 px-4 py-1.5 rounded-full border border-border-card/30 backdrop-blur-sm">
                  {format(new Date(selectedLead.horario_contato), "dd 'de' MMMM, yyyy", { locale: ptBR })}
                </span>
                <div className="flex-1 h-px bg-gradient-to-l from-transparent via-border-card to-transparent opacity-50" />
              </div>

              {chatLoading ? (
                <div className="space-y-6 py-4 max-w-3xl mx-auto w-full">
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                      <div className={`h-12 rounded-2xl rounded-${i % 2 === 0 ? 'br' : 'bl'}-sm animate-pulse bg-bg-card/60 ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
                    </div>
                  ))}
                </div>
              ) : interactions.length > 0 ? (
                <div className="max-w-3xl mx-auto w-full space-y-6">
                  {interactions.map((msg, index) => {
                    const isLead = msg.tipo === 'mensagem_lead'
                    const isSystem = msg.tipo === 'nota_vendedor' || msg.tipo === 'sistema'
                    const showAvatar = index === 0 || interactions[index - 1].tipo !== msg.tipo

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 group ${
                          isLead ? 'justify-end' : isSystem ? 'justify-center' : 'justify-start'
                        }`}
                      >
                        {/* Agent Avatar */}
                        {!isLead && !isSystem && (
                          <div className={`w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary shrink-0 mt-auto border border-primary/20 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                            <Bot size={14} />
                          </div>
                        )}

                        <div className={`max-w-[75%] flex flex-col ${isLead ? 'items-end' : isSystem ? 'items-center' : 'items-start'}`}>
                          
                          {/* Sender Label */}
                          {showAvatar && !isSystem && (
                            <span className="text-[10px] font-bold text-text-muted/60 mb-1.5 uppercase tracking-wider px-1">
                              {isLead ? (selectedLead.nome || 'Lead') : 'Agente IA'}
                            </span>
                          )}

                          <div className={`
                            relative px-4 py-3 text-[15px] leading-relaxed shadow-sm transition-all hover:shadow-md
                            ${isLead
                              ? 'bg-primary text-white rounded-2xl rounded-br-sm shadow-primary/20 hover:shadow-primary/30'
                              : isSystem
                              ? 'bg-warning/10 border border-warning/20 text-warning text-center rounded-xl flex items-center gap-2 text-xs font-medium px-5'
                              : 'bg-bg-card text-text-main border border-border-card rounded-2xl rounded-bl-sm shadow-black/10'
                            }
                          `}>
                            {isSystem && <FileText size={14} className="shrink-0 opacity-70" />}
                            {msg.conteudo}
                          </div>

                          {/* Timestamp & Status */}
                          <div className={`
                            flex items-center gap-1.5 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity
                            ${isLead ? 'flex-row-reverse' : 'flex-row'}
                          `}>
                            <span className="text-[10px] font-medium text-text-muted/50">
                              {format(new Date(msg.criado_em), 'HH:mm')}
                            </span>
                            {!isSystem && (
                              <Check size={12} className={isLead ? 'text-primary/60' : 'text-text-muted/40'} />
                            )}
                          </div>
                        </div>

                        {/* Lead Avatar */}
                        {isLead && (
                          <div className={`w-8 h-8 rounded-full bg-bg-card border border-border-card flex items-center justify-center text-text-muted shrink-0 mt-auto ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                            {selectedLead.nome?.[0]?.toUpperCase() || <User size={14} />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center py-24 text-center h-full">
                  <div className="w-24 h-24 rounded-full bg-bg-card/40 border border-border-card flex items-center justify-center mb-6 shadow-xl relative">
                    <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-20" />
                    <MessageSquare size={36} className="text-text-muted/40" />
                  </div>
                  <p className="text-xl font-bold text-text-main mb-2 font-heading">Nenhuma mensagem registrada</p>
                  <p className="text-sm text-text-muted max-w-[320px] leading-relaxed">
                    Aguardando a primeira interação deste lead. A IA irá registrar tudo automaticamente aqui.
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} className="h-4" />
            </div>

            {/* Bottom Bar Premium */}
            <div className="px-6 py-4 bg-bg-card/90 backdrop-blur-md border-t border-border-card flex items-center gap-4 shrink-0 z-10 shadow-[0_-4px_24px_-12px_rgba(0,0,0,0.5)]">
              <div className="flex-1 flex items-center gap-3 bg-bg-base/80 rounded-xl px-5 py-3.5 border border-border-card/50 shadow-inner">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </div>
                <span className="text-[13px] font-medium text-text-muted">
                  Agente de Inteligência Artificial monitorando e respondendo em tempo real...
                </span>
              </div>
              <button
                onClick={() => setIsDrawerOpen(true)}
                className="px-6 py-3.5 bg-primary/10 text-primary rounded-xl text-sm font-bold hover:bg-primary hover:text-white transition-all duration-300 flex items-center gap-2 shadow-sm"
              >
                <Info size={16} />
                Ficha Completa
              </button>
            </div>
          </div>
        ) : (
          /* ─── Premium Empty State ─── */
          <div className="flex-1 flex flex-col items-center justify-center bg-bg-base/30 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />

            <div className="text-center space-y-8 relative z-10 flex flex-col items-center">
              <div className="relative">
                <div className="w-32 h-32 bg-bg-card rounded-[2.5rem] flex items-center justify-center mx-auto border border-border-card/80 shadow-2xl rotate-3 transition-transform hover:rotate-6 duration-500">
                  <MessageSquare size={50} className="text-text-muted/30" />
                </div>
                {/* Floating badges */}
                <div className="absolute -top-4 -right-4 bg-primary text-white p-3 rounded-2xl shadow-lg shadow-primary/20 rotate-12 animate-pulse-hot">
                  <Bot size={24} />
                </div>
                <div className="absolute -bottom-4 -left-4 bg-bg-card border border-border-card text-text-muted p-2.5 rounded-2xl shadow-xl -rotate-12">
                  <Zap size={20} className="text-warning" />
                </div>
              </div>
              
              <div className="space-y-3 max-w-md">
                <h4 className="text-3xl font-black text-text-main font-heading tracking-tight">Monitoramento ao Vivo</h4>
                <p className="text-[15px] text-text-muted leading-relaxed font-medium">
                  Selecione uma conversa na lista lateral para visualizar o histórico detalhado, resumo gerado pela IA e acompanhamento em tempo real.
                </p>
              </div>

              <div className="flex items-center justify-center gap-6 bg-bg-card/40 backdrop-blur border border-border-card/50 px-8 py-5 rounded-2xl shadow-lg mt-4">
                <div className="flex flex-col items-center gap-2.5 group">
                  <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                    <Bot size={22} className="text-primary" />
                  </div>
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">IA Qualificando</span>
                </div>
                <div className="w-12 h-px bg-border-card" />
                <div className="flex flex-col items-center gap-2.5 group">
                  <div className="p-3 bg-warning/10 rounded-xl group-hover:bg-warning/20 transition-colors">
                    <Flame size={22} className="text-warning" />
                  </div>
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Aquecimento</span>
                </div>
                <div className="w-12 h-px bg-border-card" />
                <div className="flex flex-col items-center gap-2.5 group">
                  <div className="p-3 bg-success/10 rounded-xl group-hover:bg-success/20 transition-colors">
                    <CheckCircle2 size={22} className="text-success" />
                  </div>
                  <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Conversão</span>
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
