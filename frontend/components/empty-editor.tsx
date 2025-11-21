'use client'

import { FileText } from 'lucide-react'

export function EmptyEditor() {
  return (
    <div className="h-full flex items-center justify-center bg-white border border-purple-200 rounded-lg">
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-pink-100 flex items-center justify-center">
              <FileText className="w-16 h-16 text-pink-400" />
            </div>
            <div className="absolute -top-2 -right-2 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center border-2 border-white">
              <FileText className="w-6 h-6 text-blue-500" />
            </div>
          </div>
        </div>
        <div className="text-gray-600 text-sm">
          Please select a specific file in Files first
        </div>
      </div>
    </div>
  )
}

