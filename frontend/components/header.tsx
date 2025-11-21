'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { LogOut, User } from 'lucide-react'

interface HeaderProps {
  onLoginClick?: () => void
}

export function Header({ onLoginClick }: HeaderProps) {
  const { token, setToken } = useAppStore()
  const [mounted, setMounted] = useState(false)

  // Prevent hydration mismatch by only rendering auth state after mount
  useEffect(() => {
    setMounted(true)
    // Load token from localStorage after mount
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('lyra_token')
      if (storedToken && !token) {
        setToken(storedToken)
      }
    }
  }, [setToken, token])

  const handleLogout = () => {
    setToken('')
    if (typeof window !== 'undefined') {
      localStorage.removeItem('lyra_token')
    }
  }

  return (
    <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">LYRA AI</h1>
              <p className="text-xs text-gray-500">No-Code App Builder</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mounted && token ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100">
                  <User className="w-4 h-4 text-gray-600" />
                  <span className="text-sm text-gray-700">Logged In</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </>
            ) : (
              <Button variant="default" size="sm" onClick={onLoginClick}>
                Login / Register
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

