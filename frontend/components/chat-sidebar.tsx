'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  steps?: Array<{ type: 'read' | 'write'; file: string; status: 'pending' | 'processing' | 'completed' }>
}

interface ChatSidebarProps {
  messages: Message[]
  onFileClick?: (filePath: string) => void
}

export function ChatSidebar({ messages, onFileClick }: ChatSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b text-xs font-semibold text-gray-600 uppercase">
        Chat
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-8">
              No messages yet. Start a conversation!
            </div>
          ) : (
            messages.map((message) => (
            <div key={message.id} className="space-y-2">
              <div className="text-xs text-gray-500">
                {format(message.timestamp, 'MMM d, yyyy')}
              </div>
              
              {message.role === 'user' ? (
                <div className="bg-blue-50 rounded-lg p-3 text-sm">
                  {message.content}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Alex Engineer</span> says:
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-sm">
                    {message.content}
                  </div>
                  
                  {message.steps && message.steps.length > 0 && (
                    <div className="space-y-1 ml-4">
                      {message.steps.map((step, index) => (
                        <button
                          key={index}
                          onClick={() => onFileClick?.(step.file)}
                          className="flex items-center gap-2 text-xs text-gray-600 hover:text-gray-900"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                          {step.type === 'read' ? 'Read' : 'Write'} {step.file}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )))}
        </div>
      </ScrollArea>
    </div>
  )
}

