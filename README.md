# Closet

Personal PWA: photograph clothes, get outfit ideas. Two users, separate closets, data stays on each phone.

## Install (iPhone)
Open the deployed URL in Safari → Share → Add to Home Screen.

## Plan
- Local-first: IndexedDB on-device, Export/Import backup. No accounts or servers.
- Rules-based outfit engine (color, formality, season). No AI in v1.
- Stack: React + Vite + TypeScript, vite-plugin-pwa, GitHub Pages.

## Milestones
1. Scaffold + PWA install ✔
2. Camera/photo capture, background removal, closet grid ✔
3. Tags + color extraction ✔
4. Rules-based outfit generator ✔
5. Backup/restore, saved outfits, worn log ✔
6. Polish ✔ (storage protection, backup reminder, search/filters, dark mode, last worn)

## Dev
```
npm install
npm run dev
npm run build
```
