# AKALYNTH_ANDROID_BETA_V17_ITEM_ICONS

Root cause of "outfit palette" hotbar ugliness: all 20 MVP item icons were
solid 32×32 color squares (factory placeholders from PR-016). They resolved
as bitmaps, so the hotbar looked like an outfit color picker.

## Fix
- Replace every `item__*.png` with readable 32×32 transparent-background icons
  (blade, cloak, charm, torch, ley mote, etc.).
- Update sidecars + `sync:assets` so Android and debug-client mirrors match
  `data/assets-built`.
- Rebuild `atlas/items.png`.

## Identity
- versionCode 17
- versionName `0.1.15-beta-rookguard-v1.4.1-item-icons`
- Lane: beta, decision authority for distribution pin.
