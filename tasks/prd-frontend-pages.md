# PRD: Frontend Pages Implementation

## Introduction

Implement the core frontend pages for the World Cup 2026 Prediction Game including shared layout components (Header with navigation, Footer), Landing page, Predictions page with interactive bracket builder, Leaderboard page with pagination, and a Claims placeholder page. All pages use mock data - API integration will be handled in a separate PRD.

## Goals

- Create a consistent shared layout with Header (navigation + wallet button) and Footer
- Implement responsive navigation with links: Landing, Predictions, Leaderboard, Claims
- Build a full Landing page showcasing the game with mock tournament data
- Create an interactive bracket prediction form with group stage and knockout bracket
- Implement a paginated Leaderboard table displaying user rankings
- Add a Claims placeholder page for future prize claiming functionality
- Use shadcn/ui components throughout for consistent styling

## User Stories

### US-001: Install Additional shadcn/ui Components
**Description:** As a developer, I need additional shadcn/ui components installed so that I can build the pages efficiently.

**Acceptance Criteria:**
- [ ] Install NavigationMenu component for desktop navigation
- [ ] Install Sheet component for mobile navigation drawer
- [ ] Install Table component for leaderboard
- [ ] Install Select component for group stage dropdowns
- [ ] Install Tabs component for bracket stages
- [ ] Install Badge component for status indicators
- [ ] Install Separator component for visual dividers
- [ ] Install Skeleton component for loading states
- [ ] Typecheck passes

### US-002: Create Footer Component
**Description:** As a user, I want a consistent footer across all pages so that I can access important links and information.

**Acceptance Criteria:**
- [ ] `components/layout/Footer.tsx` component created
- [ ] Displays "World Cup 2026 Prediction Game" branding
- [ ] Shows copyright with current year
- [ ] Includes placeholder links: About, Rules, Terms, Privacy
- [ ] Responsive layout (stacks on mobile)
- [ ] Uses Tailwind CSS with WC2026 theme colors
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-003: Update Header with Full Navigation
**Description:** As a user, I want a navigation header so that I can easily navigate between pages and connect my wallet.

**Acceptance Criteria:**
- [ ] Update `components/layout/Header.tsx` with full navigation
- [ ] Desktop: NavigationMenu with links - Landing (/), Predictions (/predictions), Leaderboard (/leaderboard), Claims (/claims)
- [ ] Mobile: Sheet component with hamburger menu icon
- [ ] WalletMultiButton positioned right-aligned on desktop
- [ ] Active link state indicated visually
- [ ] Logo/brand links to home page
- [ ] Sticky header on scroll
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Create Shared Page Layout Component
**Description:** As a developer, I need a shared layout component so that all pages have consistent Header and Footer.

**Acceptance Criteria:**
- [ ] `components/layout/PageLayout.tsx` component created
- [ ] Accepts children prop for page content
- [ ] Includes Header at top
- [ ] Includes Footer at bottom
- [ ] Main content area has min-height to push footer down
- [ ] Applies consistent padding/max-width for content
- [ ] Typecheck passes

### US-005: Create Mock Data for Tournament
**Description:** As a developer, I need mock tournament data so that pages can display realistic content.

**Acceptance Criteria:**
- [ ] `lib/mock-data.ts` file created
- [ ] Mock tournament info: status, lock time, entry fee, prize pool, total entries
- [ ] Mock teams array with all 48 teams (id, name, code, group)
- [ ] Mock groups array (12 groups, A-L)
- [ ] Mock leaderboard entries (50+ entries with wallet, points, rank)
- [ ] Mock user entry data (predictions, points, rank)
- [ ] TypeScript types defined in `types/tournament.ts`
- [ ] Typecheck passes

### US-006: Implement Landing Page
**Description:** As a user, I want an informative landing page so that I understand the game and can get started.

**Acceptance Criteria:**
- [ ] `app/page.tsx` updated with full landing page content
- [ ] Hero section with game title, tagline, and CTA button
- [ ] Tournament info section showing: status, entry fee (0.10 SOL), prize pool, total entries, lock time countdown
- [ ] "How It Works" section explaining: 1) Connect wallet, 2) Make predictions, 3) Earn points, 4) Claim prizes
- [ ] Scoring breakdown section showing point values for groups and knockout
- [ ] CTA section with "Make Your Predictions" button (links to /predictions)
- [ ] Uses Card components for sections
- [ ] Responsive design for mobile/desktop
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Create Group Stage Prediction Component
**Description:** As a user, I want to predict group stage standings so that I can earn points for correct predictions.

**Acceptance Criteria:**
- [ ] `components/predictions/GroupStageForm.tsx` component created
- [ ] Displays all 12 groups (A-L) in a grid layout
- [ ] Each group shows 4 team slots (1st, 2nd, 3rd, 4th place)
- [ ] Select dropdowns to choose team for each position
- [ ] Teams filtered to only show teams in that group
- [ ] Validation: each team can only be selected once per group
- [ ] Visual indicator for complete vs incomplete groups
- [ ] Uses Select component from shadcn/ui
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-008: Create Knockout Bracket Component
**Description:** As a user, I want to predict knockout bracket winners so that I can earn points for correct predictions.

**Acceptance Criteria:**
- [ ] `components/predictions/KnockoutBracket.tsx` component created
- [ ] Visual bracket layout showing: Round of 32 → Round of 16 → Quarter-finals → Semi-finals → Final
- [ ] Third place match included
- [ ] Each match shows two team slots with winner selection
- [ ] Winners automatically propagate to next round
- [ ] Bracket is internally consistent (can't pick team in QF if not advanced from R16)
- [ ] Responsive design (horizontal scroll on mobile or stacked view)
- [ ] Uses Tabs component to switch between bracket stages on mobile
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-009: Create Total Goals Tiebreaker Input
**Description:** As a user, I want to predict total tournament goals so that ties can be broken fairly.

**Acceptance Criteria:**
- [ ] `components/predictions/TiebreakerInput.tsx` component created
- [ ] Number input for total goals prediction
- [ ] Validation: must be positive integer, reasonable range (100-300)
- [ ] Helper text explaining tiebreaker purpose
- [ ] Uses Input component from shadcn/ui
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-010: Implement Predictions Page
**Description:** As a user, I want a predictions page where I can submit my complete bracket prediction.

**Acceptance Criteria:**
- [ ] `app/predictions/page.tsx` created
- [ ] Page wrapped in PageLayout component
- [ ] Shows tournament status and lock time countdown
- [ ] Tabs or sections for: Group Stage, Knockout Bracket, Tiebreaker
- [ ] Integrates GroupStageForm, KnockoutBracket, and TiebreakerInput components
- [ ] Submit button at bottom (disabled if wallet not connected or predictions incomplete)
- [ ] Shows validation summary (X of 12 groups complete, bracket complete, tiebreaker set)
- [ ] Toast notification on submit (mock - "Predictions saved!")
- [ ] Entry fee display (0.10 SOL required)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-011: Create Leaderboard Table Component
**Description:** As a user, I want to see a leaderboard table so that I can track rankings.

**Acceptance Criteria:**
- [ ] `components/leaderboard/LeaderboardTable.tsx` component created
- [ ] Table columns: Rank, Wallet Address (truncated), Points, Change indicator
- [ ] Uses Table component from shadcn/ui
- [ ] Alternating row colors for readability
- [ ] Current user's row highlighted (if connected)
- [ ] Rank badges for top 3 (gold, silver, bronze)
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-012: Create Pagination Component
**Description:** As a user, I want pagination controls so that I can navigate through leaderboard pages.

**Acceptance Criteria:**
- [ ] `components/shared/Pagination.tsx` component created
- [ ] Shows current page and total pages
- [ ] Previous/Next buttons
- [ ] Page number buttons (1, 2, 3, ..., last)
- [ ] Configurable items per page (default 25)
- [ ] Disabled states for first/last page
- [ ] Uses Button component from shadcn/ui
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-013: Implement Leaderboard Page
**Description:** As a user, I want a leaderboard page so that I can see rankings and find my position.

**Acceptance Criteria:**
- [ ] `app/leaderboard/page.tsx` created
- [ ] Page wrapped in PageLayout component
- [ ] Page title "Leaderboard" with total participants count
- [ ] LeaderboardTable component displaying mock data
- [ ] Pagination component at bottom
- [ ] "Find My Rank" button that scrolls to/highlights user's row (if connected)
- [ ] Shows user's current rank in a sticky banner (if connected and ranked)
- [ ] Loading skeleton while data loads
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-014: Implement Claims Placeholder Page
**Description:** As a user, I want a claims page placeholder so that I know where to claim prizes later.

**Acceptance Criteria:**
- [ ] `app/claims/page.tsx` created
- [ ] Page wrapped in PageLayout component
- [ ] "Claims" page title
- [ ] "Coming Soon" message with explanation
- [ ] Icon or illustration indicating future feature
- [ ] Brief text: "Prize claims will be available after the tournament ends"
- [ ] Link back to leaderboard to check current ranking
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-015: Add Route Metadata and Loading States
**Description:** As a developer, I need proper metadata and loading states for all pages.

**Acceptance Criteria:**
- [ ] Each page exports metadata (title, description) for SEO
- [ ] `app/predictions/loading.tsx` with skeleton UI
- [ ] `app/leaderboard/loading.tsx` with skeleton UI
- [ ] `app/claims/loading.tsx` with skeleton UI
- [ ] Consistent loading skeleton patterns across pages
- [ ] Typecheck passes

## Functional Requirements

- FR-1: All pages must use the shared PageLayout component with Header and Footer
- FR-2: Navigation must include links to: Landing (/), Predictions (/predictions), Leaderboard (/leaderboard), Claims (/claims)
- FR-3: Header must display WalletMultiButton right-aligned
- FR-4: Mobile navigation must use a drawer/sheet pattern with hamburger icon
- FR-5: Group stage form must enforce unique team selection within each group
- FR-6: Knockout bracket must maintain internal consistency (winners propagate correctly)
- FR-7: Predictions page must show validation status before submission
- FR-8: Leaderboard must paginate with 25 entries per page by default
- FR-9: Connected user's leaderboard row must be visually highlighted
- FR-10: All pages must be responsive (mobile, tablet, desktop)
- FR-11: All interactive elements must have appropriate hover/focus states

## Non-Goals

- API integration (using mock data only)
- Actual wallet transactions (UI only)
- Real-time leaderboard updates
- User authentication/session management
- Prediction encryption/decryption
- Admin pages
- Error boundary implementation
- Internationalization (i18n)

## Design Considerations

### Navigation Structure
```
Header:
┌─────────────────────────────────────────────────────────────┐
│ [Logo] WC2026   Landing | Predictions | Leaderboard | Claims   [Connect Wallet] │
└─────────────────────────────────────────────────────────────┘

Mobile Header:
┌─────────────────────────────────────────────────────────────┐
│ [☰]  WC2026                                    [Connect Wallet] │
└─────────────────────────────────────────────────────────────┘
```

### Color Usage
- Primary (#1a365d): Headers, primary buttons, active states
- Secondary (#2d3748): Text, borders
- Accent (#38a169): Success states, CTAs, points display
- Use existing Tailwind theme colors configured in setup

### Component Reuse
- Use Card for content sections
- Use Button variants: default, outline, ghost
- Use Badge for rank indicators, status
- Use Skeleton for loading states

## Technical Considerations

### New shadcn/ui Components Required
```bash
npx shadcn@latest add navigation-menu
npx shadcn@latest add sheet
npx shadcn@latest add table
npx shadcn@latest add select
npx shadcn@latest add tabs
npx shadcn@latest add badge
npx shadcn@latest add separator
npx shadcn@latest add skeleton
```

### File Structure
```
app/
  page.tsx                    # Landing page
  predictions/
    page.tsx                  # Predictions page
    loading.tsx               # Loading state
  leaderboard/
    page.tsx                  # Leaderboard page
    loading.tsx               # Loading state
  claims/
    page.tsx                  # Claims placeholder
    loading.tsx               # Loading state

components/
  layout/
    Header.tsx                # Updated with full nav
    Footer.tsx                # New footer component
    PageLayout.tsx            # Shared layout wrapper
  predictions/
    GroupStageForm.tsx        # Group predictions
    KnockoutBracket.tsx       # Knockout bracket
    TiebreakerInput.tsx       # Total goals input
  leaderboard/
    LeaderboardTable.tsx      # Rankings table
  shared/
    Pagination.tsx            # Reusable pagination

lib/
  mock-data.ts                # Mock tournament data

types/
  tournament.ts               # TypeScript types
```

### State Management
- Use Zustand store for prediction form state (allows persistence across page navigation)
- Local component state for UI interactions (dropdowns, modals)
- URL params for leaderboard pagination

## Success Metrics

- All pages render without errors
- Navigation works correctly between all pages
- Predictions form validates input correctly
- Bracket maintains consistency when selecting winners
- Leaderboard pagination displays correct data
- Mobile navigation drawer opens/closes properly
- All pages pass accessibility checks (keyboard navigation, focus states)

## Open Questions

- Should the knockout bracket show match numbers/IDs for reference?
  - **Recommendation:** Yes, show match IDs (M1, M2, etc.) for clarity
- Should we show point values next to each bracket match?
  - **Recommendation:** Yes, show potential points (e.g., "+2 pts" for R32)
- Should predictions auto-save as users fill them out?
  - **Recommendation:** Yes, use Zustand persist to localStorage for draft predictions
