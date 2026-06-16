import React from 'react'
import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Flame,
  MessageSquare, 
  Settings, 
  Code, 
  LogOut, 
  Sun, 
  Moon,
  ChevronLeft
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useTheme } from '../../contexts/ThemeContext'
import { useCompany } from '../../contexts/CompanyContext'
import { Avatar } from '../ui/Avatar'

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { userProfile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { company } = useCompany()
  const profileName = company?.nome?.trim() || userProfile?.name || 'Usuário'

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { label: 'Leads', icon: Users, path: '/leads' },
    { label: 'Funil', icon: Flame, path: '/funil' },
    { label: 'Conversas', icon: MessageSquare, path: '/conversas' },
    { label: 'Configurações', icon: Settings, path: '/configuracoes' },
    { label: 'Doc. API', icon: Code, path: '/documentacao-api' }
  ]

  const SidebarItem = ({ item }: { item: typeof navItems[0] }) => {
    const Icon = item.icon
    return (
      <NavLink
        to={item.path}
        onClick={() => {
          if (window.innerWidth < 1024) onClose()
        }}
        className={({ isActive }) => `
          flex items-center gap-3 px-4 py-3 rounded-button transition-all duration-200 group
          ${isActive 
            ? 'bg-primary/10 text-primary border-l-4 border-primary rounded-l-none' 
            : 'text-[#7A7F99] hover:text-white hover:bg-white/5'}
        `}
      >
        <Icon size={20} className="transition-transform duration-200 group-hover:scale-110" />
        <span className="font-medium font-sans">{item.label}</span>
      </NavLink>
    )
  }

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed top-0 left-0 z-50 h-screen w-64 bg-[#13151C] border-r border-[#2A2D3A] text-[#E8EAF0]
        flex flex-col transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Top: Branding */}
        <div className="p-6 flex flex-col items-center justify-center h-[120px] text-center border-b border-[#2A2D3A]">
          <button 
            onClick={onClose}
            className="lg:hidden absolute top-4 right-4 p-2 text-[#7A7F99] hover:text-white"
          >
            <ChevronLeft size={24} />
          </button>

          {/* Brender App Logo */}
          <div className="w-full flex justify-center items-center">
            <h1 className="text-3xl font-bold text-white font-sans tracking-tight flex items-baseline">
              Brender
              <span className="text-primary text-4xl leading-none ml-0.5">.</span>
            </h1>
          </div>
        </div>

        {/* Middle: Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto mt-2 custom-scrollbar">
          {navItems.map(item => (
            <SidebarItem key={item.path} item={item} />
          ))}
        </nav>

        {/* Bottom: Profile & Actions */}
        <div className="p-4 bg-black/20 border-t border-[#2A2D3A] space-y-4">
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar src={undefined} name={profileName} size="md" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#E8EAF0] truncate">
                {profileName}
              </p>
              <p className="text-xs text-[#7A7F99] truncate capitalize">
                {userProfile?.role || 'vendedor'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={toggleTheme}
              className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-button bg-white/5 border border-white/10 text-[#7A7F99] hover:text-white hover:bg-white/10 transition-all"
              title={theme === 'dark' ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              <span className="text-xs font-medium uppercase tracking-wider">{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <button
              onClick={() => signOut()}
              className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-button bg-error/10 border border-error/20 text-error hover:bg-error/20 transition-all"
              title="Sair do sistema"
            >
              <LogOut size={18} />
              <span className="text-xs font-medium uppercase tracking-wider">Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
