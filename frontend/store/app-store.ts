import { create } from 'zustand'

export interface App {
  id: string
  name: string
  prompt: string
  status: 'generated' | 'building' | 'built' | 'running' | 'stopped' | 'error'
  createdAt: string
  updatedAt: string
  buildStartedAt?: string
  buildCompletedAt?: string
  runStartedAt?: string
  runStoppedAt?: string
  errorMessage?: string
}

interface AppStore {
  apps: App[]
  isLoading: boolean
  error: string | null
  token: string | null
  setToken: (token: string) => void
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<boolean>
  fetchApps: () => Promise<void>
  createApp: (prompt: string) => Promise<App | null>
  buildApp: (id: string) => Promise<void>
  runApp: (id: string) => Promise<{ url: string; port: number } | null>
  stopApp: (id: string) => Promise<void>
  getAppUrl: (id: string) => Promise<string | null>
  deleteApp: (id: string) => Promise<void>
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export const useAppStore = create<AppStore>((set, get) => ({
  apps: [],
  isLoading: false,
  error: null,
  // Initialize token as null to prevent hydration mismatch
  // It will be loaded from localStorage after mount
  token: null,

  setToken: (token: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lyra_token', token)
    }
    set({ token })
  },

  login: async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (data.success && data.data?.token) {
        get().setToken(data.data.token)
        await get().fetchApps()
        set({ error: null })
        return true
      }
      // Handle new error format: { success: false, message: "...", errors: [{ field, message }] }
      let errorMessage = data.message || 'Login failed'
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        errorMessage = data.errors.map((err: { field: string; message: string }) => 
          `${err.field}: ${err.message}`
        ).join(', ')
      }
      set({ error: errorMessage })
      return false
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Login failed' })
      return false
    }
  },

  register: async (email: string, password: string, firstName: string, lastName: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, firstName, lastName }),
      })
      const data = await response.json()
      if (data.success && data.data?.token) {
        get().setToken(data.data.token)
        await get().fetchApps()
        set({ error: null })
        return true
      }
      // Handle new error format: { success: false, message: "...", errors: [{ field, message }] }
      let errorMessage = data.message || 'Registration failed'
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        // Format errors as: "field1: message1, field2: message2"
        errorMessage = data.errors.map((err: { field: string; message: string }) => 
          `${err.field}: ${err.message}`
        ).join(', ')
      }
      set({ error: errorMessage })
      return false
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Registration failed' })
      return false
    }
  },

  fetchApps: async () => {
    const token = get().token
    if (!token) {
      set({ error: 'Not authenticated' })
      return
    }
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_URL}/api/apps`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        set({ apps: data.data.apps || data.apps || [], isLoading: false })
      } else {
        set({ error: data.error || 'Failed to fetch apps', isLoading: false })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch apps',
        isLoading: false,
      })
    }
  },

  createApp: async (prompt: string) => {
    const token = get().token
    if (!token) {
      set({ error: 'Not authenticated' })
      return null
    }

    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`${API_URL}/api/prompts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
      })
      const data = await response.json()
      console.log('createApp response:', data)
      if (data.success) {
        const app = data.data?.app || data.app
        console.log('Created app:', app)
        await get().fetchApps()
        set({ isLoading: false })
        return app
      } else {
        set({ error: data.error || 'Failed to create app', isLoading: false })
        return null
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create app',
        isLoading: false,
      })
      return null
    }
  },

  buildApp: async (id: string) => {
    const token = get().token
    if (!token) {
      set({ error: 'Not authenticated' })
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/apps/${id}/build`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        await get().fetchApps()
      } else {
        set({ error: data.error || 'Failed to build app' })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to build app',
      })
    }
  },

  runApp: async (id: string) => {
    const token = get().token
    if (!token) {
      set({ error: 'Not authenticated' })
      return null
    }

    try {
      const response = await fetch(`${API_URL}/api/apps/${id}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        await get().fetchApps()
        return {
          url: data.data.url,
          port: data.data.port,
        }
      } else {
        set({ error: data.error || 'Failed to run app' })
        return null
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run app',
      })
      return null
    }
  },

  stopApp: async (id: string) => {
    const token = get().token
    if (!token) {
      set({ error: 'Not authenticated' })
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/apps/${id}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        await get().fetchApps()
      } else {
        set({ error: data.error || 'Failed to stop app' })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to stop app',
      })
    }
  },

  getAppUrl: async (id: string) => {
    const token = get().token
    if (!token) {
      return null
    }

    try {
      const response = await fetch(`${API_URL}/api/apps/${id}/url`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        return data.data.url
      }
      return null
    } catch (error) {
      return null
    }
  },

  deleteApp: async (id: string) => {
    const token = get().token
    if (!token) {
      set({ error: 'Not authenticated' })
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/apps/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const data = await response.json()
      if (data.success) {
        await get().fetchApps()
      } else {
        set({ error: data.error || 'Failed to delete app' })
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete app',
      })
    }
  },
}))

