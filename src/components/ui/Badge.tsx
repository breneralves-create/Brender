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
    hot: 'bg-[#FFE8E2] text-[#B42318] border border-[#F04438]/45 dark:bg-[#C0392B]/22 dark:text-[#FFB4A8] dark:border-[#F04438]/50',
    warm: 'bg-[#FFF1D6] text-[#9A5B00] border border-[#F59E0B]/45 dark:bg-[#B7770D]/22 dark:text-[#FFD38A] dark:border-[#F59E0B]/50',
    cold: 'bg-[#E5F1FF] text-[#0B5C9F] border border-[#2F80ED]/45 dark:bg-[#1D6FA4]/22 dark:text-[#9FD0FF] dark:border-[#2F80ED]/50',
    muted: 'bg-bg-base text-text-muted border border-border-card',
    info: 'bg-blue-50 text-blue-600 border border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    warning: 'bg-[#FEF9EC] text-[#B7770D] border border-[#F9D589] dark:bg-[#B7770D]/15 dark:text-[#F9D589] dark:border-[#B7770D]/35',
    danger: 'bg-[#FEF3F0] text-[#C0392B] border border-[#F5A89A] dark:bg-[#C0392B]/15 dark:text-[#F5A89A] dark:border-[#C0392B]/35',
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
