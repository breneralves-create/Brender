import React from 'react'
import { useCompany } from '../../contexts/CompanyContext'

interface ScoreBarProps {
  score: number
  className?: string
}

export const ScoreBar: React.FC<ScoreBarProps> = ({ score, className = '' }) => {
  const { scoreConfig } = useCompany()
  
  const getScoreColor = (val: number) => {
    if (val < scoreConfig.score_minimo_morno) return 'bg-cold'
    if (val < scoreConfig.score_minimo_quente) return 'bg-warm'
    return 'bg-hot'
  }

  const normalizedScore = Math.min(Math.max(score, 0), 100)

  return (
    <div className={`w-full bg-[#E5E7EB] rounded-full h-2.5 overflow-hidden ${className}`}>
      <div 
        className={`h-full transition-all duration-500 rounded-full ${getScoreColor(normalizedScore)}`}
        style={{ width: `${normalizedScore}%` }}
      />
    </div>
  )
}
