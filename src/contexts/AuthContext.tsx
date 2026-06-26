/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, supabaseAdmin } from '../lib/supabase'
import type { UserProfile, UserRole } from '../types'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  role: UserRole | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUserProfile: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [authRole, setAuthRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = useCallback(async (currentUser: User) => {
    try {
      const { data: roleData, error: roleError } = await supabase.rpc('current_user_role')
      const currentRole: UserRole | null = roleData === 'admin' || roleData === 'vendedor' ? roleData : null

      const { data: profileData, error: profileError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (profileError) {
        setUserProfile({
          id: currentUser.id,
          email: currentUser.email ?? null,
          name: typeof currentUser.user_metadata?.name === 'string' ? currentUser.user_metadata.name : null,
          role: currentRole ?? 'vendedor',
          created_at: currentUser.created_at,
        })
      } else {
        setUserProfile(profileData ?? {
          id: currentUser.id,
          email: currentUser.email ?? null,
          name: typeof currentUser.user_metadata?.name === 'string' ? currentUser.user_metadata.name : null,
          role: currentRole ?? 'vendedor',
          created_at: currentUser.created_at,
        })
      }

      if (roleError) {
        console.error('Error fetching user role:', roleError)
        setAuthRole(null)
      } else {
        setAuthRole(currentRole)
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      setUserProfile(null)
      setAuthRole(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Safety timeout: stop loading spinner after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      setLoading(false)
    }, 5000)

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        void fetchUserProfile(session.user)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        setTimeout(() => {
          void fetchUserProfile(currentUser)
        }, 0)
      } else {
        setUserProfile(null)
        setAuthRole(null)
        setLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      clearTimeout(safetyTimeout)
    }
  }, [fetchUserProfile])

  const refreshUserProfile = async () => {
    if (user?.id) {
      await fetchUserProfile(user)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    setUser(data.user)
    if (data.user) {
      setLoading(true)
      await fetchUserProfile(data.user)
    } else {
      setLoading(false)
    }
  }

  const signOut = async () => {
    // Immediate local cleanup
    setUser(null)
    setUserProfile(null)
    setAuthRole(null)
    // Attempt to notify Supabase but don't wait for it
    supabase.auth.signOut().catch(() => {})
    
    // Force a hard redirect to the login page immediately
    window.location.assign('/login')
  }

  const role = userProfile?.role ?? authRole
  const isAdmin = role === 'admin'

  return (
    <AuthContext.Provider value={{ user, userProfile, role, loading, signIn, signOut, refreshUserProfile, isAdmin }}>
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
