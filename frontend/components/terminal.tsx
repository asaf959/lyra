'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface TerminalProps {
  appId: string
}

export function Terminal({ appId }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const initAttemptRef = useRef(0)

  useEffect(() => {
    if (!appId) {
      console.log('Terminal: No appId provided')
      return
    }
    
    let isMounted = true
    let cleanupFunctions: (() => void)[] = []
    let retryTimeout: NodeJS.Timeout | null = null
    
    // Initialize terminal with retry logic
    const initTerminal = () => {
      if (!isMounted) return
      
      initAttemptRef.current++
      console.log(`Terminal: Initialization attempt ${initAttemptRef.current}`)
      
      if (!terminalRef.current) {
        console.log('Terminal: Ref not ready, retrying...')
        retryTimeout = setTimeout(initTerminal, 100)
        return
      }

      // Check if container has dimensions and is in the DOM
      const rect = terminalRef.current.getBoundingClientRect()
      const isVisible = terminalRef.current.offsetParent !== null || 
                       terminalRef.current.style.display !== 'none'
      
      if (rect.width === 0 || rect.height === 0 || !isVisible) {
        console.log('Terminal: Container not ready, retrying...', { 
          width: rect.width, 
          height: rect.height,
          isVisible,
          offsetParent: terminalRef.current.offsetParent !== null,
          attempt: initAttemptRef.current 
        })
        if (initAttemptRef.current < 20) { // Max 20 attempts
          retryTimeout = setTimeout(initTerminal, 200)
        }
        return
      }
      
      console.log('Terminal: Container ready, initializing xterm...', {
        width: rect.width,
        height: rect.height
      })

      // Clean up any existing terminal
      if (xtermRef.current) {
        try {
          xtermRef.current.dispose()
        } catch (e) {
          console.error('Error disposing old terminal:', e)
        }
        xtermRef.current = null
      }

      try {
        // Initialize xterm with minimal options
        const xterm = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
          theme: {
            background: '#1e1e1e',
            foreground: '#d4d4d4',
            cursor: '#aeafad',
          },
          allowProposedApi: true,
        })

        const fitAddon = new FitAddon()
        xterm.loadAddon(fitAddon)

        // Store refs
        xtermRef.current = xterm
        fitAddonRef.current = fitAddon

        // Open the terminal - wrap in try-catch to handle dimension errors
        try {
          xterm.open(terminalRef.current)
          console.log('Terminal: Opened successfully')
        } catch (openError: any) {
          console.error('Error opening terminal:', openError)
          // If it's a dimension error, retry after a delay
          if (openError?.message?.includes('dimensions') || openError?.message?.includes('undefined')) {
            if (initAttemptRef.current < 10) {
              console.log('Terminal: Dimension error during open, retrying...')
              setTimeout(initTerminal, 300)
            }
            return
          }
          throw openError
        }

        // Wait for terminal to be fully ready before fitting
        // Use a longer delay to ensure all internal structures are initialized
        const fitTerminal = () => {
          if (!isMounted) return
          
          try {
            if (!xtermRef.current || !fitAddonRef.current || !terminalRef.current) {
              return
            }

            const rect = terminalRef.current.getBoundingClientRect()
            if (rect.width === 0 || rect.height === 0) {
              console.log('Terminal: Container has no dimensions for fit, retrying...')
              setTimeout(fitTerminal, 200)
              return
            }

            const terminalElement = xtermRef.current.element
            if (!terminalElement) {
              console.log('Terminal: Element not found for fit, retrying...')
              setTimeout(fitTerminal, 200)
              return
            }

            // Check if terminal is ready by accessing safe properties
            try {
              const cols = xtermRef.current.cols
              const rows = xtermRef.current.rows
              
              if (cols > 0 && rows > 0) {
                // Additional delay to ensure viewport is synced
                setTimeout(() => {
                  if (!isMounted || !fitAddonRef.current) return
                  try {
                    fitAddonRef.current.fit()
                    console.log('Terminal: Successfully fitted', { 
                      cols: xtermRef.current?.cols, 
                      rows: xtermRef.current?.rows 
                    })
                  } catch (fitError: any) {
                    console.error('Error in fit() call:', fitError)
                    // If fit fails, terminal should still work with default size
                  }
                }, 100)
              } else {
                console.log('Terminal: Not ready for fit', { cols, rows })
                setTimeout(fitTerminal, 200)
              }
            } catch (checkError) {
              console.error('Error checking terminal readiness:', checkError)
              setTimeout(fitTerminal, 300)
            }
          } catch (error) {
            console.error('Error in fitTerminal:', error)
          }
        }

        // Start fit process after a delay
        setTimeout(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(fitTerminal, 400)
            })
          })
        }, 200)

        // Connect to WebSocket
        console.log('Terminal: Connecting to WebSocket at ws://localhost:4000')
        const ws = new WebSocket(`ws://localhost:4000`)
        
        ws.onopen = () => {
          if (!isMounted) return
          console.log('Terminal: WebSocket connected successfully')
          if (xtermRef.current) {
            xtermRef.current.writeln('\r\n\x1b[32m✓ Connected to terminal...\x1b[0m\r\n')
          }
          ws.send(JSON.stringify({ type: 'subscribe_terminal', appId }))
          console.log('Terminal: Sent subscribe_terminal message for appId:', appId)
        }

        ws.onmessage = (event) => {
          if (!isMounted || !xtermRef.current) return
          try {
            const data = JSON.parse(event.data)
            console.log('Terminal: Received message:', data.type)
            
            if (data.type === 'terminal_output') {
              xtermRef.current.write(data.output)
            } else if (data.type === 'terminal_error') {
              xtermRef.current.write(`\r\n\x1b[31mError: ${data.error}\x1b[0m\r\n`)
            }
          } catch (error) {
            console.error('Error parsing terminal message:', error)
            if (xtermRef.current) {
              xtermRef.current.write(`\r\n\x1b[31mError parsing message: ${error}\x1b[0m\r\n`)
            }
          }
        }

        ws.onerror = (error) => {
          console.error('Terminal: WebSocket error:', error)
          if (xtermRef.current) {
            xtermRef.current.writeln('\r\n\x1b[31m✗ Terminal connection error. Is the backend server running?\x1b[0m\r\n')
            xtermRef.current.writeln('\x1b[33mMake sure the backend is running on port 4000\x1b[0m\r\n')
          }
        }

        ws.onclose = (event) => {
          console.log('Terminal: WebSocket closed', { code: event.code, reason: event.reason })
          if (xtermRef.current) {
            xtermRef.current.writeln(`\r\n\x1b[33m✗ Terminal disconnected (code: ${event.code})\x1b[0m\r\n`)
          }
        }

        // Handle terminal input
        xterm.onData((data) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ 
              type: 'terminal_input', 
              appId, 
              input: data 
            }))
          }
        })

        wsRef.current = ws

        // Handle resize
        const handleResize = () => {
          if (!isMounted || !fitAddonRef.current || !terminalRef.current || !xtermRef.current) return
          try {
            const rect = terminalRef.current.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0 && xtermRef.current.element) {
              fitAddonRef.current.fit()
            }
          } catch (error) {
            console.error('Error resizing terminal:', error)
          }
        }
        window.addEventListener('resize', handleResize)
        cleanupFunctions.push(() => window.removeEventListener('resize', handleResize))
        
        // Resize observer
        const resizeObserver = new ResizeObserver((entries) => {
          if (!isMounted || !fitAddonRef.current || !terminalRef.current || !xtermRef.current) return
          try {
            const rect = terminalRef.current.getBoundingClientRect()
            if (rect.width > 0 && rect.height > 0 && xtermRef.current.element) {
              fitAddonRef.current.fit()
            }
          } catch (error) {
            console.error('Error in resize observer:', error)
          }
        })
        if (terminalRef.current) {
          resizeObserver.observe(terminalRef.current)
        }
        cleanupFunctions.push(() => resizeObserver.disconnect())

      } catch (error: any) {
        console.error('Error initializing terminal:', error)
        // Retry if it's a dimension-related error
        if (error?.message?.includes('dimensions') || error?.message?.includes('undefined')) {
          if (initAttemptRef.current < 10) {
            console.log('Terminal: Retrying after dimension error...')
            setTimeout(initTerminal, 500)
          }
        }
      }
    }
    
    // Wait for component to be fully mounted before starting initialization
    // This ensures the container is in the DOM and has proper dimensions
    const startInit = () => {
      if (terminalRef.current) {
        // Double-check container is ready
        const rect = terminalRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          initTerminal()
        } else {
          // Wait a bit more
          setTimeout(startInit, 100)
        }
      } else {
        setTimeout(startInit, 50)
      }
    }
    
    // Start after a small delay to ensure DOM is ready
    setTimeout(() => {
      requestAnimationFrame(() => {
        startInit()
      })
    }, 100)
    
    // Cleanup function
    return () => {
      console.log('Terminal: Cleaning up...')
      isMounted = false
      if (retryTimeout) {
        clearTimeout(retryTimeout)
      }
      cleanupFunctions.forEach(fn => fn())
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (xtermRef.current) {
        try {
          xtermRef.current.dispose()
        } catch (e) {
          console.error('Error disposing terminal:', e)
        }
        xtermRef.current = null
      }
      fitAddonRef.current = null
      initAttemptRef.current = 0
    }
  }, [appId])

  return (
    <div 
      ref={terminalRef} 
      className="w-full h-full" 
      style={{ 
        minHeight: '200px', 
        width: '100%', 
        height: '100%',
        display: 'block',
        position: 'relative',
        backgroundColor: '#1e1e1e'
      }}
    />
  )
}
