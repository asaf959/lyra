'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Settings, Send, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface PromptViewProps {
  onSubmit: (prompt: string) => void
  isGenerating?: boolean
  placeholder?: string
}

export function PromptView({ onSubmit, isGenerating = false, placeholder = "Ask Alex to do slide" }: PromptViewProps) {
  const [prompt, setPrompt] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (prompt.trim() && !isGenerating) {
      onSubmit(prompt.trim())
      setPrompt('')
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={placeholder}
            className="min-h-[100px] resize-none border-0 focus-visible:ring-0 text-base"
            disabled={isGenerating}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e)
              }
            }}
          />
          
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg border"
              >
                <Plus className="h-4 w-4" />
              </Button>
              
              <div className="relative">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg border"
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Badge 
                  variant="default" 
                  className="absolute -top-2 -right-2 h-5 px-1.5 text-xs bg-purple-600 hover:bg-purple-700"
                >
                  New
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={!prompt.trim() || isGenerating}
                size="icon"
                className="h-9 w-9 rounded-lg bg-gray-900 hover:bg-gray-800 text-white"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

