import React, { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { UserProfile } from '../types'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Safety timeout: stop loading spinner after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        void fetchUserProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        setLoading(false)
        setTimeout(() => {
          void fetchUserProfile(currentUser.id)
        }, 0)
      } else {
        setUserProfile(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
    }
  }, [])

  const fetchUserProfile = async (id: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw error
      setUserProfile(data ?? null)
    } catch (error) {
      console.error('Error fetching user profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setUser(data.user)
    setLoading(false)
    if (data.user) {
      setTimeout(() => {
        void fetchUserProfile(data.user.id)
      }, 0)
    }
  }

  const signOut = async () => {
    // Immediate local cleanup
    setUser(null)
    setUserProfile(null)
    localStorage.clear() // Remove local session data
    
    // Attempt to notify Supabase but don't wait for it
    supabase.auth.signOut().catch(() => {})
    
    // Force a hard redirect to the login page immediately
    window.location.assign('/login')
  }

  const isAdmin = userProfile?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signIn, signOut, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
