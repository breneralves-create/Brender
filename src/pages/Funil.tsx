import React, { useState, useEffect } from 'react'
import { 
  DragDropContext, 
  Droppable, 
  Draggable
} from '@hello-pangea/dnd'
import type { DropResult } from '@hello-pangea/dnd'
import { 
  Search,
  Zap,
  Flame
} from 'lucide-react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import type { Lead, LeadStatus } from '../types'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Input } from '../components/ui/Input'
import { ScoreBar } from '../components/ui/ScoreBar'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'

const COLUMNS: { id: LeadStatus; title: string, color: string, glow: string }[] = [
  { id: 'novo_contato', title: 'NOVO CONTATO', color: 'border-blue-400/30', glow: 'shadow-blue-500/5' },
  { id: 'em_qualificacao', title: 'EM QUALIFICAÇÃO', color: 'border-cyan-400/30', glow: 'shadow-cyan-400/5' },
  { id: 'primeiro_contato', title: '1º CONTATO', color: 'border-indigo-400/30', glow: 'shadow-indigo-400/5' },
  { id: 'proposta_enviada', title: 'PROPOSTA ENVIADA', color: 'border-purple-400/30', glow: 'shadow-purple-400/5' },
  { id: 'follow_up', title: 'FOLLOW-UP', color: 'border-amber-500/30', glow: 'shadow-amber-500/5' },
  { id: 'encaminhado', title: 'ENCAMINHADO', color: 'border-violet-600/30', glow: 'shadow-violet-600/5' },
  { id: 'convertido', title: 'CONVERTIDO', color: 'border-emerald-500/40', glow: 'shadow-emerald-500/10' },
  { id: 'fora_horario', title: 'FORA DO HORÁRIO', color: 'border-white/5', glow: 'shadow-white/0' }
]

export const Funil: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null)

  useEffect(() => {
    fetchHotLeads()
    
    // Real-time subscription for leads
    const subscription = supabase
      .channel('leads-funil')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchHotLeads()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchHotLeads = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .in('status', COLUMNS.map(c => c.id))
      
      if (error) throw error
      if (data) setLeads(data as Lead[])
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
      updatedLeads[leadIndex] = { 
        ...updatedLeads[leadIndex], 
        status: newStatus,
        convertido: newStatus === 'convertido',
        data_conversao: newStatus === 'convertido' ? new Date().toISOString() : updatedLeads[leadIndex].data_conversao
      }
      setLeads(updatedLeads)

      try {
        const { error } = await supabaseAdmin
          .from('leads')
          .update({ 
            status: newStatus,
            convertido: newStatus === 'convertido',
            data_conversao: newStatus === 'convertido' ? new Date().toISOString() : null
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

  const getLeadsByStatus = (status: LeadStatus) => {
    return filteredLeads.filter(l => l.status === status)
  }

  return (
    <Layout title="Funil Kanban">
      <div className="space-y-6 flex flex-col h-[calc(100vh-140px)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative w-full max-w-md group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
            <Input 
              className="pl-10 bg-bg-card/50 border-border-card focus:border-primary/50 transition-all shadow-blue-500/5 group-focus-within:shadow-primary/10" 
              placeholder="Pesquisar leads no funil..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 bg-success/10 px-4 py-2 rounded-full border border-success/20 animate-pulse-hot shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              <div className="relative">
                <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-blink-fast" />
                <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-success animate-ping opacity-40" />
              </div>
              <span className="text-[11px] font-black text-success uppercase tracking-[0.2em] leading-none">AO VIVO</span>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-[10px] text-text-muted font-black uppercase tracking-widest">Sincronização</span>
              <span className="text-[9px] text-success/70 font-bold uppercase tracking-tighter">Equipe Prospecção Ativa</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-x-auto min-h-0 custom-scrollbar">
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 h-full min-w-max pb-4 px-1">
              {COLUMNS.map((col) => (
                <div key={col.id} className={`flex flex-col w-[260px] min-w-[260px] bg-bg-card/20 rounded-2xl border-2 ${col.color || 'border-border-card'} ${col.glow || ''} overflow-hidden group/col backdrop-blur-sm transition-all duration-300 hover:bg-bg-card/30`}>
                  {/* Column Header */}
                  <div className={`p-4 flex items-center justify-between bg-bg-card/40 border-b border-border-card transition-all group-hover/col:bg-bg-card/60`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${col.color?.split(' ')[0].replace('border-', 'bg-')} shadow-[0_0_8px_currentColor]`} />
                       <h3 className="text-[10px] font-black text-text-main font-heading tracking-[0.15em] uppercase transition-colors">
                        {col.title}
                      </h3>
                    </div>
                    <Badge variant="muted" className="text-[10px] tabular-nums font-bold bg-bg-base/50">
                      {getLeadsByStatus(col.id).length}
                    </Badge>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 p-3 space-y-4 overflow-y-auto transition-colors custom-scrollbar ${
                          snapshot.isDraggingOver ? 'bg-primary/5' : ''
                        }`}
                      >
                        {getLeadsByStatus(col.id).map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="group/card"
                                onClick={() => setSelectedLead(lead)}
                              >
                                <Card className={`
                                  relative p-4 space-y-3 bg-bg-card/90 border-l-[3px] transition-all cursor-grab active:cursor-grabbing
                                  hover:bg-bg-card hover:translate-y-[-4px] group/card
                                  ${col.color} 
                                  ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-2xl border-primary ring-1 ring-primary/40 !bg-bg-card' : ''}
                                  ${lead.score && lead.score > 80 ? 'ring-1 ring-primary/30 !shadow-[0_0_20px_-5px_rgba(0,200,150,0.3)]' : ''}
                                `}>
                                  {/* Dynamic Background Glow for high score */}
                                  {lead.score && lead.score > 80 && (
                                    <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                                  )}

                                  {/* Scanning Line Effect */}
                                  {lead.score && lead.score > 90 && (
                                    <div className="absolute left-0 right-0 h-[1px] bg-primary/40 shadow-[0_0_8px_rgba(0,200,150,0.8)] z-20 animate-scan pointer-events-none opacity-50" />
                                  )}

                                  {/* Constant shimmer for hot leads */}
                                  {lead.score && lead.score > 70 && (
                                    <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                                      <div className="absolute inset-x-0 h-[200%] w-[150px] bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-[200px] rotate-[35deg] animate-shimmer" />
                                    </div>
                                  )}

                                  <div className="relative z-10">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="text-sm font-black text-text-main leading-tight group-hover/card:text-primary transition-colors truncate">
                                        {lead.nome || lead.whatsapp}
                                      </p>
                                      {lead.score && lead.score > 85 ? (
                                        <Zap size={14} className="text-hot animate-blink-fast flex-shrink-0" />
                                      ) : lead.score && lead.score > 60 && (
                                        <Flame size={14} className="text-hot/70 flex-shrink-0" />
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${lead.dentro_horario_comercial ? 'bg-success shadow-[0_0_5px_var(--success)]' : 'bg-error shadow-[0_0_5px_var(--error)]'}`} />
                                      <p className="text-[10px] text-text-muted font-medium truncate">
                                        {lead.produto_interesse || 'Analizando interesse...'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex justify-between items-end pt-1 relative z-10">
                                    <div className="flex flex-col gap-1.5 w-full mr-4">
                                      <div className="flex items-center justify-between">
                                        <span className={`text-[9px] font-black leading-none tabular-nums tracking-tighter ${lead.score && lead.score > 80 ? 'text-primary animate-pulse' : 'text-text-muted'}`}>
                                          LIT SCORE: {lead.score || 0}%
                                        </span>
                                        {lead.temperatura === 'quente' && <span className="text-[8px] bg-hot/10 text-hot px-1.5 rounded font-black italic">HOT</span>}
                                      </div>
                                      <ScoreBar score={lead.score || 0} className="w-full h-1.5 rounded-full bg-bg-base/50" />
                                    </div>
                                    <Badge variant="muted" className="text-[8px] h-4 py-0 px-2 font-bold uppercase tracking-wider bg-bg-base/80 border border-border-card/50">
                                      {lead.origem || 'Direto'}
                                    </Badge>
                                  </div>
                                </Card>
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
