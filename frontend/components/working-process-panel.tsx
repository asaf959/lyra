'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Step {
  id: string
  type: 'read' | 'write' | 'command'
  file?: string
  command?: string
  status: 'pending' | 'processing' | 'completed'
  message?: string
}

interface WorkingProcessPanelProps {
  steps: Step[]
  onFileClick?: (filePath: string) => void
  onCommandClick?: (command: string) => void
}

export function WorkingProcessPanel({ 
  steps, 
  onFileClick,
  onCommandClick 
}: WorkingProcessPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (steps.length === 0) {
    return null
  }

  // Group steps by message
  const groupedSteps: Array<{ message?: string; steps: Step[] }> = []
  let currentGroup: { message?: string; steps: Step[] } = { steps: [] }
  
  steps.forEach((step) => {
    if (step.message) {
      if (currentGroup.steps.length > 0) {
        groupedSteps.push(currentGroup)
      }
      currentGroup = { message: step.message, steps: [] }
    }
    currentGroup.steps.push(step)
  })
  if (currentGroup.steps.length > 0) {
    groupedSteps.push(currentGroup)
  }

  return (
    <div className="border-t bg-white">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span>Working Process</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4" />
        ) : (
          <ChevronDown className="w-4 h-4" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          {groupedSteps.map((group, groupIdx) => (
            <div key={groupIdx} className="space-y-2">
              {group.message && (
                <p className="text-sm text-gray-700 mb-2">{group.message}</p>
              )}
              {group.steps.map((step) => (
                <div key={step.id} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    step.status === 'completed' ? 'bg-green-500' :
                    step.status === 'processing' ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-300'
                  }`} />
                  {step.type === 'write' && step.file && (
                    <button
                      onClick={() => onFileClick?.(step.file!)}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Write file {step.file}
                    </button>
                  )}
                  {step.type === 'read' && step.file && (
                    <span className="text-xs text-gray-600">
                      Read file {step.file}
                    </span>
                  )}
                  {step.type === 'command' && step.command && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onCommandClick?.(step.command!)}
                      className="h-6 text-xs"
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Run command in Terminal
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

