# WC2026 Frontend

World Cup 2026 prediction game frontend built with Next.js 16, React 19, and Tailwind CSS 4.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Testing

The frontend uses Jest and React Testing Library for unit testing.

### Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Coverage Requirements

Tests must maintain 70% coverage across:
- Branches
- Functions
- Lines
- Statements

### Test File Organization

Tests are co-located with their source files in `__tests__` directories:

```
src/
├── stores/__tests__/           # Zustand store tests
├── components/
│   ├── predictions/__tests__/  # Prediction form tests
│   ├── leaderboard/__tests__/  # Leaderboard component tests
│   ├── layout/__tests__/       # Layout component tests
│   └── shared/__tests__/       # Shared component tests
└── app/
    ├── predictions/__tests__/  # Predictions page tests
    ├── leaderboard/__tests__/  # Leaderboard page tests
    └── claims/__tests__/       # Claims page tests
```

### Mocking

The testing setup includes mocks for:

- **Solana Wallet Adapter**: `__mocks__/@solana/wallet-adapter-react.ts` provides helpers like `setWalletConnected()` and `setWalletDisconnected()` for testing wallet states.
- **Next.js Navigation**: `useRouter`, `usePathname`, and `Link` are mocked in `jest.setup.ts`.
- **Browser APIs**: `matchMedia`, `ResizeObserver`, and `IntersectionObserver` are mocked for jsdom compatibility.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checking |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, Tailwind CSS 4, shadcn/ui (Radix UI)
- **State**: Zustand 5
- **Data Fetching**: TanStack React Query 5
- **Wallet**: Solana Wallet Adapter
- **Testing**: Jest 29, React Testing Library 16
