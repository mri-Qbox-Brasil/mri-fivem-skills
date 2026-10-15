# NUI on top of the pause menu

A NUI card over the pause map (a custom legend, a side panel) while the map stays usable. From
mri_Qblips; validated in game unless a line says otherwise.

## One cursor

- The game draws its pause cursor **under** the NUI, so it vanishes behind the card. Hide it with
  `SetMouseCursorVisible(false)` every frame while the card is up, and draw your own cursor in the
  page (a fixed div moved with `transform`, `pointer-events: none`, top z-index). Restore with
  `SetMouseCursorVisible(true)` on close and in `onResourceStop`.
- Outside the card, drive the page from the game cursor: `GetDisabledControlNormal(0, 239/240)`
  each frame, sent to the page only when it moved, so the drawn cursor and hover follow it.

## The mouse over the card

- Disabling controls does **not** stop the map: it reads the mouse wheel raw, so zoom and clicks
  go through any `DisableControlAction`. Take the mouse instead:
  - page reports the card rect (screen fractions) on mount, after its slide in, on `ResizeObserver`
    and window resize;
  - cursor enters the rect: `SetNuiFocus(true, true)` + `SetNuiFocusKeepInput(false)`,
    `SetCursorLocation(x, y)` so the NUI cursor starts where the game one was;
  - while focused, read the position with `GetNuiCursorPosition()` divided by
    `GetActiveScreenResolution()`; ignore it for ~3 frames after the hand over (stale position);
  - cursor leaves the rect: drop the mouse (`SetNuiFocus(typing, false)`) and
    `SetCursorLocation(x, y)` so the map cursor continues from the same spot.
- Inside, the page gets real clicks and real wheel, so lists scroll natively. Hide CEF's own
  cursor with `cursor: none !important` on everything while the card is up.
- Keys never reach the game while focused: the page handles Escape and asks Lua to close
  (`SetFrontendActive(false)`); game shortcuts like Q/E tab switching only work off the card.
  (Escape through the page: waiting for its in-game test.)
- Typing in a field: keep focus with `SetNuiFocus(true, false)` and disable the menu's own keys
  (arrows, Enter, Backspace, Q/E) each frame so they do not move the map behind.

## Smooth input

- Run input in its own thread at `Wait(0)` that never waits on scaleform; reading the map page
  (return values) goes in a second thread at ~150 ms. A shared loop made hover feel heavy.
- Hover state set by hand (a class like `.is-hover` on the hovered chain, updated only for nodes
  that change) needs Tailwind to treat it as hover:
  `addVariant('hover', '&:is(:hover, .is-hover)')` and
  `addVariant('group-hover', ':merge(.group):is(:hover, .is-hover) &')`.
- Hover must never select; select on click. No sound on hover.
- Auto scroll near a list edge (cursor resting in the top or bottom ~48 px scrolls it, faster
  closer to the edge, `requestAnimationFrame` loop that stops when `scrollTop` stops changing).
  Show it: a small chevron chip at each edge where there is room to scroll, lit while it scrolls.

## Pause menu facts

- The map page is active when `IsPauseMenuActive()`, `GetPauseMenuState() == 15` and
  `PauseMenuIsContextActive(joaat('MAP_CanZoom'))`.
- There is no native to hide the instructional buttons bar at the bottom; only
  `PauseMenuRedrawInstructionalButtons` exists. Hiding it takes its `.gfx`: see `mri-gta-assets`
  (`scaleform.md`, pause menu key bar). Draw your own bar in the page with the same keys.
- Reading or changing the game's own pause page goes through its `.gfx`: see `mri-gta-assets`
  (`scaleform.md`).
