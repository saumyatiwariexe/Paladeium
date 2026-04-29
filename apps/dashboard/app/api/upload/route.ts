import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const slug = (form.get('slug') as string | null) ?? 'shared'
    const type = (form.get('type') as string | null) ?? 'model' // 'model' or 'target'
    const rawName = (form.get('name') as string | null) || file?.name || 'upload'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }
    if (file.size > 15 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large — max 15 MB' }, { status: 413 })
    }

    const lensPath = path.join(process.cwd(), '..', 'lens')
    const folder = type === 'target' ? 'targets' : 'models'
    const destDir = path.join(lensPath, folder, slug)
    
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true })
    }

    const destPath = path.join(destDir, rawName)
    const buffer = Buffer.from(await file.arrayBuffer())
    fs.writeFileSync(destPath, buffer)

    // Return the relative URL so it can be used in the DB
    return NextResponse.json({ url: `${folder}/${slug}/${rawName}` })
  } catch (err) {
    console.error('[upload]', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
