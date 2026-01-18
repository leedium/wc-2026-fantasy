# Engineering Design Document: World Cup 2026 Prediction Game

> **Version:** 2.0.0
> **Last Updated:** 2026-01-18
> **Status:** Draft

## Table of Contents

1. [Overview](#overview)
2. [Goals & Non-Goals](#goals--non-goals)
3. [System Architecture](#system-architecture)
4. [Smart Contract Design](#smart-contract-design)
5. [Database Schema](#database-schema)
6. [API Design](#api-design)
7. [Encryption Scheme](#encryption-scheme)
8. [Data Flow](#data-flow)
9. [Security Considerations](#security-considerations)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Plan](#deployment-plan)
12. [Monitoring & Operations](#monitoring--operations)
13. [Future Enhancements (v2)](#future-enhancements-v2)

---

## Overview

This document describes the technical implementation of a decentralized prediction game for FIFA World Cup 2026 on Solana. Users pay an entry fee (0.10 SOL) to submit bracket predictions before the tournament starts. Points are awarded based on prediction accuracy, and prize pool shares are distributed based on final rankings.

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Blockchain | Solana (Anchor) | Low fees, fast finality, existing expertise |
| Prediction privacy | Encrypted-until-lock | Simpler than commit-reveal, no user action needed |
| Oracle | Admin-controlled | Simplest for v1, upgradeable to multi-sig |
| Leaderboard | Off-chain (Supabase) | Reduces on-chain storage costs |
| Frontend auth | Wallet-only | Simpler for v1, no abstraction layer |

---

## Goals & Non-Goals

### Goals (v1)

- Users can register and pay entry fee
- Users can submit/update encrypted predictions before lock
- Admin can submit match results
- System calculates points automatically
- Users can view leaderboard
- Top finishers can claim prizes

### Non-Goals (v1 - Deferred to v2)

- Achievement NFTs
- Wallet abstraction (Privy/Dynamic)
- Multi-sig oracle
- Automated sports data integration
- Sybil/collusion detection
- Mobile app

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│                         (Next.js + Zustand)                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │  Landing    │  │ Predictions │  │ Leaderboard │  │   Claims    │    │
│  │    Page     │  │    Form     │  │    View     │  │    Page     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
           │                   │                  │
           │    Wallet Adapter │                  │
           ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SOLANA BLOCKCHAIN                               │
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │  PREDICTION VAULT │  │  SCORING ENGINE   │  │ PRIZE DISTRIBUTOR │   │
│  │                   │  │                   │  │                   │   │
│  │ - Tournament      │  │ - MatchResult     │  │ - PrizeConfig     │   │
│  │ - UserEntry       │  │                   │  │ - PrizeClaim      │   │
│  │                   │  │                   │  │                   │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
           │                   │                  │
           │      RPC          │                  │
           ▼                   ▼                  ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND SERVICES                                 │
│                                                                          │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐   │
│  │    HONO API       │  │    SUPABASE       │  │   CRON JOBS       │   │
│  │ (Cloudflare)      │  │   (Postgres)      │  │  (Cloudflare)     │   │
│  │                   │  │                   │  │                   │   │
│  │ - /predictions    │  │ - users           │  │ - Leaderboard     │   │
│  │ - /leaderboard    │  │ - predictions     │  │   recalc          │   │
│  │ - /admin/*        │  │ - match_results   │  │ - Notifications   │   │
│  │                   │  │ - leaderboard     │  │                   │   │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Smart Contract Design

### Program 1: Prediction Vault

**Program ID:** `WC26Vault...` (to be generated)

#### Accounts

```rust
/// Global tournament configuration
#[account]
pub struct Tournament {
    /// Admin authority (can update status, emergency withdraw)
    pub authority: Pubkey,
    /// PDA that holds the prize pool SOL
    pub prize_pool: Pubkey,
    /// Total number of registered users
    pub total_entries: u64,
    /// Total SOL in prize pool (lamports)
    pub total_prize_pool: u64,
    /// Current tournament phase
    pub status: TournamentStatus,
    /// Unix timestamp when predictions lock
    pub lock_time: i64,
    /// Entry fee in lamports (0.1 SOL = 100_000_000)
    pub entry_fee: u64,
    /// Platform rake in basis points (1000 = 10%)
    pub rake_bps: u16,
    /// Encryption public key for predictions
    pub encryption_pubkey: [u8; 32],
    /// PDA bump
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum TournamentStatus {
    /// Users can register and submit predictions
    Registration,
    /// Predictions locked, tournament in progress
    Locked,
    /// All matches complete, final scores calculated
    Completed,
    /// Prizes distributed, tournament archived
    Finalized,
}

/// Individual user entry
#[account]
pub struct UserEntry {
    /// User's wallet address
    pub owner: Pubkey,
    /// Tournament this entry belongs to
    pub tournament: Pubkey,
    /// Amount paid (should equal entry_fee)
    pub entry_fee_paid: u64,
    /// Encrypted predictions (decrypted by backend after lock)
    pub encrypted_predictions: Vec<u8>,
    /// Total points earned (updated as matches complete)
    pub total_points: u32,
    /// Final rank (set after tournament completion)
    pub rank: Option<u32>,
    /// Whether user has claimed their prize
    pub claimed: bool,
    /// When predictions were last submitted
    pub last_updated: i64,
    /// PDA bump
    pub bump: u8,
}

// Size calculation for UserEntry:
// - owner: 32
// - tournament: 32
// - entry_fee_paid: 8
// - encrypted_predictions: 4 (vec len) + ~200 (data) = 204
// - total_points: 4
// - rank: 1 + 4 = 5
// - claimed: 1
// - last_updated: 8
// - bump: 1
// Total: ~295 bytes, allocate 512 for safety
```

#### Instructions

```rust
/// Initialize a new tournament (admin only)
pub fn initialize_tournament(
    ctx: Context<InitializeTournament>,
    lock_time: i64,
    entry_fee: u64,
    rake_bps: u16,
    encryption_pubkey: [u8; 32],
) -> Result<()>;

/// User registers and pays entry fee
pub fn register_user(
    ctx: Context<RegisterUser>,
) -> Result<()>;

/// User submits or updates encrypted predictions (before lock)
pub fn submit_predictions(
    ctx: Context<SubmitPredictions>,
    encrypted_predictions: Vec<u8>,
) -> Result<()>;

/// Admin updates tournament status
pub fn update_tournament_status(
    ctx: Context<UpdateTournamentStatus>,
    new_status: TournamentStatus,
) -> Result<()>;

/// Admin emergency withdraw (time-locked, only after completion)
pub fn emergency_withdraw(
    ctx: Context<EmergencyWithdraw>,
) -> Result<()>;
```

#### PDA Seeds

```rust
// Tournament PDA
seeds = [b"tournament", tournament_id.as_bytes()]

// Prize Pool PDA (holds SOL)
seeds = [b"prize_pool", tournament.key().as_ref()]

// UserEntry PDA
seeds = [b"user_entry", tournament.key().as_ref(), user.key().as_ref()]
```

---

### Program 2: Scoring Engine

**Program ID:** `WC26Score...` (to be generated)

#### Accounts

```rust
/// Single match result submitted by admin
#[account]
pub struct MatchResult {
    /// Tournament this match belongs to
    pub tournament: Pubkey,
    /// Unique match identifier (0-103 for 104 matches)
    pub match_id: u16,
    /// Type of match
    pub match_type: MatchType,
    /// Group identifier (0-11 for group stage, ignored for knockout)
    pub group_id: Option<u8>,
    /// First team ID
    pub team_a: u8,
    /// Second team ID
    pub team_b: u8,
    /// Goals scored by team A
    pub score_a: u8,
    /// Goals scored by team B
    pub score_b: u8,
    /// Winner (0 = draw for group stage, team_a or team_b ID otherwise)
    pub winner: u8,
    /// When this result was submitted
    pub timestamp: i64,
    /// PDA bump
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchType {
    Group,
    RoundOf32,
    RoundOf16,
    QuarterFinal,
    SemiFinal,
    ThirdPlace,
    Final,
}
```

#### Instructions

```rust
/// Admin submits a verified match result
pub fn submit_match_result(
    ctx: Context<SubmitMatchResult>,
    match_id: u16,
    match_type: MatchType,
    group_id: Option<u8>,
    team_a: u8,
    team_b: u8,
    score_a: u8,
    score_b: u8,
    winner: u8,
) -> Result<()>;

/// Calculate points for a single user (called per-user, can batch)
pub fn calculate_user_points(
    ctx: Context<CalculateUserPoints>,
    // Decrypted predictions passed by backend
    predictions: Predictions,
) -> Result<()>;

/// Lock final rankings after all matches complete
pub fn finalize_tournament(
    ctx: Context<FinalizeTournament>,
) -> Result<()>;
```

#### Scoring Logic

```rust
/// Decrypted predictions structure (passed by backend)
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Predictions {
    /// Group standings: 12 groups × 4 positions = 48 team IDs
    /// groups[group_id][position] = team_id
    pub groups: [[u8; 4]; 12],
    /// Knockout bracket winners: 31 matches
    /// [16 R32 + 8 R16 + 4 QF + 2 SF + 1 Third + 1 Final] = 32 slots
    pub knockout: [u8; 32],
    /// Tiebreaker: predicted total tournament goals
    pub total_goals: u16,
}

/// Point values
const POINTS_GROUP_PERFECT: u32 = 10;      // All 4 positions correct
const POINTS_GROUP_TOP2_EXACT: u32 = 6;    // 1st and 2nd in exact order
const POINTS_GROUP_TOP2_ANY: u32 = 4;      // 1st and 2nd in any order
const POINTS_GROUP_WINNER: u32 = 2;        // Only group winner correct
const POINTS_GROUP_RUNNERUP: u32 = 2;      // Only runner-up correct
const POINTS_GROUP_POSITION: u32 = 1;      // Any other correct position

const POINTS_R32: u32 = 2;
const POINTS_R16: u32 = 4;
const POINTS_QF: u32 = 8;
const POINTS_SF: u32 = 16;
const POINTS_THIRD: u32 = 10;
const POINTS_FINAL: u32 = 25;

// Max points: 120 (groups) + 163 (knockout) = 283
```

---

### Program 3: Prize Distributor

**Program ID:** `WC26Prize...` (to be generated)

#### Accounts

```rust
/// Prize distribution configuration
#[account]
pub struct PrizeConfig {
    /// Tournament this config belongs to
    pub tournament: Pubkey,
    /// Total prize pool available (after rake)
    pub total_pool: u64,
    /// Prize tiers
    pub tiers: Vec<PrizeTier>,
    /// Whether prize calculation is finalized
    pub finalized: bool,
    /// Actual total goals (for tiebreaker)
    pub actual_total_goals: u16,
    /// PDA bump
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct PrizeTier {
    /// Starting rank (inclusive)
    pub rank_start: u32,
    /// Ending rank (inclusive)
    pub rank_end: u32,
    /// Percentage in basis points (10000 = 100%)
    pub percentage_bps: u16,
}

/// Individual prize claim record
#[account]
pub struct PrizeClaim {
    /// User claiming the prize
    pub user: Pubkey,
    /// Tournament
    pub tournament: Pubkey,
    /// User's final rank
    pub rank: u32,
    /// Prize amount in lamports
    pub prize_amount: u64,
    /// Whether claimed
    pub claimed: bool,
    /// Claim timestamp
    pub claim_timestamp: Option<i64>,
    /// PDA bump
    pub bump: u8,
}
```

#### Instructions

```rust
/// Admin configures prize distribution
pub fn configure_prizes(
    ctx: Context<ConfigurePrizes>,
    tiers: Vec<PrizeTier>,
    actual_total_goals: u16,
) -> Result<()>;

/// Calculate prize for a specific user based on rank
pub fn calculate_prize(
    ctx: Context<CalculatePrize>,
    user: Pubkey,
) -> Result<()>;

/// User claims their prize
pub fn claim_prize(
    ctx: Context<ClaimPrize>,
) -> Result<()>;
```

#### Prize Distribution (Default)

| Rank | Percentage |
|------|------------|
| 1st | 15% |
| 2nd-3rd | 10% (5% each) |
| 4th-10th | 15% (~2.1% each) |
| 11th-100th | 25% (~0.28% each) |
| 101st-1000th | 20% (~0.02% each) |
| Top 10% beyond | 15% (split equally) |

---

## Database Schema

### Supabase Tables

```sql
-- Users table (mirrors on-chain UserEntry)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address TEXT UNIQUE NOT NULL,
    tournament_id TEXT NOT NULL,
    entry_fee_paid BIGINT NOT NULL,
    encrypted_predictions BYTEA,
    decrypted_predictions JSONB,  -- Populated after lock
    total_points INTEGER DEFAULT 0,
    rank INTEGER,
    claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_wallet ON users(wallet_address);
CREATE INDEX idx_users_points ON users(total_points DESC);
CREATE INDEX idx_users_rank ON users(rank);

-- Match results (mirrors on-chain MatchResult)
CREATE TABLE match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id TEXT NOT NULL,
    match_id SMALLINT NOT NULL,
    match_type TEXT NOT NULL,
    group_id SMALLINT,
    team_a SMALLINT NOT NULL,
    team_b SMALLINT NOT NULL,
    score_a SMALLINT NOT NULL,
    score_b SMALLINT NOT NULL,
    winner SMALLINT NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, match_id)
);

-- Leaderboard (computed view)
CREATE VIEW leaderboard AS
SELECT
    wallet_address,
    total_points,
    RANK() OVER (ORDER BY total_points DESC, created_at ASC) as rank
FROM users
WHERE tournament_id = 'wc2026'
ORDER BY total_points DESC, created_at ASC;

-- Teams reference table
CREATE TABLE teams (
    id SMALLINT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,  -- 3-letter code (e.g., 'ARG')
    group_id SMALLINT NOT NULL
);

-- Groups reference table
CREATE TABLE groups (
    id SMALLINT PRIMARY KEY,
    name TEXT NOT NULL  -- e.g., 'Group A'
);
```

### Supabase Functions

```sql
-- Recalculate leaderboard rankings
CREATE OR REPLACE FUNCTION recalculate_rankings()
RETURNS void AS $$
BEGIN
    WITH ranked AS (
        SELECT
            id,
            ROW_NUMBER() OVER (
                ORDER BY total_points DESC, created_at ASC
            ) as new_rank
        FROM users
        WHERE tournament_id = 'wc2026'
    )
    UPDATE users u
    SET rank = r.new_rank, updated_at = NOW()
    FROM ranked r
    WHERE u.id = r.id;
END;
$$ LANGUAGE plpgsql;

-- Calculate points for a user
CREATE OR REPLACE FUNCTION calculate_user_points(p_wallet TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_points INTEGER := 0;
    v_predictions JSONB;
BEGIN
    SELECT decrypted_predictions INTO v_predictions
    FROM users WHERE wallet_address = p_wallet;

    -- Group stage scoring
    -- ... (implementation details)

    -- Knockout scoring
    -- ... (implementation details)

    RETURN v_points;
END;
$$ LANGUAGE plpgsql;
```

---

## API Design

### Hono API Endpoints

**Base URL:** `https://api.wc2026.app/v1`

#### Public Endpoints

```typescript
// Get tournament info
GET /tournament
Response: {
    status: "registration" | "locked" | "completed" | "finalized",
    lockTime: number,  // Unix timestamp
    entryFee: string,  // "0.1" SOL
    totalEntries: number,
    prizePool: string  // SOL amount
}

// Get leaderboard
GET /leaderboard?page=1&limit=100
Response: {
    entries: [
        { rank: 1, wallet: "ABC...", points: 245 },
        ...
    ],
    total: 5000,
    page: 1,
    pages: 50
}

// Get user entry
GET /user/:wallet
Response: {
    wallet: "ABC...",
    registered: true,
    hasPredictions: true,
    points: 156,
    rank: 234,
    claimed: false
}

// Get user predictions (only after lock)
GET /user/:wallet/predictions
Response: {
    groups: [...],
    knockout: [...],
    totalGoals: 172
} | { error: "Predictions locked until tournament starts" }

// Get match results
GET /matches
Response: {
    matches: [
        { matchId: 0, type: "group", teamA: 1, teamB: 2, scoreA: 2, scoreB: 1, winner: 1 },
        ...
    ]
}
```

#### Protected Endpoints (Wallet Signature Required)

```typescript
// Submit predictions
POST /predictions
Headers: { Authorization: "Bearer <signed-message>" }
Body: {
    encryptedPredictions: string  // Base64 encoded
}
Response: { success: true, txSignature: "..." }
```

#### Admin Endpoints (Admin Wallet Required)

```typescript
// Submit match result
POST /admin/match
Headers: { Authorization: "Bearer <admin-signed-message>" }
Body: {
    matchId: number,
    matchType: string,
    groupId?: number,
    teamA: number,
    teamB: number,
    scoreA: number,
    scoreB: number,
    winner: number
}
Response: { success: true, txSignature: "..." }

// Trigger point calculation for all users
POST /admin/calculate-points
Response: { success: true, usersProcessed: 5000 }

// Update tournament status
POST /admin/status
Body: { status: "locked" | "completed" | "finalized" }
Response: { success: true, txSignature: "..." }
```

---

## Encryption Scheme

### Overview

Predictions are encrypted client-side before submission. After lock time, the backend decrypts predictions for scoring.

### Implementation

```typescript
// Frontend: Encrypt predictions before submission
import nacl from 'tweetnacl';
import { encode as encodeBase64 } from 'bs58';

interface Predictions {
    groups: number[][];      // 12 groups × 4 positions
    knockout: number[];      // 32 match winners
    totalGoals: number;
}

function encryptPredictions(
    predictions: Predictions,
    tournamentPublicKey: Uint8Array
): Uint8Array {
    // Serialize predictions
    const data = JSON.stringify(predictions);
    const messageBytes = new TextEncoder().encode(data);

    // Generate ephemeral keypair
    const ephemeralKeypair = nacl.box.keyPair();

    // Generate nonce
    const nonce = nacl.randomBytes(nacl.box.nonceLength);

    // Encrypt
    const encrypted = nacl.box(
        messageBytes,
        nonce,
        tournamentPublicKey,
        ephemeralKeypair.secretKey
    );

    // Return: [ephemeral_pubkey (32) | nonce (24) | ciphertext]
    const result = new Uint8Array(32 + 24 + encrypted.length);
    result.set(ephemeralKeypair.publicKey, 0);
    result.set(nonce, 32);
    result.set(encrypted, 56);

    return result;
}

// Backend: Decrypt predictions after lock
function decryptPredictions(
    encryptedData: Uint8Array,
    tournamentSecretKey: Uint8Array
): Predictions {
    const ephemeralPubkey = encryptedData.slice(0, 32);
    const nonce = encryptedData.slice(32, 56);
    const ciphertext = encryptedData.slice(56);

    const decrypted = nacl.box.open(
        ciphertext,
        nonce,
        ephemeralPubkey,
        tournamentSecretKey
    );

    if (!decrypted) {
        throw new Error('Decryption failed');
    }

    const data = new TextDecoder().decode(decrypted);
    return JSON.parse(data);
}
```

### Key Management

- Tournament keypair generated at tournament creation
- Public key stored on-chain in `Tournament.encryption_pubkey`
- Secret key stored securely in backend (environment variable / secrets manager)
- Secret key is NEVER exposed until after lock time (and even then, only used server-side)

---

## Data Flow

### 1. User Registration Flow

```
User                    Frontend                 Solana                  Supabase
  │                        │                        │                        │
  │─── Connect Wallet ────▶│                        │                        │
  │                        │                        │                        │
  │─── Click Register ────▶│                        │                        │
  │                        │─── register_user() ───▶│                        │
  │                        │    (0.1 SOL)           │                        │
  │                        │◀── TX Confirmed ───────│                        │
  │                        │                        │                        │
  │                        │─── POST /user ─────────┼───────────────────────▶│
  │                        │                        │                        │
  │◀── Registration OK ────│                        │                        │
```

### 2. Submit Predictions Flow

```
User                    Frontend                 Solana                  Supabase
  │                        │                        │                        │
  │─── Fill Bracket ──────▶│                        │                        │
  │                        │                        │                        │
  │─── Submit ────────────▶│                        │                        │
  │                        │─── Encrypt locally ────│                        │
  │                        │                        │                        │
  │                        │─── submit_predictions()│                        │
  │                        │    (encrypted bytes)  ▶│                        │
  │                        │◀── TX Confirmed ───────│                        │
  │                        │                        │                        │
  │                        │─── POST /predictions ──┼───────────────────────▶│
  │                        │    (store encrypted)   │                        │
  │                        │                        │                        │
  │◀── Predictions Saved ──│                        │                        │
```

### 3. Match Result & Scoring Flow

```
Admin                   Backend                  Solana                  Supabase
  │                        │                        │                        │
  │─── Submit Result ─────▶│                        │                        │
  │                        │─── submit_match_result()                        │
  │                        │                       ▶│                        │
  │                        │◀── TX Confirmed ───────│                        │
  │                        │                        │                        │
  │                        │─── INSERT match_results┼───────────────────────▶│
  │                        │                        │                        │
  │                        │─── For each user: ─────┼───────────────────────▶│
  │                        │    1. Decrypt predictions                       │
  │                        │    2. Calculate points                          │
  │                        │    3. Update total_points                       │
  │                        │                        │                        │
  │                        │─── calculate_user_points()                      │
  │                        │    (batch, on-chain)  ▶│                        │
  │                        │                        │                        │
  │                        │─── Recalculate rankings┼───────────────────────▶│
  │                        │                        │                        │
  │◀── Results Published ──│                        │                        │
```

### 4. Prize Claim Flow

```
User                    Frontend                 Solana                  Supabase
  │                        │                        │                        │
  │─── View Final Rank ───▶│◀───────────────────────┼───────────────────────▶│
  │                        │                        │                        │
  │─── Claim Prize ───────▶│                        │                        │
  │                        │─── claim_prize() ─────▶│                        │
  │                        │                        │─── Transfer SOL ──────▶│
  │                        │◀── TX Confirmed ───────│                        │
  │                        │                        │                        │
  │                        │─── UPDATE claimed=true─┼───────────────────────▶│
  │                        │                        │                        │
  │◀── Prize Received! ────│                        │                        │
```

---

## Security Considerations

### Smart Contract Security

| Risk | Mitigation |
|------|------------|
| Reentrancy | Use Anchor's built-in checks; transfer SOL last |
| Integer overflow | Use checked math; Rust panics on overflow in debug |
| Unauthorized access | PDA-based auth; verify signer matches expected authority |
| Front-running | Predictions encrypted until lock; no MEV opportunity |
| Prize pool theft | Time-locked emergency withdraw; requires tournament completion |

### Backend Security

| Risk | Mitigation |
|------|------------|
| Decryption key leak | Store in Cloudflare secrets; never log; rotate per tournament |
| API abuse | Rate limiting; wallet signature verification |
| SQL injection | Parameterized queries via Supabase client |
| Admin impersonation | Verify admin wallet signature on all admin endpoints |

### Operational Security

| Risk | Mitigation |
|------|------------|
| Key compromise | Separate admin wallet from treasury; use hardware wallet |
| Data loss | Supabase automatic backups; on-chain data is source of truth |
| Downtime | Cloudflare's global edge network; Solana RPC failover |

---

## Testing Strategy

### Unit Tests (Anchor)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_group_scoring_perfect() {
        let predicted = [1, 2, 3, 4];
        let actual = [1, 2, 3, 4];
        assert_eq!(calculate_group_points(&predicted, &actual), 10);
    }

    #[test]
    fn test_group_scoring_top2_exact() {
        let predicted = [1, 2, 4, 3];
        let actual = [1, 2, 3, 4];
        assert_eq!(calculate_group_points(&predicted, &actual), 6);
    }

    // ... more tests
}
```

### Integration Tests (Anchor + Bankrun)

```typescript
import { startAnchor } from 'solana-bankrun';
import { BN } from '@coral-xyz/anchor';

describe('WC2026 Integration', () => {
    it('full registration flow', async () => {
        const context = await startAnchor('.');
        // ... test registration, predictions, scoring, claims
    });
});
```

### E2E Tests (Playwright)

```typescript
import { test, expect } from '@playwright/test';

test('user can register and submit predictions', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Connect Wallet');
    // ... test full user flow
});
```

### Test Coverage Targets

| Component | Target |
|-----------|--------|
| Smart contracts | 90%+ |
| API endpoints | 80%+ |
| Frontend components | 70%+ |

---

## Deployment Plan

### Phase 1: Devnet

1. Deploy smart contracts to Solana devnet
2. Deploy API to Cloudflare Workers (staging)
3. Deploy frontend to Vercel (preview)
4. Run integration tests
5. Internal team testing (1 week)

### Phase 2: Testnet (Public Beta)

1. Deploy to Solana testnet (if available) or continue devnet
2. Public beta announcement
3. Bug bounty program
4. Collect user feedback
5. Fix issues (2 weeks)

### Phase 3: Security Audit

1. Code freeze
2. Submit to audit firm (Sec3, OtterSec, or similar)
3. Address findings
4. Re-audit critical fixes
5. Publish audit report

### Phase 4: Mainnet Launch

1. Deploy smart contracts to Solana mainnet
2. Deploy API to Cloudflare Workers (production)
3. Deploy frontend to Vercel (production)
4. Verify all PDAs and accounts
5. Initialize tournament with correct parameters
6. Gradual rollout (invite-only → public)

### Deployment Checklist

- [ ] Smart contracts audited
- [ ] Admin wallet secured (hardware wallet)
- [ ] Encryption keypair generated and secret secured
- [ ] Environment variables set in Cloudflare
- [ ] Supabase production database provisioned
- [ ] Domain and SSL configured
- [ ] Monitoring and alerting set up
- [ ] Runbook documented
- [ ] Incident response plan in place

---

## Monitoring & Operations

### Metrics to Track

| Metric | Tool | Alert Threshold |
|--------|------|-----------------|
| API latency | Cloudflare Analytics | p99 > 500ms |
| API error rate | Cloudflare Analytics | > 1% |
| Solana RPC latency | Custom | > 2s |
| Database connections | Supabase Dashboard | > 80% pool |
| User registrations | Custom | Sudden drop |
| Prize pool balance | On-chain | Mismatch with expected |

### Runbook

#### Submitting Match Results

```bash
# 1. Verify match result from multiple sources
# 2. Use admin CLI to submit
wc2026-admin submit-match \
    --match-id 42 \
    --type group \
    --group-id 3 \
    --team-a 15 \
    --team-b 22 \
    --score 2-1

# 3. Verify on-chain
wc2026-admin verify-match --match-id 42

# 4. Trigger point recalculation
wc2026-admin calculate-points --all
```

#### Emergency Procedures

```bash
# Pause registrations (update status)
wc2026-admin update-status --status locked

# Emergency withdraw (requires time-lock)
wc2026-admin emergency-withdraw --execute
```

---

## Future Enhancements (v2)

### Achievement NFTs

- Metaplex Core integration
- Achievement types: Participant, Leaderboard, Champion Caller
- Arweave metadata storage

### Wallet Abstraction

- Privy or Dynamic integration
- Email/social login
- Embedded wallet creation

### Multi-Sig Oracle

- 3-of-5 multi-sig for match results
- Automated data feed integration
- Dispute resolution mechanism

### Enhanced Anti-Cheat

- Sybil detection (wallet clustering analysis)
- Collusion detection (prediction similarity)
- Rate limiting and captcha

### Mobile App

- React Native or Expo
- Push notifications
- Biometric auth for claims

---

## Appendix

### Team IDs

| ID | Team | Group |
|----|------|-------|
| 1 | Argentina | A |
| 2 | Brazil | B |
| ... | ... | ... |

*Full list to be populated when groups are announced.*

### Match IDs

| ID Range | Type |
|----------|------|
| 0-35 | Group Stage (36 matches) |
| 36-51 | Round of 32 (16 matches) |
| 52-59 | Round of 16 (8 matches) |
| 60-63 | Quarter-finals (4 matches) |
| 64-65 | Semi-finals (2 matches) |
| 66 | Third Place (1 match) |
| 67 | Final (1 match) |

### Error Codes

| Code | Description |
|------|-------------|
| E001 | Tournament not in registration phase |
| E002 | Predictions locked |
| E003 | User already registered |
| E004 | Invalid predictions format |
| E005 | Insufficient entry fee |
| E006 | Tournament not completed |
| E007 | Already claimed |
| E008 | Not eligible for prize |
