import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getRestaurantDir } from '@/lib/db'

const SAFE_NAME = /[^a-zA-Z0-9._/-]/g

function sanitizeUploadName(input: string) {
  const normalized = input.replace(/\\/g, '/').trim()
  const cleaned = normalized.replace(SAFE_NAME, '-').replace(/\/+/g, '/')
  const segments = cleaned.split('/').filter(Boolean)

  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    return null
  }

  return segments.join('/')
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const restaurantSlug = (form.get('restaurantSlug') as string | null) ?? ''
    const rawName = (form.get('name') as string | null) || file?.name || 'upload'
    const safeName = sanitizeUploadName(rawName)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (!safeName) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large - max 15 MB' }, { status: 413 })
    }

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob')
      const prefix = restaurantSlug ? `restaurants/${restaurantSlug}/models` : 'uploads'
      const blob = await put(`${prefix}/${safeName}`, file, { access: 'public' })
      return NextResponse.json({ url: blob.url })
    }

    if (!restaurantSlug) {
      return NextResponse.json({ error: 'restaurantSlug is required for local uploads' }, { status: 400 })
    }

    const modelsDir = path.join(getRestaurantDir(restaurantSlug), 'models')
    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true })

    const filename = path.posix.basename(safeName)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(modelsDir, filename), buffer)

    return NextResponse.json({
      url: `/api/restaurants/${restaurantSlug}/models/${filename}`,
      filename,
    })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
