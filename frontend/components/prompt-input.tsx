'use client'

import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, X } from 'lucide-react'

interface PromptInputProps {
  onSuccess?: () => void
  onCancel?: () => void
}

export function PromptInput({ onSuccess, onCancel }: PromptInputProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const { createApp } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!prompt.trim()) return

    setIsGenerating(true)
    try {
      await createApp(prompt)
      setPrompt('')
      onSuccess?.()
    } catch (error) {
      console.error('Error creating app:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create New App</CardTitle>
              <CardDescription>
                Describe the app you want to build in natural language
              </CardDescription>
            </div>
            {onCancel && (
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="prompt" className="text-sm font-medium mb-2 block">
              Describe your app (App name will be auto-generated)
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Build a CRM dashboard with contact management, task tracking, and analytics..."
              rows={6}
              className="resize-none"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!prompt.trim() || isGenerating}>
              {isGenerating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isGenerating ? 'Generating...' : 'Generate App'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
    </div>
  )
}

