'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react'
import { EmptyEditor } from './empty-editor'
import { useAppStore } from '@/store/app-store'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'

interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  content?: string
  children?: FileNode[]
}

interface ProjectViewerProps {
  appId: string
  projectPath?: string
  selectedFilePath?: string | null
  onFileSelect?: (filePath: string) => void
}

const getLanguageExtensions = (filePath: string | null | undefined) => {
  if (!filePath) {
    return []
  }
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    return [javascript({ typescript: true })]
  }
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) {
    return [javascript()]
  }
  if (filePath.endsWith('.json')) {
    return [json()]
  }
  return []
}

export function ProjectViewer({ appId, projectPath, selectedFilePath, onFileSelect }: ProjectViewerProps) {
  const [fileContent, setFileContent] = useState<string>('')
  const [editedContent, setEditedContent] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const codeEditorRef = useRef<HTMLDivElement | null>(null)
  const isConnectingRef = useRef(false)
  const isAuthenticatedRef = useRef(false)
  const streamedContentRef = useRef<Map<string, string>>(new Map())
  const token = useAppStore((state) => state.token)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Use selectedFilePath prop as the source of truth
  useEffect(() => {
    console.log('🔵 ProjectViewer: selectedFilePath prop changed to:', selectedFilePath)
    if (selectedFilePath) {
      console.log('🔵 ProjectViewer: Setting currentFile to:', selectedFilePath)
      setCurrentFile(selectedFilePath)
      setFileContent('') // Clear old content immediately
      console.log('🔵 ProjectViewer: currentFile set, content cleared')
    } else if (selectedFilePath === null) {
      console.log('🔵 ProjectViewer: Clearing currentFile')
      setCurrentFile(null)
      setFileContent('')
    }
  }, [selectedFilePath])

  // Function to request file content - using useCallback to avoid recreation
  const requestFileContent = useCallback((filePath: string) => {
    if (!filePath || !appId) {
      console.log('📤 ProjectViewer: Skipping request - filePath:', filePath, 'appId:', appId)
      return
    }

    console.log('📤 ===== REQUESTING FILE CONTENT =====')
    console.log('📤 ProjectViewer: Requesting content for file:', filePath)
    console.log('📤 ProjectViewer: WebSocket state:', wsRef.current?.readyState, '(OPEN=1)')
    setIsLoadingFile(true)

    const sendRequest = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && isAuthenticatedRef.current) {
        const request = { 
          type: 'get_file_content', 
          appId, 
          filePath: filePath 
        }
        console.log('📤 ProjectViewer: Sending request:', request)
        wsRef.current.send(JSON.stringify(request))
        console.log('✅ ProjectViewer: Request sent successfully!')
        return true
      } else {
        console.log('⏳ ProjectViewer: WebSocket not ready, state:', wsRef.current?.readyState)
        setIsLoadingFile(false)
      }
      return false
    }

    // Try immediately
    if (!sendRequest()) {
      console.log('⏳ ProjectViewer: WebSocket not ready, will retry...')
      // Retry every 100ms for 5 seconds
      let retries = 0
      const maxRetries = 50
      const interval = setInterval(() => {
        retries++
        if (sendRequest()) {
          console.log('✅ ProjectViewer: Request sent after retry #', retries)
          clearInterval(interval)
        } else if (retries >= maxRetries) {
          console.error('❌ ProjectViewer: Failed to send request after', maxRetries, 'retries')
          setFileContent('// Error: Could not connect to server. Please refresh the page.')
          clearInterval(interval)
        }
      }, 100)

      return () => clearInterval(interval)
    }
  }, [appId])

  // WebSocket connection with reconnection logic
  useEffect(() => {
    if (!appId || !token) {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      return
    }

    if (isConnectingRef.current) {
      return
    }

    const connectWebSocket = () => {
      if (isConnectingRef.current) return
      
      // Close existing connection if any
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }

      isConnectingRef.current = true
      console.log('🔌 ProjectViewer: Connecting WebSocket for appId:', appId)
      
      try {
        const ws = new WebSocket(`ws://localhost:4000`)
        
        ws.onopen = () => {
          console.log('✅ ProjectViewer: WebSocket connected')
          isConnectingRef.current = false
          ws.send(JSON.stringify({ type: 'authenticate', token }))
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('📨 ProjectViewer: Received message type:', data.type)
            
            if (data.type === 'authenticated') {
              console.log('🛡️ ProjectViewer: WebSocket authenticated')
              isAuthenticatedRef.current = true
              ws.send(JSON.stringify({ type: 'get_project_files', appId }))
              if (currentFile) {
                requestFileContent(currentFile)
              }
              return
            }
            
            if (data.type === 'file_content') {
              console.log('✅ ProjectViewer: Got file content! Length:', data.content?.length || 0)
              setIsLoadingFile(false)
              if (data.content !== undefined && data.content !== null) {
                setFileContent(data.content)
                setEditedContent(data.content)
                setHasUnsavedChanges(false)
                console.log('✅ ProjectViewer: File content set in state')
              } else {
                setFileContent('// File content is empty')
                setEditedContent('// File content is empty')
              }
            } else if (data.type === 'file_content_updated') {
              // Live update from another client or generation
              setIsLoadingFile(false)
              if (data.filePath === currentFile) {
                setFileContent(data.content)
                setEditedContent(data.content)
                setHasUnsavedChanges(false)
              }
            } else if (data.type === 'file_created') {
              // New file created during generation - update if it's the current file
              setIsLoadingFile(false)
              if (data.filePath === currentFile) {
                console.log('🆕 ProjectViewer: Current file was just created! Updating content...')
                setFileContent(data.content || '')
                setEditedContent(data.content || '')
                setHasUnsavedChanges(false)
              }
              // Also update if file is being viewed (even if path doesn't match exactly)
              if (data.content && data.filePath) {
                console.log('🆕 ProjectViewer: File created:', data.filePath, 'Content length:', data.content.length)
              }
            } else if (data.type === 'file_saved') {
              setIsSaving(false)
              setHasUnsavedChanges(false)
              console.log('✅ File saved successfully')
            } else if (data.type === 'file_stream_start') {
              if (data.filePath) {
                streamedContentRef.current.set(data.filePath, '')
                if (data.filePath === currentFile) {
                  setIsLoadingFile(true)
                  setFileContent('')
                  setEditedContent('')
                  setHasUnsavedChanges(false)
                }
              }
            } else if (data.type === 'file_stream_chunk') {
              if (data.filePath && typeof data.line === 'string') {
                const prev = streamedContentRef.current.get(data.filePath) ?? ''
                const newContent = prev ? `${prev}\n${data.line}` : data.line
                streamedContentRef.current.set(data.filePath, newContent)

                if (data.filePath === currentFile) {
                  setIsLoadingFile(false)
                  setFileContent(newContent)
                  setEditedContent(newContent)
                  setHasUnsavedChanges(false)
                }
              }
            } else if (data.type === 'file_stream_complete') {
              if (data.filePath && data.filePath === currentFile) {
                setIsLoadingFile(false)
                setHasUnsavedChanges(false)
              }
            } else if (data.type === 'error') {
              console.error('❌ ProjectViewer: Error:', data.message)
              setIsLoadingFile(false)
              setFileContent(`// Error: ${data.message || 'Failed to load file'}`)
              setEditedContent(`// Error: ${data.message || 'Failed to load file'}`)
              setIsSaving(false)
            }
          } catch (error) {
            console.error('❌ ProjectViewer: Error parsing message:', error)
          }
        }

        ws.onerror = (error) => {
          console.error('❌ ProjectViewer: WebSocket error:', error)
          isConnectingRef.current = false
        }

        ws.onclose = (event) => {
          console.log('🔌 ProjectViewer: WebSocket disconnected', event.code, event.reason)
          isConnectingRef.current = false
          wsRef.current = null
          isAuthenticatedRef.current = false
          
          // Reconnect if not a normal closure and appId still exists
          if (event.code !== 1000 && appId) {
            console.log('🔄 ProjectViewer: Attempting to reconnect in 1 second...')
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket()
            }, 1000)
          }
        }

        wsRef.current = ws
      } catch (error) {
        console.error('❌ ProjectViewer: Error creating WebSocket:', error)
        isConnectingRef.current = false
      }
    }

    connectWebSocket()

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
        wsRef.current = null
      }
      isConnectingRef.current = false
    }
  }, [appId, token, currentFile, requestFileContent])

  // Request file content when currentFile changes
  useEffect(() => {
    if (!currentFile || !appId) {
      return
    }

    // Request file content when currentFile changes
    requestFileContent(currentFile)
    setHasUnsavedChanges(false)
  }, [currentFile, appId, requestFileContent])


  // Save file function
  const saveFile = useCallback(() => {
    if (!currentFile || !appId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Cannot save: missing file, appId, or WebSocket not ready')
      return
    }

    setIsSaving(true)
    wsRef.current.send(JSON.stringify({
      type: 'save_file',
      appId,
      filePath: currentFile,
      content: editedContent,
    }))
  }, [currentFile, appId, editedContent])

  // Handle keyboard shortcuts (Ctrl/Cmd + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (currentFile && hasUnsavedChanges) {
          saveFile()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentFile, hasUnsavedChanges, saveFile])

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e] text-[#d4d4d4] overflow-hidden border-l border-[#2c2c2c] shadow-inner">
      {/* File Path Bar */}
      {currentFile && (
        <div className="px-4 py-2 border-b border-[#2c2c2c] bg-[#252526] text-sm text-[#dcdcdc] font-mono flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
          <span className="text-[#858585]">ERP System</span>
          <span className="text-[#858585]">/</span>
          <span className="text-[#ffffff] font-medium">{currentFile}</span>
          {isLoadingFile && (
            <span className="ml-2 text-xs text-[#4fc1ff] animate-pulse">⏳ Streaming file content…</span>
          )}
          {!isLoadingFile && !fileContent && (
            <span className="ml-2 text-xs text-[#dcdcaa]">⚠️ File may still be generating…</span>
          )}
          {hasUnsavedChanges && (
            <span className="ml-2 text-xs text-[#ff8f40]">● Unsaved changes</span>
          )}
          </div>
          <button
            onClick={saveFile}
            disabled={!hasUnsavedChanges || isSaving}
            className="px-3 py-1 text-xs bg-[#0e639c] text-white rounded hover:bg-[#1177bb] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {isSaving ? 'Saving...' : 'Save (Ctrl+S)'}
          </button>
        </div>
      )}

      {/* Code Editor */}
      <div 
        ref={codeEditorRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#1e1e1e] code-editor-scroll-container" 
      >
        {currentFile ? (
          <div className="relative min-h-full flex">
            <CodeMirror
              value={editedContent}
              height="100%"
              theme={oneDark}
              extensions={getLanguageExtensions(currentFile)}
              onChange={(value) => {
                setEditedContent(value)
                setHasUnsavedChanges(value !== fileContent)
              }}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                highlightActiveLine: true,
                foldGutter: false,
                autocompletion: false,
              }}
              className="w-full text-sm"
            />
          </div>
        ) : (
          <EmptyEditor />
        )}
      </div>
    </div>
  )
}
