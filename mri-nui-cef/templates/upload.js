// NUI side: uploadFile(file, 'video', (p) => setProgress(p)) resolves to the name the server saved.
// fetchNui(name, data) is the page's usual POST to https://<resource>/<name>.

/** First base that answers the ping within 1s; localhost comes first in the list. */
async function pickBase(urls) {
  for (const base of urls) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1000)
    try {
      const res = await fetch(`${base}/ping`, { mode: 'cors', signal: controller.signal })
      if (res.ok) return base
    } catch {
      // next base
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).slice(String(reader.result).indexOf(',') + 1))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function sendByHttp(file, start, base, onProgress) {
  const total = Math.max(1, Math.ceil(file.size / start.partBytes))
  let last = null
  for (let part = 1; part <= total; part++) {
    // A Blob body has no Content-Type, so the POST needs no CORS preflight.
    const body = file.slice((part - 1) * start.partBytes, part * start.partBytes)
    const res = await fetch(`${base}/upload/${start.token}/${part}/${total}`, { method: 'POST', mode: 'cors', body })
    last = await res.json().catch(() => null)
    if (!res.ok || !last?.ok) throw new Error(last?.error || `upload failed (${res.status})`)
    onProgress?.(part / total)
  }
  return last
}

/** Through the game connection: slower, but works for a player who isn't on the server's PC. */
async function sendByGame(fetchNui, file, start, onProgress) {
  const size = start.eventPartBytes
  const total = Math.max(1, Math.ceil(file.size / size))
  let last = null
  for (let part = 1; part <= total; part++) {
    const data = await toBase64(file.slice((part - 1) * size, part * size))
    last = await fetchNui('uploadPart', { token: start.token, part, total, data })
    if (!last?.ok) throw new Error(last?.error || 'upload failed')
    onProgress?.(part / total)
  }
  return last
}

export async function uploadFile(fetchNui, file, kind, onProgress) {
  const start = await fetchNui('uploadStart', { kind, name: file.name, size: file.size })
  if (!start?.ok) throw new Error(start?.error || 'upload refused')

  const base = await pickBase(start.urls || [])
  const last = base ? await sendByHttp(file, start, base, onProgress) : await sendByGame(fetchNui, file, start, onProgress)
  return last.name || start.name
}
