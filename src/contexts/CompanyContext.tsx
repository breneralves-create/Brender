/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { CompanyConfig, BusinessHours, LeadScoreConfig } from '../types'

interface CompanyContextType {
  company: CompanyConfig | null
  businessHours: BusinessHours[]
  scoreConfig: LeadScoreConfig
  loading: boolean
  refreshCompany: () => Promise<void>
  updateCompanyLocal: (company: CompanyConfig) => void
  updateScoreConfigLocal: (scoreConfig: LeadScoreConfig) => void
}

const DEFAULT_SCORE_CONFIG: LeadScoreConfig = {
  id: 1,
  score_minimo_morno: 40,
  score_minimo_quente: 70,
  updated_at: new Date().toISOString()
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [company, setCompany] = useState<CompanyConfig | null>(null)
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([])
  const [scoreConfig, setScoreConfig] = useState<LeadScoreConfig>(DEFAULT_SCORE_CONFIG)
  const [loading, setLoading] = useState(true)

  const fetchCompanyData = async () => {
    try {
      // Configurações da empresa (id = 1)
      const { data: companyData } = await supabaseAdmin
        .from('company_config')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (companyData) setCompany(companyData)

      // Horário comercial — ordenado pela enum dia_semana manualmente
      const diasOrdem: Record<string, number> = {
        domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6
      }
      const { data: hoursData } = await supabaseAdmin
        .from('business_hours')
        .select('*')

      if (hoursData) {
        const sorted = [...hoursData].sort(
          (a, b) => (diasOrdem[a.dia] ?? 9) - (diasOrdem[b.dia] ?? 9)
        )
        setBusinessHours(sorted)
      }

      // Configuração de score (id = 1)
      const { data: scoreData } = await supabaseAdmin
        .from('lead_score_config')
        .select('*')
        .limit(1)
        .maybeSingle()

      if (scoreData) setScoreConfig(scoreData)
      else setScoreConfig(DEFAULT_SCORE_CONFIG)

    } catch (error) {
      console.error('Erro ao carregar configurações da empresa:', error)
      setScoreConfig(DEFAULT_SCORE_CONFIG)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanyData()

    // Realtime — atualiza automaticamente quando algo mudar no banco
    const companyChannel = supabase
      .channel('company_config_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_config' }, fetchCompanyData)
      .subscribe()

    const hoursChannel = supabase
      .channel('business_hours_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'business_hours' }, fetchCompanyData)
      .subscribe()

    const scoreChannel = supabase
      .channel('lead_score_config_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_score_config' }, fetchCompanyData)
      .subscribe()

    return () => {
      supabase.removeChannel(companyChannel)
      supabase.removeChannel(hoursChannel)
      supabase.removeChannel(scoreChannel)
    }
  }, [])

  return (
    <CompanyContext.Provider value={{
      company,
      businessHours,
      scoreConfig,
      loading,
      refreshCompany: fetchCompanyData,
      updateCompanyLocal: setCompany,
      updateScoreConfigLocal: setScoreConfig
    }}>
      {children}
    </CompanyContext.Provider>
  )
}

export const useCompany = () => {
  const context = useContext(CompanyContext)
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider')
  }
  return context
}
