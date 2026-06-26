import { ApiError, corsHeaders, errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'
import { authenticateApiToken, createAdminClient } from '../_shared/supabase.ts'
import {
  LEAD_STATUSES,
  normalizeWhatsApp,
  optionalString,
  pickFields,
  requiredFutureDate,
  requiredString,
  requiredUuid,
} from '../_shared/validation.ts'

const routeSegments = (request: Request) => {
  const segments = new URL(request.url).pathname.split('/').filter(Boolean)
  const functionIndex = segments.lastIndexOf('api')
  return functionIndex >= 0 ? segments.slice(functionIndex + 1) : segments
}

const assertEnum = (value: unknown, allowed: readonly string[], field: string) => {
  if (value !== undefined && (typeof value !== 'string' || !allowed.includes(value))) {
    throw new ApiError(422, 'CAMPO_INVALIDO', `O campo ${field} possui um valor invalido.`)
  }
}

const handleCreateLead = async (body: Record<string, unknown>) => {
  const admin = createAdminClient()
  const whatsapp = normalizeWhatsApp(body.whatsapp)
  const { data: existing, error: existingError } = await admin
    .from('leads')
    .select('*')
    .eq('whatsapp', whatsapp)
    .maybeSingle()

  if (existingError) throw existingError
  if (existing) {
    return jsonResponse(200, {
      sucesso: true,
      situacao: 'LEAD_JA_EXISTE',
      mensagem: 'WhatsApp ja cadastrado.',
      lead: existing,
    })
  }

  const payload = {
    whatsapp,
    nome: optionalString(body.nome, 'nome', 200),
    produto_interesse: optionalString(body.produto_interesse, 'produto_interesse', 300),
    origem: optionalString(body.origem, 'origem', 100),
    cidade: optionalString(body.cidade, 'cidade', 200),
    dentro_horario_comercial: typeof body.dentro_horario_comercial === 'boolean' ? body.dentro_horario_comercial : true,
    status: 'novo_contato',
    ultima_atividade: new Date().toISOString(),
  }

  const { data, error } = await admin.from('leads').insert(payload).select().single()
  if (error) throw error
  return jsonResponse(201, { sucesso: true, situacao: 'LEAD_CRIADO', mensagem: 'Lead registrado com sucesso.', lead: data })
}

const handleGetLead = async (id: string | undefined, request: Request) => {
  const admin = createAdminClient()
  let query = admin.from('leads').select('*')

  if (id) {
    query = query.eq('id', requiredUuid(id))
  } else {
    const whatsappParam = new URL(request.url).searchParams.get('whatsapp')
    if (!whatsappParam) throw new ApiError(422, 'FILTRO_OBRIGATORIO', 'Informe o id ou o WhatsApp do lead.')
    query = query.eq('whatsapp', normalizeWhatsApp(whatsappParam))
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (!data) return errorResponse(404, 'LEAD_NAO_ENCONTRADO', 'Lead nao encontrado.')
  return jsonResponse(200, { sucesso: true, situacao: 'LEAD_ENCONTRADO', lead: data })
}

const handleUpdateLead = async (id: string, body: Record<string, unknown>) => {
  const admin = createAdminClient()
  requiredUuid(id)
  assertEnum(body.status, LEAD_STATUSES, 'status')
  assertEnum(body.temperatura, ['quente', 'morno', 'frio'], 'temperatura')
  assertEnum(body.intencao_compra, ['alta', 'media', 'baixa'], 'intencao_compra')
  assertEnum(body.urgencia, ['imediato', 'curto_prazo', 'sem_urgencia'], 'urgencia')

  if (body.score !== undefined && (!Number.isInteger(body.score) || Number(body.score) < 0 || Number(body.score) > 100)) {
    throw new ApiError(422, 'SCORE_INVALIDO', 'O score deve ser um inteiro entre 0 e 100.')
  }

  const updates = pickFields(body, [
    'score', 'temperatura', 'status', 'resumo_conversa', 'sintese_ia',
    'intencao_compra', 'urgencia', 'orcamento_informado', 'produto_interesse',
    'cidade', 'origem', 'bot_ativo',
  ])
  updates.ultima_atividade = new Date().toISOString()

  const { data, error } = await admin.from('leads').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  if (!data) return errorResponse(404, 'LEAD_NAO_ENCONTRADO', 'Lead nao encontrado.')
  return jsonResponse(200, { sucesso: true, situacao: 'LEAD_ATUALIZADO', mensagem: 'Qualificacao atualizada com sucesso.', lead: data })
}

const handleForwardLead = async (id: string) => {
  const admin = createAdminClient()
  requiredUuid(id)
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('leads')
    .update({ status: 'encaminhado', encaminhado_vendedor: true, data_encaminhamento: now, ultima_atividade: now })
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) throw error
  if (!data) return errorResponse(404, 'LEAD_NAO_ENCONTRADO', 'Lead nao encontrado.')
  return jsonResponse(200, { sucesso: true, situacao: 'LEAD_ENCAMINHADO', mensagem: 'Lead encaminhado com sucesso.', lead: data })
}

const handleInteraction = async (body: Record<string, unknown>) => {
  const admin = createAdminClient()
  const leadId = requiredUuid(body.lead_id, 'lead_id')
  const tipo = requiredString(body, 'tipo', 50)
  assertEnum(tipo, ['mensagem_lead', 'resposta_agente', 'nota_vendedor'], 'tipo')
  const conteudo = requiredString(body, 'conteudo', 10000)
  const { data, error } = await admin
    .from('interacoes')
    .insert({ lead_id: leadId, tipo, conteudo, criado_em: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return jsonResponse(201, { sucesso: true, situacao: 'INTERACAO_REGISTRADA', mensagem: 'Interacao registrada com sucesso.', interacao: data })
}

const handleCreateFollowUp = async (body: Record<string, unknown>) => {
  const admin = createAdminClient()
  const leadId = requiredUuid(body.lead_id, 'lead_id')
  const agendadoPara = requiredFutureDate(body.agendado_para)
  const motivo = requiredString(body, 'motivo', 1000)
  const { data, error } = await admin
    .from('follow_ups')
    .insert({ lead_id: leadId, agendado_para: agendadoPara, motivo, realizado: false, criado_por: 'agente_ia' })
    .select()
    .single()
  if (error) throw error
  return jsonResponse(201, { sucesso: true, situacao: 'FOLLOWUP_CRIADO', mensagem: 'Follow-up agendado com sucesso.', follow_up: data })
}

const handleUpdateFollowUp = async (id: string, body: Record<string, unknown>) => {
  const admin = createAdminClient()
  requiredUuid(id)
  const updates: Record<string, unknown> = {}
  if (body.realizado !== undefined) {
    if (typeof body.realizado !== 'boolean') throw new ApiError(422, 'CAMPO_INVALIDO', 'O campo realizado deve ser booleano.')
    updates.realizado = body.realizado
    updates.realizado_em = body.realizado ? new Date().toISOString() : null
  }
  if (body.agendado_para !== undefined) updates.agendado_para = requiredFutureDate(body.agendado_para)
  if (body.motivo !== undefined) updates.motivo = optionalString(body.motivo, 'motivo', 1000)
  if (Object.keys(updates).length === 0) throw new ApiError(422, 'CORPO_VAZIO', 'Informe ao menos um campo para atualizar.')

  const { data, error } = await admin.from('follow_ups').update(updates).eq('id', id).select().maybeSingle()
  if (error) throw error
  if (!data) return errorResponse(404, 'FOLLOWUP_NAO_ENCONTRADO', 'Follow-up nao encontrado.')
  return jsonResponse(200, { sucesso: true, situacao: 'FOLLOWUP_ATUALIZADO', mensagem: 'Follow-up atualizado com sucesso.', follow_up: data })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    await authenticateApiToken(request)
    const segments = routeSegments(request)
    const [resource, id, action] = segments

    if (resource === 'leads' && request.method === 'POST' && !id) return handleCreateLead(await readJsonBody(request))
    if (resource === 'leads' && request.method === 'GET') return handleGetLead(id, request)
    if (resource === 'leads' && request.method === 'PUT' && id && action === 'encaminhar') return handleForwardLead(id)
    if (resource === 'leads' && request.method === 'PUT' && id && !action) return handleUpdateLead(id, await readJsonBody(request))
    if (resource === 'interacoes' && request.method === 'POST' && !id) return handleInteraction(await readJsonBody(request))
    if (resource === 'follow-ups' && request.method === 'POST' && !id) return handleCreateFollowUp(await readJsonBody(request))
    if (resource === 'follow-ups' && request.method === 'PUT' && id) return handleUpdateFollowUp(id, await readJsonBody(request))

    return errorResponse(404, 'ROTA_NAO_ENCONTRADA', 'Endpoint nao encontrado.')
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message)
    console.error('Unhandled API error', error)
    return errorResponse(500, 'ERRO_INTERNO', 'Nao foi possivel concluir a operacao.')
  }
})
