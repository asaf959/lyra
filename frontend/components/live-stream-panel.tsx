'use client'

import { useMemo } from 'react'
import { X, Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type LiveStreamState = {
  filePath: string
  lines: string[]
  status: 'streaming' | 'completed'
  totalLines?: number
}

interface LiveStreamPanelProps {
  streams: Record<string, LiveStreamState>
  onSelectFile?: (filePath: string) => void
  onDismiss?: (filePath: string) => void
}

export function LiveStreamPanel({ streams, onSelectFile, onDismiss }: LiveStreamPanelProps) {
  const entries = useMemo(() => Object.values(streams), [streams])

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="rounded-xl border border-[#3c3c3c] bg-[#1e1e1e] text-[#d4d4d4] shadow-[0_20px_55px_rgba(0,0,0,0.6)] max-h-[75vh] w-[420px] overflow-hidden backdrop-blur">
      <div className="px-4 py-3 border-b border-[#3c3c3c] flex items-center justify-between bg-gradient-to-r from-[#2d2d2d] to-[#252525]">
        <div className="text-sm font-semibold tracking-wide text-[#f5f5f5]">Live Code Generation</div>
        <span className="text-xs text-[#8c8c8c]">{entries.length} file{entries.length > 1 ? 's' : ''}</span>
      </div>

      <div className="max-h-[65vh] overflow-y-auto divide-y divide-[#2d2d2d]">
        {entries.map((stream) => (
          <div key={stream.filePath} className="last:border-b-0">
            <div className="px-4 py-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-[#f0f0f0] break-all font-mono">{stream.filePath}</p>
                <p className="text-[11px] text-[#9f9f9f] mt-1 font-mono">
                  {stream.status === 'streaming' ? (
                    <>
                      <Loader2 className="inline w-3 h-3 mr-1 animate-spin text-[#4fc1ff]" />
                      Generating…
                      {stream.totalLines
                        ? ` (${stream.lines.length}/${stream.totalLines} lines)`
                        : ` (${stream.lines.length} lines)`}
                    </>
                  ) : (
                    <>Completed · {stream.lines.length} lines</>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="xs"
                  variant="secondary"
                  onClick={() => onSelectFile?.(stream.filePath)}
                  className="h-7 text-[11px] bg-[#0e639c] hover:bg-[#1177bb] text-white border-0"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  View
                </Button>
                <button
                  onClick={() => onDismiss?.(stream.filePath)}
                  className="text-[#707070] hover:text-[#bdbdbd] transition-colors"
                  aria-label="Dismiss stream"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="px-4 pb-4">
              <div className="rounded-lg border border-[#2f2f2f] bg-[#1b1b1f] max-h-48 overflow-y-auto font-mono text-[12px]">
                {stream.lines.length > 0 ? (
                  stream.lines.map((line, idx) => (
                    <div
                      key={`${stream.filePath}-${idx}`}
                      className="flex items-start leading-5"
                    >
                      <span className="w-10 text-right pr-3 text-[#5c6370] select-none">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <code className="flex-1 text-[#dcdcdc] whitespace-pre-wrap break-words">
                        {line.length ? line : ' '}
                      </code>
                    </div>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[#676767]">// Waiting for content…</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

