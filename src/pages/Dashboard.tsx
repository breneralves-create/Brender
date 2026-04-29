import React, { useState, useEffect, useMemo } from 'react'
import { 
  Users, 
  Flame, 
  Send, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown,
  Bot,
  ArrowRight,
  Zap,
  Trash2
} from 'lucide-react'
import { 
  AreaChart, Area, Line,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts'
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, eachDayOfInterval, subMonths, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { ScoreBar } from '../components/ui/ScoreBar'
import { DrawerLead } from '../components/Lead/DrawerLead'
import { LeadModal } from '../components/Lead/LeadModal'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { useCompany } from '../contexts/CompanyContext'
import type { Lead } from '../types'
import { Badge } from '../components/ui/Badge'

export const Dashboard: React.FC = () => {
  const { company, refreshCompany } = useCompany()
  const [leads, setLeads] = useState<Lead[]>([])
  const [isToggling, setIsToggling] = useState(false)
  // ✅ CORREÇÃO: padrão agora é 'todos' para mostrar TODOS os leads sempre
  const [selectedRange, setSelectedRange] = useState<'todos' | 'hoje' | 'ontem' | '7dias' | 'este_mes' | 'mes_passado' | 'este_ano'>('todos')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [leadToEdit, setLeadToEdit] = useState<Lead | null>(null)
  
  // Delete Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // ✅ FIX: Range inicial padrão é o mês atual para evitar processar milhares de dias
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  })

  useEffect(() => {
    fetchDashboardData()

    const subscription = supabase
      .channel('dashboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchDashboardData()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [dateRange])

  const fetchDashboardData = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('leads')
        .select('*')
        .order('horario_contato', { ascending: false })
      
      if (error) throw error
      
      if (data) {
        console.log('📊 Dashboard: Leads carregados com sucesso:', data.length)
        setLeads(data as Lead[])
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard:', err)
    }
  }

  const handleToggleAutomation = async () => {
    if (!company) return
    setIsToggling(true)
    try {
      const { error } = await supabase
        .from('company_config')
        .update({ automacao_ativa: !company.automacao_ativa })
        .eq('id', company.id)
      
      if (!error) await refreshCompany()
    } catch (err) {
      console.error(err)
    } finally {
      setIsToggling(false)
    }
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setLeadToDelete(id)
    setIsDeleteModalOpen(true)
  }

  const confirmDelete = async () => {
    if (!leadToDelete) return
    
    setIsDeleting(true)
    try {
      const { error } = await supabaseAdmin
        .from('leads')
        .delete()
        .eq('id', leadToDelete)

      if (error) throw error
      
      // Atualiza a lista localmente
      setLeads(prev => prev.filter(l => l.id !== leadToDelete))
      setIsDeleteModalOpen(false)
    } catch (err) {
      console.error('Erro ao deletar lead:', err)
      alert('Erro ao excluir lead. Verifique as permissões.')
    } finally {
      setIsDeleting(false)
      setLeadToDelete(null)
    }
  }

  // ✅ CORREÇÃO: filtro usa created_at como fallback e "todos" mostra tudo
  const filteredLeads = useMemo(() => {
    if (selectedRange === 'todos') return leads
    return leads.filter(lead => {
      const dateToUse = lead.horario_contato || lead.created_at
      if (!dateToUse) return true
      const contactDate = new Date(dateToUse)
      return contactDate >= dateRange.from && contactDate <= dateRange.to
    })
  }, [leads, dateRange, selectedRange])

  const metrics = useMemo(() => {
    const total = filteredLeads.length
    const quentes = filteredLeads.filter(l => l.temperatura === 'quente').length
    const encaminhados = filteredLeads.filter(l => l.encaminhado_vendedor).length
    const convertidos = filteredLeads.filter(l => l.convertido).length

    return [
      { label: 'Total de Leads', value: total, icon: Users, color: 'text-text-main', trend: 12 },
      { label: 'Leads Quentes', value: quentes, icon: Flame, color: 'text-hot', trend: 8 },
      { label: 'Encaminhados', value: encaminhados, icon: Send, color: 'text-primary', trend: -3 },
      { label: 'Convertidos', value: convertidos, icon: CheckCircle, color: 'text-success', trend: 15 },
    ]
  }, [filteredLeads])

  const evolutionData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
    const dayLabels = days.map(d => format(d, 'yyyy-MM-dd'))
    
    return days.map((day, idx) => {
      const dayStr = dayLabels[idx]
      const dayLeads = leads.filter(l => {
        const dateStr = l.horario_contato 
          ? format(new Date(l.horario_contato), 'yyyy-MM-dd') 
          : format(new Date(l.created_at), 'yyyy-MM-dd')
        return dateStr === dayStr
      })
      return {
        date: format(day, 'dd/MM'),
        total: dayLeads.length,
        quentes: dayLeads.filter(l => l.temperatura === 'quente').length,
        encaminhados: dayLeads.filter(l => l.encaminhado_vendedor).length
      }
    })
  }, [leads, dateRange])

  const weekdayData = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0]
    const labels = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    filteredLeads.forEach(l => {
      const dateToUse = l.horario_contato ? new Date(l.horario_contato) : new Date(l.created_at)
      const day = dateToUse.getDay()
      counts[day]++
    })
    return counts.map((count, index) => ({
      name: labels[index],
      leads: count,
      fill: count > 10 ? 'var(--hot)' : count > 5 ? 'var(--warm)' : 'var(--cold)'
    }))
  }, [filteredLeads])

  const businessHoursData = useMemo(() => {
    const dentro = filteredLeads.filter(l => l.dentro_horario_comercial).length
    const fora = filteredLeads.filter(l => !l.dentro_horario_comercial).length
    return [
      { name: 'Dentro do Horário', value: dentro, color: 'var(--success)' },
      { name: 'Fora do Horário', value: fora, color: 'var(--warning)' }
    ]
  }, [filteredLeads])

  const funnelData = useMemo(() => {
    const statuses = [
      { id: 'novo_contato', label: 'Novo', color: 'var(--primary-light)' },
      { id: 'em_qualificacao', label: 'Qualif.', color: 'var(--warning)' },
      { id: 'quente', label: 'Quente', color: 'var(--hot)' },
      { id: 'encaminhado', label: 'Encam.', color: 'var(--primary)' },
      { id: 'convertido', label: 'Conv.', color: 'var(--success)' },
    ]

    return statuses.map(s => ({
      name: s.label,
      value: filteredLeads.filter(l => l.status === s.id).length,
      fill: s.color
    }))
  }, [filteredLeads])

  const productsData = useMemo(() => {
    const counts: Record<string, number> = {}
    filteredLeads.forEach(l => {
      const p = l.produto_interesse || 'Não informado'
      counts[p] = (counts[p] || 0) + 1
    })
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8)
  }, [filteredLeads])

  const recentHotLeads = useMemo(() => {
    return leads
      .filter(l => l.temperatura === 'quente' || (l.score && l.score > 70))
      .sort((a, b) => {
        const dateB = new Date(b.horario_contato || b.created_at).getTime()
        const dateA = new Date(a.horario_contato || a.created_at).getTime()
        return dateB - dateA
      })
      .slice(0, 5)
  }, [leads])

  const handleRangeChange = (range: typeof selectedRange) => {
    setSelectedRange(range)
    const today = new Date()
    switch (range) {
      case 'todos':
        setDateRange({ from: new Date(2000, 0, 1), to: new Date(2100, 0, 1) }); break
      case 'hoje':
        setDateRange({ from: startOfDay(today), to: endOfDay(today) }); break
      case 'ontem':
        setDateRange({ from: startOfDay(subDays(today, 1)), to: endOfDay(subDays(today, 1)) }); break
      case '7dias':
        setDateRange({ from: startOfDay(subDays(today, 7)), to: endOfDay(today) }); break
      case 'este_mes':
        setDateRange({ from: startOfMonth(today), to: endOfMonth(today) }); break
      case 'mes_passado':
        const lastMonth = subMonths(today, 1)
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) }); break
      case 'este_ano':
        setDateRange({ from: new Date(today.getFullYear(), 0, 1), to: endOfMonth(today) }); break
    }
  }

  const foraHorarioCount = filteredLeads.filter(l => !l.dentro_horario_comercial).length

  return (
    <Layout title="Dashboard de Performance">
      <div className="space-y-8">
        {/* Filters & Real-time Indicator */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="bg-bg-card p-2 rounded-xl border border-border-card flex flex-wrap gap-2">
            {(['todos', 'hoje', 'ontem', '7dias', 'este_mes', 'mes_passado', 'este_ano'] as const).map(range => (
              <button
                key={range}
                onClick={() => handleRangeChange(range)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedRange === range 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'text-text-muted hover:text-text-main hover:bg-bg-base'
                }`}
              >
                {range === 'todos' ? 'Todos' : range === 'hoje' ? 'Hoje' : range === 'ontem' ? 'Ontem' : range === '7dias' ? '7 dias' : range === 'este_mes' ? 'Este mês' : range === 'mes_passado' ? 'Mês passado' : 'Este ano'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 bg-bg-card/40 px-4 py-2 rounded-full border border-border-card">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-primary animate-ping opacity-75" />
            </div>
            <span className="text-xs font-bold text-text-main/70 uppercase tracking-widest">Tempo Real</span>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => (
            <Card key={idx} className="p-6 space-y-4 hover:border-primary/30 transition-all group overflow-hidden relative">
              {m.label === 'Leads Quentes' && (
                <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 bg-hot/5 rounded-full group-hover:bg-hot/10 transition-colors" />
              )}
              <div className="flex justify-between items-start">
                <div className={`p-3 rounded-xl bg-bg-base border border-border-card group-hover:scale-110 transition-transform ${m.color}`}>
                  <m.icon size={24} />
                </div>
                <div className={`flex items-center gap-1 text-xs font-bold ${m.trend > 0 ? 'text-success' : 'text-error'}`}>
                  {m.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {Math.abs(m.trend)}%
                </div>
              </div>
              <div>
                <h3 className="text-4xl font-bold font-heading text-text-main">{m.value}</h3>
                <p className="text-sm font-medium text-text-muted mt-1 uppercase tracking-wider">{m.label}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Real-Time Funnel Chart */}
        <Card className="p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4">
             <div className="flex items-center gap-2 bg-success/10 px-3 py-1.5 rounded-full border border-success/20 animate-pulse-hot">
               <div className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_10px_rgba(34,197,94,0.8)] animate-blink-fast" />
               <span className="text-[10px] font-black text-success uppercase tracking-widest leading-none">AO VIVO</span>
             </div>
          </div>

          <div className="mb-8">
            <h3 className="text-xl font-bold text-text-main font-heading uppercase tracking-tight">Funil em Tempo Real</h3>
            <p className="text-sm text-text-muted">Distribuição atual de todos os leads por etapa do funil</p>
          </div>

          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnelData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-muted)" fontSize={12} fontWeight="bold" />
                <YAxis hide />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '12px' }}
                />
                <Bar dataKey="value" radius={[8, 8, 8, 8]} barSize={120} animationBegin={0} animationDuration={1500}>
                  {funnelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-5 gap-2 mt-4 px-4">
            {funnelData.map((item, idx) => (
              <div key={idx} className="text-center">
                <p className="text-xl font-black text-text-main leading-tight">{item.value}</p>
                <div className="w-8 h-1 mx-auto mt-1 rounded-full" style={{ backgroundColor: item.fill }} />
              </div>
            ))}
          </div>
        </Card>

        {/* Evolution Chart */}
        <Card className="p-6">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-text-main font-heading">Evolução Diária de Leads</h3>
            <p className="text-sm text-text-muted">Quantidade de leads recebidos por dia no período selecionado</p>
          </div>
          <div className="h-[350px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={evolutionData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorHot" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--hot)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--hot)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: '12px' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" />
                <Area type="monotone" dataKey="total" stroke="#8884d8" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={3} name="Total de Leads" />
                <Area type="monotone" dataKey="quentes" stroke="var(--hot)" fillOpacity={1} fill="url(#colorHot)" strokeWidth={3} name="Leads Quentes" />
                <Line type="monotone" dataKey="encaminhados" stroke="var(--primary)" strokeWidth={3} dot={{ strokeWidth: 2, r: 4 }} name="Encaminhados" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Side by Side Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3 p-6 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-text-main font-heading">Dias com mais movimento</h3>
              <p className="text-xs text-text-muted">Em quais dias da semana você recebe mais leads</p>
            </div>
            <div className="h-[250px] mt-auto">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekdayData}>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} contentStyle={{ backgroundColor: 'var(--bg-card)', borderRadius: '12px', border: 'none' }} />
                  <Bar dataKey="leads" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="lg:col-span-2 p-6 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-text-main font-heading">Horário dos contatos</h3>
              <p className="text-xs text-text-muted">Leads recebidos dentro e fora do horário comercial</p>
            </div>
            <div className="h-[200px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={businessHoursData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={8} dataKey="value">
                    {businessHoursData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-text-main">{filteredLeads.length}</span>
                <span className="text-[10px] text-text-muted uppercase">Leads</span>
              </div>
            </div>
            <div className="mt-6 flex justify-center gap-6">
              {businessHoursData.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-main">{item.value}</span>
                    <span className="text-[10px] text-text-muted">{item.name}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* AI Automation Banner */}
        <div className={`p-6 border-l-4 rounded-xl flex items-center gap-6 animate-in fade-in slide-in-from-left-4 duration-700 ${
          company?.automacao_ativa ? 'bg-success/10 border-success' : 'bg-primary/10 border-primary'
        }`}>
          <div className={`p-4 rounded-2xl text-white shadow-lg ${
            company?.automacao_ativa ? 'bg-success shadow-success/30' : 'bg-primary shadow-primary/30'
          }`}>
            {company?.automacao_ativa ? <CheckCircle size={32} /> : <Bot size={32} />}
          </div>
          <div className="flex-1">
            <h4 className={`text-lg font-bold mb-1 ${company?.automacao_ativa ? 'text-success' : 'text-primary'}`}>
              {company?.automacao_ativa ? 'Automação Total Ativa' : 'Oportunidade Recuperada pelo Agente'}
            </h4>
            <p className="text-sm text-text-main/80 leading-relaxed max-w-3xl">
              {company?.automacao_ativa ? (
                <>O Agente de IA está operando 24/7, qualificando leads e registrando interações automaticamente.</>
              ) : (
                <><strong>{foraHorarioCount} pessoas</strong> tentaram falar fora do horário comercial. Ative a automação para responder instantaneamente.</>
              )}
            </p>
          </div>
          <Button 
            variant={company?.automacao_ativa ? 'secondary' : 'primary'} 
            className="hidden md:flex gap-2"
            onClick={handleToggleAutomation}
            isLoading={isToggling}
          >
            {company?.automacao_ativa ? 'Pausar Automação' : 'Ativar Automação Total'} 
            {!company?.automacao_ativa && <ArrowRight size={18} />}
          </Button>
        </div>

        {/* Products and Hot Leads */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-bold text-text-main font-heading mb-6">Produtos mais procurados</h3>
            <div className="space-y-4">
              {productsData.length > 0 ? productsData.map((p, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold px-1">
                    <span className="text-text-main">{p.name}</span>
                    <span className="text-text-muted">{p.value} leads</span>
                  </div>
                  <div className="w-full bg-bg-base h-2.5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all duration-1000" style={{ width: `${(p.value / (productsData[0]?.value || 1)) * 100}%`, opacity: 1 - idx * 0.1 }} />
                  </div>
                </div>
              )) : (
                <p className="text-sm text-text-muted text-center py-8">Nenhum produto registrado ainda.</p>
              )}
            </div>
          </Card>

          <Card className="p-6 overflow-hidden relative">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-text-main font-heading">Leads Prioritários (Tempo Real)</h3>
              <div className="flex items-center gap-2">
                <Zap size={18} className="text-primary animate-blink-fast" />
                <Flame size={20} className="text-hot animate-pulse" />
              </div>
            </div>
            <div className="divide-y divide-border-card">
              {recentHotLeads.length > 0 ? (
                recentHotLeads.map((lead) => (
                  <div 
                    key={lead.id} 
                    className={`py-4 flex items-center justify-between group cursor-pointer relative transition-all hover:bg-primary/5 px-2 rounded-xl border border-transparent hover:border-primary/20 ${lead.score && lead.score > 90 ? 'bg-primary/5 border-primary/10' : ''}`}
                    onClick={() => setSelectedLead(lead)}
                  >
                    <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-primary font-bold shadow-md ${lead.score && lead.score > 90 ? 'bg-primary text-white scale-110 !shadow-primary/30' : 'bg-primary/10'}`}>
                        {lead.nome?.[0] || <Users size={18} />}
                      </div>
                      <div>
                        <p className={`text-sm font-bold group-hover:text-primary transition-colors ${lead.score && lead.score > 90 ? 'text-primary' : 'text-text-main'}`}>
                          {lead.nome || lead.whatsapp}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="muted" className="text-[10px] py-0">{lead.origem || 'WhatsApp'}</Badge>
                          <span className="text-[10px] text-text-muted italic">• {formatDistanceToNow(new Date(lead.horario_contato || lead.created_at || new Date()), { addSuffix: true, locale: ptBR })}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 mb-1">
                          <span className={`text-[10px] font-black tabular-nums transition-colors ${lead.score && lead.score > 90 ? 'text-primary animate-pulse' : 'text-text-muted'}`}>
                            {lead.score || 0}%
                          </span>
                          <ScoreBar score={lead.score || 0} className="w-16 h-1" />
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-tighter ${lead.score && lead.score > 90 ? 'text-primary' : 'text-hot'}`}>
                          {lead.score && lead.score > 90 ? 'Urgência Máxima' : 'Lead Quente'}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, lead.id)}
                        className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all"
                        title="Excluir Lead"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center opacity-30">
                  <Flame size={48} className="mx-auto mb-4" />
                  <p className="text-sm">Nenhum lead prioritário no momento.</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <DrawerLead 
        lead={selectedLead}
        isOpen={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={fetchDashboardData}
        onEdit={(lead) => {
          setLeadToEdit(lead)
          setIsModalOpen(true)
          setSelectedLead(null)
        }}
      />

      <LeadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={fetchDashboardData}
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
