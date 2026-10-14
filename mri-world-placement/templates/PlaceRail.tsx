import { MriKbd, MriKeyHint, MriMouse } from '@mriqbox/ui-kit'
import { useT } from '@/lib/i18n'
import { useStore } from '@/store'

// Key rail shown while a world tool runs; the panel itself is hidden.
// Store: `hud: { mode: 'place' | 'route'; count?: number } | null`, set by the `placeHud` NUI message.
export function PlaceRail() {
  const t = useT()
  const hud = useStore((s) => s.hud)
  if (!hud) return null
  const route = hud.mode === 'route'

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 flex justify-center px-4">
      <div className="mri-surface flex max-w-[94vw] flex-col items-center gap-2 rounded-xl border border-border bg-popover/95 px-4 py-3 text-foreground shadow-2xl">
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold uppercase tracking-wide text-primary">{t(route ? 'rail.route_title' : 'rail.place_title')}</span>
          {route && <span className="font-mono tabular-nums text-foreground">{t('rail.count', { count: (hud.count ?? 0) + 1 })}</span>}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          {route ? (
            <>
              <MriKeyHint keys={<MriKbd variant="accent">E</MriKbd>} label={t('rail.mark')} />
              <MriKeyHint keys={<MriKbd>BACKSPACE</MriKbd>} label={t('rail.undo')} />
              <MriKeyHint keys={<MriKbd>ENTER</MriKbd>} label={t('rail.finish')} />
              <MriKeyHint keys={<MriKbd>ESC</MriKbd>} label={t('rail.cancel')} />
            </>
          ) : (
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
              <MriKeyHint keys={<MriKbd variant="accent">E</MriKbd>} label={t('rail.place')} />
              <MriKeyHint keys={<MriKbd>BACKSPACE</MriKbd>} label={t('rail.cancel')} />
            </>
          )}
        </div>
        <p className="max-w-[560px] text-center text-[11px] text-muted-foreground">{t(route ? 'rail.route_hint' : 'rail.place_hint')}</p>
      </div>
    </div>
  )
}
