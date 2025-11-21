'use client'

import { FileText, FileEdit, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Step {
  id: string
  type: 'read' | 'write'
  file: string
  status: 'pending' | 'processing' | 'completed'
}

interface CreatingViewProps {
  steps: Step[]
  currentStep?: number
  message?: string
}

export function CreatingView({ steps, currentStep = 0, message }: CreatingViewProps) {
  const completedSteps = steps.filter(s => s.status === 'completed').length

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {completedSteps > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span>Processed {completedSteps} steps</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 rounded-full bg-gray-400 mt-2 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-gray-700 mb-3">{message}</p>
            <div className="space-y-2">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center gap-2">
                  <div className="w-px h-6 bg-gray-300 ml-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 bg-gray-50 hover:bg-gray-100 border-gray-200"
                    disabled={step.status === 'completed' || index > currentStep}
                  >
                    {step.type === 'read' ? (
                      <FileText className="h-3.5 w-3.5" />
                    ) : (
                      <FileEdit className="h-3.5 w-3.5" />
                    )}
                    <span className="text-xs">
                      {step.type === 'read' ? 'Read file' : 'Write file'} {step.file}
                    </span>
                    {step.status === 'completed' && (
                      <CheckCircle2 className="h-3 w-3 text-green-600 ml-1" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

