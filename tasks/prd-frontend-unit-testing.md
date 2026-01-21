# PRD: Frontend Unit Testing Infrastructure

## Introduction

Add comprehensive unit testing infrastructure for the WC2026 frontend application using Jest and React Testing Library. This enables catching regressions before deployment by providing automated tests for all hooks, components, and business logic. The testing setup will mock external dependencies (Solana wallet adapter, Next.js router) to test component logic in isolation.

## Goals

- Establish Jest + React Testing Library as the testing framework
- Achieve 70% code coverage across branches, functions, lines, and statements
- Provide mocks for Solana wallet adapter to test wallet-dependent features
- Create reusable test utilities and patterns for the codebase
- Enable developers to run tests locally before pushing changes

## User Stories

### US-001: Install Testing Dependencies
**Description:** As a developer, I need testing libraries installed so I can write and run unit tests.

**Acceptance Criteria:**
- [ ] Jest 29.x installed as dev dependency
- [ ] @testing-library/react 16.x installed
- [ ] @testing-library/jest-dom 6.x installed
- [ ] @testing-library/user-event 14.x installed
- [ ] ts-jest configured for TypeScript support
- [ ] jest-environment-jsdom installed for DOM testing
- [ ] All dependencies compatible with React 19 and Next.js 16
- [ ] `npm install` completes without errors

### US-002: Configure Jest for Next.js
**Description:** As a developer, I need Jest configured to work with Next.js App Router so tests run correctly.

**Acceptance Criteria:**
- [ ] `jest.config.ts` created in frontend directory
- [ ] jsdom test environment configured
- [ ] Module path aliases (`@/*`) resolve correctly
- [ ] CSS imports mocked (don't break tests)
- [ ] Image/asset imports mocked
- [ ] Coverage thresholds set to 70%
- [ ] Test file patterns match `**/__tests__/**/*.test.{ts,tsx}`
- [ ] `npm test` command runs without configuration errors

### US-003: Create Jest Setup File
**Description:** As a developer, I need common mocks and setup so I don't repeat boilerplate in every test.

**Acceptance Criteria:**
- [ ] `jest.setup.ts` created and referenced in config
- [ ] `@testing-library/jest-dom` matchers extended globally
- [ ] `next/navigation` mocked (useRouter, usePathname, useSearchParams)
- [ ] `next/link` mocked as simple anchor element
- [ ] Browser APIs mocked (matchMedia, ResizeObserver, IntersectionObserver)
- [ ] Environment variables set for test environment
- [ ] No console errors during test setup

### US-004: Create Solana Wallet Adapter Mocks
**Description:** As a developer, I need wallet adapter mocked so I can test wallet-dependent components without real connections.

**Acceptance Criteria:**
- [ ] `__mocks__/@solana/wallet-adapter-react.ts` created
- [ ] `useWallet` hook mocked with configurable state
- [ ] `useConnection` hook mocked
- [ ] `WalletProvider` mocked as passthrough
- [ ] `__mocks__/@solana/wallet-adapter-react-ui.ts` created
- [ ] `WalletMultiButton` mocked as simple button
- [ ] Mocks support both connected and disconnected states
- [ ] Tests can override mock state per-test

### US-005: Add npm Test Scripts
**Description:** As a developer, I need npm scripts so I can easily run tests from the command line.

**Acceptance Criteria:**
- [ ] `npm test` runs all tests once
- [ ] `npm run test:watch` runs tests in watch mode
- [ ] `npm run test:coverage` runs tests with coverage report
- [ ] Scripts work from the frontend directory
- [ ] Coverage report outputs to `coverage/` directory

### US-006: Test useAppStore Zustand Store
**Description:** As a developer, I need the Zustand store tested so state management logic is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/stores/__tests__/useAppStore.test.ts`
- [ ] Initial state values tested
- [ ] `setGroupPrediction` action tested
- [ ] `setKnockoutPrediction` action tested
- [ ] `setTiebreaker` action tested
- [ ] `resetPredictions` action tested
- [ ] Selector hooks tested (useGroupPredictions, useKnockoutPredictions, etc.)
- [ ] All tests pass

### US-007: Test GroupStageForm Component
**Description:** As a developer, I need GroupStageForm tested so prediction input logic is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/predictions/__tests__/GroupStageForm.test.tsx`
- [ ] Component renders without crashing
- [ ] Team selection dropdown works
- [ ] Position assignment (1-4) works correctly
- [ ] Validation prevents duplicate positions
- [ ] Completion state calculated correctly
- [ ] onChange callback fired with correct data
- [ ] All tests pass

### US-008: Test LeaderboardTable Component
**Description:** As a developer, I need LeaderboardTable tested so ranking display logic is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/leaderboard/__tests__/LeaderboardTable.test.tsx`
- [ ] Component renders with mock leaderboard data
- [ ] Rank, user, and points columns display correctly
- [ ] Current user row highlighted
- [ ] Rank change indicators show correctly (up/down/same)
- [ ] Empty state handled gracefully
- [ ] All tests pass

### US-009: Test KnockoutBracket Component
**Description:** As a developer, I need KnockoutBracket tested so bracket prediction logic is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/predictions/__tests__/KnockoutBracket.test.tsx`
- [ ] Component renders all knockout stages
- [ ] Stage navigation (tabs/buttons) works
- [ ] Team selection in match slots works
- [ ] Winner cascades to next round correctly
- [ ] Changing earlier pick clears dependent picks
- [ ] Read-only mode disables interactions
- [ ] All tests pass

### US-010: Test TiebreakerInput Component
**Description:** As a developer, I need TiebreakerInput tested so tiebreaker validation is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/predictions/__tests__/TiebreakerInput.test.tsx`
- [ ] Component renders with label and input
- [ ] Accepts valid numeric input
- [ ] Validates minimum value (e.g., 0)
- [ ] Validates maximum value (e.g., 500)
- [ ] Shows error state for invalid input
- [ ] onChange callback fired with correct value
- [ ] All tests pass

### US-011: Test Header Component
**Description:** As a developer, I need Header tested so navigation logic is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/layout/__tests__/Header.test.tsx`
- [ ] Component renders logo and navigation links
- [ ] Active page link styled differently
- [ ] Navigation links point to correct routes
- [ ] Wallet button renders (mocked)
- [ ] Mobile menu toggle works (if applicable)
- [ ] All tests pass

### US-012: Test Footer Component
**Description:** As a developer, I need Footer tested so it renders correctly.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/layout/__tests__/Footer.test.tsx`
- [ ] Component renders without crashing
- [ ] Copyright text displays
- [ ] Links render correctly (if any)
- [ ] All tests pass

### US-013: Test PageLayout Component
**Description:** As a developer, I need PageLayout tested so layout wrapper logic is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/layout/__tests__/PageLayout.test.tsx`
- [ ] Component renders children
- [ ] Header included in layout
- [ ] Footer included in layout
- [ ] Page title prop works (if applicable)
- [ ] All tests pass

### US-014: Test Pagination Component
**Description:** As a developer, I need Pagination tested so pagination logic is verified.

**Acceptance Criteria:**
- [ ] Test file created at `src/components/shared/__tests__/Pagination.test.tsx`
- [ ] Component renders page numbers
- [ ] Current page highlighted
- [ ] Previous/Next buttons work
- [ ] Ellipsis shown for large page counts
- [ ] Disabled state for first/last page boundaries
- [ ] onPageChange callback fired correctly
- [ ] All tests pass

### US-015: Test Page Content Components
**Description:** As a developer, I need page content components tested so page-level integration is verified.

**Acceptance Criteria:**
- [ ] `PredictionsPageContent.test.tsx` created
- [ ] `LeaderboardPageContent.test.tsx` created
- [ ] `ClaimsPageContent.test.tsx` created
- [ ] Components render with mocked wallet (disconnected state)
- [ ] Components handle loading states
- [ ] Components handle error states
- [ ] All tests pass

### US-016: Update Documentation
**Description:** As a developer, I need testing documentation so I know how to write and run tests.

**Acceptance Criteria:**
- [ ] ENGINEERING.md updated with "Frontend Unit Tests" section
- [ ] Testing commands documented
- [ ] Mock usage patterns documented
- [ ] README.md updated with testing section
- [ ] Test file organization explained

## Functional Requirements

- FR-1: Jest must be configured with jsdom environment for DOM testing
- FR-2: Module aliases (`@/*` to `./src/*`) must resolve in tests
- FR-3: CSS and image imports must be mocked to prevent test failures
- FR-4: Coverage thresholds must be set to 70% for branches, functions, lines, and statements
- FR-5: `@testing-library/jest-dom` matchers must be available globally in all tests
- FR-6: `next/navigation` hooks must be mocked with configurable return values
- FR-7: Solana wallet adapter must be fully mocked to test without blockchain connection
- FR-8: Tests must be able to simulate user interactions via `@testing-library/user-event`
- FR-9: Each component test file must be co-located in a `__tests__` subdirectory
- FR-10: All tests must pass before the implementation is considered complete

## Non-Goals

- No end-to-end (E2E) testing with Playwright or Cypress
- No visual regression testing
- No CI/CD pipeline integration (not yet available)
- No integration tests with actual Solana devnet
- No snapshot testing (prefer explicit assertions)
- No testing of third-party shadcn/ui primitives (trust the library)

## Technical Considerations

- **React 19 Compatibility:** Ensure @testing-library/react 16.x which supports React 19
- **Next.js App Router:** Mock `next/navigation` (not `next/router`)
- **Zustand Testing:** Use `act()` wrapper when testing store state changes
- **Async Components:** Handle Suspense boundaries in tests if needed
- **CSS Modules/Tailwind:** Use identity-obj-proxy or simple mock for className handling

## Success Metrics

- All 70%+ coverage thresholds met on first `npm run test:coverage`
- All tests pass on `npm test`
- No flaky tests (tests pass consistently on multiple runs)
- Tests run in under 30 seconds for full suite
- Developers can write new tests following established patterns

## Open Questions

- Should we add a pre-commit hook to run tests? (Deferred - no CI/CD yet)
- Should we add test utilities for common patterns (e.g., renderWithProviders)? (Yes, if patterns emerge)
