import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { Avatar } from '../ui/Avatar'
import { Menu } from 'lucide-react'

interface HeaderProps {
  title: string
  onMenuClick: () => void
}

export const Header: React.FC<HeaderProps> = ({ title, onMenuClick }) => {
  const { user, userProfile, role } = useAuth()
  const accountName = userProfile?.name || user?.user_metadata?.name || user?.email || 'Minha conta'

  return (
    <header className="h-16 bg-bg-card border-b border-border-card px-6 flex items-center justify-between z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="p-2 text-text-muted hover:text-text-main lg:hidden"
        >
          <Menu size={24} />
        </button>
        <h1 className="text-2xl font-bold text-text-main font-heading truncate">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right hidden sm:block">
          <p className="text-sm font-semibold text-text-main leading-none">
            {accountName}
          </p>
          <p className="text-xs text-text-muted mt-1 leading-none uppercase tracking-wider font-bold">
            {role === 'admin' ? 'Administrador' : 'Vendedor'}
          </p>
        </div>
        <Avatar src={undefined} name={accountName} />
      </div>
    </header>
  )
}
