'use client'
import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface RestaurantInfo {
  id: string
  name: string
  slug: string
  targetsUrl: string | null
}

// ── Canvas perspective warp ────────────────────────────────────────────────
function warpCanvas(img: HTMLImageElement, tiltX: number, tiltY = 0): HTMLCanvasElement {
  const W = img.naturalWidth || img.width
  const H = img.naturalHeight || img.height
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  const N = 120

  // Pass 1: X tilt — each horizontal strip is drawn wider/narrower
  const tmp = document.createElement('canvas')
  tmp.width = W; tmp.height = H
  const tc = tmp.getContext('2d')!
  for (let i = 0; i < N; i++) {
    const t = i / N
    const xScale = Math.max(0.05, 1 + tiltX * (t - 0.5) * 1.7)
    const sy = t * H, sh = H / N
    const dw = W * xScale
    const dx = (W - dw) / 2
    tc.drawImage(img, 0, sy, W, sh, dx, sy, dw, sh)
  }

  // Pass 2: Y tilt — each vertical strip is drawn taller/shorter
  for (let i = 0; i < N; i++) {
    const t = i / N
    const yScale = Math.max(0.05, 1 + tiltY * (t - 0.5) * 1.7)
    const sx = t * W, sw = W / N
    const dh = H * yScale
    const dy = (H - dh) / 2
    ctx.drawImage(tmp, sx, 0, sw, H, sx, dy, sw, dh)
  }

  return canvas
}

function canvasToImg(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = canvas.toDataURL('image/jpeg', 0.92)
  })
}

// ── Component ──────────────────────────────────────────────────────────────
export default function MarkerPage() {
  const { id } = useParams<{ id: string }>()
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [mindARLoaded, setMindARLoaded] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [progress, setProgress] = useState(0)
  const [compiled, setCompiled] = useState<ArrayBuffer | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/restaurants/${id}`)
      .then(r => r.json())
      .catch(() => ({}))
      .then((data: { restaurant?: RestaurantInfo }) => {
        if (data.restaurant) setRestaurant(data.restaurant)
      })

    // Load MindAR compiler lazily from CDN
    if ((window as unknown as { MINDAR?: { IMAGE?: { Compiler?: unknown } } }).MINDAR?.IMAGE?.Compiler) {
      setMindARLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js'
    script.onload = () => setMindARLoaded(true)
    script.onerror = () => setError('Failed to load AR compiler. Check internet connection.')
    document.head.appendChild(script)
  }, [id])

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Select an image file (JPG or PNG)')
      return
    }
    setImageFile(file)
    setCompiled(null)
    setError('')
    setSuccess('')
    const reader = new FileReader()
    reader.onload = ev => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleCompile() {
    if (!imageFile || !mindARLoaded) return
    setCompiling(true)
    setProgress(0)
    setError('')
    setSuccess('')
    setCompiled(null)

    try {
      const src = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = URL.createObjectURL(imageFile)
      })

      // 5 perspective-warped training images for best multi-angle detection
      const warps: [number, number][] = [
        [0, 0],        // straight on
        [0.7, 0],      // bird's-eye forward
        [-0.7, 0],     // back tilt
        [0.45, 0.38],  // diagonal right
        [0.45, -0.38], // diagonal left
      ]

      const images = await Promise.all(
        warps.map(async ([tx, ty]) => {
          if (tx === 0 && ty === 0) return src
          return canvasToImg(warpCanvas(src, tx, ty))
        }),
      )

      type MindARWindow = { MINDAR: { IMAGE: { Compiler: new () => { compileImageTargets: (imgs: HTMLImageElement[], cb: (p: number) => void) => Promise<void>; exportData: () => Promise<ArrayBuffer> } } } }
      const Compiler = (window as unknown as MindARWindow).MINDAR.IMAGE.Compiler
      const compiler = new Compiler()

      await compiler.compileImageTargets(images, (p: number) => {
        setProgress(Math.round(p * 100))
      })

      const buffer = await compiler.exportData()
      setCompiled(buffer)
      setProgress(100)
      setSuccess(`Compiled! 5-angle target ready — ${(buffer.byteLength / 1024).toFixed(0)} KB`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Compilation failed')
    } finally {
      setCompiling(false)
    }
  }

  async function handleSave() {
    if (!compiled || !restaurant) return
    setUploading(true)
    setError('')
    setSuccess('')

    try {
      const blob = new Blob([compiled], { type: 'application/octet-stream' })
      const file = new File([blob], `${restaurant.slug}.mind`)
      const form = new FormData()
      form.append('file', file)
      form.append('name', `markers/${restaurant.slug}-${Date.now()}.mind`)

      const uploadRes = await fetch('/api/upload', { method: 'POST', body: form })
      const uploadData = await uploadRes.json().catch(() => ({})) as { url?: string; error?: string }
      if (!uploadRes.ok) throw new Error(uploadData.error ?? 'Upload failed')

      const patchRes = await fetch(`/api/restaurants/${restaurant.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetsUrl: uploadData.url }),
      })
      const patchData = await patchRes.json().catch(() => ({})) as { error?: string }
      if (!patchRes.ok) throw new Error(patchData.error ?? 'Failed to save')

      setRestaurant(prev => prev ? { ...prev, targetsUrl: uploadData.url! } : null)
      setSuccess('Marker activated! The AR lens will use it immediately.')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setUploading(false)
    }
  }

  function handleDownload() {
    if (!compiled) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([compiled], { type: 'application/octet-stream' }))
    a.download = `${restaurant?.slug ?? 'targets'}.mind`
    a.click()
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
        <Link href="/restaurants" className="text-white/30 hover:text-white/60 transition-colors">Restaurants</Link>
        <span className="text-white/20">/</span>
        <Link href={`/restaurants/${id}/menu`} className="text-white/30 hover:text-white/60 transition-colors">
          {restaurant?.name ?? 'Menu'}
        </Link>
        <span className="text-white/20">/</span>
        <span className="text-[#D4A853]">AR Marker</span>
      </div>

      <h1 className="text-2xl font-semibold text-white mb-1">AR Marker</h1>
      <p className="text-white/40 text-sm mb-6">
        Upload your menu card photo. We compile it with 5 perspective warps for stable detection at any angle.
      </p>

      {/* Current marker status */}
      {restaurant?.targetsUrl && (
        <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-4 mb-6 flex items-start gap-3">
          <span className="text-emerald-400 text-lg mt-0.5">✓</span>
          <div className="flex-1 min-w-0">
            <p className="text-emerald-400 text-sm font-medium">Marker active</p>
            <p className="text-white/35 text-xs mt-0.5 truncate">{restaurant.targetsUrl}</p>
          </div>
          <button
            onClick={() => { const a = document.createElement('a'); a.href = restaurant.targetsUrl!; a.download = 'targets.mind'; a.click() }}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-white/5 text-white/40 hover:text-white/70 transition-colors shrink-0"
          >
            ↓ .mind
          </button>
        </div>
      )}

      {/* Main flex layout */}
      <div className="flex flex-col lg:flex-row gap-6">

        {/* Left — image upload & preview */}
        <div className="flex-1 min-w-0">
          <p className="text-white/50 text-xs font-medium uppercase tracking-wider mb-2">Marker Image</p>

          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-xl border-2 border-dashed cursor-pointer transition-all ${
              imagePreview
                ? 'border-[#D4A853]/30 bg-[#D4A853]/5 hover:border-[#D4A853]/50'
                : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
            }`}
            style={{ minHeight: 200 }}
          >
            {imagePreview ? (
              <div className="p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Marker preview"
                  className="w-full max-h-72 object-contain rounded-lg"
                />
                <p className="text-center text-white/25 text-xs mt-2">Click to change</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-white/60 text-sm font-medium">Drop your menu card photo here</p>
                <p className="text-white/30 text-xs mt-1.5">or tap to browse — JPG or PNG</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />

          {/* Tips */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {[
              'Use the physical menu card or coaster',
              'High contrast, distinct patterns work best',
              'Avoid plain / single-colour images',
              'Minimum 400 × 400 px recommended',
            ].map(tip => (
              <div key={tip} className="flex items-start gap-1.5 text-xs text-white/30">
                <span className="text-[#D4A853]/40 mt-px shrink-0">›</span>
                {tip}
              </div>
            ))}
          </div>
        </div>

        {/* Right — controls */}
        <div className="w-full lg:w-72 flex flex-col gap-4">

          {/* Step 1 */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-[#D4A853]/20 text-[#D4A853] text-xs font-bold flex items-center justify-center shrink-0">1</span>
              <span className="text-white/80 text-sm font-medium">Compile AR Target</span>
            </div>
            <p className="text-white/35 text-xs mb-4 leading-relaxed">
              Generates 5 angle-warped versions of your marker so detection stays locked at steep viewing angles.
            </p>

            {compiling && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-white/40 mb-1.5">
                  <span>Compiling angles…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#D4A853] rounded-full transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <button
              onClick={handleCompile}
              disabled={!imageFile || compiling}
              className="w-full py-2.5 text-sm font-semibold rounded-lg bg-[#D4A853] text-black hover:bg-[#E8C06D] disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
            >
              {compiling
                ? `Compiling… ${progress}%`
                : compiled
                  ? '↺ Recompile'
                  : !mindARLoaded
                    ? 'Loading compiler…'
                    : '▶ Compile (5 Angles)'}
            </button>

            {!mindARLoaded && !error && (
              <p className="text-white/20 text-[10px] mt-1.5 text-center animate-pulse">
                Loading AR library from CDN…
              </p>
            )}
          </div>

          {/* Step 2 */}
          <div className={`bg-white/[0.03] border rounded-xl p-5 transition-all ${compiled ? 'border-white/[0.07]' : 'border-white/[0.04] opacity-50 pointer-events-none'}`}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-[#D4A853]/20 text-[#D4A853] text-xs font-bold flex items-center justify-center shrink-0">2</span>
              <span className="text-white/80 text-sm font-medium">Save to Restaurant</span>
            </div>
            <p className="text-white/35 text-xs mb-4 leading-relaxed">
              Uploads to cloud storage and links to this restaurant. The AR lens picks it up immediately.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleSave}
                disabled={!compiled || uploading}
                className="w-full py-2.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {uploading ? 'Uploading…' : '↑ Save & Activate'}
              </button>
              <button
                onClick={handleDownload}
                disabled={!compiled}
                className="w-full py-2 text-xs rounded-lg bg-white/[0.04] text-white/40 hover:text-white/70 hover:bg-white/[0.07] transition-all"
              >
                ↓ Download .mind (manual deploy)
              </button>
            </div>
          </div>

          {/* Messages */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm">
              {success}
            </div>
          )}

          {/* How it works */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4">
            <p className="text-white/40 text-xs font-medium mb-2 uppercase tracking-wider">How it works</p>
            <div className="space-y-2">
              {[
                { n: '0°', d: 'Straight-on view' },
                { n: '+35°', d: 'Forward tilt (bird\'s eye)' },
                { n: '−35°', d: 'Back tilt' },
                { n: 'Diag ×2', d: 'Left + right diagonals' },
              ].map(row => (
                <div key={row.n} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-[#D4A853]/70 w-14 shrink-0">{row.n}</span>
                  <span className="text-white/30">{row.d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
