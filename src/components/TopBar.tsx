'use client'

import { useState } from 'react'
import { listingsToCSV } from '@/lib/csv-export'
import type { Listing } from '@/types/listing'

interface TopBarProps {
  listings: Listing[]
}

export function TopBar({ listings }: TopBarProps) {
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    // Copy URL to clipboard for easy pasting in Claude Code
    navigator.clipboard.writeText(url.trim()).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleExport = () => {
    const csv = listingsToCSV(listings)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `househunter-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-slate-200">
      {/* Logo / Title */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">H</span>
        </div>
        <h1 className="text-lg font-semibold text-slate-800">HouseHunter</h1>
      </div>

      {/* URL Input */}
      <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="Paste a Centris.ca link here..."
          className="flex-1 px-4 py-2 text-sm border border-slate-200 rounded-lg
                     bg-slate-50 placeholder-slate-400 text-slate-700
                     focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                     transition-all"
        />
        <button
          type="submit"
          className={`
            px-4 py-2 text-sm font-medium rounded-lg transition-all
            ${copied
              ? 'bg-emerald-500 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </form>

      {/* Export */}
      <button
        onClick={handleExport}
        disabled={listings.length === 0}
        className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg
                   hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        Export CSV
      </button>
    </div>
  )
}
