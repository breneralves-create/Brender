import React, { useState, useEffect } from 'react'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import {
  Settings,
  Users as UsersIcon,
  Key,
  FileCode,
  Plus,
  Trash2,
  Copy,
  Check,
  Upload,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useCompany } from '../contexts/CompanyContext'
import type { BusinessHours, LeadScoreConfig, ApiToken, UserProfile } from '../types'

type Tab = 'geral' | 'usuarios' | 'tokens' | 'referencia'

export const Configuracoes: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('geral')
  const { company, scoreConfig, businessHours, refreshCompany } = useCompany()

  // ==============================
  // Estado Global da Página
  // ==============================
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [copied, setCopied] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Empresa
  const [companyName, setCompanyName] = useState('')
  const [logoPreview, setLogoPreview] = useState<string | null>(null)

  // Score
  const [scoreConfigLocal, setScoreConfigLocal] = useState<LeadScoreConfig>({
    id: scoreConfig?.id || 0,
    score_minimo_morno: scoreConfig?.score_minimo_morno || 40,
    score_minimo_quente: scoreConfig?.score_minimo_quente || 70,
    updated_at: scoreConfig?.updated_at || ''
  })

  // Horários
  const [hoursLocal, setHoursLocal] = useState<BusinessHours[]>([])

  // Usuários
  const [allUsers, setAllUsers] = useState<UserProfile[]>([])
  const [isUserModalOpen, setIsUserModalOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')

  // Tokens
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [isRevealTokenModalOpen, setIsRevealTokenModalOpen] = useState(false)
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [revealedToken, setRevealedToken] = useState('')

  // ==============================
  // Sync com contexto
  // ==============================
  useEffect(() => {
    if (company) {
      setCompanyName(company.nome)
      setLogoPreview(company.logo_url)
    }
  }, [company])

  useEffect(() => {
    if (scoreConfig) setScoreConfigLocal(scoreConfig)
  }, [scoreConfig])

  useEffect(() => {
    if (businessHours.length > 0) setHoursLocal(businessHours)
  }, [businessHours])

  useEffect(() => {
    fetchUsers()
    fetchTokens()
  }, [])

  // ==============================
  // Fetchers
  // ==============================
  const fetchUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('created_at', { ascending: false })
    if (data) setAllUsers(data as UserProfile[])
  }

  const fetchTokens = async () => {
    const { data } = await supabase.from('api_tokens').select('*').order('created_at', { ascending: false })
    if (data) setTokens(data)
  }

  // ==============================
  // Helpers
  // ==============================
  const triggerToast = (status: 'success' | 'error') => {
    setSaveStatus(status)
    setTimeout(() => setSaveStatus('idle'), 3000)
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const updateHourField = (idx: number, field: keyof BusinessHours, value: unknown) => {
    const newHours = [...hoursLocal]
    newHours[idx] = { ...newHours[idx], [field]: value }
    setHoursLocal(newHours)
  }

  // ==============================
  // Actions — Geral
  // ==============================
  const saveCompanyName = async () => {
    setIsSaving(true)
    const { error } = await supabase
      .from('company_config')
      .update({ nome: companyName })
      .eq('id', company?.id)
    setIsSaving(false)
    if (error) triggerToast('error')
    else { refreshCompany(); triggerToast('success') }
  }

  const saveScoreConfig = async () => {
    setIsSaving(true)
    const { error } = await supabase
      .from('lead_score_config')
      .update({
        score_minimo_morno: scoreConfigLocal.score_minimo_morno,
        score_minimo_quente: scoreConfigLocal.score_minimo_quente
      })
      .eq('id', scoreConfig?.id)
    setIsSaving(false)
    if (error) triggerToast('error')
    else { refreshCompany(); triggerToast('success') }
  }

  const saveBusinessHours = async () => {
    setIsSaving(true)
    const upsertData = hoursLocal.map(h => ({
      id: h.id,
      dia: h.dia,
      aberto: h.aberto,
      hora_inicio: h.aberto ? (h.hora_inicio || null) : null,
      hora_fim: h.aberto ? (h.hora_fim || null) : null,
    }))
    const { error } = await supabase
      .from('business_hours')
      .upsert(upsertData, { onConflict: 'dia' })
    setIsSaving(false)
    if (error) triggerToast('error')
    else { refreshCompany(); triggerToast('success') }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `logos/company_${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('company-assets').upload(filePath, file)
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(filePath)
      const { error: updateError } = await supabase.from('company_config').update({ logo_url: publicUrl }).eq('id', company?.id)
      if (updateError) throw updateError
      setLogoPreview(publicUrl)
      refreshCompany()
      triggerToast('success')
    } catch (err) {
      console.error(err)
      triggerToast('error')
    } finally {
      setIsUploading(false)
    }
  }

  // ==============================
  // Actions — Tokens
  // ==============================
  const generateToken = async () => {
    if (!newTokenLabel) return
    setIsSaving(true)
    const rawToken = `tk_prod_${crypto.randomUUID().replace(/-/g, '')}`
    const { error } = await supabase.from('api_tokens').insert({
      label: newTokenLabel,
      token_hash: rawToken,
      ativo: true
    })
    setIsSaving(false)
    if (error) triggerToast('error')
    else {
      setRevealedToken(rawToken)
      setIsTokenModalOpen(false)
      setIsRevealTokenModalOpen(true)
      setNewTokenLabel('')
      fetchTokens()
    }
  }

  const disableToken = async (tokenId: string) => {
    const { error } = await supabase.from('api_tokens').update({ ativo: false }).eq('id', tokenId)
    if (!error) fetchTokens()
  }

  // ==============================
  // Actions — Usuários
  // ==============================
  const createUser = async () => {
    if (!newUserEmail) return
    setIsSaving(true)
    // O trigger on_auth_user_created insere automaticamente em public.users
    const { error } = await supabase.auth.signUp({
      email: newUserEmail,
      password: crypto.randomUUID(),
    })
    setIsSaving(false)
    if (error) triggerToast('error')
    else {
      setIsUserModalOpen(false)
      setNewUserEmail('')
      triggerToast('success')
      setTimeout(fetchUsers, 1200)
    }
  }

  // ==============================
  // Render Sections
  // ==============================
  const renderGeral = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Identidade */}
      <Card title="Identidade da Empresa" subtitle="Configure o nome e a marca que aparecerão no painel.">
        <div className="space-y-6">
          <Input
            label="Nome da Empresa"
            value={companyName}
            onChange={e => setCompanyName(e.target.value)}
          />
          <div className="space-y-2">
            <p className="text-sm font-medium text-text-muted">Logo da Empresa</p>
            <div className="flex items-center gap-6 p-4 bg-bg-base/50 rounded-lg border border-border-card border-dashed">
              <div className="w-24 h-24 bg-bg-card rounded-lg border border-border-card flex items-center justify-center overflow-hidden">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                  : <Upload className="text-text-muted opacity-30" size={32} />
                }
              </div>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" onChange={handleLogoUpload} accept="image/*" disabled={isUploading} />
                    <Button variant="secondary" size="sm" as="span" isLoading={isUploading}>
                      {logoPreview ? 'Alterar Logo' : 'Upload Logo'}
                    </Button>
                  </label>
                  {logoPreview && (
                    <Button
                      variant="ghost" size="sm"
                      onClick={async () => {
                        const { error } = await supabase.from('company_config').update({ logo_url: null }).eq('id', company?.id)
                        if (!error) { setLogoPreview(null); refreshCompany() }
                      }}
                      className="text-error hover:bg-error/10"
                    >
                      Remover
                    </Button>
                  )}
                </div>
                <p className="text-xs text-text-muted">PNG, JPG ou SVG. Máximo 2MB.</p>
              </div>
            </div>
          </div>
          <div className="pt-4 border-t border-border-card flex justify-end">
            <Button onClick={saveCompanyName} isLoading={isSaving}>Salvar Alterações</Button>
          </div>
        </div>
      </Card>

      {/* Score Config */}
      <Card title="Configuração de Temperatura" subtitle="Defina os limites de score para qualificação automática.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Input
            label="Score Mínimo para Morno"
            type="number"
            value={scoreConfigLocal.score_minimo_morno}
            onChange={e => setScoreConfigLocal({ ...scoreConfigLocal, score_minimo_morno: Number(e.target.value) })}
          />
          <Input
            label="Score Mínimo para Quente"
            type="number"
            value={scoreConfigLocal.score_minimo_quente}
            onChange={e => setScoreConfigLocal({ ...scoreConfigLocal, score_minimo_quente: Number(e.target.value) })}
          />
        </div>
        <div className="mt-8 pt-4 border-t border-border-card flex justify-end">
          <Button onClick={saveScoreConfig} isLoading={isSaving}>Salvar Configuração de Score</Button>
        </div>
      </Card>

      {/* Horário Comercial */}
      <Card title="Horário Comercial" subtitle="Defina quando o sistema encaminha leads automaticamente.">
        <div className="space-y-4">
          {(['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'] as const).map((diaNome, idx) => {
            const labels = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
            const h = hoursLocal.find(hour => hour.dia === diaNome)
            if (!h) return null
            const hIdx = hoursLocal.indexOf(h)
            return (
              <div key={diaNome} className="flex items-center justify-between p-3 bg-bg-base/30 rounded-lg hover:bg-bg-base/50 transition-colors">
                <span className="font-medium w-24">{labels[idx]}</span>
                <div className="flex items-center gap-4">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-primary"
                    checked={h.aberto}
                    onChange={e => updateHourField(hIdx, 'aberto', e.target.checked)}
                  />
                  <div className={`flex items-center gap-2 transition-opacity ${h.aberto ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                    <input
                      type="time"
                      className="bg-bg-card border border-border-card rounded p-1 text-sm outline-none focus:border-primary"
                      value={(h.hora_inicio || '').substring(0, 5)}
                      onChange={e => updateHourField(hIdx, 'hora_inicio', e.target.value)}
                    />
                    <span className="text-text-muted">—</span>
                    <input
                      type="time"
                      className="bg-bg-card border border-border-card rounded p-1 text-sm outline-none focus:border-primary"
                      value={(h.hora_fim || '').substring(0, 5)}
                      onChange={e => updateHourField(hIdx, 'hora_fim', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-8 pt-4 border-t border-border-card flex justify-end">
          <Button onClick={saveBusinessHours} isLoading={isSaving}>Salvar Horários</Button>
        </div>
      </Card>
    </div>
  )

  const renderUsuarios = () => (
    <Card title="Usuários do Sistema" headerAction={
      <Button icon={<Plus size={18} />} onClick={() => setIsUserModalOpen(true)}>Novo Usuário</Button>
    }>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border-card text-text-muted text-sm uppercase tracking-wider">
              <th className="px-4 py-4 font-semibold">Usuário</th>
              <th className="px-4 py-4 font-semibold">Role</th>
              <th className="px-4 py-4 font-semibold">Cadastrado em</th>
              <th className="px-4 py-4 font-semibold text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-card/50">
            {allUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-text-muted">
                  Nenhum usuário cadastrado ainda.
                </td>
              </tr>
            ) : allUsers.map(user => (
              <tr key={user.id} className="hover:bg-bg-base/30 transition-colors">
                <td className="px-4 py-4">
                  <div>
                    <p className="font-medium text-text-main">{user.name || 'Sem nome'}</p>
                    <p className="text-xs text-text-muted font-mono opacity-50">{user.id.substring(0, 20)}...</p>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <Badge variant={user.role === 'admin' ? 'primary' : 'muted'}>
                    {user.role === 'admin' ? 'Admin' : 'Vendedor'}
                  </Badge>
                </td>
                <td className="px-4 py-4 text-sm text-text-muted">
                  {new Date(user.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-4 text-right">
                  <button className="p-2 text-text-muted hover:text-error transition-colors" title="Remover">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )

  const renderTokens = () => (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg flex items-start gap-4 text-primary">
        <AlertCircle className="mt-1 flex-shrink-0" />
        <p className="text-sm">
          Os tokens são necessários para todas as chamadas de API via N8N ou integração externa.
          Gere um novo token e salve o valor em local seguro — <strong>ele só é exibido uma vez</strong>.
        </p>
      </div>

      <Card title="Tokens de API" headerAction={
        <Button icon={<Plus size={18} />} onClick={() => setIsTokenModalOpen(true)}>Novo Token</Button>
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border-card text-text-muted text-sm uppercase tracking-wider">
                <th className="px-4 py-4 font-semibold">Label</th>
                <th className="px-4 py-4 font-semibold">Status</th>
                <th className="px-4 py-4 font-semibold">Criado em</th>
                <th className="px-4 py-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card/50">
              {tokens.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-text-muted">Nenhum token cadastrado.</td></tr>
              ) : tokens.map(token => (
                <tr key={token.id} className="hover:bg-bg-base/30 transition-colors">
                  <td className="px-4 py-4 font-medium text-text-main">{token.label}</td>
                  <td className="px-4 py-4">
                    <Badge variant={token.ativo ? 'success' : 'muted'}>
                      {token.ativo ? 'Ativo' : 'Desabilitado'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-sm text-text-muted">
                    {new Date(token.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {token.ativo && (
                      <Button variant="danger" size="sm" onClick={() => disableToken(token.id)}>
                        Desabilitar
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )

  const renderReferencia = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-bold font-heading text-text-main">Referência para Integração</h2>
        <p className="text-text-muted mt-1">Use os valores abaixo para atualizar leads via N8N ou agente de IA.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card title="Status do Lead" noPadding>
          <div className="divide-y divide-border-card">
            {[
              ['Novo Contato', 'novo_contato'],
              ['Em Qualificação', 'em_qualificacao'],
              ['Quente', 'quente'],
              ['Morno', 'morno'],
              ['Frio', 'frio'],
              ['Encaminhado', 'encaminhado'],
              ['Primeiro Contato', 'primeiro_contato'],
              ['Proposta Enviada', 'proposta_enviada'],
              ['Follow Up', 'follow_up'],
              ['Convertido', 'convertido'],
              ['Sem Interesse', 'sem_interesse'],
              ['Fora do Horário', 'fora_horario'],
            ].map(([label, value]) => (
              <div key={value} className="px-6 py-3 flex items-center justify-between group">
                <span className="font-medium text-sm">{label}</span>
                <div className="flex items-center gap-3">
                  <code className="bg-bg-base/50 px-2 py-1 rounded text-primary text-xs font-mono">{value}</code>
                  <button onClick={() => handleCopy(value)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-primary">
                    <Copy size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Campos de Qualificação" noPadding>
          <div className="divide-y divide-border-card">
            {[
              ['score', 'integer (0–100) — temperatura automática'],
              ['temperatura', 'quente | morno | frio (auto)'],
              ['produto_interesse', 'text'],
              ['resumo_conversa', 'text'],
              ['intencao_compra', 'alta | media | baixa'],
              ['urgencia', 'imediato | curto_prazo | sem_urgencia'],
              ['orcamento_informado', 'boolean'],
              ['encaminhado_vendedor', 'boolean (trigger valida)'],
              ['valor_pago', 'numeric(10,2) — R$'],
            ].map(([label, type]) => (
              <div key={label} className="px-6 py-3 flex items-center justify-between group">
                <div>
                  <span className="font-bold text-sm text-text-main">{label}</span>
                  <p className="text-[10px] text-text-muted uppercase tracking-tighter">{type}</p>
                </div>
                <button onClick={() => handleCopy(label)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-muted hover:text-primary">
                  <Copy size={14} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )

  // ==============================
  // Render
  // ==============================
  return (
    <Layout title="Configurações">
      {/* Tabs */}
      <div className="mb-8 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-2">
          {[
            { id: 'geral', label: 'Geral', icon: Settings },
            { id: 'usuarios', label: 'Usuários', icon: UsersIcon },
            { id: 'tokens', label: 'Token de API', icon: Key },
            { id: 'referencia', label: 'Referência Técnica', icon: FileCode }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-button font-medium transition-all
                ${activeTab === tab.id
                  ? 'bg-primary text-[#0F1117] shadow-lg shadow-primary/20'
                  : 'text-text-muted hover:text-text-main hover:bg-bg-card'}
              `}
            >
              <tab.icon size={20} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="relative">
        {activeTab === 'geral' && renderGeral()}
        {activeTab === 'usuarios' && renderUsuarios()}
        {activeTab === 'tokens' && renderTokens()}
        {activeTab === 'referencia' && renderReferencia()}

        {/* Toast global */}
        {saveStatus !== 'idle' && (
          <div className={`
            fixed bottom-8 right-8 px-6 py-3 rounded-card shadow-2xl flex items-center gap-3 z-50
            ${saveStatus === 'success'
              ? 'bg-success/10 border border-success/20 text-success'
              : 'bg-error/10 border border-error/20 text-error'}
          `}>
            {saveStatus === 'success' ? <Check size={20} /> : <AlertCircle size={20} />}
            <span className="font-bold">
              {saveStatus === 'success' ? 'Configurações salvas!' : 'Erro ao salvar. Tente novamente.'}
            </span>
          </div>
        )}
      </div>

      {/* Copy toast */}
      {copied && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-primary text-bg-base px-6 py-3 rounded-badge font-bold shadow-lg flex items-center gap-2 z-50">
          <Check size={20} /> Copiado!
        </div>
      )}

      {/* Modal: Novo Usuário */}
      <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title="Convidar Novo Usuário">
        <div className="space-y-4">
          <Input
            label="E-mail"
            placeholder="usuario@empresa.com"
            value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)}
          />
          <p className="text-xs text-text-muted">
            Um e-mail de boas-vindas será enviado. O trigger do banco criará o registro automaticamente.
          </p>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsUserModalOpen(false)}>Cancelar</Button>
            <Button onClick={createUser} isLoading={isSaving}>Enviar Convite</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Gerar Token */}
      <Modal isOpen={isTokenModalOpen} onClose={() => setIsTokenModalOpen(false)} title="Gerar Novo Token de API">
        <div className="space-y-4">
          <Input
            label="Label do Token"
            placeholder="Ex: N8N Produção"
            value={newTokenLabel}
            onChange={e => setNewTokenLabel(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="ghost" onClick={() => setIsTokenModalOpen(false)}>Cancelar</Button>
            <Button onClick={generateToken} isLoading={isSaving}>Gerar Token</Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Revelar Token */}
      <Modal isOpen={isRevealTokenModalOpen} onClose={() => setIsRevealTokenModalOpen(false)} title="Token Gerado com Sucesso!">
        <div className="space-y-6">
          <div className="bg-warning/10 border border-warning/20 p-4 rounded-lg flex items-start gap-4 text-warning">
            <AlertCircle size={24} className="flex-shrink-0" />
            <p className="text-sm font-medium">
              Copie agora — este token não será exibido novamente por motivos de segurança.
            </p>
          </div>
          <div className="relative group">
            <div className="bg-bg-base border border-border-card p-4 rounded-lg font-mono text-primary break-all pr-14 text-sm">
              {revealedToken}
            </div>
            <button
              onClick={() => handleCopy(revealedToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-primary transition-colors"
            >
              <Copy size={20} />
            </button>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsRevealTokenModalOpen(false)}>Entendido, Fechar</Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
