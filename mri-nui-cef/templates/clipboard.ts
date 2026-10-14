// Copy text from a NUI page; works on CEF 103 and 144 (144 needs the element focused).
export async function copyText(text: string): Promise<boolean> {
  const active = document.activeElement as HTMLElement | null
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  area.style.pointerEvents = 'none'
  document.body.appendChild(area)
  area.focus()
  area.select()
  let ok = false
  try {
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }
  area.remove()
  active?.focus?.()
  if (ok) return true
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
