import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const { signIn } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      await signIn(email, password)
      navigate('/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciais inválidas ou erro de conexão.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg-base px-4 py-10 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-primary/10 blur-[110px]" />
        <div className="absolute bottom-[-18rem] right-[-12rem] h-[32rem] w-[32rem] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.025] [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <main className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md items-center justify-center">
        <div className="w-full animate-in fade-in zoom-in duration-500">
          <header className="mb-8 flex flex-col items-center text-center">
            <div className="mb-7 inline-flex items-center gap-3" aria-label="Brender, sistema online">
              <span className="font-sans text-[2.65rem] font-bold leading-none tracking-[-0.07em] text-text-main">
                Brender
              </span>
              <span className="relative -ml-2 mt-4 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-40" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-primary shadow-[0_0_18px_rgba(0,200,150,0.75)]" />
              </span>
            </div>

            <div className="mb-4 flex items-center gap-3 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-primary">
              <span className="h-px w-7 bg-primary/50" />
              Plataforma comercial
              <span className="h-px w-7 bg-primary/50" />
            </div>

            <h1 className="font-heading text-3xl font-bold tracking-tight text-text-main sm:text-[2rem]">
              Painel de Leads
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-text-muted sm:text-base">
              Acesse sua conta para continuar
            </p>
          </header>

          <section className="relative overflow-hidden rounded-[1.25rem] border border-border-card bg-bg-card/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:p-8">
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

            <div className="mb-7">
              <h2 className="text-lg font-semibold text-text-main">Bem-vindo de volta</h2>
              <p className="mt-1 text-sm text-text-muted">
                Entre com suas credenciais para acessar o painel.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-3 rounded-input border border-error/20 bg-error/10 p-4 text-error">
                  <AlertCircle size={20} className="mt-0.5 flex-shrink-0" />
                  <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <Input
                label="E-mail"
                type="email"
                placeholder="seu@email.com"
                icon={<Mail size={20} />}
                className="py-3"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Input
                label="Senha"
                type="password"
                placeholder="••••••••"
                icon={<Lock size={20} />}
                className="py-3"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Button
                type="submit"
                className="w-full"
                isLoading={isLoading}
                size="lg"
                icon={!isLoading ? <ArrowRight size={19} /> : undefined}
              >
                Entrar
              </Button>
            </form>

            <div className="mt-7 border-t border-border-card pt-5 text-center">
              <p className="text-sm text-text-muted">
                Esqueceu sua senha?{' '}
                <span className="font-medium text-text-main">Entre em contato com o suporte.</span>
              </p>
            </div>
          </section>

          <footer className="mt-6 flex items-center justify-center gap-2 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Ambiente seguro
          </footer>
        </div>
      </main>
    </div>
  )
}
