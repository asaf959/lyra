'use client'

import { useState, useRef, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2, Plus, Grid3x3, Search, ChevronDown, ArrowUp, Users, User } from 'lucide-react'
import { format } from 'date-fns'
import { WorkingProcessPanel } from '@/components/working-process-panel'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  steps?: Array<{ type: 'read' | 'write'; file: string; status: 'pending' | 'processing' | 'completed' }>
}

interface ChatPanelProps {
  messages: Message[]
  isGenerating?: boolean
  onFileClick?: (filePath: string) => void
  onSendMessage?: (message: string) => void
  creatingSteps?: Array<{ id: string; type: 'read' | 'write' | 'command'; file?: string; command?: string; status: 'pending' | 'processing' | 'completed'; message?: string }>
}

export function ChatPanel({ 
  messages, 
  isGenerating, 
  onFileClick,
  onSendMessage,
  creatingSteps = []
}: ChatPanelProps) {
  const [inputValue, setInputValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }, [inputValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (inputValue.trim() && onSendMessage) {
      onSendMessage(inputValue.trim())
      setInputValue('')
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Scrollable Messages Area - ONLY THIS SCROLLS */}
      <div 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden chat-messages-scrollable"
        style={{
          overscrollBehavior: 'contain',
          overscrollBehaviorY: 'contain',
          overscrollBehaviorX: 'none',
          isolation: 'isolate',
          contain: 'layout style paint',
          position: 'relative'
        }}
        onWheel={(e) => {
          // Stop propagation to prevent affecting other sections
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        onTouchMove={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        onScroll={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        ref={(el) => {
          if (el) {
            // Block external scroll events in capture phase
            const blockExternal = (e: WheelEvent) => {
              const target = e.target as HTMLElement;
              // If event is from code editor, block it
              if (target.closest('.code-editor-scroll-container')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return false;
              }
            };
            el.addEventListener('wheel', blockExternal, { capture: true, passive: false });
          }
        }}
      >
        <div className="p-4 space-y-4 pb-4">
            {/* Date */}
            {messages.length > 0 && (
              <div className="text-xs text-gray-500 mb-2">
                {format(new Date(), 'MMM d, yyyy')}
              </div>
            )}
            
            {/* Messages */}
            {messages.map((message) => (
              <div key={message.id} className="space-y-3">
                {message.role === 'user' ? (
                  <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-900 leading-relaxed">
                    {message.content}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">
                        A
                      </div>
                      <div className="text-sm font-semibold text-gray-900">Alex Engineer</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 ml-10 leading-relaxed">
                      {message.content}
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Fixed Bottom Input Area - Single Unified Footer - NEVER SCROLLS */}
      <div className="flex-shrink-0 border-t bg-white z-10">
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Input textarea area - clearly visible above footer */}
          <div className="px-3 pt-3 pb-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="How's it going? Ask the team to ..."
              className="w-full px-3 py-2.5 text-sm border-0 bg-transparent focus:outline-none resize-none min-h-[60px] max-h-[120px] overflow-y-auto placeholder:text-gray-400 text-gray-900 leading-relaxed"
              disabled={isGenerating}
              rows={2}
              style={{ lineHeight: '1.5' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
            />
          </div>

          {/* Single unified footer bar */}
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-t border-gray-200">
            {/* Left side - Square icon buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                title="Add"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                title="Team"
              >
                <Users className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors"
                title="User"
              >
                <User className="w-4 h-4" />
              </button>
            </div>

            {/* Right side - Model selector and Send button */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded-md transition-colors"
                title="Model"
              >
                <span className="font-medium">Claude Sonnet 4.5</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              <button
                type="submit"
                disabled={!inputValue.trim() || isGenerating}
                className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Loading indicator - only shown when generating */}
          {isGenerating && (
            <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Alex is thinking...</span>
              </div>
            </div>
          )}
        </form>
        
        {/* Working Process Panel - shows generation status */}
        {creatingSteps.length > 0 && (
          <WorkingProcessPanel 
            steps={creatingSteps}
            onFileClick={onFileClick}
          />
        )}
      </div>
    </div>
  )
}

