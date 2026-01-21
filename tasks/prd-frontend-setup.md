# PRD: Frontend Application Setup

## Introduction

Set up the foundational Next.js 15 web application for the World Cup 2026 Decentralized Prediction Game. This PRD covers project scaffolding, dependency installation, folder structure, global layout, wallet adapter integration, state management boilerplate, and environment configuration. Page implementations and API routes will be added in subsequent PRDs.

## Goals

- Create a production-ready Next.js 15 App Router project with strict TypeScript
- Configure Tailwind CSS and shadcn/ui component library
- Establish consistent folder structure following Next.js conventions
- Integrate Solana wallet adapter with multi-wallet support (Phantom, Backpack, Solflare)
- Set up Zustand for client state and React Query for server state management
- Configure environment variables for devnet/mainnet network switching
- Create reusable layout components (navigation shell, wallet connection wrapper)

## User Stories

### US-001: Initialize Next.js 15 Project
**Description:** As a developer, I need a properly initialized Next.js 15 project so that I can build the prediction game frontend.

**Acceptance Criteria:**
- [ ] Next.js 15 project created using `create-next-app` with App Router
- [ ] TypeScript configured with strict mode enabled in `tsconfig.json`
- [ ] Project builds successfully with `npm run build`
- [ ] Development server starts with `npm run dev`
- [ ] Typecheck passes with `npm run typecheck` (add script if needed)

### US-002: Configure Tailwind CSS
**Description:** As a developer, I need Tailwind CSS configured so that I can style components efficiently.

**Acceptance Criteria:**
- [ ] Tailwind CSS installed and configured with `tailwind.config.ts`
- [ ] Global styles imported in `app/globals.css`
- [ ] Content paths configured for `app/**/*.{ts,tsx}` and `components/**/*.{ts,tsx}`
- [ ] Custom theme colors defined for the WC2026 brand (primary, secondary, accent)
- [ ] Dark mode support configured (class-based)
- [ ] Typecheck passes

### US-003: Install and Configure shadcn/ui
**Description:** As a developer, I need shadcn/ui initialized so that I can use pre-built accessible components.

**Acceptance Criteria:**
- [ ] shadcn/ui initialized with `npx shadcn@latest init`
- [ ] `components.json` configuration file created
- [ ] Base components installed: Button, Card, Input, Dialog, Toast
- [ ] Components directory structure: `components/ui/` for shadcn components
- [ ] `lib/utils.ts` created with `cn()` helper function
- [ ] Typecheck passes

### US-004: Establish Folder Structure
**Description:** As a developer, I need a consistent folder structure so that the codebase is organized and maintainable.

**Acceptance Criteria:**
- [ ] Folder structure created as follows:
  ```
  app/
    (routes)/           # Route groups
    layout.tsx          # Root layout
    page.tsx            # Landing page placeholder
    globals.css         # Global styles
  components/
    ui/                 # shadcn/ui components
    layout/             # Layout components (Header, Footer, etc.)
    shared/             # Shared/reusable components
  lib/
    utils.ts            # Utility functions
    constants.ts        # App constants
  hooks/                # Custom React hooks
  stores/               # Zustand stores
  types/                # TypeScript type definitions
  config/               # Configuration files
  providers/            # React context providers
  ```
- [ ] Each directory contains a placeholder file or `.gitkeep`
- [ ] Typecheck passes

### US-005: Configure Solana Wallet Adapter
**Description:** As a developer, I need wallet adapter integration so that users can connect their Solana wallets.

**Acceptance Criteria:**
- [ ] `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, and `@solana/wallet-adapter-wallets` installed
- [ ] `@solana/web3.js` installed for Solana interactions
- [ ] `WalletContextProvider` component created in `providers/WalletProvider.tsx`
- [ ] Wallet adapters configured: Phantom, Backpack, Solflare
- [ ] `WalletMultiButton` component renders correctly
- [ ] Wallet adapter CSS imported (`@solana/wallet-adapter-react-ui/styles.css`)
- [ ] Network configurable via environment variable (devnet/mainnet)
- [ ] Typecheck passes

### US-006: Set Up Zustand State Management
**Description:** As a developer, I need Zustand configured so that I can manage client-side state.

**Acceptance Criteria:**
- [ ] `zustand` package installed
- [ ] Example store created in `stores/useAppStore.ts` with basic structure
- [ ] Store includes: wallet connection status, selected network, UI state (loading, modals)
- [ ] Zustand devtools middleware enabled in development
- [ ] Persist middleware example for relevant state
- [ ] Typecheck passes

### US-007: Set Up React Query
**Description:** As a developer, I need React Query configured so that I can manage server state and API caching.

**Acceptance Criteria:**
- [ ] `@tanstack/react-query` and `@tanstack/react-query-devtools` installed
- [ ] `QueryClientProvider` component created in `providers/QueryProvider.tsx`
- [ ] Query client configured with sensible defaults (staleTime, retry logic)
- [ ] React Query Devtools enabled in development mode
- [ ] Typecheck passes

### US-008: Create Root Layout with Providers
**Description:** As a developer, I need a root layout that wraps the app with all necessary providers.

**Acceptance Criteria:**
- [ ] `app/layout.tsx` created with proper HTML structure
- [ ] All providers wrapped in correct order: QueryProvider > WalletProvider > children
- [ ] Metadata configured (title, description, OpenGraph basics)
- [ ] Font configured (Inter or similar)
- [ ] `Toaster` component from shadcn/ui included for notifications
- [ ] Typecheck passes
- [ ] Verify in browser: app loads without errors

### US-009: Create Navigation Header Component
**Description:** As a developer, I need a navigation header component so that users can navigate the app and connect their wallet.

**Acceptance Criteria:**
- [ ] `components/layout/Header.tsx` component created
- [ ] Logo/brand placeholder displayed
- [ ] Navigation links placeholder (to be populated in future PRDs)
- [ ] `WalletMultiButton` integrated in header
- [ ] Responsive design (mobile hamburger menu structure, content deferred)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Configure Environment Variables
**Description:** As a developer, I need environment configuration so that I can switch between devnet and mainnet.

**Acceptance Criteria:**
- [ ] `.env.example` file created with all required variables documented
- [ ] `.env.local` added to `.gitignore`
- [ ] Environment variables defined:
  - `NEXT_PUBLIC_SOLANA_NETWORK` (devnet | mainnet-beta)
  - `NEXT_PUBLIC_SOLANA_RPC_URL` (RPC endpoint)
  - `NEXT_PUBLIC_API_URL` (Backend API URL)
- [ ] `config/env.ts` created to validate and export typed env variables
- [ ] Network selection uses environment variable in wallet provider
- [ ] Typecheck passes

### US-011: Create Placeholder Landing Page
**Description:** As a developer, I need a placeholder landing page so that I can verify the setup is working.

**Acceptance Criteria:**
- [ ] `app/page.tsx` displays "World Cup 2026 Prediction Game" heading
- [ ] Shows wallet connection status (connected/disconnected)
- [ ] Displays current network (devnet/mainnet)
- [ ] Basic styling with Tailwind CSS
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Configure ESLint and Prettier
**Description:** As a developer, I need consistent code formatting so that the codebase maintains quality standards.

**Acceptance Criteria:**
- [ ] ESLint configured with Next.js recommended rules
- [ ] Prettier installed and configured (`.prettierrc`)
- [ ] ESLint Prettier plugin to avoid conflicts
- [ ] `npm run lint` script works
- [ ] `npm run format` script added for Prettier
- [ ] Typecheck passes

## Functional Requirements

- FR-1: The project must use Next.js 15 with App Router architecture
- FR-2: TypeScript must be configured in strict mode with no implicit any
- FR-3: Tailwind CSS must be configured with custom theme colors for WC2026 branding
- FR-4: shadcn/ui must be initialized with default components (Button, Card, Input, Dialog, Toast)
- FR-5: Wallet adapter must support Phantom, Backpack, and Solflare wallets
- FR-6: Network selection (devnet/mainnet) must be configurable via environment variables
- FR-7: Zustand must be configured with devtools for development debugging
- FR-8: React Query must be configured with devtools for development debugging
- FR-9: Root layout must wrap all pages with required providers in correct order
- FR-10: Header component must include wallet connection button
- FR-11: All environment variables must be documented in `.env.example`
- FR-12: ESLint and Prettier must be configured for consistent code style

## Non-Goals

- Page implementations (predictions form, leaderboard, claims) - separate PRDs
- API route implementations - separate PRD
- Smart contract integration (beyond wallet connection) - separate PRD
- Authentication/authorization logic - separate PRD
- Database integration - separate PRD
- Deployment configuration (Vercel) - separate PRD
- Testing setup (Jest, Playwright) - separate PRD
- CI/CD pipeline - separate PRD
- Analytics integration - separate PRD
- Error boundary implementation - separate PRD

## Design Considerations

### Color Palette (WC2026 Brand)
```
Primary: #1a365d (deep blue - trust, professionalism)
Secondary: #2d3748 (dark gray - sophistication)
Accent: #38a169 (green - success, money, sports fields)
Background: #f7fafc (light gray)
Background Dark: #1a202c (dark mode)
```

### Typography
- Primary font: Inter (clean, modern, highly readable)
- Monospace: JetBrains Mono (for wallet addresses, numbers)

### Component Library
- Use shadcn/ui components as the base
- Extend with custom variants as needed
- Follow shadcn/ui naming conventions

## Technical Considerations

### Dependencies
```json
{
  "dependencies": {
    "next": "^15.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "@solana/wallet-adapter-react": "^0.15.x",
    "@solana/wallet-adapter-react-ui": "^0.9.x",
    "@solana/wallet-adapter-wallets": "^0.19.x",
    "@solana/web3.js": "^1.x",
    "@tanstack/react-query": "^5.x",
    "zustand": "^4.x",
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x",
    "lucide-react": "^0.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "tailwindcss": "^3.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x",
    "eslint": "^9.x",
    "eslint-config-next": "^15.x",
    "prettier": "^3.x",
    "@tanstack/react-query-devtools": "^5.x"
  }
}
```

### Folder Structure Rationale
- `app/` - Next.js App Router convention
- `components/ui/` - shadcn/ui components (auto-generated)
- `components/layout/` - Layout-specific components
- `components/shared/` - Reusable components across features
- `lib/` - Utility functions and helpers
- `hooks/` - Custom React hooks
- `stores/` - Zustand stores (one file per store domain)
- `types/` - Shared TypeScript types
- `config/` - Environment and app configuration
- `providers/` - React context providers

### Provider Order (Important)
```tsx
<QueryClientProvider>
  <WalletConnectionProvider>
    <WalletModalProvider>
      {children}
    </WalletModalProvider>
  </WalletConnectionProvider>
</QueryClientProvider>
```

## Success Metrics

- Project builds without errors (`npm run build` succeeds)
- TypeScript compilation passes with strict mode
- ESLint passes with no errors
- Development server starts and renders landing page
- Wallet connection modal opens when clicking connect button
- Environment variables correctly switch between devnet and mainnet
- All shadcn/ui components render correctly with custom theme

## Open Questions

- Should we include a specific icon library (lucide-react is typical with shadcn)?
  - **Recommendation:** Yes, install lucide-react as it's the default for shadcn/ui
- Should we add path aliases (`@/` for imports)?
  - **Recommendation:** Yes, configure `@/` alias in tsconfig.json for cleaner imports
- Should we include next-themes for dark mode toggle?
  - **Recommendation:** Yes, include for future dark mode support
