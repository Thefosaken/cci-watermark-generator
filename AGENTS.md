# CCI Watermark Generator - Agent Guidelines

## ⚠️ IMPORTANT: Next.js 16

This project uses Next.js 16, which has breaking changes from older versions. APIs, conventions, and file structure may differ from training data. Read `node_modules/next/dist/docs/` before writing code.

---

## Build Commands

```bash
# Development
npm run dev              # Start dev server at localhost:3000

# Production
npm run build           # Build for production
npm run start           # Start production server

# Linting
npm run lint            # Run ESLint
```

---

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── page.tsx        # Main page
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── WatermarkForm.tsx
│   ├── CampusSelector.tsx
│   ├── ServiceTypeSelector.tsx
│   └── CciLogo.tsx
├── data/               # JSON data (campuses)
├── lib/                # Utilities
│   ├── drawWatermark.ts   # Canvas rendering
│   ├── designTokens.ts    # Colors, layouts
│   ├── fitText.ts        # Text fitting
│   └── filename.ts       # File naming
├── types/              # TypeScript types
└── types/watermark.ts  # Core types
```

---

## Code Style Guidelines

### Imports
- Use absolute imports with `@/` prefix: `import { Campus } from '@/types/watermark'`
- Order imports: React → external libs → internal components → utilities → types
- Group imports with blank lines between groups

### Types
- Use TypeScript for all props and function signatures
- Define shared types in `src/types/watermark.ts`
- Use interfaces for objects, type for unions

### Naming
- **Components**: PascalCase (e.g., `WatermarkForm`)
- **Files**: PascalCase for components, camelCase for utilities
- **Props**: camelCase
- **Constants**: SCREAMING_SNAKE_CASE in designTokens

### React Patterns
- Use `'use client'` directive for client components
- Use `useState` for local state, `useEffect` for side effects
- Destructure props for clarity
- Add TypeScript types to all props interfaces

### Error Handling
- Wrap async operations in try/catch
- Set error state and display to user
- Log errors to console for debugging

---

## Canvas Rendering

The watermark generator uses HTML Canvas API. Key files:
- `src/lib/drawWatermark.ts` - Main rendering logic
- `src/lib/designTokens.ts` - Colors, fonts, dimensions
- `src/lib/fitText.ts` - Auto-scaling text

When modifying canvas code:
- Use `ctx.clearRect()` for transparent backgrounds
- Test both portrait (1080×1350) and landscape (1620×1080)
- Use `canvas.toDataURL('image/png')` for export
- Test text overflow handling

---

## Tailwind CSS

This project uses Tailwind CSS v4 with `@import "tailwindcss"`. Classes are standard.

---

## Campus Data

Campus data is stored in `src/data/campuses.json`. Each campus has:
- `id`: unique identifier (lowercase, URL-safe)
- `name`: display name
- `cityLabel`: uppercase label for watermark
- `address`: default address
- `sundayAddress`: optional Sunday-specific address
- `midweekAddress`: optional midweek-specific address
- `active`: boolean for dropdown filtering

---

## Common Tasks

### Adding a new campus
Edit `src/data/campuses.json` - add new object with all fields.

### Modifying watermark design
Edit `src/lib/designTokens.ts` for colors/layouts, `src/lib/drawWatermark.ts` for rendering.

### Adding new service type
1. Add to `ServiceType` in `src/types/watermark.ts`
2. Add label in `SERVICE_LABELS` in `src/lib/designTokens.ts`
3. Update CampusSelector if address logic changes

---

## Vercel Deployment

This project auto-deploys to Vercel on git push. Production URL: https://cci-watermark-generator.vercel.app

---

## API Reference

### Types (src/types/watermark.ts)

```typescript
type ServiceType = 'midweek' | 'sunday' | 'event';

interface Campus {
  id: string;
  name: string;
  cityLabel: string;
  address: string;
  sundayAddress?: string;
  midweekAddress?: string;
  country?: string;
  region?: string;
  active: boolean;
}
```

### Design Tokens (src/lib/designTokens.ts)

- Colors: `tileRed`, `barRed`, `textWhite`, `cityYellow`
- Layouts: portrait (1080×1350), landscape (1620×1080)
- Service labels: MDWK, Sunday, EVENT

---

## Testing Checklist

When making changes, verify:
- [ ] Build passes (`npm run build`)
- [ ] Lint passes (`npm run lint`)
- [ ] Portrait watermark renders correctly
- [ ] Landscape watermark renders correctly
- [ ] Address auto-fills based on service type
- [ ] Download works (individual + ZIP)
- [ ] Text fits within allocated space
- [ ] Logo displays in both orientations