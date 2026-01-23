# PRD: Solana Wallet Connectivity

## Introduction

Enable functional Solana wallet connectivity for the World Cup 2026 prediction game. Currently, a placeholder "Connect Wallet" button exists but has no functionality. This feature will allow users to connect their Solana wallets, view their address and balance, select their preferred network, and disconnect when needed. Wallet connection is a prerequisite for users to pay entry fees and submit bracket predictions.

## Goals

- Replace placeholder button with fully functional wallet connection
- Support all major Solana wallets (Phantom, Backpack, Solflare, Ledger, etc.)
- Allow users to switch between networks (Devnet, Testnet, Mainnet)
- Display connected wallet address (truncated) and SOL balance
- Persist wallet connection across page refreshes
- Provide clear feedback for connection errors via toast notifications

## User Stories

### US-001: Set up wallet adapter providers
**Description:** As a developer, I need to configure the Solana wallet adapter so that wallet functionality is available throughout the app.

**Acceptance Criteria:**
- [ ] Install @solana/wallet-adapter-react, @solana/wallet-adapter-react-ui, @solana/wallet-adapter-wallets, @solana/web3.js
- [ ] Create WalletContextProvider component wrapping ConnectionProvider and WalletProvider
- [ ] Configure adapters for Phantom, Backpack, Solflare, Ledger, and other major wallets
- [ ] Wrap app layout with WalletContextProvider
- [ ] Typecheck/lint passes

### US-002: Add network selector
**Description:** As a user, I want to select which Solana network to connect to so I can use devnet for testing or mainnet for real transactions.

**Acceptance Criteria:**
- [ ] Network selector dropdown with options: Mainnet, Devnet, Testnet
- [ ] Selected network stored in localStorage and persists across sessions
- [ ] Network selection updates the RPC endpoint used by ConnectionProvider
- [ ] Default to Devnet if no network previously selected
- [ ] Network change triggers wallet reconnection if already connected
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-003: Implement connect wallet button
**Description:** As a user, I want to click "Connect Wallet" to see a list of available wallets so I can connect my preferred wallet.

**Acceptance Criteria:**
- [ ] Replace placeholder button with functional connect button
- [ ] Clicking button opens wallet selection modal showing installed wallets
- [ ] Wallets that are not installed show "Install" link to their respective stores
- [ ] Modal is styled consistently with existing UI (shadcn/ui, Tailwind)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-004: Display connected state with truncated address
**Description:** As a user, I want to see my truncated wallet address on the button after connecting so I know which wallet is active.

**Acceptance Criteria:**
- [ ] After successful connection, button shows truncated address (e.g., "7xKp...3nFq")
- [ ] Truncation shows first 4 and last 4 characters of the address
- [ ] Button styling changes to indicate connected state (e.g., different background color or border)
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-005: Show wallet details popup
**Description:** As a user, I want to click my connected wallet button to see my full address, balance, and disconnect option.

**Acceptance Criteria:**
- [ ] Clicking connected wallet button opens a popup/dropdown
- [ ] Popup displays full wallet address with copy-to-clipboard button
- [ ] Popup displays current SOL balance (formatted to 4 decimal places)
- [ ] Popup includes "Disconnect" button
- [ ] Popup closes when clicking outside or pressing Escape
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-006: Implement disconnect functionality
**Description:** As a user, I want to disconnect my wallet so I can switch accounts or protect my privacy.

**Acceptance Criteria:**
- [ ] Clicking "Disconnect" in popup disconnects the wallet
- [ ] Button returns to "Connect Wallet" state after disconnect
- [ ] Popup closes after disconnect
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-007: Auto-reconnect on page refresh
**Description:** As a user, I want my wallet to stay connected when I refresh the page so I don't have to reconnect every time.

**Acceptance Criteria:**
- [ ] Wallet adapter configured with autoConnect: true
- [ ] Previously connected wallet automatically reconnects on page load
- [ ] If auto-reconnect fails (e.g., wallet locked), button shows "Connect Wallet" state
- [ ] Typecheck/lint passes

### US-008: Handle connection errors with toast notifications
**Description:** As a user, I want to see a clear error message if my wallet connection fails so I know what went wrong.

**Acceptance Criteria:**
- [ ] User rejection shows toast: "Connection cancelled"
- [ ] Wallet not found shows toast: "Wallet not found. Please install [wallet name]"
- [ ] Network error shows toast: "Failed to connect. Please try again"
- [ ] Toast notifications use existing toast system or shadcn/ui toast component
- [ ] Toasts auto-dismiss after 5 seconds
- [ ] Typecheck/lint passes
- [ ] Verify in browser using dev-browser skill

### US-009: Fetch and display SOL balance
**Description:** As a developer, I need to fetch the user's SOL balance from the blockchain so it can be displayed in the wallet popup.

**Acceptance Criteria:**
- [ ] Fetch balance using connection.getBalance() after wallet connects
- [ ] Convert lamports to SOL (divide by 1e9)
- [ ] Update balance when network changes
- [ ] Handle errors gracefully (show "—" if balance fetch fails)
- [ ] Typecheck/lint passes

## Functional Requirements

- FR-1: Install and configure @solana/wallet-adapter packages with support for Phantom, Backpack, Solflare, Ledger, and other major wallets
- FR-2: Create WalletContextProvider that wraps the application with ConnectionProvider and WalletProvider
- FR-3: Implement network selector dropdown (Mainnet, Devnet, Testnet) that persists selection to localStorage
- FR-4: Replace placeholder "Connect Wallet" button with WalletMultiButton or custom implementation
- FR-5: Display truncated address (first 4 + last 4 characters) on button when connected
- FR-6: Show popup on connected button click with: full address, copy button, SOL balance, disconnect button
- FR-7: Enable auto-reconnect for returning users
- FR-8: Display toast notifications for all connection errors with appropriate messages
- FR-9: Fetch and display SOL balance in popup, formatted to 4 decimal places

## Non-Goals

- No transaction signing or sending in this feature (separate PRD)
- No ENS/SNS domain name resolution for addresses
- No multi-wallet support (connecting multiple wallets simultaneously)
- No wallet balance change notifications/subscriptions
- No fiat currency conversion display
- No transaction history display

## Design Considerations

- Use shadcn/ui components (Button, Popover, DropdownMenu, Toast) for consistency
- Network selector should be positioned near the wallet button (e.g., in header)
- Connected state button should be visually distinct from disconnected state
- Popup should be responsive and work on mobile viewports
- Copy-to-clipboard should show brief "Copied!" feedback

## Technical Considerations

- Use @solana/wallet-adapter-react hooks: useWallet, useConnection
- RPC endpoints:
  - Mainnet: https://api.mainnet-beta.solana.com (or custom RPC)
  - Devnet: https://api.devnet.solana.com
  - Testnet: https://api.testnet.solana.com
- Consider using environment variable for custom RPC endpoints (rate limits on public endpoints)
- Balance should be fetched client-side only (no SSR for wallet state)
- Wallet adapter CSS may need customization to match app theme

## Success Metrics

- Users can connect wallet in under 3 clicks
- Wallet connection persists across page refreshes without user action
- Error states are clear and actionable
- Balance displays within 2 seconds of connection

## Open Questions

- Should we use a custom RPC provider (Helius, QuickNode) for better reliability, or start with public endpoints?
- Should the network selector be visible only to developers/admin, or available to all users?
- Should we add a "Refresh Balance" button in the popup for manual updates?
