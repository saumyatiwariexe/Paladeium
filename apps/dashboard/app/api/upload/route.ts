import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'File storage not configured. Add BLOB_READ_WRITE_TOKEN to your Vercel environment variables (Storage → Blob → Connect).' },
        { status: 501 },
      )
    }

    const { put } = await import('@vercel/blob')
    const form = await req.formData()
    const file = form.get('file') as File | null
    const restaurantId = (form.get('restaurantId') as string | null) ?? 'shared'
    const rawName = (form.get('name') as string | null) || file?.name || 'upload'
    const blobPath = `models/${restaurantId}/${rawName}`

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large — max 15 MB' }, { status: 413 })
    }

    const blob = await put(blobPath, file, { access: 'public' })
    return NextResponse.json({ url: blob.url })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
