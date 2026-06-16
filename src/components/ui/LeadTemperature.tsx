import React from 'react'
import { Badge } from './Badge'
import { Flame, Thermometer, Snowflake } from 'lucide-react'

interface LeadTemperatureProps {
  temperature: 'quente' | 'morno' | 'frio' | null | string
  className?: string
}

export const LeadTemperature: React.FC<LeadTemperatureProps> = ({ temperature, className = '' }) => {
  if (!temperature) return null

  const config = {
    quente: {
      label: 'Quente',
      variant: 'hot' as const,
      icon: <Flame size={12} />
    },
    morno: {
      label: 'Morno',
      variant: 'warm' as const,
      icon: <Thermometer size={12} />
    },
    frio: {
      label: 'Frio',
      variant: 'cold' as const,
      icon: <Snowflake size={12} />
    }
  }

  const current = config[temperature as keyof typeof config] || {
    label: temperature,
    variant: 'muted' as const,
    icon: null
  }

  return (
    <Badge 
      variant={current.variant} 
      icon={current.icon}
      className={`text-[10px] uppercase tracking-wide ${className}`}
    >
      {current.label}
    </Badge>
  )
}
