# LexiSight — Status: All Systems Connected ✅

All previously listed issues have been resolved:

## ✅ Completed Fixes

1. **Model Loading (Root Cause)** — Keras 3 `batch_shape` → TF.js `batch_input_shape` patched in both model.json files
2. **Custom Layer Registration** — `PositionalEncoding` + `TransformerEncoderBlock` implemented in `src/utils/customLayers.js`
3. **IndexedDB Cache** — Bumped to v4, stale v3 entries auto-cleared
4. **ENTROPY_THRESHOLD** — Was undefined, now set to `null` (auto-compute)
5. **SplashScreen** — Connected in `App.jsx`, shows once per session
6. **SettingsProvider** — Wrapped in `main.jsx`, `useSettings()` works everywhere
7. **Settings Route** — Added `/settings` to `App.jsx` routing
8. **Settings Nav Link** — Added to `Navbar.jsx`
9. **Model Dropdown** — Status bar now has a model selector (Word/Letter/Number)
10. **Orphaned Files Removed** — `ConfidenceBar.jsx`, `GestureConfidenceIndicator.jsx`, `PageLoader.jsx`
11. **MediaPipe CDN** — Updated to v0.5.1675471629 (earlier session)
`