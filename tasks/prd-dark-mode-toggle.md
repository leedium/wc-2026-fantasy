# PRD: Dark Mode Toggle

## Introduction

Add a comprehensive dark mode system to the WC2026 application. Users can toggle between light and dark themes via a header icon button. The system detects OS preferences, allows manual override, and persists the choice using cookies for SSR-compatible rendering without flash of unstyled content.

## Goals

- Provide light/dark theme switching across the entire application
- Detect and respect system color scheme preferences
- Allow users to manually override system preference
- Persist theme choice using cookies (SSR-compatible)
- Eliminate flash of wrong theme on page load
- Support all existing shadcn/ui components and custom components

## User Stories

### US-001: Add Theme Provider Infrastructure
**Description:** As a developer, I need a theme provider that manages theme state so that all components can access the current theme.

**Acceptance Criteria:**
- [ ] Create `components/providers/ThemeProvider.tsx` using next-themes library
- [ ] Provider wraps the application in `app/layout.tsx`
- [ ] Supports three modes: "light", "dark", "system"
- [ ] Default to "system" for first-time visitors
- [ ] Typecheck passes

### US-002: Configure Cookie-Based Theme Storage
**Description:** As a user, I want my theme preference to load instantly so that I don't see a flash of the wrong theme.

**Acceptance Criteria:**
- [ ] Configure next-themes to use cookie storage (`storageKey` and `attribute`)
- [ ] Theme cookie set with appropriate expiry (1 year)
- [ ] Server-side rendering uses cookie value to set initial theme
- [ ] No flash of unstyled/wrong-themed content on page load
- [ ] Typecheck passes

### US-003: Create Theme Toggle Button Component
**Description:** As a user, I want a button in the header to toggle between themes so that I can switch modes easily.

**Acceptance Criteria:**
- [ ] Create `components/shared/ThemeToggle.tsx` component
- [ ] Button displays Sun icon for light mode, Moon icon for dark mode
- [ ] Clicking cycles through: light → dark → system → light
- [ ] Uses lucide-react icons (Sun, Moon, Monitor)
- [ ] Tooltip shows current mode on hover
- [ ] Accessible with keyboard navigation
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-004: Add Theme Toggle to Header
**Description:** As a user, I want the theme toggle visible in the header so that I can easily access it from any page.

**Acceptance Criteria:**
- [ ] ThemeToggle added to Header component (desktop and mobile)
- [ ] Positioned before the wallet button on desktop
- [ ] Visible in mobile navigation sheet
- [ ] Consistent styling with other header elements
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-005: Update Tailwind Dark Mode Configuration
**Description:** As a developer, I need Tailwind configured for class-based dark mode so that next-themes can control the theme.

**Acceptance Criteria:**
- [ ] `tailwind.config.ts` has `darkMode: "class"` setting
- [ ] CSS variables in `globals.css` support both light and dark themes
- [ ] Existing shadcn/ui components automatically support dark mode
- [ ] Typecheck passes

### US-006: Add Dark Theme Styles to Custom Components
**Description:** As a user, I want all custom components to look correct in dark mode so that the experience is consistent.

**Acceptance Criteria:**
- [ ] Review all custom components for hardcoded colors
- [ ] Replace hardcoded colors with CSS variables or Tailwind dark: variants
- [ ] GroupStageForm component supports dark mode
- [ ] KnockoutBracket component supports dark mode
- [ ] LeaderboardTable component supports dark mode
- [ ] Typecheck passes
- [ ] Verify in browser using dev-browser skill

### US-007: Add System Preference Detection
**Description:** As a user, I want the app to detect my OS dark mode setting so that it matches my system preference by default.

**Acceptance Criteria:**
- [ ] next-themes `enableSystem` option enabled
- [ ] First-time visitors see theme matching their OS preference
- [ ] Users can override system preference with manual selection
- [ ] "System" option clearly indicated in toggle cycle
- [ ] Typecheck passes

### US-008: Write Unit Tests for Theme Components
**Description:** As a developer, I need tests for the theme system so that we can ensure it works correctly.

**Acceptance Criteria:**
- [ ] Unit tests for ThemeToggle component
- [ ] Tests verify toggle cycles through modes correctly
- [ ] Tests verify correct icons displayed for each mode
- [ ] Mock next-themes in test setup
- [ ] All tests pass
- [ ] Typecheck passes

## Functional Requirements

- FR-1: Install `next-themes` package for theme management
- FR-2: Create ThemeProvider component wrapping the application
- FR-3: Configure cookie-based storage for SSR compatibility
- FR-4: Create ThemeToggle button component with Sun/Moon/Monitor icons
- FR-5: Add ThemeToggle to Header (desktop nav and mobile sheet)
- FR-6: Configure Tailwind CSS for class-based dark mode
- FR-7: Ensure all shadcn/ui components support dark mode (built-in)
- FR-8: Update custom components to use dark mode variants
- FR-9: Enable system preference detection with manual override
- FR-10: Persist theme choice in cookie (1-year expiry)

## Non-Goals

- No theme customization beyond light/dark (no custom color themes)
- No per-page theme settings
- No theme scheduling (automatic day/night switching)
- No theme preview before applying

## Technical Considerations

- Use `next-themes` library (well-maintained, Next.js 15 compatible)
- Cookie storage prevents hydration mismatch and flash
- shadcn/ui components already have dark mode support via CSS variables
- Lucide icons already installed in project
- Consider adding `suppressHydrationWarning` to html element

## Success Metrics

- Theme toggle accessible in under 1 click from any page
- Zero flash of wrong theme on page load
- All pages render correctly in both light and dark modes
- Theme preference persists across sessions and devices (same browser)

## Open Questions

- Should the theme toggle show a dropdown menu instead of cycling? (Decided: cycle for simplicity)
- Should we add a subtle transition animation when switching themes?
