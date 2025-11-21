'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

interface AppViewerProps {
  appId: string
  url?: string
}

export function AppViewer({ appId, url: propUrl }: AppViewerProps) {
  const [iframeUrl, setIframeUrl] = useState<string | null>(propUrl || null)
  const [isLoading, setIsLoading] = useState(false)
  const { runApp, getAppUrl, token } = useAppStore()

  useEffect(() => {
    // Try to get URL if not provided
    if (!iframeUrl && token) {
      getAppUrl(appId).then((url) => {
        if (url) {
          setIframeUrl(url)
        }
      })
    }
  }, [appId, iframeUrl, token, getAppUrl])

  const handleRun = async () => {
    if (!token) return
    
    setIsLoading(true)
    try {
      const result = await runApp(appId)
      if (result?.url) {
        setIframeUrl(result.url)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (!iframeUrl || isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white border border-purple-200 rounded-lg">
        <div className="text-center space-y-6">
          {/* Animated Loading Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center animate-pulse">
                <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center">
                    <div className="w-8 h-8 rounded-full bg-white"></div>
                  </div>
                </div>
              </div>
              <div className="absolute inset-0 rounded-full border-4 border-purple-300 border-t-transparent animate-spin"></div>
            </div>
          </div>
          
          <div className="space-y-2">
            <Button 
              onClick={handleRun} 
              disabled={isLoading || !token}
              className="gap-2 bg-purple-600 hover:bg-purple-700"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Starting up my computer
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Start App
                </>
              )}
            </Button>
            <p className="text-sm text-gray-600">
              Agent's computer is starting up<br />
              Please wait...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full rounded-lg border overflow-hidden bg-white flex flex-col">
      <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-600 font-mono">{iframeUrl}</div>
        <Button variant="ghost" size="sm" onClick={() => window.open(iframeUrl, '_blank')}>
          Open in New Tab
        </Button>
      </div>
      <div className="flex-1">
        <iframe
          src={iframeUrl}
          className="w-full h-full border-0"
          title="App Preview"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  )
}

