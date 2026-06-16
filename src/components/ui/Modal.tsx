import React, { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  if (!isOpen) return null

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />
      
      {/* Content */}
      <div className={`
        relative w-full ${sizes[size]} max-h-[90vh] flex flex-col bg-bg-card border border-border-card 
        rounded-modal shadow-modal overflow-hidden animate-in fade-in zoom-in duration-300
      `}>
        <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between border-b border-border-card shrink-0">
          {title ? (
            <h3 className="text-xl sm:text-2xl font-bold text-text-main font-heading">{title}</h3>
          ) : <div />}
          <button 
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main hover:bg-primary-light rounded-button transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="px-6 py-6 sm:px-8 sm:py-8 overflow-y-auto custom-scrollbar flex-1">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-5 sm:px-8 sm:py-6 bg-bg-base/30 border-t border-border-card flex justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
