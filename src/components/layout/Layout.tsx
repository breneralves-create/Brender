import React, { useState } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface LayoutProps {
  children: React.ReactNode
  title: string
}

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-bg-base flex">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        <Header 
          title={title} 
          onMenuClick={() => setIsSidebarOpen(true)} 
        />
        
        <main className="flex-1 p-6 lg:p-8 bg-bg-base">
          <div className="max-w-full animate-in fade-in duration-200">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
