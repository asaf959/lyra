'use client'

import { FileCode, Monitor, Terminal, Folder } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type ViewType = 'editor' | 'app-viewer' | 'terminal' | 'file'

interface ViewSelectorProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

export function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
  const views: Array<{ type: ViewType; label: string; icon: any }> = [
    { type: 'editor', label: 'Editor', icon: FileCode },
    { type: 'app-viewer', label: 'App Viewer', icon: Monitor },
    { type: 'terminal', label: 'Terminal', icon: Terminal },
    { type: 'file', label: 'File', icon: Folder },
  ]

  const currentViewConfig = views.find(v => v.type === currentView) || views[0]
  const CurrentIcon = currentViewConfig.icon

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CurrentIcon className="h-4 w-4" />
            {currentViewConfig.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {views.map((view) => {
            const Icon = view.icon
            return (
              <DropdownMenuItem
                key={view.type}
                onClick={() => {
                  console.log('ViewSelector: Changing view to', view.type)
                  onViewChange(view.type)
                }}
                className={currentView === view.type ? 'bg-purple-50' : ''}
              >
                <Icon className="h-4 w-4 mr-2" />
                {view.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

