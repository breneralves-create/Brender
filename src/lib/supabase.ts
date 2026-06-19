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

// Backward-compatible alias. Browser code must never hold privileged server credentials.
// Keep privileged operations behind Supabase RLS policies or Edge Functions.
export const supabaseAdmin = supabase
