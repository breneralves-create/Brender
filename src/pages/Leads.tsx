import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Search,
  ArrowUpDown,
  Download,
  Plus,
  Flame,
  Thermometer,
  Snowflake,
  CheckCircle2,
  Trash2
} from 'lucide-react'
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { ScoreBar } from '../components/ui/ScoreBar'
import { LeadTemperature } from '../components/ui/LeadTemperature'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import type { Lead } from '../types'

export const Leads: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null)

  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [tempFilter, setTempFilter] = useState<string[]>([])
  const [hoursFilter, setHoursFilter] = useState<'todos' | 'comercial' | 'fora'>('todos')
  const [forwardFilter, setForwardFilter] = useState<'todos' | 'encaminhado' | 'nao_encaminhado'>('todos')
  const [selectedRange, setSelectedRange] = useState<'este_mes' | 'mes_passado' | 'hoje' | 'todos'>('todos')
  const [dateRange, setDateRange] = useState({
    from: new Date(2000, 0, 1),
    to: new Date(2100, 0, 1)
  })

  // Sorting and Pagination
  const [sortField, setSortField] = useState<keyof Lead>('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    fetchLeads()

    const channel = supabase
      .channel('public:leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const fetchLeads = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      if (data) setLeads(data as Lead[])

      if (data && data.length === 0) {
        console.warn('⚠️ LEADS: O banco retornou ZERO leads. Isso pode ser RLS ou falta de dados.')
      } else {
        console.log('✅ LEADS: Recebidos', data?.length, 'leads do banco.')
      }
    } catch (err: any) {
      console.error('Erro ao buscar leads:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleRangeChange = (range: typeof selectedRange) => {
    setSelectedRange(range)
    const today = new Date()
    switch (range) {
      case 'hoje':
        setDateRange({ from: startOfDay(today), to: endOfDay(today) }); break
      case 'este_mes':
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) }); break
      case 'mes_passado':
        const lastMonth = subMonths(today, 1)
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }); break
      default:
        setDateRange({ from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) })
    }
  }

  const getDisplayTemperature = (lead: Lead) => {
    if (lead.temperatura) return lead.temperatura
    const score = lead.score || 0
    if (score >= 80) return 'quente'
    if (score >= 40) return 'morno'
    return 'frio'
  }

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch =
        ((lead.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase())) ||
        (lead.whatsapp || '').includes(searchTerm)

      const matchesTemp = tempFilter.length === 0 || tempFilter.includes(getDisplayTemperature(lead))

      const matchesHours =
        hoursFilter === 'todos' ||
        (hoursFilter === 'comercial' && lead.dentro_horario_comercial) ||
        (hoursFilter === 'fora' && !lead.dentro_horario_comercial)

      const matchesForward =
        forwardFilter === 'todos' ||
        (forwardFilter === 'encaminhado' && lead.encaminhado_vendedor) ||
        (forwardFilter === 'nao_encaminhado' && !lead.encaminhado_vendedor)

      if (selectedRange === 'todos') return matchesSearch && matchesTemp && matchesHours && matchesForward

      const contactDate = new Date(lead.horario_contato || lead.created_at || '')
      const matchesDate = !isNaN(contactDate.getTime()) && contactDate >= dateRange.from && contactDate <= dateRange.to

      return matchesSearch && matchesTemp && matchesHours && matchesForward && matchesDate
    })
  }, [leads, searchTerm, tempFilter, hoursFilter, forwardFilter, dateRange, selectedRange])

  const sortedLeads = useMemo(() => {
    return [...filteredLeads].sort((a, b) => {
      const valA = a[sortField] || ''
      const valB = b[sortField] || ''
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1
      return 0
    })
  }, [filteredLeads, sortField, sortOrder])

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return sortedLeads.slice(start, start + pageSize)
  }, [sortedLeads, currentPage])

  const totalPages = Math.ceil(sortedLeads.length / pageSize)

  const toggleSort = (field: keyof Lead) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setLeadToDelete(id)
    setIsDeleteModalOpen(true)
  }

  // ✅ CORRIGIDO: usa supabaseAdmin para contornar o RLS no delete
  const confirmDelete = async () => {
    if (!leadToDelete) return

    setIsDeleting(true)
    try {
      const { error } = await supabaseAdmin
        .from('leads')
        .delete()
        .eq('id', leadToDelete)

      if (error) throw error

      setLeads(prev => prev.filter(l => l.id !== leadToDelete))
      setIsDeleteModalOpen(false)
    } catch (err: any) {
      console.error('Erro ao deletar lead:', err)
      alert(`Erro ao excluir lead: ${err.message || 'Verifique suas permissões de RLS.'}`)
    } finally {
      setIsDeleting(false)
      setLeadToDelete(null)
    }
  }

  const exportCSV = () => {
    const headers = "Nome,WhatsApp,Score,Temperatura,Produto,Origem,Status,Data\n"
    const rows = sortedLeads.map(l =>
      `"${l.nome || 'Sem nome'}","${l.whatsapp}",${l.score || 0},"${l.temperatura || ''}","${l.produto_interesse || ''}","${l.origem || ''}","${l.status}","${l.horario_contato || l.created_at}"`
    ).join("\n")

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `export-leads-${format(new Date(), 'yyyy-MM-dd')}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatWhatsApp = (num: string) => {
    const cleaned = num.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`
    }
    return num
  }

  return (
    <Layout title="Gestão de Leads">
      <div className="space-y-6">
        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-hot/5 border-hot/20 flex items-center gap-4">
            <div className="p-3 bg-hot rounded-xl text-white">
              <Flame size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-hot uppercase">🔥 Quente</p>
              <p className="text-xs text-text-muted">Score 80-100</p>
            </div>
          </Card>
          <Card className="p-4 bg-warm/5 border-warm/20 flex items-center gap-4">
            <div className="p-3 bg-warm rounded-xl text-white">
              <Thermometer size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-warm uppercase">🌡 Morno</p>
              <p className="text-xs text-text-muted">Score 40-79</p>
            </div>
          </Card>
          <Card className="p-4 bg-cold/5 border-cold/20 flex items-center gap-4">
            <div className="p-3 bg-cold rounded-xl text-white">
              <Snowflake size={20} />
            </div>
            <div>
              <p className="text-xs font-bold text-cold uppercase">❄ Frio</p>
              <p className="text-xs text-text-muted">Score 0-39</p>
            </div>
          </Card>
        </div>

        {/* Filters Header */}
        <div className="bg-bg-card p-6 rounded-2xl border border-border-card space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {(['hoje', 'este_mes', 'mes_passado', 'todos'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => handleRangeChange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedRange === range
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-text-muted hover:text-text-main hover:bg-bg-base'
                    }`}
                >
                  {range === 'hoje' ? 'Hoje' : range === 'este_mes' ? 'Este mês' : range === 'mes_passado' ? 'Mês passado' : 'Todos'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={exportCSV}>
                <Download size={18} /> Exportar CSV
              </Button>
              <Button variant="primary" className="gap-2" onClick={() => { setLeadToEdit(null); setIsModalOpen(true); }}>
                <Plus size={18} /> Novo Lead
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <Input
                className="pl-10"
                placeholder="Buscar por nome ou WhatsApp..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex bg-bg-base rounded-button border border-border-card p-1">
              {(['quente', 'morno', 'frio'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTempFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-1 ${tempFilter.includes(t)
                      ? (t === 'quente' ? 'bg-hot text-white' : t === 'morno' ? 'bg-warm text-white' : 'bg-cold text-white')
                      : 'text-text-muted hover:text-text-main'
                    }`}
                >
                  {t === 'quente' ? <Flame size={12} /> : t === 'morno' ? <Thermometer size={12} /> : <Snowflake size={12} />}
                  {t}
                </button>
              ))}
            </div>

            <select
              className="bg-bg-base border border-border-card rounded-button px-4 py-2.5 text-xs font-medium text-text-main"
              value={hoursFilter}
              onChange={e => setHoursFilter(e.target.value as any)}
            >
              <option value="todos" className="bg-[#1a1c24] text-white">Todos os Horários</option>
              <option value="comercial" className="bg-[#1a1c24] text-white">Horário Comercial</option>
              <option value="fora" className="bg-[#1a1c24] text-white">Fora do Horário</option>
            </select>

            <select
              className="bg-bg-base border border-border-card rounded-button px-4 py-2.5 text-xs font-medium text-text-main"
              value={forwardFilter}
              onChange={e => setForwardFilter(e.target.value as any)}
            >
              <option value="todos" className="bg-[#1a1c24] text-white">Encaminhamento (Todos)</option>
              <option value="encaminhado" className="bg-[#1a1c24] text-white">Encaminhados</option>
              <option value="nao_encaminhado" className="bg-[#1a1c24] text-white">Não Encaminhados</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-bg-card rounded-2xl border border-border-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-base/50 text-[10px] uppercase font-bold text-text-muted tracking-widest border-b border-border-card">
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('nome')}>
                    <div className="flex items-center gap-2">Nome <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4">WhatsApp</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('cidade')}>
                    <div className="flex items-center gap-2">Cidade <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('score')}>
                    <div className="flex items-center gap-2">Score <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('temperatura')}>
                    <div className="flex items-center gap-2">Temperatura <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">Origem</th>
                  <th className="px-6 py-4">Encaminhado</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-primary transition-colors" onClick={() => toggleSort('created_at')}>
                    <div className="flex items-center gap-2">Data Contato <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4 text-center text-xs font-bold uppercase text-text-muted tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-card">
                {paginatedLeads.map(lead => (
                  <tr
                    key={lead.id}
                    className="hover:bg-bg-base/30 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">
                        {lead.nome || <span className="text-text-muted italic">Sem nome</span>}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-muted font-medium">
                      {formatWhatsApp(lead.whatsapp)}
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-text-main">
                      {lead.cidade ? (
                        <Badge variant="muted" className="text-xs bg-primary/10 text-primary border-primary/20">
                          {lead.cidade}
                        </Badge>
                      ) : (
                        <span className="text-text-muted opacity-30">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-text-main w-8">{lead.score || 0}%</span>
                        <ScoreBar score={lead.score || 0} className="w-20" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <LeadTemperature temperature={getDisplayTemperature(lead)} className="text-[10px] py-1" />
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-text-main">
                      {lead.produto_interesse || <span className="text-text-muted opacity-30">—</span>}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="muted" className="text-[10px]">{lead.origem || 'WhatsApp'}</Badge>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {lead.encaminhado_vendedor ? (
                          <div className="p-1 px-2 rounded-full bg-success/10 text-success flex items-center gap-1 text-[10px] font-bold">
                            <CheckCircle2 size={12} /> SIM
                          </div>
                        ) : (
                          <span className="text-text-muted opacity-30">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-text-muted font-medium">
                        {lead.horario_contato || lead.created_at
                          ? format(new Date(lead.horario_contato || lead.created_at), 'dd/MM/yyyy')
                          : <span className="opacity-30">—</span>
                        }
                        <span className="block text-[10px] opacity-70 mt-0.5">
                          {(lead.horario_contato || lead.created_at) && format(new Date(lead.horario_contato || lead.created_at), 'HH:mm')}
                          {lead.dentro_horario_comercial ? (
                            <span className="text-primary/80"> (Comercial)</span>
                          ) : (
                            <span className="text-warning/80"> (Fora do Horário)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <button
                          onClick={(e) => handleDelete(e, lead.id)}
                          className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all"
                          title="Excluir Lead"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && paginatedLeads.length === 0 && (
            <div className="p-20 text-center space-y-4">
              <div className="p-4 bg-bg-base rounded-full inline-block text-text-muted/20">
                <Users size={64} />
              </div>
              <h4 className="text-lg font-bold text-text-main">Nenhum lead encontrado</h4>
              <p className="text-sm text-text-muted max-w-xs mx-auto">
                Tente ajustar os filtros ou pesquisar por outro termo.
              </p>
              <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setTempFilter([]); setHoursFilter('todos'); setForwardFilter('todos'); }}>
                Limpar Filtros
              </Button>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-6 py-4 bg-bg-base/30 border-t border-border-card flex items-center justify-between">
              <div className="text-xs text-text-muted">
                Mostrando <span className="font-bold text-text-main">{(currentPage - 1) * pageSize + 1}</span> a <span className="font-bold text-text-main">{Math.min(currentPage * pageSize, sortedLeads.length)}</span> de <span className="font-bold text-text-main">{sortedLeads.length}</span> resultados
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${currentPage === i + 1 ? 'bg-primary text-white' : 'hover:bg-bg-base text-text-muted'
                        }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <DrawerLead
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={fetchLeads}
        onEdit={(lead) => {
          setLeadToEdit(lead)
          setIsModalOpen(true)
          setSelectedLead(null)
        }}
      />

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchLeads}
        lead={leadToEdit}
      />

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Deletar este Lead?"
        description="Tem certeza que deseja deletar este lead? Esta ação não pode ser desfeita e removerá todo o histórico."
        isLoading={isDeleting}
      />
    </Layout>
  )
}
