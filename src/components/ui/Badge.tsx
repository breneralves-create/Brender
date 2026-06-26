import React from 'react'

interface BadgeProps {
  children: React.ReactNode
  variant?: 'primary' | 'success' | 'hot' | 'warm' | 'cold' | 'muted' | 'info' | 'warning' | 'danger'
  icon?: React.ReactNode
  className?: string
}

export const Badge: React.FC<BadgeProps> = ({ 
  children, 
  variant = 'muted', 
  icon, 
  className = '' 
}) => {
  const variants: Record<string, string> = {
    primary: 'bg-[#00C48C]/10 text-[#00C48C] border border-[#00C48C]/20',
    success: 'bg-[#00C48C]/10 text-[#00C48C] border border-[#00C48C]/20',
    hot: 'bg-hot-light text-hot border border-hot/30',
    warm: 'bg-warm-light text-warm border border-warm/30',
    cold: 'bg-cold-light text-cold border border-cold/30',
    muted: 'bg-bg-base text-text-muted border border-border-card',
    info: 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    warning: 'bg-warm-light text-warning border border-warm/30',
    danger: 'bg-hot-light text-error border border-hot/30',
  }

  return (
    <span className={`
      inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold
      rounded-full transition-colors duration-200
      ${variants[variant]}
      ${className}
    `}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  )
}
