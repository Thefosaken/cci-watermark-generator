# CCI Watermark Generator - Agent Guidelines

## ⚠️ IMPORTANT: Next.js 16

This project uses Next.js 16 (Turbopack). APIs, conventions, and file structure may differ from training data. Check `node_modules/next/dist/docs/` before writing code.

---

## Build Commands

```bash
npm run dev              # Start dev server at localhost:3000
npm run build            # Production build (includes TS check)
npm run start            # Start production server
npm run lint             # ESLint (next-vitals + next-typescript)
npx tsc --noEmit         # Standalone TypeScript check
```

**Note**: No test suite exists. To add tests, install Jest or Vitest and add scripts to package.json.

**ESLint config**: `eslint.config.mjs` — uses `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.

**TypeScript**: `strict: true` in `tsconfig.json`.

---

## Project Structure

```
cci-watermark-generator/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── page.tsx        # Main page (server component)
│   │   └── globals.css     # Tailwind CSS v4 (@import "tailwindcss")
│   ├── components/         # React components (PascalCase.tsx)
│   ├── data/               # JSON data (campuses.json)
│   ├── lib/                # Utilities (camelCase.ts)
│   │   ├── drawWatermark.ts   # Canvas rendering
│   │   ├── designTokens.ts    # Colors, fonts, layouts
│   │   ├── fitText.ts         # Text auto-scaling
│   │   ├── filename.ts        # File naming
│   │   └── googleDrive.ts     # Google Drive API + OAuth
│   └── types/watermark.ts  # Core types
├── public/                # Static assets
├── .env.local             # NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_API_KEY
├── next.config.ts
├── tsconfig.json           # strict: true, paths: @/ -> src/*
└── eslint.config.mjs
```

**Components**: `WatermarkForm.tsx`, `CampusSelector.tsx`, `ServiceTypeSelector.tsx`, `CciLogo.tsx`

---

## Import Conventions

- Use **absolute imports** with `@/` prefix for all internal sources: `import { Campus } from '@/types/watermark'`
- **Relative imports** only for sibling components in the same directory (`./`)
- **Order**: React → external libraries → internal components → utilities → types
- **Group** with blank lines between groups
- **No default exports** (prefer named exports)

```
import { useState, useRef, useEffect } from 'react';         // React
import { ServiceType, Campus } from '@/types/watermark';       // types
import { ServiceTypeSelector } from './ServiceTypeSelector';   // components
import { renderWatermark } from '@/lib/drawWatermark';         // lib
import { ChromePicker } from 'react-color';                    // external
```

---

## TypeScript & Naming

| Element | Convention | Example |
|---------|-----------|---------|
| Component files | PascalCase.tsx | `WatermarkForm.tsx` |
| Utility files | camelCase.ts | `drawWatermark.ts` |
| Type/interface | PascalCase | `interface Campus`, `type ServiceType` |
| Props interface | PascalCase + `Props` suffix | `interface WatermarkFormProps` |
| Functions/variables | camelCase | `handleGenerate`, `activeCampuses` |
| Constants | SCREAMING_SNAKE_CASE | `BATCH_SIZE`, `DESIGN_TOKENS` |
| Nested properties | camelCase | `colors.tileRed`, `typography.primaryFont` |

- Use `interface` for objects, `type` for unions/enums
- Use `as const` for config/constant objects
- Add TypeScript generics to all hooks: `useState<ServiceType>('sunday')`, `useRef<HTMLDivElement>(null)`
- Unused parameters get underscore prefix: `_serviceType`
- Avoid `any` (strict mode)

---

## React Patterns

- **Client components**: Add `'use client'` as first line. Used by: `WatermarkForm`, `CampusSelector`, `ServiceTypeSelector`
- **Server components**: No directive. Used by: `layout.tsx`, `page.tsx`, `CciLogo`
- **Hooks**: `useState` for local state, `useEffect` for side effects, `useRef` for DOM refs and mutable values
- **Destructure props** in function signature
- **Functional components only**
- **Named exports** (not default)

---

## Error Handling

```typescript
try {
  // async operation
} catch (err) {
  setError('User-facing message');
  console.error(err);  // always log for debugging
} finally {
  // cleanup loading states
}
```

- Wrap all async operations in try/catch
- Use `setError(string | null)` state to display errors in the UI
- Set `error = null` before starting new operations
- Handle canvas rendering failures gracefully (logo not loaded, context errors)
- GIS/Drive API errors are wrapped in `Error` instances for consistent `err.message` access

---

## Canvas Rendering

Uses HTML Canvas API for PNG export. Portrait: 1080×1350, Landscape: 1620×1080.

- Use `ctx.clearRect()` for transparent backgrounds
- Test both orientations
- Use `canvas.toDataURL('image/png')` for preview, `canvas.toBlob()` for download
- Logo is loaded as `HTMLImageElement` and stored in a ref

---

## Google Drive API

- GIS (Google Identity Services) script loaded dynamically on mount
- OAuth scope: `https://www.googleapis.com/auth/drive.file`
- Drive API v3 for folder creation and file upload
- Google Picker API for destination folder selection
- Rate limiting: 200ms delay between campuses during upload
- Uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_API_KEY` env vars

---

## Campus Data

Stored in `src/data/campuses.json`. Sort alphabetically.

```
addressLogic:
  Sunday   → `sundayAddress` || `address`
  Midweek  → `midweekAddress` || `address`
  Event    → `address`
```

Skip campuses with empty addresses for bulk operations.

---

## Common Tasks

| Task | Steps |
|------|-------|
| Add campus | Add to `campuses.json` with all fields, sort alphabetically |
| Modify design | Edit `designTokens.ts` (colors) + `drawWatermark.ts` (rendering) |
| Add service type | Add to `ServiceType` union in types → add label in `SERVICE_LABELS` → update address logic |

---

## Deployment

Auto-deploys to Vercel on `git push origin master`. Production: https://cci-watermark-generator.vercel.app

---

## Verification Checklist

Before completing a task:
- [ ] `npm run build` passes
- [ ] `npm run lint` passes (0 errors)
- [ ] No TypeScript errors
- [ ] Both portrait/landscape render correctly
- [ ] Address auto-fills per service type
- [ ] Individual download works (PNG)
- [ ] ZIP download works (single + all campuses)
- [ ] Google Drive export creates correct folder structure
- [ ] Logo displays in both orientations
- [ ] Text fits within allocated bounds
