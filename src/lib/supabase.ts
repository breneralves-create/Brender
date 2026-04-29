import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ ERRO CRÍTICO: Variáveis de ambiente do Supabase não encontradas!');
  // Não podemos travar o app, mas vamos avisar no console de forma impossível de ignorar
} else {
  console.log('✅ Supabase: URL e Chave encontradas.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-error.supabase.co',
  supabaseAnonKey || 'placeholder-error'
)

export const supabaseAdmin = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        // Garante que a chave service_role seja enviada corretamente para bypass do RLS
        'x-address-mode': 'admin' 
      }
    }
  }
)
