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
/// Final standings for a single group (submitted once after group stage ends)
/// Admin submits 12 of these total (one per group)
#[account]
pub struct GroupStandings {
    /// Tournament this belongs to
    pub tournament: Pubkey,
    /// Group identifier (0-11 for groups A-L)
    pub group_id: u8,
    /// Team IDs in final standing order: [1st, 2nd, 3rd, 4th]
    pub standings: [u8; 4],
    /// When this was submitted
    pub timestamp: i64,
    /// PDA bump
    pub bump: u8,
}

/// Single knockout match result (submitted as each match completes)
/// Admin submits 31 of these total
#[account]
pub struct KnockoutResult {
    /// Tournament this belongs to
    pub tournament: Pubkey,
    /// Match identifier (0-30 for 31 knockout matches)
    pub match_id: u8,
    /// Type of knockout match
    pub match_type: MatchType,
    /// First team ID
    pub team_a: u8,
    /// Second team ID
    pub team_b: u8,
    /// Winning team ID
    pub winner: u8,
    /// When this was submitted
    pub timestamp: i64,
    /// PDA bump
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum MatchType {
    RoundOf32,    // 16 matches (IDs 0-15)
    RoundOf16,    // 8 matches (IDs 16-23)
    QuarterFinal, // 4 matches (IDs 24-27)
    SemiFinal,    // 2 matches (IDs 28-29)
    ThirdPlace,   // 1 match (ID 30)
    Final,        // 1 match (ID 30, shared with third place conceptually but separate)
}
```

#### Instructions

```rust
/// Admin submits final standings for one group (called 12 times total)
pub fn submit_group_standings(
    ctx: Context<SubmitGroupStandings>,
    group_id: u8,
    standings: [u8; 4],  // [1st, 2nd, 3rd, 4th] team IDs
) -> Result<()>;

/// Admin submits a knockout match result (called 31 times total)
pub fn submit_knockout_result(
    ctx: Context<SubmitKnockoutResult>,
    match_id: u8,
    match_type: MatchType,
    team_a: u8,
    team_b: u8,
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

#### PDA Seeds

```rust
// GroupStandings PDA
seeds = [b"group_standings", tournament.key().as_ref(), &[group_id]]

// KnockoutResult PDA
seeds = [b"knockout_result", tournament.key().as_ref(), &[match_id]]
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

-- Group standings (mirrors on-chain GroupStandings)
-- 12 rows total, one per group
CREATE TABLE group_standings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id TEXT NOT NULL,
    group_id SMALLINT NOT NULL,          -- 0-11 for groups A-L
    first_place SMALLINT NOT NULL,       -- Team ID
    second_place SMALLINT NOT NULL,      -- Team ID
    third_place SMALLINT NOT NULL,       -- Team ID
    fourth_place SMALLINT NOT NULL,      -- Team ID
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, group_id)
);

-- Knockout results (mirrors on-chain KnockoutResult)
-- 31 rows total for knockout stage
CREATE TABLE knockout_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id TEXT NOT NULL,
    match_id SMALLINT NOT NULL,          -- 0-30
    match_type TEXT NOT NULL,            -- R32, R16, QF, SF, Third, Final
    team_a SMALLINT NOT NULL,
    team_b SMALLINT NOT NULL,
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

// Get group standings (available after group stage)
GET /groups
Response: {
    groups: [
        { groupId: 0, name: "A", standings: [teamId1, teamId2, teamId3, teamId4] },
        ...
    ]
}

// Get knockout results (updated as matches complete)
GET /knockout
Response: {
    matches: [
        { matchId: 0, type: "R32", teamA: 1, teamB: 2, winner: 1 },
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
// Submit group standings (called once per group after group stage ends)
POST /admin/group-standings
Headers: { Authorization: "Bearer <admin-signed-message>" }
Body: {
    groupId: number,           // 0-11
    standings: [number, number, number, number]  // [1st, 2nd, 3rd, 4th] team IDs
}
Response: { success: true, txSignature: "..." }

// Submit knockout result (called as each knockout match completes)
POST /admin/knockout-result
Headers: { Authorization: "Bearer <admin-signed-message>" }
Body: {
    matchId: number,           // 0-30
    matchType: "R32" | "R16" | "QF" | "SF" | "Third" | "Final",
    teamA: number,
    teamB: number,
    winner: number
}
Response: { success: true, txSignature: "..." }

// Trigger point calculation for all users
POST /admin/calculate-points
Body: { stage: "groups" | "knockout" | "all" }
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

### 3a. Group Standings & Scoring Flow (after group stage ends)

```
Admin                   Backend                  Solana                  Supabase
  │                        │                        │                        │
  │─── Submit Group A ────▶│                        │                        │
  │    standings           │─── submit_group_standings()                     │
  │                        │    (group_id=0)       ▶│                        │
  │                        │◀── TX Confirmed ───────│                        │
  │                        │─── INSERT group_standings ─────────────────────▶│
  │                        │                        │                        │
  │   ... repeat for groups B-L (12 total) ...      │                        │
  │                        │                        │                        │
  │─── Calculate Points ──▶│                        │                        │
  │                        │─── For each user: ─────┼───────────────────────▶│
  │                        │    1. Decrypt predictions                       │
  │                        │    2. Calculate GROUP points                    │
  │                        │    3. Update total_points                       │
  │                        │                        │                        │
  │                        │─── Recalculate rankings┼───────────────────────▶│
  │◀── Group Scoring Done ─│                        │                        │
```

### 3b. Knockout Result & Scoring Flow (as each match completes)

```
Admin                   Backend                  Solana                  Supabase
  │                        │                        │                        │
  │─── Submit R32 Match ──▶│                        │                        │
  │                        │─── submit_knockout_result()                     │
  │                        │    (match_id, winner) ▶│                        │
  │                        │◀── TX Confirmed ───────│                        │
  │                        │                        │                        │
  │                        │─── INSERT knockout_results ────────────────────▶│
  │                        │                        │                        │
  │                        │─── For each user: ─────┼───────────────────────▶│
  │                        │    1. Check if predicted winner                 │
  │                        │    2. Add points for this match                 │
  │                        │    3. Update total_points                       │
  │                        │                        │                        │
  │                        │─── Recalculate rankings┼───────────────────────▶│
  │                        │                        │                        │
  │◀── Match Scored ───────│                        │                        │
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

### Frontend Unit Tests

The frontend uses Jest and React Testing Library for unit testing.

#### Commands

```bash
cd frontend

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

#### Test File Organization

```
frontend/src/
├── stores/__tests__/
│   └── useAppStore.test.ts          # Zustand store tests
├── components/
│   ├── predictions/__tests__/
│   │   ├── GroupStageForm.test.tsx
│   │   ├── KnockoutBracket.test.tsx
│   │   └── TiebreakerInput.test.tsx
│   ├── leaderboard/__tests__/
│   │   └── LeaderboardTable.test.tsx
│   ├── layout/__tests__/
│   │   ├── Header.test.tsx
│   │   ├── Footer.test.tsx
│   │   └── PageLayout.test.tsx
│   └── shared/__tests__/
│       └── Pagination.test.tsx
└── app/
    ├── predictions/__tests__/
    │   └── PredictionsPageContent.test.tsx
    ├── leaderboard/__tests__/
    │   └── LeaderboardPageContent.test.tsx
    └── claims/__tests__/
        └── ClaimsPageContent.test.tsx
```

#### Mocking Strategy

| Dependency | Mock Location | Description |
|------------|---------------|-------------|
| `@solana/wallet-adapter-react` | `__mocks__/@solana/wallet-adapter-react.ts` | Wallet hooks (useWallet, useConnection) |
| `@solana/wallet-adapter-react-ui` | `__mocks__/@solana/wallet-adapter-react-ui.ts` | UI components (WalletMultiButton) |
| `next/navigation` | `jest.setup.ts` | Router hooks (useRouter, usePathname) |
| `next/link` | `jest.setup.ts` | Link component as anchor |
| `next/image` | `jest.setup.ts` | Image component as img |
| CSS/SCSS | `identity-obj-proxy` | Returns class names as-is |
| Images/Assets | `__mocks__/fileMock.js` | Returns stub string |

#### Wallet Mock Helpers

The wallet adapter mock provides helpers for testing connected/disconnected states:

```typescript
import {
  setWalletConnected,
  setWalletDisconnected,
  createConnectedWallet,
} from '@solana/wallet-adapter-react';

// In your test:
beforeEach(() => {
  setWalletDisconnected(); // Reset to disconnected state
});

it('should show user rank when connected', () => {
  setWalletConnected('YourTestWalletAddress123...');
  render(<LeaderboardPageContent />);
  // ...assertions
});
```

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

#### Submitting Group Standings (after group stage ends)

```bash
# 1. Verify final group standings from multiple sources
# 2. Submit standings for each group (12 total)
wc2026-admin submit-group \
    --group-id 0 \
    --standings 1,2,3,4    # Team IDs: 1st, 2nd, 3rd, 4th

# 3. Repeat for all 12 groups (A=0 through L=11)

# 4. Trigger group stage point calculation
wc2026-admin calculate-points --stage groups
```

#### Submitting Knockout Results (as each match completes)

```bash
# 1. Verify match result from multiple sources
# 2. Submit knockout result
wc2026-admin submit-knockout \
    --match-id 0 \
    --type R32 \
    --team-a 15 \
    --team-b 22 \
    --winner 15

# 3. Points are calculated automatically per match
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

### Team Enum (Rust)

```rust
/// All 48 teams for FIFA World Cup 2026
/// Teams 1-42 are confirmed qualified, 43-48 TBD via playoffs (March 2026)
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Team {
    // === HOSTS (3) ===
    USA = 1,
    MEX = 2,
    CAN = 3,

    // === CONMEBOL - South America (6) ===
    ARG = 4,
    BRA = 5,
    COL = 6,
    ECU = 7,
    PAR = 8,
    URU = 9,

    // === UEFA - Europe (12 confirmed, 4 TBD) ===
    ENG = 10,
    FRA = 11,
    GER = 12,
    ESP = 13,
    POR = 14,
    NED = 15,
    BEL = 16,
    SUI = 17,
    CRO = 18,
    AUT = 19,
    SCO = 20,
    NOR = 21,

    // === CONCACAF - North/Central America & Caribbean (3 non-hosts) ===
    PAN = 22,
    CUW = 23,  // Curaçao
    HAI = 24,

    // === AFC - Asia (8) ===
    JPN = 25,
    KOR = 26,
    AUS = 27,
    IRN = 28,
    QAT = 29,
    KSA = 30,  // Saudi Arabia
    UZB = 31,
    JOR = 32,

    // === CAF - Africa (9) ===
    MAR = 33,
    SEN = 34,
    CIV = 35,  // Ivory Coast
    EGY = 36,
    GHA = 37,
    TUN = 38,
    ALG = 39,
    RSA = 40,  // South Africa
    CPV = 41,  // Cape Verde

    // === OFC - Oceania (1) ===
    NZL = 42,

    // === TBD - Playoffs March 2026 (6 remaining) ===
    TBD_UEFA_1 = 43,   // UEFA Playoff Path A winner
    TBD_UEFA_2 = 44,   // UEFA Playoff Path B winner
    TBD_UEFA_3 = 45,   // UEFA Playoff Path C winner
    TBD_UEFA_4 = 46,   // UEFA Playoff Path D winner
    TBD_PLAYOFF_1 = 47, // Inter-confederation playoff winner 1
    TBD_PLAYOFF_2 = 48, // Inter-confederation playoff winner 2
}

impl Team {
    pub fn code(&self) -> &'static str {
        match self {
            Team::USA => "USA", Team::MEX => "MEX", Team::CAN => "CAN",
            Team::ARG => "ARG", Team::BRA => "BRA", Team::COL => "COL",
            Team::ECU => "ECU", Team::PAR => "PAR", Team::URU => "URU",
            Team::ENG => "ENG", Team::FRA => "FRA", Team::GER => "GER",
            Team::ESP => "ESP", Team::POR => "POR", Team::NED => "NED",
            Team::BEL => "BEL", Team::SUI => "SUI", Team::CRO => "CRO",
            Team::AUT => "AUT", Team::SCO => "SCO", Team::NOR => "NOR",
            Team::PAN => "PAN", Team::CUW => "CUW", Team::HAI => "HAI",
            Team::JPN => "JPN", Team::KOR => "KOR", Team::AUS => "AUS",
            Team::IRN => "IRN", Team::QAT => "QAT", Team::KSA => "KSA",
            Team::UZB => "UZB", Team::JOR => "JOR",
            Team::MAR => "MAR", Team::SEN => "SEN", Team::CIV => "CIV",
            Team::EGY => "EGY", Team::GHA => "GHA", Team::TUN => "TUN",
            Team::ALG => "ALG", Team::RSA => "RSA", Team::CPV => "CPV",
            Team::NZL => "NZL",
            _ => "TBD",
        }
    }

    pub fn name(&self) -> &'static str {
        match self {
            Team::USA => "United States", Team::MEX => "Mexico", Team::CAN => "Canada",
            Team::ARG => "Argentina", Team::BRA => "Brazil", Team::COL => "Colombia",
            Team::ECU => "Ecuador", Team::PAR => "Paraguay", Team::URU => "Uruguay",
            Team::ENG => "England", Team::FRA => "France", Team::GER => "Germany",
            Team::ESP => "Spain", Team::POR => "Portugal", Team::NED => "Netherlands",
            Team::BEL => "Belgium", Team::SUI => "Switzerland", Team::CRO => "Croatia",
            Team::AUT => "Austria", Team::SCO => "Scotland", Team::NOR => "Norway",
            Team::PAN => "Panama", Team::CUW => "Curaçao", Team::HAI => "Haiti",
            Team::JPN => "Japan", Team::KOR => "South Korea", Team::AUS => "Australia",
            Team::IRN => "Iran", Team::QAT => "Qatar", Team::KSA => "Saudi Arabia",
            Team::UZB => "Uzbekistan", Team::JOR => "Jordan",
            Team::MAR => "Morocco", Team::SEN => "Senegal", Team::CIV => "Ivory Coast",
            Team::EGY => "Egypt", Team::GHA => "Ghana", Team::TUN => "Tunisia",
            Team::ALG => "Algeria", Team::RSA => "South Africa", Team::CPV => "Cape Verde",
            Team::NZL => "New Zealand",
            _ => "To Be Determined",
        }
    }
}
```

### Team Reference Table

| ID | Code | Team | Confederation | Status |
|----|------|------|---------------|--------|
| 1 | USA | United States | CONCACAF | Host |
| 2 | MEX | Mexico | CONCACAF | Host |
| 3 | CAN | Canada | CONCACAF | Host |
| 4 | ARG | Argentina | CONMEBOL | Qualified |
| 5 | BRA | Brazil | CONMEBOL | Qualified |
| 6 | COL | Colombia | CONMEBOL | Qualified |
| 7 | ECU | Ecuador | CONMEBOL | Qualified |
| 8 | PAR | Paraguay | CONMEBOL | Qualified |
| 9 | URU | Uruguay | CONMEBOL | Qualified |
| 10 | ENG | England | UEFA | Qualified |
| 11 | FRA | France | UEFA | Qualified |
| 12 | GER | Germany | UEFA | Qualified |
| 13 | ESP | Spain | UEFA | Qualified |
| 14 | POR | Portugal | UEFA | Qualified |
| 15 | NED | Netherlands | UEFA | Qualified |
| 16 | BEL | Belgium | UEFA | Qualified |
| 17 | SUI | Switzerland | UEFA | Qualified |
| 18 | CRO | Croatia | UEFA | Qualified |
| 19 | AUT | Austria | UEFA | Qualified |
| 20 | SCO | Scotland | UEFA | Qualified |
| 21 | NOR | Norway | UEFA | Qualified |
| 22 | PAN | Panama | CONCACAF | Qualified |
| 23 | CUW | Curaçao | CONCACAF | Qualified |
| 24 | HAI | Haiti | CONCACAF | Qualified |
| 25 | JPN | Japan | AFC | Qualified |
| 26 | KOR | South Korea | AFC | Qualified |
| 27 | AUS | Australia | AFC | Qualified |
| 28 | IRN | Iran | AFC | Qualified |
| 29 | QAT | Qatar | AFC | Qualified |
| 30 | KSA | Saudi Arabia | AFC | Qualified |
| 31 | UZB | Uzbekistan | AFC | Qualified |
| 32 | JOR | Jordan | AFC | Qualified |
| 33 | MAR | Morocco | CAF | Qualified |
| 34 | SEN | Senegal | CAF | Qualified |
| 35 | CIV | Ivory Coast | CAF | Qualified |
| 36 | EGY | Egypt | CAF | Qualified |
| 37 | GHA | Ghana | CAF | Qualified |
| 38 | TUN | Tunisia | CAF | Qualified |
| 39 | ALG | Algeria | CAF | Qualified |
| 40 | RSA | South Africa | CAF | Qualified |
| 41 | CPV | Cape Verde | CAF | Qualified |
| 42 | NZL | New Zealand | OFC | Qualified |
| 43-46 | TBD | UEFA Playoff Winners | UEFA | Pending |
| 47-48 | TBD | Inter-conf. Playoff Winners | Mixed | Pending |

*42 of 48 teams confirmed. Remaining 6 decided via playoffs in March 2026.*

*Group assignments will be determined at the FIFA World Cup Draw.*

### Group IDs

| ID | Group |
|----|-------|
| 0 | Group A |
| 1 | Group B |
| 2 | Group C |
| ... | ... |
| 11 | Group L |

### Knockout Match IDs

| ID Range | Type | Count |
|----------|------|-------|
| 0-15 | Round of 32 | 16 matches |
| 16-23 | Round of 16 | 8 matches |
| 24-27 | Quarter-finals | 4 matches |
| 28-29 | Semi-finals | 2 matches |
| 30 | Third Place | 1 match |
| 31 | Final | 1 match |

**Total: 12 group standings + 32 knockout results = 44 admin submissions**

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
