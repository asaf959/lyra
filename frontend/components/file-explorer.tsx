'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { Folder, File, ChevronRight, ChevronDown } from 'lucide-react'

interface FileNode {
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileNode[]
}

interface LiveStreamEvent {
  type: 'file_stream_start' | 'file_stream_chunk' | 'file_stream_complete'
  filePath: string
  line?: string
  totalLines?: number
}

interface FileExplorerProps {
  appId: string
  onFileClick?: (filePath: string) => void
  onStreamEvent?: (event: LiveStreamEvent) => void
}

export function FileExplorer({ appId, onFileClick, onStreamEvent }: FileExplorerProps) {
  const [files, setFiles] = useState<FileNode[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['app', 'components']))
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const token = useAppStore((state) => state.token)
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  
  const fetchControllerRef = useRef<AbortController | null>(null)
  
  if (!appId) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        No app selected
      </div>
    )
  }

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isConnectingRef = useRef(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchRemoteTree = useCallback(async (attempt: number = 0) => {
    if (!appId || !token) {
      return
    }
    try {
      fetchControllerRef.current?.abort()
      const controller = new AbortController()
      fetchControllerRef.current = controller
      const response = await fetch(`${API_URL}/api/apps/${appId}/remote/tree`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      })
      const data = await response.json()
      if (data?.success) {
        const tree = data.data?.files || data.files || []
        console.log('📁 FileExplorer: Remote tree fetched from HTTP API. Items:', tree.length)
        setFiles(tree)
        // Auto-expand root folders
        if (tree.length > 0) {
          const appFolder = tree.find((f: any) => f.name === 'app' && f.type === 'folder')
          if (appFolder) {
            setExpandedFolders((prev) => new Set([...prev, 'app']))
          }
        }
        // Cancel any pending retries once we have data
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }
      } else {
        console.error('❌ FileExplorer: Failed to fetch remote tree:', data?.error)
        if (attempt < 15) {
          retryTimeoutRef.current = setTimeout(() => fetchRemoteTree(attempt + 1), 2000)
        }
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        return
      }
      console.error('❌ FileExplorer: Error fetching remote tree:', error)
      if (attempt < 15) {
        retryTimeoutRef.current = setTimeout(() => fetchRemoteTree(attempt + 1), 2000)
      }
    }
  }, [API_URL, appId, token])

  useEffect(() => {
    fetchRemoteTree()
    return () => {
      fetchControllerRef.current?.abort()
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [appId, token, fetchRemoteTree])

  useEffect(() => {
    if (!appId || !token) return

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
    }

    pollingIntervalRef.current = setInterval(() => {
      fetchRemoteTree()
    }, 3000)

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [appId, token, fetchRemoteTree])

  useEffect(() => {
    console.log('🔍 FileExplorer: Component mounted/updated, appId:', appId)
    console.log('🔍 FileExplorer: Files count:', files.length)
    console.log('🔍 FileExplorer: onFileClick exists?', typeof onFileClick === 'function')
    
    if (!appId) {
      console.log('🔍 FileExplorer: No appId, skipping WebSocket connection')
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      return
    }

    if (isConnectingRef.current || !token) {
      if (!token) {
        console.warn('⚠️ FileExplorer: Cannot connect WebSocket without token')
      }
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
      console.log('🔍 FileExplorer: Connecting WebSocket...')
      
      try {
        const ws = new WebSocket(`ws://localhost:4000`)
        
        ws.onopen = () => {
          console.log('✅✅✅ FileExplorer: WebSocket CONNECTED for appId:', appId)
          isConnectingRef.current = false
          // Authenticate first
          ws.send(JSON.stringify({ type: 'authenticate', token }))
          console.log('🛡️ FileExplorer: Sent authenticate message for appId:', appId)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            console.log('📨 FileExplorer: Received message', data.type, 'for appId:', appId)
            if (data.type === 'authenticated') {
              console.log('🛡️ FileExplorer: WebSocket authenticated, requesting project files')
              ws.send(JSON.stringify({ type: 'get_project_files', appId }))
              return
            }
            if (data.type === 'project_files') {
              console.log('📁 FileExplorer: Received project_files update!', data.files?.length || 0, 'items in tree')
              if (data.files && data.files.length > 0) {
                console.log('📁 FileExplorer: File tree sample (first 3):', JSON.stringify(data.files.slice(0, 3), null, 2))
              }
              // Update files state - this will trigger re-render and show files in UI
              setFiles(data.files || [])
              
              // Auto-expand 'app' folder so users can see the main app design immediately
              if (data.files && data.files.length > 0) {
                const appFolder = data.files.find((f: any) => f.name === 'app' && f.type === 'folder')
                if (appFolder) {
                  setExpandedFolders(prev => new Set([...prev, 'app']))
                  console.log('📂 FileExplorer: Auto-expanded app folder to show app/page.tsx')
                }
              }
              
              console.log('✅✅✅ FileExplorer: Files state updated! Total items in tree:', data.files?.length || 0)
              console.log('✅✅✅ FileExplorer: Files should now be visible in the UI!')
            } else if (data.type === 'file_created') {
              // Live update: add new file to tree
              console.log('🆕 FileExplorer: NEW FILE CREATED!', data.filePath, 'Content length:', data.content?.length || 0)
              setFiles(prevFiles => {
                const newFiles = [...prevFiles]
                const pathParts = data.filePath.split('/')
                const fileName = pathParts[pathParts.length - 1]
                
                // Helper function to insert file into tree
                const insertFile = (nodes: FileNode[], pathParts: string[], index: number): FileNode[] => {
                  if (index === pathParts.length - 1) {
                    // This is the file itself
                    const fileNode: FileNode = {
                      name: fileName,
                      type: 'file',
                      path: data.filePath,
                    }
                    // Check if file already exists
                    if (!nodes.find(n => n.path === data.filePath)) {
                      nodes.push(fileNode)
                      nodes.sort((a, b) => {
                        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
                        return a.name.localeCompare(b.name)
                      })
                    }
                    return nodes
                  }
                  
                  // This is a folder
                  const folderName = pathParts[index]
                  let folder = nodes.find(n => n.name === folderName && n.type === 'folder')
                  
                  if (!folder) {
                    folder = {
                      name: folderName,
                      type: 'folder',
                      path: pathParts.slice(0, index + 1).join('/'),
                      children: [],
                    }
                    nodes.push(folder)
                    nodes.sort((a, b) => {
                      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
                      return a.name.localeCompare(b.name)
                    })
                  }
                  
                  if (!folder.children) {
                    folder.children = []
                  }
                  
                  folder.children = insertFile(folder.children, pathParts, index + 1)
                  return nodes
                }
                
                return insertFile(newFiles, pathParts, 0)
              })
              
              // Auto-expand parent folders
              const pathParts = data.filePath.split('/')
              for (let i = 1; i < pathParts.length; i++) {
                const folderPath = pathParts.slice(0, i).join('/')
                setExpandedFolders(prev => new Set([...prev, folderPath]))
              }
            } else if (
              data.type === 'file_stream_start' ||
              data.type === 'file_stream_chunk' ||
              data.type === 'file_stream_complete'
            ) {
              if (data.filePath) {
                onStreamEvent?.({
                  type: data.type,
                  filePath: data.filePath,
                  line: data.line,
                  totalLines: data.totalLines,
                })
              }
            }
          } catch (error) {
            console.error('❌ Error parsing WebSocket message:', error)
          }
        }

        ws.onerror = (error) => {
          console.error('❌ FileExplorer: WebSocket error:', error)
          isConnectingRef.current = false
        }

        ws.onclose = (event) => {
          console.log('🔌 FileExplorer: WebSocket disconnected', event.code, event.reason)
          isConnectingRef.current = false
          wsRef.current = null
          
          // Reconnect if not a normal closure and appId still exists
          if (event.code !== 1000 && appId) {
            console.log('🔄 FileExplorer: Attempting to reconnect in 1 second...')
            reconnectTimeoutRef.current = setTimeout(() => {
              connectWebSocket()
            }, 1000)
          }
        }

        wsRef.current = ws
      } catch (error) {
        console.error('❌ FileExplorer: Error creating WebSocket:', error)
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
  }, [appId, token, onStreamEvent])

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(path)) {
        newSet.delete(path)
      } else {
        newSet.add(path)
      }
      return newSet
    })
  }

  const handleFileClick = (file: FileNode, e?: React.MouseEvent) => {
    // BIG CONSOLE LOGS SO USER CAN SEE
    console.log('')
    console.log('🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️')
    console.log('🖱️ FILE CLICKED!')
    console.log('🖱️ File Name:', file.name)
    console.log('🖱️ File Path:', file.path)
    console.log('🖱️ File Type:', file.type)
    console.log('🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️🖱️')
    console.log('')
    
    if (e) {
      e.stopPropagation()
      // Don't prevent default - let the click work normally
    }
    
    if (file.type === 'file') {
      console.log('📁 Processing FILE click...')
      setSelectedFile(file.path)
      console.log('📁 Selected file set to:', file.path)
      console.log('📁 Checking if onFileClick exists...', typeof onFileClick)
      console.log('📁 onFileClick function:', onFileClick)
      
      if (onFileClick && typeof onFileClick === 'function') {
        console.log('📁 onFileClick is a function! Calling it now with path:', file.path)
        try {
          // Call immediately and synchronously
          onFileClick(file.path)
          console.log('✅✅✅ onFileClick CALLED SUCCESSFULLY! ✅✅✅')
        } catch (error) {
          console.error('❌❌❌ ERROR calling onFileClick:', error)
        }
      } else {
        console.error('❌❌❌ onFileClick is NOT defined or NOT a function!')
        console.error('❌ onFileClick value:', onFileClick)
        console.error('❌ onFileClick type:', typeof onFileClick)
      }
    } else {
      console.log('📁 Processing FOLDER click, toggling:', file.path)
      toggleFolder(file.path)
    }
  }

  // Get file icon based on extension
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'json':
        return '{}'
      case 'js':
      case 'jsx':
        return 'JS'
      case 'ts':
      case 'tsx':
        return 'TS'
      case 'md':
        return 'M'
      case 'html':
        return 'HTML'
      case 'css':
        return 'CSS'
      default:
        return '•'
    }
  }

  const renderFileTree = (nodes: FileNode[], level = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders.has(node.path)
      const isSelected = selectedFile === node.path

      return (
        <div key={node.path} className="select-none">
          <div
            className={`flex items-center gap-1.5 px-2 py-1 hover:bg-gray-100 cursor-pointer text-sm ${
              isSelected ? 'bg-purple-100 text-purple-900' : 'text-gray-700'
            }`}
            style={{ 
              paddingLeft: `${level * 16 + 8}px`,
              pointerEvents: 'auto',
              zIndex: 10,
              position: 'relative',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none'
            }}
            onClick={(e) => {
              console.log('')
              console.log('🖱️ ===== CLICK EVENT FIRED =====')
              console.log('🖱️ File/Folder:', node.name)
              console.log('🖱️ Type:', node.type)
              console.log('🖱️ Path:', node.path)
              console.log('🖱️ Event:', e)
              console.log('🖱️ ===============================')
              // Stop propagation to prevent parent handlers from interfering
              e.stopPropagation()
              // Don't prevent default - allow the click to work
              // Call handleFileClick immediately
              handleFileClick(node, e)
            }}
            onMouseDown={(e) => {
              // Stop propagation to prevent scroll handlers from interfering with clicks
              e.stopPropagation()
              console.log('🖱️ MOUSE DOWN on:', node.name)
            }}
            onMouseUp={(e) => {
              // Stop propagation to prevent scroll handlers from interfering with clicks
              e.stopPropagation()
              console.log('🖱️ MOUSE UP on:', node.name)
            }}
          >
            {node.type === 'folder' ? (
              <>
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )}
                <Folder className="w-3.5 h-3.5 text-blue-500" />
              </>
            ) : (
              <>
                <div className="w-3.5 h-3.5 flex items-center justify-center text-xs font-mono text-gray-500">
                  {getFileIcon(node.name)}
                </div>
              </>
            )}
            <span className={`truncate text-sm ${
              selectedFile === node.path ? 'text-purple-600 font-medium' : 'text-gray-700'
            }`}>{node.name}</span>
          </div>
          {node.type === 'folder' && isExpanded && node.children && (
            <div>{renderFileTree(node.children, level + 1)}</div>
          )}
        </div>
      )
    })
  }

  return (
    <div 
      className="h-full flex flex-col overflow-hidden file-explorer-root" 
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
      onWheel={(e) => {
        // Block ALL wheel events that don't come from file explorer scrollable area
        const target = e.target as HTMLElement;
        if (!target.closest('.file-explorer-scrollable')) {
          e.preventDefault();
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }
      }}
      ref={(el) => {
        if (el) {
          // Block all external scroll events
          const blockAll = (e: WheelEvent) => {
            const target = e.target as HTMLElement;
            // Only allow if from file explorer scrollable
            if (!target.closest('.file-explorer-scrollable')) {
              e.preventDefault();
              e.stopPropagation();
              e.stopImmediatePropagation();
            }
          };
          el.addEventListener('wheel', blockAll, { capture: true, passive: false });
        }
      }}
    >
      <div 
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden file-explorer-scrollable" 
        style={{ 
          overscrollBehavior: 'contain',
          overscrollBehaviorY: 'contain',
          overscrollBehaviorX: 'none',
          scrollBehavior: 'auto',
          isolation: 'isolate',
          contain: 'layout style paint',
          position: 'relative',
          willChange: 'scroll-position',
          touchAction: 'pan-y'
        }}
        onWheel={(e) => {
          // Only stop propagation for wheel events, NOT clicks
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          
          // Check boundaries to prevent scroll chaining
          const target = e.currentTarget;
          const { scrollTop, scrollHeight, clientHeight } = target;
          const isAtTop = scrollTop <= 1;
          const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;
          
          // If at boundaries, prevent default to stop scroll chaining
          if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
            e.preventDefault();
          }
        }}
        // Don't block touch/click events - only scroll events
        onScroll={(e) => {
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
        }}
        ref={(el) => {
          if (el) {
            // Store original scroll position
            let lastScrollTop = el.scrollTop;
            
            // Block external scroll events in capture phase
            const blockExternal = (e: WheelEvent) => {
              const target = e.target as HTMLElement;
              // If event is from code editor, block it COMPLETELY
              if (target.closest('.code-editor-scroll-container')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                // Force scroll position to stay the same
                el.scrollTop = lastScrollTop;
                return false;
              }
              // Only allow if from this file explorer
              if (!el.contains(target) && !target.closest('.file-explorer-scrollable')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                // Force scroll position to stay the same
                el.scrollTop = lastScrollTop;
              } else {
                // Update last scroll position if scrolling within file explorer
                lastScrollTop = el.scrollTop;
              }
            };
            
            // Also prevent scroll events from changing scroll position
            const preventExternalScroll = () => {
              const target = document.activeElement as HTMLElement;
              if (target && target.closest('.code-editor-scroll-container')) {
                // If code editor is active, lock file explorer scroll
                el.scrollTop = lastScrollTop;
              }
            };
            
            // Only block wheel events, NOT click events
            el.addEventListener('wheel', blockExternal, { capture: true, passive: false });
            
            // Ensure clicks work - allow them to propagate
            el.addEventListener('click', (e) => {
              // Don't prevent clicks - let them bubble up
              console.log('🔍 TEST: Click detected on scrollable container, allowing propagation');
            }, { capture: false });
            el.addEventListener('scroll', () => {
              const target = document.activeElement as HTMLElement;
              if (target && target.closest('.code-editor-scroll-container')) {
                // Restore scroll position if code editor caused it
                el.scrollTop = lastScrollTop;
              } else {
                // Update last scroll position if scrolling within file explorer
                lastScrollTop = el.scrollTop;
              }
            }, { capture: true });
            
            // Monitor for scroll changes from external sources
            const observer = new MutationObserver(() => {
              const target = document.activeElement as HTMLElement;
              if (target && target.closest('.code-editor-scroll-container')) {
                if (el.scrollTop !== lastScrollTop) {
                  el.scrollTop = lastScrollTop;
                }
              }
            });
            
            // Watch for changes
            setInterval(() => {
              const target = document.activeElement as HTMLElement;
              if (target && target.closest('.code-editor-scroll-container')) {
                if (Math.abs(el.scrollTop - lastScrollTop) > 1) {
                  el.scrollTop = lastScrollTop;
                }
              } else {
                lastScrollTop = el.scrollTop;
              }
            }, 16); // Check every frame (~60fps)
          }
        }}
      >
        <div className="py-2">
          {files.length > 0 ? (
            <>
              <div className="px-3 py-2 text-xs text-green-600 bg-green-50 border-b">
                ✅ {files.length} files loaded - Click any file to view it
              </div>
              {renderFileTree(files)}
            </>
          ) : (
            <div className="px-3 py-4 text-center text-sm text-gray-500">
              Loading files...
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

