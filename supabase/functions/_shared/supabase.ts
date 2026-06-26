import { createClient } from 'npm:@supabase/supabase-js@2'
import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
import { ApiError } from './http.ts'

const requiredEnv = (name: string) => {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export const createAdminClient = (): SupabaseClient => {
  return createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

export const createRequestClient = (authorization: string): SupabaseClient => {
  return createClient(
    requiredEnv('SUPABASE_URL'),
    requiredEnv('SUPABASE_ANON_KEY'),
    {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}

const readBearerToken = (request: Request) => {
  const authorization = request.headers.get('authorization') || ''
  const [scheme, token] = authorization.split(/\s+/, 2)
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    throw new ApiError(401, 'NAO_AUTORIZADO', 'Token de autorizacao ausente.')
  }
  return { authorization, token }
}

export const authenticateDashboardUser = async (request: Request): Promise<{
  user: User
  role: 'admin' | 'vendedor'
  client: SupabaseClient
}> => {
  const { authorization, token } = readBearerToken(request)
  const client = createRequestClient(authorization)
  const { data: userData, error: userError } = await client.auth.getUser(token)

  if (userError || !userData.user) {
    throw new ApiError(401, 'SESSAO_INVALIDA', 'A sessao do usuario e invalida ou expirou.')
  }

  const { data: roleData, error: roleError } = await client.rpc('current_user_role')
  if (roleError) throw new ApiError(403, 'PERFIL_INDISPONIVEL', 'Nao foi possivel validar o perfil do usuario.')

  const role = roleData === 'admin' ? 'admin' : 'vendedor'
  return { user: userData.user, role, client }
}

const toHex = (bytes: Uint8Array) => {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

const hashApiToken = async (token: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return `sha256:${toHex(new Uint8Array(digest))}`
}

export const authenticateApiToken = async (request: Request): Promise<void> => {
  const { token } = readBearerToken(request)
  if (!token.startsWith('tk_prod_') || token.length < 40) {
    throw new ApiError(401, 'TOKEN_INVALIDO', 'Token de API invalido.')
  }

  const tokenHash = await hashApiToken(token)
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('api_tokens')
    .select('id')
    .eq('token_hash', tokenHash)
    .eq('ativo', true)
    .maybeSingle()

  if (error) throw new ApiError(500, 'ERRO_TOKEN', 'Nao foi possivel validar o token.')
  if (!data) throw new ApiError(401, 'TOKEN_INVALIDO', 'Token ausente, invalido ou desativado.')
}
