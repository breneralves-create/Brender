import React, { useState, useEffect } from 'react'
import { 
  DragDropContext, 
  Droppable, 
  Draggable
} from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { 
  Search,
  Flame,
  User,
  Tag,
  Sparkles,
  RotateCcw
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import type { Lead, LeadStatus } from '../types'
import { Input } from '../components/ui/Input'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'
import { LeadTemperature } from '../components/ui/LeadTemperature'

const COLUMNS: { id: LeadStatus; title: string, hexColor: string }[] = [
  { id: 'novo_contato', title: 'Novo Contato', hexColor: '#3b82f6' },
  { id: 'em_qualificacao', title: 'Em Qualificação', hexColor: '#06b6d4' },
  { id: 'follow_up', title: 'Follow Up', hexColor: '#f59e0b' },
  { id: 'encaminhado', title: 'Encaminhado', hexColor: '#8b5cf6' },
  { id: 'convertido', title: 'Convertido', hexColor: '#10b981' }
]

const isDueDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return false
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return false
  return date.getTime() <= Date.now()
}

const isFollowUpSent = (lead: Lead) => {
  return lead.followup_1enviado?.trim().toLowerCase() === 'feito'
}

export const Funil: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [dueFollowUpLeadIds, setDueFollowUpLeadIds] = useState<Set<string>>(new Set())
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null)

  useEffect(() => {
    fetchHotLeads()
    const refreshInterval = window.setInterval(fetchHotLeads, 60000)
    
    // Real-time subscription for leads
    const subscription = supabase
      .channel('leads-funil')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchHotLeads()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'follow_ups' }, () => {
        fetchHotLeads()
      })
      .subscribe()

    return () => {
      window.clearInterval(refreshInterval)
      subscription.unsubscribe()
    }
  }, [])

  const fetchHotLeads = async () => {
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500) // Traz os mais recentes para não pesar
      
      if (error) throw error
      if (data) setLeads(data as Lead[])

      const { data: followUps, error: followUpError } = await supabaseAdmin
        .from('follow_ups')
        .select('lead_id, agendado_para')
        .eq('realizado', false)
        .lte('agendado_para', new Date().toISOString())

      if (followUpError) throw followUpError
      setDueFollowUpLeadIds(new Set((followUps || []).map((followUp) => followUp.lead_id as string)))
    } catch (err) {
      console.error('Erro ao buscar leads:', err)
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStatus = destination.droppableId as LeadStatus
    
    // Optimistic Update
    const updatedLeads = [...leads]
    const leadIndex = updatedLeads.findIndex(l => l.id === draggableId)
    if (leadIndex !== -1) {
      const isConvertido = newStatus === 'convertido';
      const isEncaminhado = newStatus === 'encaminhado' ? true : updatedLeads[leadIndex].encaminhado_vendedor;
      
      updatedLeads[leadIndex] = { 
        ...updatedLeads[leadIndex], 
        status: newStatus,
        convertido: isConvertido,
        encaminhado_vendedor: isEncaminhado,
        data_conversao: isConvertido && !updatedLeads[leadIndex].convertido ? new Date().toISOString() : updatedLeads[leadIndex].data_conversao
      }
      setLeads(updatedLeads)

      try {
        const { error } = await supabaseAdmin
          .from('leads')
          .update({ 
            status: newStatus,
            convertido: isConvertido,
            encaminhado_vendedor: isEncaminhado,
            data_conversao: isConvertido && !updatedLeads[leadIndex].convertido ? new Date().toISOString() : null
          })
          .eq('id', draggableId)
        
        if (error) fetchHotLeads()
      } catch (err) {
        fetchHotLeads()
      }
    }
  }

  const filteredLeads = leads.filter(l => 
    (l.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase()) || 
    (l.whatsapp || '').includes(searchTerm)
  )

  const getEffectiveStatus = (lead: Lead): LeadStatus => {
    let s = lead.status || 'novo_contato';
    
    // Prioridade máxima para as flags booleanas
    if (lead.convertido) return 'convertido';
    if (lead.encaminhado_vendedor) return 'encaminhado';
    if (isFollowUpSent(lead)) return 'follow_up';
    if ((s === 'follow_up' && !lead.data_follow_up) || isDueDate(lead.data_follow_up) || dueFollowUpLeadIds.has(lead.id)) return 'follow_up';
    if (s === 'follow_up') s = 'novo_contato';
    if (lead.score && lead.score >= 80) return 'em_qualificacao';
    if (lead.temperatura === 'quente' || lead.temperatura === 'morno' || lead.temperatura === 'frio') return 'em_qualificacao';
    // Mapeamento de status legados/ocultos
    if (s === 'fora_horario' || s === 'primeiro_contato' || s === 'conversando') s = 'novo_contato';
    else if (s === 'proposta_enviada' || s === 'quente' || s === 'morno' || s === 'frio' || s === 'sem_interesse') s = 'em_qualificacao';

    const validCols = ['novo_contato', 'em_qualificacao', 'follow_up', 'encaminhado', 'convertido'];
    if (!validCols.includes(s)) {
      return 'novo_contato'; // Fallback de segurança para nunca perder o lead do quadro
    }

    return s as LeadStatus;
  }

  const isFirstContact = (lead: Lead) => {
    return !lead.convertido
  }

  const getDisplayTemperature = (lead: Lead) => {
    if (lead.temperatura) return lead.temperatura
    const score = lead.score || 0
    if (score >= 80) return 'quente'
    if (score >= 40) return 'morno'
    return 'frio'
  }

  const getLeadsByStatus = (status: LeadStatus) => {
    return filteredLeads.filter(l => getEffectiveStatus(l) === status)
  }

  return (
    <Layout title="Funil de Vendas">
      <div className="space-y-4 flex flex-col h-[calc(100vh-140px)]">
        {/* Barra Superior - Estilo Clean */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-bg-card p-4 border border-border-card rounded-[10px] shadow-card">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={16} />
            <Input 
              className="pl-9 h-9 text-sm bg-bg-card border-border-card focus:border-[#00C48C]/50 transition-all rounded-lg" 
              placeholder="Buscar no funil..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#00C48C]/10 px-3 py-1.5 rounded-md border border-[#00C48C]/20">
              <div className="w-2 h-2 rounded-full bg-[#00C48C] animate-pulse" />
              <span className="text-[11px] font-bold text-[#00C48C] uppercase tracking-wider">Ao Vivo</span>
            </div>
            <span className="text-xs text-border-card">|</span>
            <span className="text-[11px] text-text-muted uppercase font-semibold">Total: {filteredLeads.length} Oportunidades</span>
          </div>
        </div>

        {/* Board Kanban */}
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar bg-bg-card rounded-[10px] p-4 border border-border-card">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full min-w-max pb-2">
              {COLUMNS.map((col) => (
                <div key={col.id} className="flex flex-col w-[300px] min-w-[300px] bg-bg-base rounded-[10px] border border-border-card border-t-[3px] border-t-border-card overflow-hidden flex-shrink-0">
                  {/* Cabeçalho da Coluna Sólido e Limpo */}
                  <div className="px-4 py-3 flex items-center justify-between border-b border-border-card">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-main tracking-tight">
                        {col.title}
                      </h3>
                    </div>
                    <span className="bg-bg-card text-text-muted text-xs font-bold px-2 py-0.5 rounded-full border border-border-card">
                      {getLeadsByStatus(col.id).length}
                    </span>
                  </div>

                  {/* Área Soltável (Droppable) */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 p-3 space-y-3 overflow-y-auto custom-scrollbar transition-colors ${
                          snapshot.isDraggingOver ? 'bg-[#00C48C]/10' : ''
                        }`}
                      >
                        {getLeadsByStatus(col.id).map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedLead(lead)}
                                className={`
                                  bg-bg-card p-3 rounded-[10px] border border-border-card shadow-card
                                  hover:border-[#00C48C]/40 hover:shadow-sm cursor-pointer transition-all
                                  ${snapshot.isDragging ? 'rotate-1 scale-[1.02] border-[#00C48C] ring-1 ring-[#00C48C]/20 shadow-lg' : ''}
                                  group relative
                                `}
                              >
                                {/* Indicador lateral discreto de Score/Hot */}
                                {lead.score && lead.score > 80 && (
                                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#C0392B] rounded-l-md" />
                                )}

                                <div className="space-y-2">
                                  {/* Nome e Ação */}
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <User size={14} className="text-text-muted flex-shrink-0" />
                                      <p className="text-sm font-semibold text-text-main truncate group-hover:text-[#00C48C] transition-colors">
                                        {lead.nome || lead.whatsapp}
                                      </p>
                                    </div>
                                    {lead.score && lead.score > 80 && (
                                      <Flame size={14} className="text-[#C0392B] flex-shrink-0" />
                                    )}
                                  </div>

                                  {/* Produto / Valor */}
                                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                    <Tag size={12} className="flex-shrink-0" />
                                    <span className="truncate">{lead.produto_interesse || 'Nenhum produto listado'}</span>
                                  </div>

                                  <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-bold uppercase tracking-wide ${
                                    isFirstContact(lead)
                                      ? 'bg-[#00C48C]/10 border-[#00C48C]/20 text-[#00C48C]'
                                      : 'bg-bg-base border-border-card text-text-muted'
                                  }`}>
                                    {isFirstContact(lead) ? <Sparkles size={11} /> : <RotateCcw size={11} />}
                                    {isFirstContact(lead) ? 'Primeiro contato' : 'Cliente convertido'}
                                  </div>

                                  {/* Badges Info */}
                                  <div className="flex items-center justify-between pt-2 mt-2 border-t border-border-card">
                                    <div className="flex items-center gap-2">
                                      <LeadTemperature temperature={getDisplayTemperature(lead)} className="text-[10px] py-0.5 px-1.5 h-auto rounded" />
                                    </div>
                                    <div className="text-[10px] text-text-muted flex flex-col items-end">
                                      <span className="font-semibold text-text-main/70">{lead.score || 0}% Score</span>
                                      <span className="italic">{formatDistanceToNow(new Date(lead.horario_contato || lead.created_at || new Date()), { addSuffix: true, locale: ptBR })}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              ))}
            </div>
          </DragDropContext>
        </div>
      </div>

      <DrawerLead 
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={fetchHotLeads}
        onEdit={(lead) => {
          setLeadToEdit(lead)
          setIsModalOpen(true)
          setSelectedLead(null)
        }}
      />

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchHotLeads}
        lead={leadToEdit}
      />
    </Layout>
  )
}
