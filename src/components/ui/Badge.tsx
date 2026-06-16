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
    hot: 'bg-[#FEF3F0] text-[#C0392B] border border-[#F5A89A] dark:bg-[#C0392B]/15 dark:text-[#F5A89A] dark:border-[#C0392B]/35',
    warm: 'bg-[#FEF9EC] text-[#B7770D] border border-[#F9D589] dark:bg-[#B7770D]/15 dark:text-[#F9D589] dark:border-[#B7770D]/35',
    cold: 'bg-[#EFF6FF] text-[#1D6FA4] border border-[#93C5FD] dark:bg-[#1D6FA4]/15 dark:text-[#93C5FD] dark:border-[#1D6FA4]/35',
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
