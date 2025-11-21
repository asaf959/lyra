'use client'

import { Sparkles } from 'lucide-react'
import { PromptView } from './prompt-view'

interface LandingPageProps {
  onPromptSubmit: (prompt: string) => void
  isGenerating?: boolean
}

export function LandingPage({ onPromptSubmit, isGenerating }: LandingPageProps) {
  return (
    <div className="flex flex-col h-full bg-gray-50">

      {/* Main Content - Centered */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Icon */}
        <div className="mb-6">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        {/* Main Title */}
        <h1 className="text-5xl font-bold text-gray-900 mb-8 text-center">
          Build Your Ideas with Agents
        </h1>

        {/* Prompt Input - Large and Centered */}
        <div className="w-full max-w-3xl">
          <PromptView 
            onSubmit={onPromptSubmit}
            isGenerating={isGenerating}
            placeholder="Ask Alex to generate your LinkHub."
          />
        </div>
      </div>
    </div>
  )
}
