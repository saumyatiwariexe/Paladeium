import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getRestaurantDir } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const form           = await req.formData()
    const file           = form.get('file')           as File   | null
    const restaurantSlug = form.get('restaurantSlug') as string | null ?? ''
    const rawName        = (form.get('name') as string | null) || file?.name || 'upload'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large — max 15 MB' }, { status: 413 })
    }

    // Production: upload to Vercel Blob
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const { put } = await import('@vercel/blob')
      const blob = await put(`restaurants/${restaurantSlug}/models/${rawName}`, file, { access: 'public' })
      return NextResponse.json({ url: blob.url })
    }

    // Development: save to the restaurant's local models directory
    if (!restaurantSlug) {
      return NextResponse.json({ error: 'restaurantSlug is required for local uploads' }, { status: 400 })
    }

    const modelsDir = path.join(getRestaurantDir(restaurantSlug), 'models')
    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true })

    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(path.join(modelsDir, rawName), buffer)

    return NextResponse.json({
      url:      `/api/restaurants/${restaurantSlug}/models/${rawName}`,
      filename: rawName,
    })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
