'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, ChevronRight, Globe, Sparkles, Heart, User, Crown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Card } from '@/components/ui/card'

interface SidebarProps {
  onNewChat: () => void
  onAppSelect: (appId: string) => void
  selectedAppId?: string | null
}

export function Sidebar({ onNewChat, onAppSelect, selectedAppId }: SidebarProps) {
  const { apps, token } = useAppStore()
  const [showMyChats, setShowMyChats] = useState(true)

  // Get recent apps (last 10)
  const recentApps = apps.slice(0, 10)

  return (
    <div className="w-64 h-full flex flex-col bg-white border-r">
      {/* Logo */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl">
            L
          </div>
          <div>
            <div className="font-bold text-lg">LYRA AI</div>
            <div className="text-xs text-gray-500">No-Code App Builder</div>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* New Chat Button */}
          <Button 
            onClick={onNewChat}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>

          {/* Go to App World */}
          <Button 
            variant="outline" 
            className="w-full"
          >
            <div className="w-4 h-4 grid grid-cols-2 gap-0.5">
              <div className="w-1.5 h-1.5 bg-gray-600 rounded"></div>
              <div className="w-1.5 h-1.5 bg-gray-600 rounded"></div>
              <div className="w-1.5 h-1.5 bg-gray-600 rounded"></div>
              <div className="w-1.5 h-1.5 bg-gray-600 rounded"></div>
            </div>
            <span className="ml-2">Go to App World</span>
          </Button>

          {/* My Chats Section */}
          <div className="space-y-2">
            <button
              onClick={() => setShowMyChats(!showMyChats)}
              className="w-full flex items-center justify-between text-sm font-semibold text-gray-700 hover:text-gray-900"
            >
              <span>My Chats</span>
              <ChevronRight 
                className={`w-4 h-4 transition-transform ${showMyChats ? 'rotate-90' : ''}`} 
              />
            </button>

            {showMyChats && (
              <div className="space-y-1">
                <div className="text-xs text-gray-500 px-2 py-1">Recents</div>
                {recentApps.length > 0 ? (
                  recentApps.map((app) => (
                    <button
                      key={app.id}
                      onClick={() => onAppSelect(app.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedAppId === app.id
                          ? 'bg-purple-50 text-purple-900 border border-purple-200'
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="font-medium truncate">{app.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No recent chats
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* User Profile Section */}
      {token && (
        <div className="p-4 border-t">
          <Card className="p-3 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-semibold">
                A
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 truncate">
                  Asif Khan
                </div>
                <div className="text-xs text-gray-500">Free</div>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">Credits remaining</span>
              <span className="text-xs font-semibold text-gray-700">2.33 left</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
              <div className="h-full bg-purple-600 rounded-full" style={{ width: '70%' }}></div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-xs bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
            >
              <Crown className="w-3 h-3 mr-1" />
              Upgrade
            </Button>
          </Card>
        </div>
      )}
    </div>
  )
}

