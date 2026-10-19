import { authFetch } from '../auth/google'

const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

export interface DriveFile {
  id: string
  modifiedTime: string
}

export async function driveFind(name: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false`)
  const r = await authFetch(`${FILES}?q=${q}&fields=files(id,modifiedTime)&spaces=drive`)
  const j = (await r.json()) as { files?: DriveFile[] }
  return j.files?.[0] ?? null
}

export async function driveCreate(name: string, content: unknown): Promise<DriveFile> {
  const boundary = 'b' + Date.now()
  const meta = { name, mimeType: 'application/json' }
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(meta) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(content) +
    `\r\n--${boundary}--`
  const r = await authFetch(`${UPLOAD}?uploadType=multipart&fields=id,modifiedTime`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  return r.json()
}

export async function driveLoad<T>(id: string): Promise<T> {
  const r = await authFetch(`${FILES}/${id}?alt=media`)
  return r.json()
}

export async function driveUpload(id: string, content: unknown): Promise<DriveFile> {
  const r = await authFetch(`${UPLOAD}/${id}?uploadType=media&fields=id,modifiedTime`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(content),
  })
  return r.json()
}
