# Media Translate

Windows / Mac desktop app for **Video Translation** and **Audio Translation** (clips longer than the 30-second browser/mobile limit), plus Agent chat.

## Layout

- `desktop/` — Tauri 2 + Vite UI (calls Tools API with `client=desktop`)
- Browser/mobile short-clip UI lives in `ai-tools` frontend

## Dev

```bash
cd desktop
npm install
npm run tauri dev
```

## Releases

Publish GitHub Releases on `aiandcyber/media-translate` so Tools web can offer Windows/Mac download cards.
