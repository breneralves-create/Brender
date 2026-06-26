import { ApiError, corsHeaders, errorResponse, jsonResponse, readJsonBody } from '../_shared/http.ts'
import { authenticateDashboardUser, createAdminClient } from '../_shared/supabase.ts'
import { optionalString, requiredString, requiredUuid } from '../_shared/validation.ts'

const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return errorResponse(405, 'METODO_NAO_PERMITIDO', 'Use o metodo POST.')

  try {
    const { user, role } = await authenticateDashboardUser(request)
    if (role !== 'admin') throw new ApiError(403, 'ADMIN_OBRIGATORIO', 'Somente administradores podem gerenciar usuarios.')

    const body = await readJsonBody(request)
    const action = requiredString(body, 'action', 30)
    const admin = createAdminClient()

    if (action === 'invite') {
      const email = requiredString(body, 'email', 320).toLowerCase()
      if (!validEmail(email)) throw new ApiError(422, 'EMAIL_INVALIDO', 'Informe um e-mail valido.')
      const name = optionalString(body.name, 'name', 200)
      const userRole = body.role === 'admin' ? 'admin' : 'vendedor'
      const redirectTo = Deno.env.get('INVITE_REDIRECT_URL')

      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { name },
        ...(redirectTo ? { redirectTo } : {}),
      })
      if (error) throw new ApiError(400, 'CONVITE_FALHOU', error.message)

      const invitedUser = data.user
      const { error: profileError } = await admin.from('users').upsert({
        id: invitedUser.id,
        email,
        name,
        role: userRole,
      })
      if (profileError) throw profileError

      return jsonResponse(201, {
        sucesso: true,
        situacao: 'USUARIO_CONVIDADO',
        mensagem: 'Convite enviado com sucesso.',
        user: { id: invitedUser.id, email, name, role: userRole },
      })
    }

    if (action === 'delete') {
      const userId = requiredUuid(body.user_id, 'user_id')
      if (userId === user.id) throw new ApiError(422, 'AUTOEXCLUSAO_BLOQUEADA', 'Voce nao pode remover a propria conta.')

      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) throw new ApiError(400, 'EXCLUSAO_FALHOU', error.message)
      await admin.from('users').delete().eq('id', userId)

      return jsonResponse(200, { sucesso: true, situacao: 'USUARIO_REMOVIDO', mensagem: 'Usuario removido com sucesso.' })
    }

    if (action === 'change_role') {
      const userId = requiredUuid(body.user_id, 'user_id')
      if (body.role !== 'admin' && body.role !== 'vendedor') {
        throw new ApiError(422, 'ROLE_INVALIDA', 'A role deve ser admin ou vendedor.')
      }
      if (userId === user.id && body.role !== 'admin') {
        throw new ApiError(422, 'AUTO_REBAIXAMENTO_BLOQUEADO', 'Voce nao pode remover seu proprio acesso administrativo.')
      }

      const { data, error } = await admin
        .from('users')
        .update({ role: body.role })
        .eq('id', userId)
        .select('id, email, name, role, created_at')
        .single()
      if (error) throw error
      return jsonResponse(200, { sucesso: true, situacao: 'ROLE_ATUALIZADA', mensagem: 'Permissao atualizada.', user: data })
    }

    throw new ApiError(422, 'ACAO_INVALIDA', 'Acao de usuario invalida.')
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message)
    console.error('Unhandled admin-users error', error)
    return errorResponse(500, 'ERRO_INTERNO', 'Nao foi possivel gerenciar o usuario.')
  }
})
