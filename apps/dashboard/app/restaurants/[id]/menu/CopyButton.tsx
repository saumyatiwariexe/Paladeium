'use client'
import { useState } from 'react'

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-xs px-3 py-1.5 rounded-lg bg-[#D4A853]/15 text-[#D4A853] hover:bg-[#D4A853]/25 transition-colors shrink-0"
    >
      {copied ? '✓ Copied' : 'Copy Link'}
    </button>
  )
}
