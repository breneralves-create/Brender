import { ApiError, corsHeaders, errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'
import { authenticateDashboardUser } from '../_shared/supabase.ts'
import { requiredUuid } from '../_shared/validation.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new ApiError(503, 'INTEGRACAO_NAO_CONFIGURADA', `Configure o secret ${name} na Edge Function.`)
  return value
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return errorResponse(405, 'METODO_NAO_PERMITIDO', 'Use o metodo POST.')

  try {
    const { client, user } = await authenticateDashboardUser(request)
    const body = await readJsonBody(request)
    const leadId = requiredUuid(body.lead_id, 'lead_id')
    if (typeof body.ativo !== 'boolean') throw new ApiError(422, 'CAMPO_INVALIDO', 'O campo ativo deve ser booleano.')

    const { data: lead, error: leadError } = await client
      .from('leads')
      .select('id, whatsapp, bot_ativo')
      .eq('id', leadId)
      .maybeSingle()

    if (leadError) throw leadError
    if (!lead) throw new ApiError(404, 'LEAD_NAO_ENCONTRADO', 'Lead nao encontrado.')

    const webhookUrl = requiredEnv('BOT_CONTROL_WEBHOOK_URL')
    const webhookSecret = Deno.env.get('N8N_WEBHOOK_SECRET')
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(webhookSecret ? { 'X-Brender-Webhook-Secret': webhookSecret } : {}),
      },
      body: JSON.stringify({
        lead_id: lead.id,
        whatsapp: lead.whatsapp,
        ativo: body.ativo,
        requested_by: user.id,
      }),
      signal: AbortSignal.timeout(12_000),
    })

    const responseText = await webhookResponse.text()
    if (!webhookResponse.ok) {
      console.error('Bot webhook error', webhookResponse.status, responseText.slice(0, 500))
      throw new ApiError(502, 'WEBHOOK_FALHOU', 'O servico de automacao recusou a alteracao.')
    }

    const { data: updatedLead, error: updateError } = await client
      .from('leads')
      .update({ bot_ativo: body.ativo, ultima_atividade: new Date().toISOString() })
      .eq('id', leadId)
      .select('id, bot_ativo')
      .single()

    if (updateError) throw updateError
    return jsonResponse(200, {
      sucesso: true,
      situacao: body.ativo ? 'IA_ATIVADA' : 'IA_PAUSADA',
      mensagem: body.ativo ? 'Agente IA retomado.' : 'Atendimento humano assumido.',
      lead: updatedLead,
    })
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message)
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return errorResponse(504, 'WEBHOOK_TIMEOUT', 'O servico de automacao nao respondeu a tempo.')
    }
    console.error('Unhandled bot-control error', error)
    return errorResponse(500, 'ERRO_INTERNO', 'Nao foi possivel alterar o agente IA.')
  }
})
