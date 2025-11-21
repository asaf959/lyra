'use client'

import { App } from '@/store/app-store'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Play, Hammer, Trash2, RefreshCw, ExternalLink, Square } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { formatDistanceToNow } from 'date-fns'
import { useState, useEffect } from 'react'

interface AppListProps {
  apps: App[]
  isLoading: boolean
  onRefresh: () => void
  onAppSelect?: (appId: string) => void
}

const statusColors: Record<App['status'], string> = {
  generated: 'bg-gray-500',
  building: 'bg-yellow-500',
  built: 'bg-blue-500',
  running: 'bg-green-500',
  stopped: 'bg-gray-400',
  error: 'bg-red-500',
}

const statusLabels: Record<App['status'], string> = {
  generated: 'Generated',
  building: 'Building',
  built: 'Built',
  running: 'Running',
  stopped: 'Stopped',
  error: 'Error',
}

export function AppList({ apps, isLoading, onRefresh, onAppSelect }: AppListProps) {
  const { buildApp, runApp, stopApp, getAppUrl, deleteApp } = useAppStore()
  const [runningUrls, setRunningUrls] = useState<Record<string, string>>({})
  const [loadingApps, setLoadingApps] = useState<Record<string, boolean>>({})

  const handleRun = async (appId: string) => {
    setLoadingApps(prev => ({ ...prev, [appId]: true }))
    try {
      const result = await runApp(appId)
      if (result?.url) {
        setRunningUrls(prev => ({ ...prev, [appId]: result.url }))
        // Open in new tab
        window.open(result.url, '_blank')
      }
    } finally {
      setLoadingApps(prev => ({ ...prev, [appId]: false }))
    }
  }

  const handleStop = async (appId: string) => {
    setLoadingApps(prev => ({ ...prev, [appId]: true }))
    try {
      await stopApp(appId)
      setRunningUrls(prev => {
        const newUrls = { ...prev }
        delete newUrls[appId]
        return newUrls
      })
    } finally {
      setLoadingApps(prev => ({ ...prev, [appId]: false }))
    }
  }

  const handleOpenUrl = (url: string) => {
    window.open(url, '_blank')
  }

  // Check for running apps on mount
  useEffect(() => {
    apps.forEach(async (app) => {
      if (app.status === 'running') {
        const url = await getAppUrl(app.id)
        if (url) {
          setRunningUrls(prev => ({ ...prev, [app.id]: url }))
        }
      }
    })
  }, [apps, getAppUrl])

  if (isLoading && apps.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (apps.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-gray-500">No apps yet. Create your first app!</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Your Apps</h2>
        <Button variant="outline" size="sm" onClick={onRefresh}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {apps.map((app) => (
          <Card 
            key={app.id}
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => onAppSelect?.(app.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{app.name}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {app.prompt}
                  </CardDescription>
                </div>
                <Badge
                  className={`${statusColors[app.status]} text-white ml-2`}
                >
                  {statusLabels[app.status]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Created {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {runningUrls[app.id] ? (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleOpenUrl(runningUrls[app.id])}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open in Browser
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStop(app.id)}
                        disabled={loadingApps[app.id]}
                      >
                        {loadingApps[app.id] ? (
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        ) : (
                          <Square className="w-3 h-3 mr-1" />
                        )}
                        Stop
                      </Button>
                    </>
                  ) : (
                    <>
                      {app.status === 'generated' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => buildApp(app.id)}
                        >
                          <Hammer className="w-3 h-3 mr-1" />
                          Build
                        </Button>
                      )}
                      {(app.status === 'built' || app.status === 'generated') && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleRun(app.id)}
                          disabled={loadingApps[app.id]}
                        >
                          {loadingApps[app.id] ? (
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          ) : (
                            <Play className="w-3 h-3 mr-1" />
                          )}
                          Run in Browser
                        </Button>
                      )}
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => deleteApp(app.id)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

