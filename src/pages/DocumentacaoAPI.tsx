import React, { useState, useEffect, useMemo } from 'react'
import { 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink, 
  BookOpen, 
  Code2, 
  AlertCircle,
  Hash,
  Info,
  Plus
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Layout } from '../components/layout/Layout'
import { Card } from '../components/ui/Card'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { Input } from '../components/ui/Input'
import type { ApiToken } from '../types'

// --- Types & Interfaces ---

interface Parameter {
  campo: string
  tipo: string
  obrigatorio: boolean
  desc: string
  onde?: 'Body' | 'URL' | 'Query'
}

interface ErrorResponse {
  http: string
  situacao: string
  motivo: string
}

interface Endpoint {
  id: string
  metodo: 'POST' | 'PUT' | 'GET' | 'DELETE'
  titulo: string
  desc: string
  parametros: Parameter[]
  curl: string
  resposta: string
  erros: ErrorResponse[]
}

// --- Constants & Data ---

const ENDPOINTS: Endpoint[] = [
  {
    id: 'registrar-lead',
    metodo: 'POST',
    titulo: 'Registrar Lead',
    desc: 'Cria um novo lead no sistema a partir de um contato recebido no WhatsApp. Deve ser chamado pelo agente de IA assim que o primeiro contato for identificado.',
    parametros: [
      { campo: 'whatsapp', tipo: 'String', obrigatorio: true, desc: 'Número com DDI+DDD, somente dígitos (ex: 5527999990000)' },
      { campo: 'nome', tipo: 'String', obrigatorio: false, desc: 'Nome informado pelo lead durante a conversa' },
      { campo: 'produto_interesse', tipo: 'String', obrigatorio: false, desc: 'Produto ou serviço de interesse identificado' },
      { campo: 'origem', tipo: 'String', obrigatorio: false, desc: 'Canal de entrada: instagram, google, tiktok, indicacao, etc.' },
      { campo: 'cidade', tipo: 'String', obrigatorio: false, desc: 'Cidade informada pelo lead' },
      { campo: 'horario_contato', tipo: 'String', obrigatorio: false, desc: 'ISO 8601 — se omitido, usa now() automaticamente' },
      { campo: 'dentro_horario_comercial', tipo: 'Boolean', obrigatorio: false, desc: 'Se omitido, calculado automaticamente pelo banco' }
    ],
    curl: `curl -X POST {BASE_URL}/leads \\
  -H "Authorization: Bearer {TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "whatsapp": "5527999990000",
    "nome": "Carlos Souza",
    "produto_interesse": "Painel Ripado",
    "origem": "instagram",
    "cidade": "Vitória"
  }'`,
    resposta: `{
  "sucesso": true,
  "situacao": "LEAD_CRIADO",
  "mensagem": "Lead registrado com sucesso.",
  "lead": {
    "id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
    "whatsapp": "5527999990000",
    "nome": "Carlos Souza",
    "produto_interesse": "Painel Ripado",
    "origem": "instagram",
    "cidade": "Vitória",
    "status": "novo_contato",
    "temperatura": null,
    "score": null,
    "dentro_horario_comercial": true,
    "horario_contato": "2025-04-01T10:30:00-03:00",
    "created_at": "2025-04-01T10:30:00-03:00"
  }
}`,
    erros: [
      { http: '201', situacao: 'LEAD_CRIADO', motivo: 'Lead registrado com sucesso' },
      { http: '200', situacao: 'LEAD_JA_EXISTE', motivo: 'WhatsApp já cadastrado — retorna o lead existente' },
      { http: '401', situacao: 'TOKEN_INVALIDO', motivo: 'Token ausente ou inválido' },
      { http: '422', situacao: 'CAMPO_OBRIGATORIO_AUSENTE', motivo: 'Campo whatsapp não informado' }
    ]
  },
  {
    id: 'atualizar-qualificacao',
    metodo: 'PUT',
    titulo: 'Atualizar Qualificação do Lead',
    desc: 'Atualiza os dados de qualificação de um lead após a conversa com o agente de IA. Deve ser chamado ao final da conversa com o score, temperatura e resumo.',
    parametros: [
      { campo: ':id', tipo: 'UUID', obrigatorio: true, desc: 'ID do lead na URL', onde: 'URL' },
      { campo: 'score', tipo: 'Number', obrigatorio: false, desc: 'Número inteiro de 0 a 100', onde: 'Body' },
      { campo: 'temperatura', tipo: 'String', obrigatorio: false, desc: 'quente, morno ou frio', onde: 'Body' },
      { campo: 'status', tipo: 'String', obrigatorio: false, desc: 'Novo status do lead', onde: 'Body' },
      { campo: 'resumo_conversa', tipo: 'String', obrigatorio: false, desc: 'Resumo gerado pela IA', onde: 'Body' },
      { campo: 'intencao_compra', tipo: 'String', obrigatorio: false, desc: 'alta, media ou baixa', onde: 'Body' }
    ],
    curl: `curl -X PUT {BASE_URL}/leads/UUID_DO_LEAD \\
  -H "Authorization: Bearer {TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "score": 82,
    "status": "quente",
    "resumo_conversa": "Cliente demonstrou forte interesse em Painel Ripado...",
    "intencao_compra": "alta",
    "urgencia": "imediato",
    "orcamento_informado": true
  }'`,
    resposta: `{
  "sucesso": true,
  "situacao": "LEAD_ATUALIZADO",
  "mensagem": "Qualificação do lead atualizada com sucesso.",
  "lead": {
    "id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
    "score": 82,
    "temperatura": "quente",
    "status": "quente"
  }
}`,
    erros: [
      { http: '200', situacao: 'LEAD_ATUALIZADO', motivo: 'Qualificação atualizada com sucesso' },
      { http: '404', situacao: 'LEAD_NAO_ENCONTRADO', motivo: 'UUID do lead não existe' },
      { http: '422', situacao: 'SCORE_INVALIDO', motivo: 'Score fora do intervalo 0–100' }
    ]
  },
  {
    id: 'registrar-interacao',
    metodo: 'POST',
    titulo: 'Registrar Interação (Mensagem)',
    desc: 'Registra uma mensagem ou resposta na tabela interacoes, mantendo o histórico completo da conversa vinculado ao lead.',
    parametros: [
      { campo: 'lead_id', tipo: 'UUID', obrigatorio: true, desc: 'ID do lead ao qual a interação pertence' },
      { campo: 'tipo', tipo: 'String', obrigatorio: true, desc: 'mensagem_lead, resposta_agente ou nota_vendedor' },
      { campo: 'conteudo', tipo: 'String', obrigatorio: true, desc: 'Texto da mensagem ou nota' }
    ],
    curl: `curl -X POST {BASE_URL}/interacoes \\
  -H "Authorization: Bearer {TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_id": "UUID_DO_LEAD",
    "tipo": "mensagem_lead",
    "conteudo": "Olá, gostaria de saber o preço do Painel Ripado"
  }'`,
    resposta: `{
  "sucesso": true,
  "situacao": "INTERACAO_REGISTRADA",
  "mensagem": "Interação registrada com sucesso."
}`,
    erros: [
      { http: '201', situacao: 'INTERACAO_REGISTRADA', motivo: 'Interação registrada com sucesso' },
      { http: '404', situacao: 'LEAD_NAO_ENCONTRADO', motivo: 'lead_id não existe' }
    ]
  },
  {
    id: 'criar-followup',
    metodo: 'POST',
    titulo: 'Criar Follow-up',
    desc: 'Agenda um follow-up para um lead. Pode ser criado automaticamente pelo agente de IA quando o lead solicitar contato futuro.',
    parametros: [
      { campo: 'lead_id', tipo: 'UUID', obrigatorio: true, desc: 'ID do lead para o follow-up' },
      { campo: 'agendado_para', tipo: 'String', obrigatorio: true, desc: 'ISO 8601 — data e hora do follow-up' },
      { campo: 'motivo', tipo: 'String', obrigatorio: true, desc: 'Motivo do follow-up (ex: "Pediu retorno em 3 dias")' }
    ],
    curl: `curl -X POST {BASE_URL}/follow-ups \\
  -H "Authorization: Bearer {TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "lead_id": "UUID_DO_LEAD",
    "agendado_para": "2025-04-05T10:00:00-03:00",
    "motivo": "Cliente pediu retorno após ver os materiais"
  }'`,
    resposta: `{
  "sucesso": true,
  "situacao": "FOLLOWUP_CRIADO",
  "mensagem": "Follow-up agendado com sucesso."
}`,
    erros: [
      { http: '201', situacao: 'FOLLOWUP_CRIADO', motivo: 'Follow-up agendado com sucesso' },
      { http: '422', situacao: 'DATA_PASSADA', motivo: 'Data informada já passou' }
    ]
  },
  {
    id: 'atualizar-followup',
    metodo: 'PUT',
    titulo: 'Atualizar Follow-up',
    desc: 'Marca um follow-up como realizado ou atualiza sua data.',
    parametros: [
      { campo: ':id', tipo: 'UUID', obrigatorio: true, desc: 'ID do follow-up na URL', onde: 'URL' },
      { campo: 'realizado', tipo: 'Boolean', obrigatorio: false, desc: 'true para marcar como realizado', onde: 'Body' },
      { campo: 'agendado_para', tipo: 'String', obrigatorio: false, desc: 'Nova data se reagendado', onde: 'Body' }
    ],
    curl: `curl -X PUT {BASE_URL}/follow-ups/UUID_DO_FOLLOWUP \\
  -H "Authorization: Bearer {TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "realizado": true
  }'`,
    resposta: `{
  "sucesso": true,
  "situacao": "FOLLOWUP_ATUALIZADO",
  "mensagem": "Follow-up atualizado com sucesso."
}`,
    erros: [
      { http: '200', situacao: 'FOLLOWUP_ATUALIZADO', motivo: 'Follow-up atualizado com sucesso' },
      { http: '404', situacao: 'FOLLOWUP_NAO_ENCONTRADO', motivo: 'UUID do follow-up não existe' }
    ]
  },
  {
    id: 'encaminhar-vendedor',
    metodo: 'PUT',
    titulo: 'Encaminhar ao Vendedor',
    desc: 'Marca um lead como encaminhado ao WhatsApp do vendedor. Chamado após identificar que o lead é Quente.',
    parametros: [
      { campo: ':id', tipo: 'UUID', obrigatorio: true, desc: 'ID do lead na URL', onde: 'URL' },
      { campo: 'data_encaminhamento', tipo: 'String', obrigatorio: false, desc: 'ISO 8601 — omitir para usar now()', onde: 'Body' }
    ],
    curl: `curl -X PUT {BASE_URL}/leads/UUID_DO_LEAD/encaminhar \\
  -H "Authorization: Bearer {TOKEN}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data_encaminhamento": "2025-04-01T10:40:00-03:00"
  }'`,
    resposta: `{
  "sucesso": true,
  "situacao": "LEAD_ENCAMINHADO",
  "mensagem": "Lead encaminhado ao vendedor com sucesso."
}`,
    erros: [
      { http: '200', situacao: 'LEAD_ENCAMINHADO', motivo: 'Lead encaminhado com sucesso' },
      { http: '422', situacao: 'TEMPERATURA_INSUFICIENTE', motivo: 'Lead não é quente' }
    ]
  },
  {
    id: 'consultar-lead',
    metodo: 'GET',
    titulo: 'Consultar Lead',
    desc: 'Consulta os dados completos de um lead pelo UUID ou pelo número de WhatsApp. Útil para o agente verificar se um número já foi atendido antes de iniciar nova qualificação.',
    parametros: [
      { campo: ':id', tipo: 'UUID', obrigatorio: false, desc: 'Consulta por ID (na URL)', onde: 'URL' },
      { campo: 'whatsapp', tipo: 'Query', obrigatorio: false, desc: 'Consulta por WhatsApp (Query)', onde: 'Query' }
    ],
    curl: `curl -X GET "{BASE_URL}/leads/UUID_DO_LEAD" \\
  -H "Authorization: Bearer {TOKEN}"

# Ou via WhatsApp
curl -X GET "{BASE_URL}/leads?whatsapp=5527999990000" \\
  -H "Authorization: Bearer {TOKEN}"`,
    resposta: `// Lead encontrado (200)
{
  "sucesso": true,
  "situacao": "LEAD_ENCONTRADO",
  "lead": {
    "id": "a1b2c3d4-1234-5678-abcd-ef0123456789",
    "whatsapp": "5527999990000",
    "nome": "Carlos Souza",
    "status": "quente",
    "score": 82
  }
}

// Lead não encontrado (200)
{
  "sucesso": false,
  "situacao": "LEAD_NAO_ENCONTRADO",
  "mensagem": "Nenhum lead encontrado com este WhatsApp."
}`,
    erros: [
      { http: '200', situacao: 'LEAD_ENCONTRADO', motivo: 'Lead retornado com sucesso' },
      { http: '200', situacao: 'LEAD_NAO_ENCONTRADO', motivo: 'Nenhum lead com esse ID ou WhatsApp' },
      { http: '401', situacao: 'TOKEN_INVALIDO', motivo: 'Token ausente ou inválido' }
    ]
  }
]

// --- Helper Components ---

const CodeBlock: React.FC<{ code: string, title?: string, language?: string, type?: string }> = ({ 
  code, 
  title
}) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Syntax highlighting logic
  const renderHighlightedCode = () => {
    // 1. Strings in quotes (simple detection)
    // 2. Automated placeholders {TOKEN}, {BASE_URL}
    // 3. Manual placeholders (UPPERCASE_WITH_UNDERSCORES or UUID_)

    return (
      <code className="block text-[13px] leading-6 font-mono whitespace-pre text-gray-300">
        {code.split('\n').map((line, i) => {
          // This is a very basic replacement for highlighting
          // For a production app, a lib like Prism or Shiki is better, 
          // but here we follow specific styling rules from the prompt.
          
          const elements: React.ReactNode[] = []
          let currentPos = 0
          
          // Regex for:
          // - {TOKEN} and {BASE_URL}
          // - Strings in quotes
          // - Manual placeholders like UUID_DO_LEAD
          const regex = /({TOKEN}|{BASE_URL}|"[^"]*"|[A-Z_]{3,20}(?=[^a-z]))/g
          let match

          while ((match = regex.exec(line)) !== null) {
            // Text before match
            if (match.index > currentPos) {
              elements.push(line.substring(currentPos, match.index))
            }

            const val = match[0]
            if (val === '{TOKEN}' || val === '{BASE_URL}') {
               elements.push(
                 <span key={match.index} className="text-primary-light font-bold bg-primary/20 px-1 rounded flex-inline items-center gap-1">
                   {val}
                   <span className="text-[9px] uppercase bg-primary text-white px-1 rounded ml-1">auto</span>
                 </span>
               )
            } else if (val.startsWith('"')) {
              elements.push(<span key={match.index} className="text-emerald-400">{val}</span>)
            } else if (val.includes('_')) {
              elements.push(
                <span key={match.index} className="text-amber-500 border-b border-dotted border-amber-500 cursor-help" title="Substitua pelo valor real">
                  {val}
                </span>
              )
            } else {
              elements.push(val)
            }
            currentPos = regex.lastIndex
          }

          // Remaining text
          if (currentPos < line.length) {
            elements.push(line.substring(currentPos))
          }

          return <div key={i}>{elements.length > 0 ? elements : line}</div>
        })}
      </code>
    )
  }

  return (
    <div className="relative group rounded-xl overflow-hidden border border-white/5 bg-[#0D0F14] shadow-2xl">
      {title && (
        <div className="px-4 py-2 border-b border-white/5 bg-white/5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{title}</span>
        </div>
      )}
      <div className="p-6 overflow-x-auto custom-scrollbar">
        {renderHighlightedCode()}
      </div>
      <button 
        onClick={handleCopy}
        className="absolute top-4 right-4 p-2 rounded-lg bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-all opacity-0 group-hover:opacity-100"
      >
        {copied ? <Check size={16} className="text-success" /> : <Copy size={16} />}
      </button>
    </div>
  )
}

// --- Main Page Component ---

export const DocumentacaoAPI: React.FC = () => {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null)
  const [activeSection, setActiveSection] = useState('')
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [isRevealTokenModalOpen, setIsRevealTokenModalOpen] = useState(false)
  const [newTokenLabel, setNewTokenLabel] = useState('')
  const [revealedToken, setRevealedToken] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://projeto.supabase.co') + '/functions/v1'

  const fetchTokens = async () => {
    const { data } = await supabase
      .from('api_tokens')
      .select('*')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
    
    if (data) {
      setTokens(data)
      if (data.length > 0) setSelectedToken(data[0])
    }
  }

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
    if (!error) {
      setRevealedToken(rawToken)
      setIsTokenModalOpen(false)
      setIsRevealTokenModalOpen(true)
      setNewTokenLabel('')
      fetchTokens()
    }
  }

  const setupIntersectionObserver = () => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      })
    }, { threshold: 0.5 })

    ENDPOINTS.forEach(ep => {
      const el = document.getElementById(ep.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }

  useEffect(() => {
    fetchTokens()
    setupIntersectionObserver()
  }, [])

  const maskedToken = useMemo(() => {
    if (!selectedToken) return '{TOKEN}'
    const raw = selectedToken.token_hash || '••••••••'
    return `••••••${raw.slice(-8)}`
  }, [selectedToken])

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 100,
        behavior: 'smooth'
      })
    }
  }

  const renderEndpoint = (ep: Endpoint) => {
    const processedCurl = ep.curl
      .replace(/{BASE_URL}/g, baseUrl)
      .replace(/{TOKEN}/g, maskedToken)

    return (
      <section key={ep.id} id={ep.id} className="scroll-mt-32 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Badge 
              variant={ep.metodo === 'POST' ? 'success' : ep.metodo === 'PUT' ? 'info' : 'muted'} 
              className="text-xs font-black uppercase py-1"
            >
              {ep.metodo}
            </Badge>
            <h2 className="text-2xl font-bold font-heading text-text-main">{ep.titulo}</h2>
          </div>
          <p className="text-text-muted leading-relaxed">{ep.desc}</p>
        </div>

        {/* Parameters */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
            <Info size={14} /> Parâmetros
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border-card bg-bg-card/30">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border-card bg-bg-base/30 text-[10px] uppercase font-bold text-text-muted">
                  <th className="px-6 py-4">Campo</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Obrig.</th>
                  <th className="px-6 py-4">Local</th>
                  <th className="px-6 py-4">Descrição</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-card">
                {ep.parametros.map((p, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-mono text-primary-light font-bold">{p.campo}</td>
                    <td className="px-6 py-4 text-text-muted">{p.tipo}</td>
                    <td className="px-6 py-4">
                      {p.obrigatorio ? <Badge variant="hot" className="text-[8px]">SIM</Badge> : <span className="text-text-muted opacity-30">—</span>}
                    </td>
                    <td className="px-6 py-4 font-medium text-xs">{p.onde || 'Body'}</td>
                    <td className="px-6 py-4 text-text-muted text-xs leading-relaxed">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Code Blocks */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
              <Terminal size={14} /> Exemplo cURL
            </h3>
            <CodeBlock code={processedCurl} title="Shell / cURL" />
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted flex items-center gap-2">
              <BookOpen size={14} /> Resposta Sucesso
            </h3>
            <CodeBlock code={ep.resposta} title="JSON Success (200/201)" type="json" />
          </div>
        </div>

        {/* Error Responses */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted">Situações e Erros Possíveis</h4>
          <div className="overflow-x-auto rounded-xl border border-border-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-bg-base/20 text-[10px] uppercase font-bold text-text-muted">
                  <th className="px-6 py-4">HTTP</th>
                  <th className="px-6 py-4">Situação</th>
                  <th className="px-6 py-4">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-card">
                {ep.erros.map((err, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 font-bold">{err.http}</td>
                    <td className="px-6 py-4 font-mono text-xs text-text-main">{err.situacao}</td>
                    <td className="px-6 py-4 text-text-muted text-xs">{err.motivo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-border-card to-transparent w-full my-12" />
      </section>
    )
  }

  return (
    <Layout title="Documentação da API">
      <div className="space-y-12 pb-20 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="space-y-2">
           <h1 className="text-4xl font-bold font-heading text-text-main">Referência Técnica da API</h1>
           <p className="text-text-muted max-w-2xl text-lg">
             Use os endpoints abaixo para integrar seu agente de IA e ferramentas como N8N com o sistema de qualificação de leads.
           </p>
        </div>

        {/* Quick Config Panel */}
        <Card className="p-8 border-primary bg-primary/5 shadow-lg shadow-primary/5">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                 <label className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <Hash size={14} className="text-primary" /> Token Ativo
                   </div>
                   <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={() => setIsTokenModalOpen(true)}>
                     <Plus size={12} className="mr-1" /> NOVO
                   </Button>
                 </label>
                 <select 
                    className="w-full bg-bg-base border border-border-card rounded-button px-4 py-3 text-text-main focus:ring-2 focus:ring-primary/20 outline-none font-medium"
                    value={selectedToken?.id || ''}
                    onChange={(e) => setSelectedToken(tokens.find(t => t.id === e.target.value) || null)}
                 >
                    {tokens.map(t => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                    {tokens.length === 0 && <option disabled>Nenhum token ativo encontrado</option>}
                 </select>
                 <p className="text-[10px] text-text-muted leading-relaxed">
                   <AlertCircle size={10} className="inline mr-1 -mt-0.5" />
                   O token real não é exibido por segurança. Copie o cURL e substitua pelo token completo gerado em <strong>Configurações → Token de API</strong>.
                 </p>
              </div>

              <div className="space-y-3">
                 <label className="text-xs font-black uppercase text-text-muted tracking-widest flex items-center gap-2">
                   <Code2 size={14} className="text-primary" /> Base URL
                 </label>
                 <div className="flex gap-2">
                    <div className="flex-1 bg-bg-base border border-border-card rounded-button px-4 py-3 text-text-main font-mono text-sm overflow-hidden truncate">
                       {baseUrl}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigator.clipboard.writeText(baseUrl)}>
                       <Copy size={16} />
                    </Button>
                 </div>
                 <p className="text-[10px] text-text-muted">
                    URL base para chamadas de API via Edge Functions.
                 </p>
              </div>
           </div>
        </Card>

        {/* Content with Sidebar */}
        <div className="flex flex-col lg:flex-row gap-12 relative">
           {/* Mobile Nav Trigger (could be added if needed, but the list is stackable) */}
           
           {/* Sidebar Navigation */}
           <aside className="lg:w-64 shrink-0 hidden lg:block">
              <div className="sticky top-32 space-y-6">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-text-muted border-b border-border-card pb-2">Navegação</h4>
                 <nav className="flex flex-col gap-1">
                    {ENDPOINTS.map(ep => (
                      <button
                        key={ep.id}
                        onClick={() => scrollToSection(ep.id)}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition-all text-left
                          ${activeSection === ep.id 
                            ? 'bg-primary/10 text-primary border-r-4 border-primary' 
                            : 'text-text-muted hover:text-text-main hover:bg-white/5'}
                        `}
                      >
                        <Badge 
                           variant={ep.metodo === 'POST' ? 'success' : ep.metodo === 'PUT' ? 'info' : 'muted'} 
                           className="text-[8px] px-1 py-0 min-w-[32px] justify-center"
                        >
                           {ep.metodo}
                        </Badge>
                        {ep.titulo}
                      </button>
                    ))}
                 </nav>

                 <div className="p-4 bg-bg-base/40 rounded-xl border border-border-card space-y-3">
                    <p className="text-[10px] text-text-muted font-bold uppercase">Integração Externa</p>
                    <div className="flex flex-col gap-2">
                       <button className="flex items-center justify-between text-[11px] text-text-main hover:text-primary transition-colors group">
                          Configurar no N8N <ExternalLink size={12} className="opacity-50 group-hover:opacity-100" />
                       </button>
                       <button className="flex items-center justify-between text-[11px] text-text-main hover:text-primary transition-colors group">
                          Webhook IA <ExternalLink size={12} className="opacity-50 group-hover:opacity-100" />
                       </button>
                    </div>
                 </div>
              </div>
           </aside>

           {/* API Reference Content */}
           <div className="flex-1 space-y-24">
              {ENDPOINTS.map(ep => renderEndpoint(ep))}
           </div>
        </div>
      </div>

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
              onClick={() => {
                navigator.clipboard.writeText(revealedToken)
                // Usar a mesma lógica de "copied" do CodeBlock seria o ideal, mas por simplicidade:
                alert("Token copiado para a área de transferência!")
              }}
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
