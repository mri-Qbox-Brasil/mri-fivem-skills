import type { ReactNode } from 'react'
import { MriKbd, MriKeyHint, MriMouse } from '@mriqbox/ui-kit'
import { useT } from '@/lib/i18n'
import { useStore } from '@/store'

// A shot or E marks: E alone fails in noclip, which uses it to go down.
const markKeys = (
  <>
    <MriMouse button="left" />
    <MriKbd variant="accent">E</MriKbd>
  </>
)

// Key rail shown while a world tool runs; the panel itself is hidden.
// Store: `hud: { mode: 'place' | 'spot' | 'route' | 'zone'; count?: number; size?: { x: number; y: number; z: number }; multiple?: boolean } | null`,
// set by the `placeHud` NUI message.
export function PlaceRail() {
  const t = useT()
  const hud = useStore((s) => s.hud)
  if (!hud) return null

  let title: string
  let counter: ReactNode = null
  let keys: ReactNode
  let hint: string

  if (hud.mode === 'route') {
    title = t('rail.route_title')
    counter = <span className="font-mono tabular-nums text-foreground">{t('rail.count', { count: (hud.count ?? 0) + 1 })}</span>
    keys = (
      <>
        <MriKeyHint keys={markKeys} label={t('rail.mark')} />
        <MriKeyHint keys={<MriKbd>BACKSPACE</MriKbd>} label={t('rail.undo')} />
        <MriKeyHint keys={<MriKbd>ENTER</MriKbd>} label={t('rail.finish')} />
        <MriKeyHint keys={<MriKbd>ESC</MriKbd>} label={t('rail.cancel')} />
      </>
    )
    hint = t('rail.route_hint')
  } else if (hud.mode === 'zone') {
    const size = hud.size
    title = t('rail.zone_title')
    counter = (
      <>
        {size && <span className="font-mono tabular-nums text-muted-foreground">{`${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)} m`}</span>}
        {hud.multiple && <span className="font-mono tabular-nums text-foreground">{t('rail.zone_count', { count: hud.count ?? 0 })}</span>}
      </>
    )
    keys = (
      <>
        <MriKeyHint keys={<MriKbd>WASD</MriKbd>} label={t('rail.walk')} />
        <MriKeyHint keys={<MriMouse button="scroll" />} label={t('rail.size')} />
        <MriKeyHint
          keys={
            <>
              <MriKbd>SHIFT</MriKbd>
              <MriMouse button="scroll" />
            </>
          }
          label={t('rail.height')}
        />
        <MriKeyHint keys={markKeys} label={t(hud.multiple ? 'rail.zone_mark' : 'rail.place')} />
        {hud.multiple ? (
          <>
            <MriKeyHint keys={<MriKbd>BACKSPACE</MriKbd>} label={t('rail.undo')} />
            <MriKeyHint keys={<MriKbd>ENTER</MriKbd>} label={t('rail.finish')} />
            <MriKeyHint keys={<MriKbd>ESC</MriKbd>} label={t('rail.cancel')} />
          </>
        ) : (
          <MriKeyHint keys={<MriKbd>BACKSPACE</MriKbd>} label={t('rail.cancel')} />
        )}
      </>
    )
    hint = t('rail.zone_hint')
  } else if (hud.mode === 'spot') {
    title = t('rail.place_title')
    keys = (
      <>
        <MriKeyHint keys={markKeys} label={t('rail.place')} />
        <MriKeyHint keys={<MriKbd>BACKSPACE</MriKbd>} label={t('rail.cancel')} />
      </>
    )
    hint = t('rail.place_hint')
  } else {
    title = t('rail.place_title')
    keys = (
      <>
        <MriKeyHint
          keys={
            <>
              <MriKbd>← →</MriKbd>
              <MriMouse button="scroll" />
            </>
          }
          label={t('rail.rotate')}
        />
        <MriKeyHint keys={markKeys} label={t('rail.place')} />
        <MriKeyHint keys={<MriKbd>BACKSPACE</MriKbd>} label={t('rail.cancel')} />
      </>
    )
    hint = t('rail.place_hint')
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
      <div className="mri-surface flex max-w-[94vw] flex-col items-center gap-2 rounded-xl border border-border bg-popover/95 px-4 py-3 text-foreground shadow-2xl">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold uppercase tracking-wide text-primary">{title}</span>
          {counter}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3.5">{keys}</div>
        <p className="max-w-[560px] text-center text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  )
}
