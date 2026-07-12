# CCI Watermark Generator — Agent Guidelines

Next.js 16 web app generating branded watermarks for Celebration Church International (54+ campuses). Users pick service type, campus, topic, and address to create portrait/landscape watermarks.

**Production**: https://cci-watermark-generator.vercel.app

---

## Build / Lint / Test Commands

```bash
npm run dev         # Start dev server at localhost:3000
npm run build       # Production build (includes TypeScript check)
npm run start       # Start production server
npm run lint        # ESLint (next-core-web-vitals + next-typescript) — flat config in eslint.config.mjs
npx tsc --noEmit    # Standalone TypeScript check
```

**No test suite exists.** If adding tests, install Jest or Vitest and add scripts to `package.json`.

---

## Project Structure

```
cci-watermark-generator/
├── src/
│   ├── app/                 # App Router: page.tsx, globals.css, layout.tsx
│   ├── components/          # Client components (PascalCase.tsx)
│   │   ├── WatermarkForm.tsx        # Main orchestration component
│   │   ├── CampusSelector.tsx       # Campus/cell-church dropdown with search
│   │   ├── ServiceTypeSelector.tsx  # Segmented pill control
│   │   └── CciLogo.tsx              # Inline SVG logo (server component)
│   ├── data/                # JSON sources: campuses.json, cellChurches.json
│   ├── layouts/             # Layout components
│   ├── lib/                 # Pure utilities (camelCase.ts)
│   │   ├── designTokens.ts    # Colors, fonts, layout constants (as const)
│   │   ├── drawWatermark.ts   # Canvas rendering: normal + documentary watermark
│   │   ├── fitText.ts         # Font-size auto-scaling for canvas
│   │   ├── filename.ts        # File-name generation (sluggified)
│   │   ├── resolveAddress.ts  # Address resolution with service-type fallback
│   │   └── googleDrive.ts     # GIS OAuth + Drive API v3 upload
│   └── types/watermark.ts  # Shared types: Campus, CellChurch, ServiceType, etc.
├── public/                 # Static assets: /cci-logo.svg, /google-drive-logo.svg, /fonts/
├── .env.local              # NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_API_KEY
├── next.config.ts
├── tsconfig.json            # strict: true, paths: @/* -> src/*
├── eslint.config.mjs        # ESLint flat config (next-vitals + next-typescript)
└── package.json             # deps: next 16, react 19, react-color, file-saver, jszip
```

---

## Import Conventions

- **Absolute** imports with `@/` prefix for everything: `import { Campus } from '@/types/watermark'`
- **Relative** imports ONLY for sibling components in same directory (`./`)
- **Order** (groups separated by blank lines):
  1. React/hooks (`import { useState } from 'react'`)
  2. External libraries (`import { ChromePicker } from 'react-color'`)
  3. Internal components (`import { CampusSelector } from './CampusSelector'`)
  4. Internal utilities (`import { renderWatermark } from '@/lib/drawWatermark'`)
  5. Types (`import { Campus } from '@/types/watermark'`)
- **Named exports only** — no `export default` anywhere

---

## TypeScript

- `strict: true` in tsconfig. Avoid `any`.
- `interface` for object shapes, `type` for unions/enums/literals.
- All function parameters and return values typed explicitly.
- Props interfaces: PascalCase + `Props` suffix (`CampusSelectorProps`).
- Shared types in `src/types/watermark.ts`:
  - `ServiceType`: `'midweek' | 'sunday' | 'event'`
  - `OrganizationType`: `'campus' | 'cellChurch'`
  - `WatermarkPayload` — carries all rendering params; optional fields for event features
- `as const` for config objects (`DESIGN_TOKENS`, `LAYOUTS`, `SERVICE_LABELS`).
- Generics on all hooks: `useState<ServiceType>('sunday')`, `useRef<HTMLDivElement>(null)`.
- Unused function parameters get underscore prefix: `_serviceType`.
- `Record<string, unknown>` for dynamic object shapes (not `any`).

---

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Component files | PascalCase.tsx | `CampusSelector.tsx` |
| Utility files | camelCase.ts | `drawWatermark.ts` |
| Interfaces | PascalCase | `WatermarkPayload` |
| Props interfaces | PascalCase + `Props` | `WatermarkFormProps` |
| Functions/variables | camelCase | `handleGenerate`, `activeCampuses` |
| Module-level constants | SCREAMING_SNAKE_CASE | `PRESET_COLORS`, `BATCH_SIZE`, `NUDGE_STEP` |
| Config objects | PascalCase + `as const` | `DESIGN_TOKENS`, `EVENT_LAYOUTS` |
| Custom Error classes | PascalCase + `Error` suffix | `DriveError` |

---

## React / Component Patterns

- **Server components** (no directive): `page.tsx`, `layout.tsx`, `CciLogo.tsx`
- **Client components** (`'use client'` first line): `WatermarkForm.tsx`, `CampusSelector.tsx`, `ServiceTypeSelector.tsx`
- **State**: `useState` with proper generics. Local state only (no context/store).
- **Refs**: `useRef<HTMLImageElement | null>(null)` for mutable DOM refs and pre-generated blob caches.
- **Prop-derived state**: Adjusted during render (React-recommended pattern) rather than in `useEffect` to avoid cascading renders.
- **Effects**: `useEffect` for side effects (click-outside listeners, keyboard dismiss, logo preloading, live preview debounce, GIS script load).
- **Pre-generated blob cache**: Blobs created during `handleGenerate` stored in refs for instant downloads — avoids re-rendering on button click.
- **Dynamic imports**: `const { saveAs } = await import('file-saver')` — deferred to first use to keep bundle small.
- **Event handlers**: Defined as named functions inside the component, not inline in JSX.

---

## Error Handling

```typescript
try {
  // async operation
} catch (err) {
  setError('User-facing message');
  console.error(err);
} finally {
  setIsGenerating(false);
}
```

- `setError(string | null)` for UI display; errors cleared before new operations.
- Error modal: summary via first line of error message, optional details via `showErrorDetails` toggle.
- Dismissable: click backdrop or press Escape.
- Google Drive errors: custom `DriveError` class with `code`, `message`, `userCancelled`.
- File input handlers reset `e.target.value = ''` so re-selecting the same file triggers `onChange`.

---

## Canvas Rendering (drawWatermark.ts)

HTML Canvas API for PNG export at 3x scale (print quality). Two watermark types:

| Type | Orientation | Canvas Size | Output |
|------|------------|-------------|--------|
| Normal | Portrait | 1080×1350 → 3240×4050 | Red tile + logo + topic + address + city badge |
| Normal | Landscape | 1620×1080 → 5760×3240 | Same layout |
| Documentary | Portrait | 1080×1350 | Transparent overlay: right-anchored badge + red tile |
| Documentary | Landscape | 1620×1080 | Same layout |
| Special Event | Either | Same dimensions | Centered smaller tile + event logo overlay |

Key patterns:
- Layout metrics in `designTokens.ts` as `as const` objects. Event uses `EVENT_LAYOUTS` (smaller tile).
- Text auto-scaled via `fitText.ts` (binary search font size down to `minFontSize`).
- Logo pre-loaded into ref via `loadImage()` utility. Scale factor of 3x via `ctx.scale()`.
- **Event-only features** (guarded by `isEvent` check): custom `tileColor` via `eventBoxColor`, bottom bar uses same color at 50% opacity via `hexToRgba()`, `eventUnclipTop` toggle for logo container clipping, `eventLogoOffsetX/Y` nudge offset applied to final draw position.
- Documentary watermark uses default red tile color only.

---

## Special Event Watermark Features

Shown only when `serviceType === 'event'`:

- **Event Logo**: Upload image displayed in a 174×81 box above the tile. 9-position alignment grid. Scale slider (10–400%).
- **Box & Strip Color**: Color picker for the tile and bottom bar. Bar gets same color at 50% opacity. Event-only — never affects Sunday/Midweek.
- **Unclip Top**: Toggle OFF by default (all 4 sides clipped). Toggle ON to let logo extend above container top.
- **Nudge Pad**: Cross-shaped d-pad (↑ ← · → ↓) beside alignment grid, 5px per step. Offset readout and reset button. Applied to final `drawImage` position.
- **Background Image**: Optional cover-fit image behind logo, overrides solid color.

---

## Campus Data & Address Resolution

`src/data/campuses.json` and `src/data/cellChurches.json`. Sorted alphabetically by id.

**Address resolution** (single source of truth in `resolveAddress.ts`):
- Cell Church → `address` only
- Sunday → `sundayAddress || address`
- Midweek → `midweekAddress || address`
- Event → `address`

Per-session address overrides stored in `addressOverrides` state (keyed by org id) for the multi-campus picker. Campuses with empty address are skipped in bulk exports.

---

## Google Drive Integration

- GIS script loaded dynamically via `loadGisScript()` in `useEffect`. OAuth scope: `drive.file`.
- Drive API v3: folder creation + file upload. Google Picker API for folder selection.
- Rate limiting: 200ms delay between campuses. Batch size: 4 concurrent renders/uploads.
- Exponential backoff retry (`fetchWithRetry`) with jitter for 429/403/5xx responses.
- Config from env: `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_API_KEY` (`getGoogleConfig()`).
- `loadEventAssets()` pre-loads event logo and bg image once for reuse across batch.

---

## Styling

- **Tailwind CSS v4**: `@import "tailwindcss"` (not `@tailwind` directives).
- **CSS custom properties** in `globals.css` for theming: `--bg`, `--surface`, `--text`, `--border`, `--brand-red`, etc.
- **Dark mode**: `[data-theme="dark"]` selector — all custom properties get dark values.
- **Font**: Expose Bold (woff2) for watermark canvas text. Geist for UI (loaded via `next/font/google` in layout).
- **No component-level CSS files** — all styling is inline Tailwind classes.

---

## Verification Checklist

- [ ] `npm run build` passes (0 errors)
- [ ] `npm run lint` passes (0 errors)
- [ ] Portrait and landscape watermarks render correctly
- [ ] Address auto-fills per service type
- [ ] Individual download works (PNG)
- [ ] ZIP download works (single + all campuses + selected campuses)
- [ ] Google Drive export creates correct folder structure
- [ ] Logo displays in both orientations
- [ ] Text fits within allocated bounds
- [ ] Documentary watermarks generate for campuses (not cell churches)
- [ ] Special Event layout with custom logo/color/scale/clip/nudge renders correctly
- [ ] Cell Church mode shows only Midweek/Sunday (no Event tab)
- [ ] Custom box color does not affect Sunday/Midweek watermarks

---

## Deployment

Auto-deploys to Vercel on `git push origin master`.
Production: https://cci-watermark-generator.vercel.app

```bash
git add . && git commit -m "description" && git push origin master
```
