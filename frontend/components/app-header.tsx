'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw, Globe, Settings, Share2, X } from 'lucide-react'

interface AppHeaderProps {
  appName?: string
  onExit?: () => void
  onPublish?: () => void
  onShare?: () => void
  onRefresh?: () => void
}

export function AppHeader({ 
  appName, 
  onExit, 
  onPublish, 
  onShare,
  onRefresh 
}: AppHeaderProps) {
  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left: Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">L</span>
          </div>
          <div className="text-sm font-semibold text-gray-700">LYRA AI</div>
        </div>

        {/* Center: App Name Tab */}
        {appName && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-200 rounded-lg">
            <span className="text-sm font-medium text-gray-900">{appName}</span>
            <button 
              onClick={onRefresh}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded">
              <Globe className="w-3.5 h-3.5 text-gray-500" />
            </button>
          </div>
        )}

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {appName && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                className="bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
              >
                Following agent's screen
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={onExit}
              >
                Exit
              </Button>
            </>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            onClick={onRefresh}
          >
            <Settings className="w-4 h-4" />
          </Button>
          {appName && (
            <>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onPublish}
              >
                Publish
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={onShare}
              >
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

