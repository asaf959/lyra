'use client'

import { useState, useImperativeHandle, forwardRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface PromptFormProps {
  onAppGenerated?: (appId: string) => void
  onNeedAuth?: (prompt: string) => void
}

export const PromptForm = forwardRef<{ submit: () => void; setPrompt: (p: string) => void }, PromptFormProps>(
  ({ onAppGenerated, onNeedAuth }, ref) => {
    const [prompt, setPrompt] = useState('')
    const [isGenerating, setIsGenerating] = useState(false)
    const { createApp, token } = useAppStore()

    useImperativeHandle(ref, () => ({
      submit: async () => {
        if (!prompt.trim() || !token) return
        await handleSubmitInternal()
      },
      setPrompt: (p: string) => {
        setPrompt(p)
      },
    }))

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault()
      if (!prompt.trim()) return

      if (!token) {
        onNeedAuth?.(prompt)
        return
      }

      await handleSubmitInternal()
    }

    const handleSubmitInternal = async () => {
      if (!prompt.trim() || !token) return

      setIsGenerating(true)
      try {
        const app = await createApp(prompt)
        if (app) {
          onAppGenerated?.(app.id)
          // Don't clear prompt - keep it visible
        }
      } catch (error) {
        console.error('Error creating app:', error)
      } finally {
        setIsGenerating(false)
      }
    }

    return (
      <form onSubmit={handleSubmit} className="w-full max-w-3xl mx-auto">
        <div className="space-y-4">
          <div>
            <label htmlFor="prompt" className="text-sm font-medium mb-2 block text-gray-700">
              Describe your app idea
            </label>
            <Textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a complete ERP system with dashboard, user management, inventory tracking, and sales module using Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui..."
              rows={6}
              className="resize-none text-base"
              disabled={isGenerating}
            />
            <p className="text-xs text-gray-500 mt-2">
              Be as detailed as possible. The app name will be auto-generated.
            </p>
          </div>
          <div className="flex justify-center">
            <Button 
              type="submit" 
              disabled={!prompt.trim() || isGenerating}
              size="lg"
              className="min-w-[200px]"
            >
              {isGenerating && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
              {isGenerating ? 'Generating...' : 'Generate App'}
            </Button>
          </div>
        </div>
      </form>
    )
  }
)

PromptForm.displayName = 'PromptForm'
