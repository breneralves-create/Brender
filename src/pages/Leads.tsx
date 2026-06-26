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
  Trash2,
  MessageCircle,
  Bot,
  BotOff
} from 'lucide-react'
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Badge } from '../components/ui/Badge'
import { ScoreBar } from '../components/ui/ScoreBar'
import { LeadTemperature } from '../components/ui/LeadTemperature'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import type { Lead } from '../types'
import { buildWhatsAppUrl, formatWhatsAppNumber, openWhatsApp } from '../lib/whatsapp'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { getLeadTemperature } from '../lib/leadScoring'
import { formatCityName } from '../lib/textFormat'

export const Leads: React.FC = () => {
  const { isAdmin } = useAuth()
  const { scoreConfig } = useCompany()
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
    } catch (err: unknown) {
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
      case 'mes_passado': {
        const lastMonth = subMonths(today, 1)
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }); break
      }
      default:
        setDateRange({ from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) })
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      const matchesSearch =
        ((lead.nome?.toLowerCase() || '').includes(searchTerm.toLowerCase())) ||
        (lead.whatsapp || '').includes(searchTerm)

      const matchesTemp = tempFilter.length === 0 || tempFilter.includes(getLeadTemperature(lead, scoreConfig))

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
  }, [leads, searchTerm, tempFilter, hoursFilter, forwardFilter, dateRange, selectedRange, scoreConfig])

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

  const handleWhatsApp = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation()
    openWhatsApp(lead.whatsapp, lead.nome)
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
    } catch (err: unknown) {
      console.error('Erro ao deletar lead:', err)
      const message = err instanceof Error ? err.message : 'Verifique suas permissões de RLS.'
      alert(`Erro ao excluir lead: ${message}`)
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
    URL.revokeObjectURL(url)
  }

  const tempCounts = useMemo(() => ({
    quente: leads.filter(l => getLeadTemperature(l, scoreConfig) === 'quente').length,
    morno: leads.filter(l => getLeadTemperature(l, scoreConfig) === 'morno').length,
    frio: leads.filter(l => getLeadTemperature(l, scoreConfig) === 'frio').length,
  }), [leads, scoreConfig])

  const toggleTempCard = (temp: string) => {
    setTempFilter(prev => prev.includes(temp) ? prev.filter(x => x !== temp) : [...prev, temp])
  }

  return (
    <Layout title="Gestão de Leads">
      <div className="space-y-6">

        {/* Temperature Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* QUENTE */}
          <button
            onClick={() => toggleTempCard('quente')}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
              tempFilter.includes('quente')
                ? 'bg-[#FEF3F0] border-[#F5A89A] shadow-sm'
                : 'bg-bg-card border-border-card hover:border-[#F5A89A] hover:bg-[#FEF3F0]/40'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#C0392B] flex items-center justify-center flex-shrink-0">
              <Flame size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#C0392B]">🔥 Quente</p>
              <p className="text-lg font-bold text-text-main leading-none mt-0.5">{tempCounts.quente}</p>
              <p className="text-[10px] text-text-muted mt-0.5">Score {scoreConfig.score_minimo_quente}–100</p>
            </div>
          </button>

          {/* MORNO */}
          <button
            onClick={() => toggleTempCard('morno')}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
              tempFilter.includes('morno')
                ? 'bg-[#FEF9EC] border-[#F9D589] shadow-sm'
                : 'bg-bg-card border-border-card hover:border-[#F9D589] hover:bg-[#FEF9EC]/40'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#B7770D] flex items-center justify-center flex-shrink-0">
              <Thermometer size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#B7770D]">🌡 Morno</p>
              <p className="text-lg font-bold text-text-main leading-none mt-0.5">{tempCounts.morno}</p>
              <p className="text-[10px] text-text-muted mt-0.5">Score {scoreConfig.score_minimo_morno}–{scoreConfig.score_minimo_quente - 1}</p>
            </div>
          </button>

          {/* FRIO */}
          <button
            onClick={() => toggleTempCard('frio')}
            className={`flex items-center gap-3 p-4 rounded-xl border transition-all text-left ${
              tempFilter.includes('frio')
                ? 'bg-[#EFF6FF] border-[#93C5FD] shadow-sm'
                : 'bg-bg-card border-border-card hover:border-[#93C5FD] hover:bg-[#EFF6FF]/40'
            }`}
          >
            <div className="w-10 h-10 rounded-lg bg-[#1D6FA4] flex items-center justify-center flex-shrink-0">
              <Snowflake size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-[#1D6FA4]">❄ Frio</p>
              <p className="text-lg font-bold text-text-main leading-none mt-0.5">{tempCounts.frio}</p>
              <p className="text-[10px] text-text-muted mt-0.5">Score 0–{scoreConfig.score_minimo_morno - 1}</p>
            </div>
          </button>
        </div>

        {/* Filters Header */}
        <div className="bg-bg-card p-5 rounded-[10px] border border-border-card space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              {(['hoje', 'este_mes', 'mes_passado', 'todos'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => handleRangeChange(range)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedRange === range
                      ? 'bg-[#00C48C] text-white shadow-sm'
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
              {isAdmin && (
                <Button variant="primary" className="gap-2" onClick={() => { setLeadToEdit(null); setIsModalOpen(true); }}>
                  <Plus size={18} /> Novo Lead
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <Input
                className="pl-10"
                placeholder="Buscar por nome ou WhatsApp..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(['quente', 'morno', 'frio'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTempFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])}
                  className={`py-2 px-3 rounded-full text-xs font-bold uppercase transition-all flex items-center justify-center gap-1.5 border ${tempFilter.includes(t)
                      ? (t === 'quente' ? 'bg-[#FEF3F0] text-[#C0392B] border-[#F5A89A]' : t === 'morno' ? 'bg-[#FEF9EC] text-[#B7770D] border-[#F9D589]' : 'bg-[#EFF6FF] text-[#1D6FA4] border-[#93C5FD]')
                      : 'bg-bg-card text-text-muted border-border-card hover:text-text-main hover:bg-bg-base'
                    }`}
                >
                  {t === 'quente' ? <Flame size={12} /> : t === 'morno' ? <Thermometer size={12} /> : <Snowflake size={12} />}
                  {t}
                </button>
              ))}
            </div>

            <select
              className="bg-bg-card border border-border-card rounded-lg px-4 py-2.5 text-xs font-medium text-text-main"
              value={hoursFilter}
              onChange={e => setHoursFilter(e.target.value as typeof hoursFilter)}
            >
              <option value="todos" className="bg-[#1a1c24] text-white">Todos os Horários</option>
              <option value="comercial" className="bg-[#1a1c24] text-white">Horário Comercial</option>
              <option value="fora" className="bg-[#1a1c24] text-white">Fora do Horário</option>
            </select>

            <select
              className="bg-bg-card border border-border-card rounded-lg px-4 py-2.5 text-xs font-medium text-text-main"
              value={forwardFilter}
              onChange={e => setForwardFilter(e.target.value as typeof forwardFilter)}
            >
              <option value="todos" className="bg-[#1a1c24] text-white">Encaminhamento (Todos)</option>
              <option value="encaminhado" className="bg-[#1a1c24] text-white">Encaminhados</option>
              <option value="nao_encaminhado" className="bg-[#1a1c24] text-white">Não Encaminhados</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-bg-card rounded-[10px] border border-border-card overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bg-base text-[10px] uppercase font-bold text-text-muted tracking-widest border-b border-border-card">
                  <th className="px-6 py-4 cursor-pointer hover:text-[#00C48C] transition-colors" onClick={() => toggleSort('nome')}>
                    <div className="flex items-center gap-2">Lead <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4">WhatsApp</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-[#00C48C] transition-colors" onClick={() => toggleSort('cidade')}>
                    <div className="flex items-center gap-2">Cidade <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-[#00C48C] transition-colors" onClick={() => toggleSort('score')}>
                    <div className="flex items-center gap-2">Score <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4 cursor-pointer hover:text-[#00C48C] transition-colors" onClick={() => toggleSort('temperatura')}>
                    <div className="flex items-center gap-2">Temperatura <ArrowUpDown size={12} /></div>
                  </th>
                  <th className="px-6 py-4">Encaminhado</th>
                  <th className="px-6 py-4 text-center">IA</th>
                  <th className="px-6 py-4 cursor-pointer hover:text-[#00C48C] transition-colors" onClick={() => toggleSort('created_at')}>
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
                    className="hover:bg-bg-base/60 transition-colors cursor-pointer group"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-text-main group-hover:text-[#00C48C] transition-colors">
                        {lead.nome || <span className="text-text-muted italic">Sem nome</span>}
                      </p>
                      <p className="text-xs text-text-muted mt-1">
                        {lead.produto_interesse || 'Nenhum produto listado'} · {lead.origem || 'WhatsApp'}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-xs text-text-muted font-medium">
                      <button
                        type="button"
                        onClick={(e) => handleWhatsApp(e, lead)}
                        disabled={!buildWhatsAppUrl(lead.whatsapp, lead.nome)}
                        className="group/whatsapp inline-flex items-center gap-2 rounded-lg px-2 py-1.5 -ml-2 transition-all hover:bg-[#25D366]/10 hover:text-[#159447] disabled:cursor-not-allowed disabled:opacity-40"
                        title={buildWhatsAppUrl(lead.whatsapp, lead.nome) ? 'Conversar no WhatsApp' : 'WhatsApp inválido'}
                      >
                        <MessageCircle size={15} className="text-[#25D366] transition-transform group-hover/whatsapp:scale-110" />
                        {formatWhatsAppNumber(lead.whatsapp)}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-text-main">
                      {lead.cidade ? (
                        <Badge variant="muted" className="text-xs bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]/20">
                          {formatCityName(lead.cidade)}
                        </Badge>
                      ) : (
                        <span className="text-text-muted opacity-40">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-text-main w-8">{lead.score || 0}%</span>
                        <ScoreBar score={lead.score || 0} className="w-20" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <LeadTemperature temperature={getLeadTemperature(lead, scoreConfig)} className="text-[10px] py-1" />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {lead.encaminhado_vendedor ? (
                          <div className="p-1 px-2 rounded-full bg-[#00C48C]/10 text-[#00C48C] flex items-center gap-1 text-[10px] font-bold">
                            <CheckCircle2 size={12} /> SIM
                          </div>
                        ) : (
                          <span className="text-text-muted opacity-40">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center">
                        {lead.bot_ativo === false ? (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#F9D589] bg-[#FEF9EC] px-2.5 py-1 text-[10px] font-bold uppercase text-[#B7770D]">
                            <BotOff size={12} />
                            Agente pausada
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 rounded-full border border-[#00C48C]/20 bg-[#00C48C]/10 px-2.5 py-1 text-[10px] font-bold uppercase text-[#00A878]">
                            <Bot size={12} />
                            Ativa
                          </div>
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
                            <span className="text-[#00C48C]"> (Comercial)</span>
                          ) : (
                            <span className="text-[#B7770D]"> (Fora do Horário)</span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={(e) => handleWhatsApp(e, lead)}
                          disabled={!buildWhatsAppUrl(lead.whatsapp, lead.nome)}
                          className="p-2 text-[#159447] hover:bg-[#25D366]/10 rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-30"
                          title={buildWhatsAppUrl(lead.whatsapp, lead.nome) ? 'Abrir WhatsApp' : 'WhatsApp inválido'}
                        >
                          <MessageCircle size={17} />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => handleDelete(e, lead.id)}
                            className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all"
                            title="Excluir Lead"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
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
