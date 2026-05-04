import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { getRestaurantDir } from '@/lib/db'

type Params = { params: { slug: string; file: string[] } }

const CONTENT_TYPES: Record<string, string> = {
  '.glb':  'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.bin':  'application/octet-stream',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control':                'public, max-age=3600',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS })
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { slug, file } = params

  // Guard against path traversal
  const filename = (file ?? []).join('/')
  if (!filename || filename.includes('..') || filename.includes('\0')) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  const filePath = path.join(getRestaurantDir(slug), 'models', filename)

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const ext         = path.extname(filename).toLowerCase()
  const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'
  const buffer      = fs.readFileSync(filePath)

  return new NextResponse(buffer, {
    status:  200,
    headers: { 'Content-Type': contentType, ...CORS },
  })
}
