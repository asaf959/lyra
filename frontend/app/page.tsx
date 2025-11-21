'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/app-store'
import { PromptView } from '@/components/prompt-view'
import { CreatingView } from '@/components/creating-view'
import { ChatSidebar } from '@/components/chat-sidebar'
import { ProjectViewer } from '@/components/project-viewer'
import { AppViewer } from '@/components/app-viewer'
import { ViewSelector, ViewType } from '@/components/view-selector'
import { AuthForm } from '@/components/auth-form'
import { Header } from '@/components/header'
import { AppHeader } from '@/components/app-header'
import { FileExplorer } from '@/components/file-explorer'
import { Sidebar } from '@/components/sidebar'
import { LandingPage } from '@/components/landing-page'
import { ChatPanel } from '@/components/chat-panel'
import { EmptyEditor } from '@/components/empty-editor'
import { WorkingProcessPanel } from '@/components/working-process-panel'
import { LiveStreamPanel, LiveStreamState } from '@/components/live-stream-panel'

// Dynamically import Terminal to avoid SSR issues with xterm.js
const Terminal = dynamic(() => import('@/components/terminal').then(mod => ({ default: mod.Terminal })), {
  ssr: false,
  loading: () => <div className="p-4 text-gray-400">Loading terminal...</div>
})

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  steps?: Array<{ type: 'read' | 'write'; file: string; status: 'pending' | 'processing' | 'completed' }>
}

export default function Home() {
  const { apps, fetchApps, isLoading, token, createApp, setToken } = useAppStore()
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState<string>('')
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<ViewType>('editor')
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [liveStreams, setLiveStreams] = useState<Record<string, LiveStreamState>>({})
  
  // Prevent hydration mismatch by only accessing store after mount
  useEffect(() => {
    setMounted(true)
    // Load token from localStorage after mount
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('lyra_token')
      if (storedToken && !token) {
        setToken(storedToken)
      }
    }
  }, [token])
  
  // Debug: Log view changes
  useEffect(() => {
    if (mounted) {
      console.log('Current view changed to:', currentView)
    }
  }, [currentView, mounted])
  const [messages, setMessages] = useState<Message[]>([])
  const [creatingSteps, setCreatingSteps] = useState<Array<{ id: string; type: 'read' | 'write' | 'command'; file?: string; command?: string; status: 'pending' | 'processing' | 'completed'; message?: string }>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const promptFormRef = useRef<{ submit: () => void; setPrompt: (p: string) => void }>(null)
  const fileExplorerScrollLockRef = useRef<{ element: HTMLElement | null; lockedScrollTop: number }>({ element: null, lockedScrollTop: 0 })
  const loadedPromptAppIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (mounted && token) {
      fetchApps()
    }
  }, [token, fetchApps, mounted])

  // WebSocket connection for generation status updates
  useEffect(() => {
    if (!selectedAppId || !token || !mounted) return

    const ws = new WebSocket('ws://localhost:4000')
    let authenticated = false
    
    ws.onopen = () => {
      // Authenticate first
      ws.send(JSON.stringify({ type: 'authenticate', token }))
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'authenticated') {
          console.log('✅ Status WebSocket authenticated')
          authenticated = true
          // Subscribe to app updates
          ws.send(JSON.stringify({ type: 'get_project_files', appId: selectedAppId }))
        } else if (data.type === 'generation_status') {
          // Update creating steps with status information
          const statusMap: Record<string, 'pending' | 'processing' | 'completed'> = {
            'pending': 'pending',
            'planning': 'processing',
            'processing': 'processing',
            'generating': 'processing',
            'completed': 'completed',
            'failed': 'completed',
          }
          
          const stepStatus = statusMap[data.status] || 'processing'
          const statusMessage = data.message || `${data.status}${data.progress ? ` (${data.progress}%)` : ''}`
          
          setCreatingSteps(prev => {
            // Check if we already have a step with this message
            const existingStepIndex = prev.findIndex(s => s.message === statusMessage)
            
            if (existingStepIndex >= 0) {
              // Update existing step
              return prev.map((step, idx) => 
                idx === existingStepIndex 
                  ? { ...step, status: stepStatus, message: statusMessage }
                  : step
              )
            } else {
              // Add new step
              const newStep = {
                id: `status-${Date.now()}-${prev.length}`,
                type: 'command' as const,
                status: stepStatus,
                message: statusMessage,
              }
              return [...prev, newStep]
            }
          })
          
          // Keep generating state active while status is not completed
          if (data.status !== 'completed' && data.status !== 'failed') {
            setIsGenerating(true)
          } else {
            setIsGenerating(false)
          }
        }
      } catch (error) {
        console.error('Error parsing status WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      console.error('Status WebSocket error:', error)
    }

    ws.onclose = () => {
      console.log('Status WebSocket closed')
    }

    return () => {
      ws.close()
    }
  }, [selectedAppId, token, mounted])

  // Load prompt from selected app and display it in chat
  useEffect(() => {
    if (selectedAppId && apps.length > 0) {
      const selectedApp = apps.find(app => app.id === selectedAppId)
      if (selectedApp && selectedApp.prompt) {
        // Only load if we haven't loaded this app's prompt yet
        // This prevents overwriting messages when creating a new app
        if (loadedPromptAppIdRef.current !== selectedAppId) {
          // Use setMessages with a function to check current state
          setMessages(currentMessages => {
            // Check if we already have a user message with this prompt
            const hasMatchingPrompt = currentMessages.some(msg => 
              msg.role === 'user' && msg.content === selectedApp.prompt
            )
            
            // Only load if we don't have matching messages
            if (!hasMatchingPrompt) {
              // Create a user message with the prompt
              const promptMessage: Message = {
                id: `prompt-${selectedApp.id}`,
                role: 'user',
                content: selectedApp.prompt,
                timestamp: new Date(selectedApp.createdAt),
              }
              
              // Create an assistant response message
              const responseMessage: Message = {
                id: `response-${selectedApp.id}`,
                role: 'assistant',
                content: `✅ App "${selectedApp.name}" has been generated successfully! You can now view the files and run the app.`,
                timestamp: new Date(selectedApp.updatedAt || selectedApp.createdAt),
              }
              
              return [promptMessage, responseMessage]
            }
            return currentMessages
          })
          loadedPromptAppIdRef.current = selectedAppId
        }
      }
    } else if (!selectedAppId) {
      // Clear messages when no app is selected (but only if we're not in the middle of generating)
      if (!isGenerating) {
        setMessages([])
        loadedPromptAppIdRef.current = null
      }
    }
  }, [selectedAppId, apps, isGenerating])

  // Global scroll lock for file explorer and chat panel - prevents them from scrolling when code editor scrolls
  useEffect(() => {
    if (!selectedAppId) return

    const fileExplorerScrollable = document.querySelector('.file-explorer-scrollable') as HTMLElement
    const chatMessagesScrollable = document.querySelector('.chat-messages-scrollable') as HTMLElement

    if (!fileExplorerScrollable && !chatMessagesScrollable) return

    // Initialize locked scroll positions
    if (fileExplorerScrollable) {
      fileExplorerScrollLockRef.current.element = fileExplorerScrollable
      fileExplorerScrollLockRef.current.lockedScrollTop = fileExplorerScrollable.scrollTop
    }

    let isCodeEditorScrolling = false
    let lastFileExplorerScrollTop = fileExplorerScrollable?.scrollTop || 0
    let lastChatScrollTop = chatMessagesScrollable?.scrollTop || 0

    // Track when code editor is being scrolled
    const codeEditorWheelHandler = (e: WheelEvent) => {
      // Don't prevent default - allow code editor to scroll
      // Just track that it's scrolling to lock other panels
      isCodeEditorScrolling = true
      // Lock file explorer immediately
      if (fileExplorerScrollable && fileExplorerScrollable.scrollTop !== fileExplorerScrollLockRef.current.lockedScrollTop) {
        fileExplorerScrollable.scrollTop = fileExplorerScrollLockRef.current.lockedScrollTop
      }
      // Lock chat panel immediately
      if (chatMessagesScrollable && chatMessagesScrollable.scrollTop !== lastChatScrollTop) {
        chatMessagesScrollable.scrollTop = lastChatScrollTop
      }
      setTimeout(() => {
        isCodeEditorScrolling = false
      }, 100)
    }

    // Lock scrolls when they try to change
    const lockScrolls = () => {
      if (isCodeEditorScrolling) {
        // Code editor is scrolling - force lock
        if (fileExplorerScrollable && fileExplorerScrollable.scrollTop !== fileExplorerScrollLockRef.current.lockedScrollTop) {
          fileExplorerScrollable.scrollTop = fileExplorerScrollLockRef.current.lockedScrollTop
        }
        if (chatMessagesScrollable && chatMessagesScrollable.scrollTop !== lastChatScrollTop) {
          chatMessagesScrollable.scrollTop = lastChatScrollTop
        }
      } else {
        // Update lock positions if scrolling on their own
        if (fileExplorerScrollable && fileExplorerScrollable.scrollTop !== lastFileExplorerScrollTop) {
          fileExplorerScrollLockRef.current.lockedScrollTop = fileExplorerScrollable.scrollTop
          lastFileExplorerScrollTop = fileExplorerScrollable.scrollTop
        }
        if (chatMessagesScrollable && chatMessagesScrollable.scrollTop !== lastChatScrollTop) {
          lastChatScrollTop = chatMessagesScrollable.scrollTop
        }
      }
    }

    // Use requestAnimationFrame to constantly monitor and lock
    let rafId: number
    const monitorAndLock = () => {
      lockScrolls()
      rafId = requestAnimationFrame(monitorAndLock)
    }
    rafId = requestAnimationFrame(monitorAndLock)

    // Listen for code editor wheel events to track when it's scrolling
    // This allows us to lock other panels while code editor scrolls
    let codeEditorElement: HTMLElement | null = null
    let codeEditorObserver: MutationObserver | null = null
    
    const findAndAttachCodeEditor = () => {
      const codeEditor = document.querySelector('.code-editor-scroll-container') as HTMLElement
      if (codeEditor && !codeEditorElement) {
        codeEditorElement = codeEditor
        codeEditor.addEventListener('wheel', codeEditorWheelHandler, { capture: false, passive: true })
        return true
      }
      return false
    }
    
    // Try immediately
    if (!findAndAttachCodeEditor()) {
      // If not found, try again after a short delay
      codeEditorObserver = new MutationObserver(() => {
        if (findAndAttachCodeEditor()) {
          codeEditorObserver?.disconnect()
          codeEditorObserver = null
        }
      })
      codeEditorObserver.observe(document.body, { childList: true, subtree: true })
      
      // Also try after a timeout
      setTimeout(() => {
        findAndAttachCodeEditor()
        codeEditorObserver?.disconnect()
        codeEditorObserver = null
      }, 500)
    }

    // Lock on scroll events
    if (fileExplorerScrollable) {
      fileExplorerScrollable.addEventListener('scroll', lockScrolls, { passive: false, capture: true })
    }
    if (chatMessagesScrollable) {
      chatMessagesScrollable.addEventListener('scroll', lockScrolls, { passive: false, capture: true })
    }

    return () => {
      cancelAnimationFrame(rafId)
      if (codeEditorElement) {
        codeEditorElement.removeEventListener('wheel', codeEditorWheelHandler, { capture: false } as any)
        codeEditorElement = null
      }
      if (codeEditorObserver) {
        codeEditorObserver.disconnect()
        codeEditorObserver = null
      }
      if (fileExplorerScrollable) {
        fileExplorerScrollable.removeEventListener('scroll', lockScrolls, { capture: true } as any)
      }
      if (chatMessagesScrollable) {
        chatMessagesScrollable.removeEventListener('scroll', lockScrolls, { capture: true } as any)
      }
    }
  }, [selectedAppId])

  const handlePromptSubmit = async (prompt: string) => {
    if (!token) {
      setPendingPrompt(prompt)
      setShowAuthDialog(true)
      return
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])

    setIsGenerating(true)

    // Simulate creating steps for Working Process panel
    const steps = [
      { id: '1', type: 'read' as const, file: 'README.md', status: 'processing' as const },
      { id: '2', type: 'write' as const, file: 'app/page.tsx', status: 'pending' as const },
      { id: '3', type: 'write' as const, file: 'app/layout.tsx', status: 'pending' as const },
      { id: '4', type: 'write' as const, file: 'package.json', status: 'pending' as const },
    ]
    setCreatingSteps(steps)

    // Add assistant message with steps
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: "I'll help you create this application. Let me start by reading the template structure and then creating all necessary files.",
      timestamp: new Date(),
      steps: steps.map(s => ({ type: s.type, file: s.file, status: s.status })),
    }
    setMessages(prev => [...prev, assistantMessage])

    // Simulate step completion locally (visual feedback)
    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      setCreatingSteps(prev => prev.map((s, idx) => 
        idx === i ? { ...s, status: 'completed' as const } : s
      ))
    }

    try {
      console.log('Creating app with prompt:', prompt)
      const app = await createApp(prompt)
      console.log('App created:', app)
      
      if (app && app.id) {
        console.log('Setting selectedAppId to:', app.id)
        // Select the app FIRST to show the interface IMMEDIATELY
        // This ensures FileExplorer connects to WebSocket before files are broadcast
        setSelectedAppId(app.id)
        setCurrentView('editor')
        setSelectedFilePath(null) // Reset selected file when new app is created
        loadedPromptAppIdRef.current = app.id // Mark that we've loaded this app's prompt
        
        // Give FileExplorer time to mount and connect to WebSocket
        // This ensures the WebSocket is ready before backend starts broadcasting files
        await new Promise(resolve => setTimeout(resolve, 500))
        
        // Then clear creating steps and stop generating (real updates now come from backend)
        setCreatingSteps([])
        setIsGenerating(false)
        
        await fetchApps()
        
        // The prompt and response will be loaded automatically by the useEffect
        // No need to add completion message here as it will be added when the app is selected
      } else {
        console.error('App creation failed or returned null:', app)
        setIsGenerating(false)
        setCreatingSteps([])
        
        // Add error message to chat
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: `❌ Failed to create app. Please try again.`,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Error creating app:', error)
      setIsGenerating(false)
      setCreatingSteps([])
      
      // Add error message to chat
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: `❌ Error generating app: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    }
  }

  const handleAuthSuccess = () => {
    setShowAuthDialog(false)
    if (pendingPrompt && promptFormRef.current) {
      promptFormRef.current.setPrompt(pendingPrompt)
      setTimeout(() => {
        promptFormRef.current?.submit()
      }, 500)
    }
  }

  const handleStreamEvent = useCallback(
    (event: { type: 'file_stream_start' | 'file_stream_chunk' | 'file_stream_complete'; filePath?: string; line?: string; totalLines?: number }) => {
      if (!event.filePath) {
        return
      }

      setLiveStreams((prev) => {
        const next = { ...prev }
        const current: LiveStreamState = next[event.filePath] ?? {
          filePath: event.filePath!,
          lines: [],
          status: 'streaming',
        }

        if (event.type === 'file_stream_start') {
          current.lines = []
          current.status = 'streaming'
          if (event.totalLines) {
            current.totalLines = event.totalLines
          }
        } else if (event.type === 'file_stream_chunk' && typeof event.line === 'string') {
          current.lines = [...current.lines, event.line]
        } else if (event.type === 'file_stream_complete') {
          current.status = 'completed'
        }

        next[event.filePath] = { ...current }
        return next
      })
    },
    []
  )

  const handleDismissStream = useCallback((filePath: string) => {
    setLiveStreams((prev) => {
      if (!(filePath in prev)) return prev
      const next = { ...prev }
      delete next[filePath]
      return next
    })
  }, [])

  const handleFileClick = (filePath: string) => {
    console.log('')
    console.log('🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯')
    console.log('🎯 MAIN HANDLER: FILE CLICKED!')
    console.log('🎯 File Path:', filePath)
    console.log('🎯 Current selectedFilePath (before):', selectedFilePath)
    console.log('🎯 Current view:', currentView)
    console.log('🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯🎯')
    console.log('')
    
    // Set the selected file path so ProjectViewer can display it
    setSelectedFilePath(filePath)
    console.log('✅ setSelectedFilePath called with:', filePath)
    
    // Only switch to editor if we're not in terminal view
    if (currentView !== 'terminal') {
      setCurrentView('editor')
      console.log('✅ Switched to editor view')
    }
    handleDismissStream(filePath)
    
    console.log('✅✅✅ FILE CLICK HANDLED SUCCESSFULLY! ✅✅✅')
    console.log('')
  }

  const handleNewChat = () => {
    setSelectedAppId(null)
    setCurrentView('editor')
    setMessages([])
  }

  const renderMainContent = (): JSX.Element => {
    // Only log after mount to prevent hydration issues
    if (mounted) {
      console.log('renderMainContent - selectedAppId:', selectedAppId, 'isGenerating:', isGenerating)
    }
    
    if (!selectedAppId) {
      return (
        <LandingPage 
          onPromptSubmit={handlePromptSubmit}
          isGenerating={isGenerating}
        />
      )
    }

    switch (currentView) {
      case 'editor':
        return (
          <div className="h-full flex flex-col overflow-hidden">
            <ProjectViewer 
              appId={selectedAppId} 
              selectedFilePath={selectedFilePath}
              onFileSelect={handleFileClick}
            />
          </div>
        )
      case 'app-viewer':
        return (
          <div className="h-full overflow-hidden">
            <AppViewer appId={selectedAppId} />
          </div>
        )
      case 'terminal':
        // Terminal is shown in bottom panel, so show editor in main area
        return (
          <div className="h-full overflow-hidden">
            <ProjectViewer 
              appId={selectedAppId} 
              selectedFilePath={selectedFilePath}
              onFileSelect={handleFileClick}
            />
          </div>
        )
      case 'file':
        return (
          <div className="h-full overflow-hidden">
            <FileExplorer appId={selectedAppId} onFileClick={handleFileClick} onStreamEvent={handleStreamEvent} />
          </div>
        )
      default:
        return (
          <div className="h-full overflow-hidden">
            <ProjectViewer 
              appId={selectedAppId} 
              selectedFilePath={selectedFilePath}
              onFileSelect={handleFileClick}
            />
          </div>
        )
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden" style={{ position: 'relative' }}>
      {selectedAppId ? (
        <AppHeader 
          appName={apps.find(app => app.id === selectedAppId)?.name}
          onExit={handleNewChat}
          onPublish={() => console.log('Publish')}
          onShare={() => console.log('Share')}
          onRefresh={() => fetchApps()}
        />
      ) : (
        <Header onLoginClick={() => setShowAuthDialog(true)} />
      )}
      
      <div 
        className="flex-1 flex overflow-hidden relative min-h-0 main-content-container" 
        style={{ 
          overscrollBehavior: 'none',
          overscrollBehaviorY: 'none',
          overscrollBehaviorX: 'none',
          position: 'relative',
          height: selectedAppId && currentView !== 'terminal' ? 'calc(100vh - 56px - 48px)' : 'calc(100vh - 56px)',
          maxHeight: selectedAppId && currentView !== 'terminal' ? 'calc(100vh - 56px - 48px)' : 'calc(100vh - 56px)',
          display: 'flex',
          flexDirection: 'row',
          overflow: 'hidden',
          touchAction: 'none'
        }}
        ref={(el) => {
          if (el) {
            // Use addEventListener with passive: false to allow preventDefault
            const handleWheel = (e: WheelEvent) => {
              const target = e.target as HTMLElement;
              const isCodeEditor = target.closest('.code-editor-scroll-container');
              const isFileExplorer = target.closest('.file-explorer-scrollable');
              const isChatMessages = target.closest('.chat-messages-scrollable');
              
              // If not from any scrollable area, prevent default and stop propagation
              if (!isCodeEditor && !isFileExplorer && !isChatMessages) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
              }
            };
            
            el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
            
            return () => {
              el.removeEventListener('wheel', handleWheel, { capture: true } as any);
            };
          }
        }}
      >
        {/* Left Sidebar - Navigation (Hidden by default, shows on hover) */}
        {!selectedAppId && (
          <>
            {/* Hover trigger area - invisible strip on left edge */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-2 z-40"
              onMouseEnter={() => setShowSidebar(true)}
            />
            {/* Sidebar */}
            <div 
              className={`absolute left-0 top-0 bottom-0 z-50 transition-transform duration-300 ${
                showSidebar ? 'translate-x-0' : '-translate-x-full'
              }`}
              onMouseEnter={() => setShowSidebar(true)}
              onMouseLeave={() => setShowSidebar(false)}
            >
              <Sidebar 
                onNewChat={handleNewChat}
                onAppSelect={(appId) => {
                  setSelectedAppId(appId)
                  setCurrentView('editor')
                  setShowSidebar(false)
                }}
                selectedAppId={selectedAppId}
              />
            </div>
          </>
        )}

        {/* THREE SECTIONS LAYOUT when app is selected */}
        {selectedAppId ? (
          <>
            {/* Section 1: Left - Chat Panel - FIXED, doesn't scroll with code editor */}
            <div 
              className="w-80 border-r bg-white flex flex-col overflow-hidden flex-shrink-0 chat-panel-section" 
              style={{ 
                overscrollBehavior: 'none',
                overscrollBehaviorY: 'none',
                overscrollBehaviorX: 'none',
                position: 'relative',
                isolation: 'isolate',
                contain: 'layout style paint',
                height: '100%',
                maxHeight: '100%',
                overflow: 'hidden'
              }}
              ref={(el) => {
                if (el) {
                  // Use addEventListener with passive: false to allow preventDefault
                  const handleWheel = (e: WheelEvent) => {
                    const target = e.target as HTMLElement;
                    // If event is from code editor, ABSOLUTELY block it
                    if (target.closest('.code-editor-scroll-container')) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      return false;
                    }
                    // Only allow if from chat scrollable area
                    if (!target.closest('.chat-messages-scrollable')) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      return false;
                    }
                  };
                  
                  el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
                  
                  // Also prevent scroll events
                  const blockScroll = (e: Event) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('.chat-messages-scrollable')) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                    }
                  };
                  el.addEventListener('scroll', blockScroll, { capture: true });
                  
                  return () => {
                    el.removeEventListener('wheel', handleWheel, { capture: true } as any);
                    el.removeEventListener('scroll', blockScroll, { capture: true } as any);
                  };
                }
              }}
            >
              <ChatPanel 
                messages={messages}
                isGenerating={isGenerating}
                onFileClick={handleFileClick}
                onSendMessage={handlePromptSubmit}
                creatingSteps={creatingSteps}
              />
            </div>

            {/* Section 2: Middle - File Explorer - COMPLETELY FIXED AND ISOLATED */}
            <div 
              className="w-64 border-r bg-white flex flex-col overflow-hidden file-explorer-section flex-shrink-0"
              style={{ 
                overscrollBehavior: 'none',
                overscrollBehaviorY: 'none',
                overscrollBehaviorX: 'none',
                position: 'relative',
                isolation: 'isolate',
                contain: 'layout style paint',
                pointerEvents: 'auto',
                height: '100%',
                maxHeight: '100%',
                overflow: 'hidden'
              }}
              ref={(el) => {
                if (el) {
                  // Use addEventListener with passive: false to allow preventDefault
                  const handleWheel = (e: WheelEvent) => {
                    const target = e.target as HTMLElement;
                    // If event is from code editor, ABSOLUTELY block it
                    if (target.closest('.code-editor-scroll-container')) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      return false;
                    }
                    // Only allow if from file explorer scrollable area
                    if (!target.closest('.file-explorer-scrollable')) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                      return false;
                    }
                  };
                  
                  el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
                  
                  // Also prevent scroll events
                  const blockScroll = (e: Event) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('.file-explorer-scrollable')) {
                      e.preventDefault();
                      e.stopPropagation();
                      e.stopImmediatePropagation();
                    }
                  };
                  el.addEventListener('scroll', blockScroll, { capture: true });
                  
                  return () => {
                    el.removeEventListener('wheel', handleWheel, { capture: true } as any);
                    el.removeEventListener('scroll', blockScroll, { capture: true } as any);
                  };
                }
              }}
            >
              {/* File Explorer Header */}
              <div className="px-3 py-2 border-b bg-white flex items-center gap-2 flex-shrink-0">
                <span className="text-sm font-semibold text-gray-900">
                  {apps.find(app => app.id === selectedAppId)?.name || 'shadcn-ui'}
                </span>
              </div>
              
              {/* File Explorer - FIXED, doesn't scroll with code editor */}
              <div 
                className="flex-1 min-h-0 overflow-hidden file-explorer-container"
                style={{ 
                  overscrollBehavior: 'none',
                  overscrollBehaviorY: 'none',
                  overscrollBehaviorX: 'none',
                  touchAction: 'auto', // Allow clicks and touches
                  position: 'relative',
                  isolation: 'isolate',
                  height: '100%',
                  maxHeight: '100%',
                  overflow: 'hidden',
                  pointerEvents: 'auto' // Ensure clicks work
                }}
                onWheel={(e) => {
                  // Block all wheel events except from file explorer scrollable
                  // BUT don't block click events
                  const target = e.target as HTMLElement;
                  if (!target.closest('.file-explorer-scrollable')) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
                onClick={(e) => {
                  // Allow clicks to propagate - don't block them
                  // This ensures file clicks work
                }}
              >
            <FileExplorer appId={selectedAppId} onFileClick={handleFileClick} onStreamEvent={handleStreamEvent} />
                <FileExplorer appId={selectedAppId} onFileClick={handleFileClick} onStreamEvent={handleStreamEvent} />
              </div>
            </div>

            {/* Section 3: Right - Code Editor (Main Content) */}
            <div 
              className="flex-1 flex flex-col overflow-hidden bg-white relative flex-shrink-0 code-editor-section" 
              style={{ 
                overscrollBehavior: 'none',
                overscrollBehaviorY: 'none',
                overscrollBehaviorX: 'none',
                height: '100%',
                maxHeight: '100%',
                minWidth: 0,
                position: 'relative',
                isolation: 'isolate',
                contain: 'layout style paint'
              }}
              ref={(el) => {
                if (el) {
                  // Use addEventListener with passive: false to allow preventDefault
                  const handleWheel = (e: WheelEvent) => {
                    const target = e.target as HTMLElement;
                    if (!target.closest('.code-editor-scroll-container')) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  };
                  
                  el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
                  
                  return () => {
                    el.removeEventListener('wheel', handleWheel, { capture: true } as any);
                  };
                }
              }}
            >
              {/* Main content area - adjust height when terminal is visible */}
              <div 
                className={`${currentView === 'terminal' ? 'flex-1 min-h-0' : 'flex-1 min-h-0'} overflow-hidden`} 
                style={{ 
                  overscrollBehavior: 'none',
                  overscrollBehaviorY: 'none',
                  overscrollBehaviorX: 'none',
                  height: '100%',
                  maxHeight: '100%'
                }}
              >
                {renderMainContent()}
              </div>
              
              {/* Bottom Terminal Panel - Only when terminal view is active */}
              {currentView === 'terminal' && selectedAppId && (
                <div 
                  className="h-64 border-t-2 border-gray-700 bg-gray-900 overflow-hidden flex flex-col flex-shrink-0 shadow-2xl"
                  style={{ backgroundColor: '#111827' }}
                  data-testid="terminal-panel"
                >
                  <div className="px-4 py-2 border-b border-gray-700 flex items-center justify-between bg-gray-800 flex-shrink-0">
                    <span className="text-sm text-gray-300 font-mono font-semibold">Terminal</span>
                    <ViewSelector currentView={currentView} onViewChange={setCurrentView} />
                  </div>
                  <div 
                    className="flex-1 overflow-hidden" 
                    style={{ 
                      minHeight: 0, 
                      position: 'relative',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {selectedAppId ? (
                      <Terminal appId={selectedAppId} />
                    ) : (
                      <div className="p-4 text-gray-400">No app selected</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Debug: Show current view */}
              {process.env.NODE_ENV === 'development' && (
                <div className="absolute top-2 right-2 bg-yellow-200 px-2 py-1 text-xs z-50">
                  View: {currentView} | App: {selectedAppId ? 'Yes' : 'No'}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Show chat during generation if we have messages */
          (messages.length > 0 || isGenerating) && (
            <div className="w-80 border-r bg-white flex flex-col h-full overflow-hidden">
              <ChatPanel 
                messages={messages}
                isGenerating={isGenerating}
                onFileClick={handleFileClick}
                onSendMessage={handlePromptSubmit}
                creatingSteps={creatingSteps}
              />
            </div>
          )
        )}

        {/* Main Content Area - Only shown when no app is selected */}
        {!selectedAppId && (
          <div className="flex-1 flex flex-col overflow-hidden bg-white">
            <div className="flex-1 overflow-hidden">
              {renderMainContent()}
            </div>
          </div>
        )}
      </div>

      {selectedAppId && Object.keys(liveStreams).length > 0 && (
        <div className="absolute bottom-4 right-4 z-50">
          <LiveStreamPanel
            streams={liveStreams}
            onSelectFile={(filePath) => {
              handleFileClick(filePath)
              handleDismissStream(filePath)
            }}
            onDismiss={handleDismissStream}
          />
        </div>
      )}

      {/* View Selector Footer - Only shown in main content area, not in chat section */}
      {selectedAppId && currentView !== 'terminal' && (
        <div 
          className="fixed-footer flex items-center justify-end px-4 py-2"
          style={{
            height: '48px',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            width: 'calc(100% - 320px)',
            left: '320px',
            right: '0'
          }}
        >
          <ViewSelector currentView={currentView} onViewChange={setCurrentView} />
        </div>
      )}

      <AuthForm 
        open={showAuthDialog} 
        onOpenChange={(open) => {
          setShowAuthDialog(open)
          if (!open) {
            setPendingPrompt('')
          }
        }}
        onSuccess={handleAuthSuccess}
      />
    </div>
  )
}
