import React from 'react'

interface AvatarProps {
  src?: string | null
  name?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '' }) => {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
    xl: 'w-20 h-20 text-2xl'
  }

  const initials = (name ?? '')
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={`
      relative inline-flex items-center justify-center rounded-full overflow-hidden
      bg-primary-light text-primary border border-primary/20 flex-shrink-0
      font-semibold font-sans
      ${sizes[size]}
      ${className}
    `}>
      {src ? (
        <img 
          src={src} 
          alt={name || ''} 
          className="w-full h-full object-cover"
          onError={(e) => {
            const img = e.target as HTMLImageElement
            img.style.display = 'none'
          }}
        />
      ) : initials ? (
        <span>{initials}</span>
      ) : (
        <span className="h-3 w-3 rounded-full bg-primary shadow-[0_0_0_4px_rgba(0,196,140,0.12),0_0_16px_rgba(0,196,140,0.45)]" />
      )}
    </div>
  )
}
