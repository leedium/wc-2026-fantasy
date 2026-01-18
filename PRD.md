# Product Requirements Document: World Cup 2026 Decentralized Prediction Game

> **Version:** 2.0.0
> **Last Updated:** 2026-01-18

## Executive Summary

A blockchain-based prediction game for FIFA World Cup 2026 where users pay an entry fee to submit full tournament bracket predictions (group stage standings + knockout bracket) upfront before the tournament begins. Winners claim shares of the prize pool based on final rankings. The platform takes a small rake for sustainability while distributing the majority to winners.

---

## Problem Statement

Traditional sports prediction pools suffer from:
- Centralized control and trust issues with prize distribution
- Limited transparency in how winnings are calculated
- Geographic/payment restrictions

A decentralized solution provides transparent, trustless prize distribution.

---

## Target Users

| Segment | Characteristics | Needs |
|---------|----------------|-------|
| Crypto-native | Familiar with wallets, DeFi | Seamless Web3 experience |

**v1 Focus:** Crypto-native users with existing Solana wallets. Wallet abstraction for casual users can be added in v2.

---

## Product Goals & Success Metrics

### Goals
1. Create an engaging, fair prediction game for World Cup 2026
2. Demonstrate a reusable model for future sports events
3. Build a community of 10K+ participants
4. Ensure transparent, trustless prize distribution

### Success Metrics
- Total participants
- Prize pool size (TVL)
- User retention for future events

---

## Game Mechanics (Detailed)

### World Cup 2026 Format Overview
- **48 teams** in **12 groups** (4 teams per group)
- Top 2 from each group advance (24 teams) + 8 best 3rd-place teams = **32 teams** in knockout
- Knockout: Round of 32 → Round of 16 → QF → SF → 3rd Place → Final
- **104 total matches** (36 group + 68 knockout)

---

### Prediction Categories

#### Category 1: Group Stage Predictions (Required)

Users predict **final standings for all 12 groups** (positions 1-4 for each group).

| Scoring Scenario | Points | Example |
|-----------------|--------|---------|
| Perfect group (all 4 positions correct) | 10 pts | Predicted: 1.GER 2.FRA 3.JPN 4.CRC → Actual: Same |
| Top 2 correct in exact order | 6 pts | Got 1st and 2nd right, 3rd/4th wrong |
| Top 2 correct, wrong order | 4 pts | Picked GER & FRA to advance, but swapped positions |
| Only 1st place correct | 2 pts | Got the group winner only |
| Only 2nd place correct | 2 pts | Got the runner-up only |
| One team in correct position (3rd/4th) | 1 pt | Correctly placed an eliminated team |

**Maximum Group Stage Points:** 12 groups × 10 pts = **120 pts**

**Minimum to show skill:** ~40 pts (partial credit on most groups)

---

#### Category 2: Knockout Bracket Predictions (Required)

Users predict **all knockout match winners** from Round of 32 to Final.

| Round | Matches | Points/Correct | Max Points |
|-------|---------|----------------|------------|
| Round of 32 | 16 | 2 pts | 32 pts |
| Round of 16 | 8 | 4 pts | 32 pts |
| Quarter-finals | 4 | 8 pts | 32 pts |
| Semi-finals | 2 | 16 pts | 32 pts |
| 3rd Place Match | 1 | 10 pts | 10 pts |
| Final | 1 | 25 pts | 25 pts |

**Maximum Knockout Points:** **163 pts**

**Bracket Logic:**
- Predictions must be internally consistent (can't pick a team in QF if you didn't pick them to advance from R16)

---

### Total Points Summary

| Category | Max Points | Typical Good Score |
|----------|------------|-------------------|
| Group Stage | 120 | 50-70 |
| Knockout Bracket | 163 | 60-90 |
| **TOTAL** | **283** | **110-160** |

---

### Prediction Submission

**All predictions are submitted upfront before the tournament begins.**

| What | Lock Deadline |
|------|---------------|
| All predictions (group stage + full knockout bracket + total goals tiebreaker) | 1 hour before first match |

Users must submit their complete bracket prediction in a single submission, including:
- Group stage standings (positions 1-4 for all 12 groups)
- Full knockout bracket (R32 through Final)
- Total tournament goals prediction (used for tiebreaker only)

---

### Tiebreaker System

When players have equal points, ties are resolved by **Total Goals Prediction Accuracy**:

- Each user predicts the exact total number of goals scored in the tournament
- Absolute difference from actual total goals determines winner
- Lower difference wins

If still tied after total goals comparison, use submission timestamp (earlier submission wins).

---

### Anti-Cheat Mechanisms

1. **Encrypted-Until-Lock**
   - Users submit predictions encrypted with tournament encryption key
   - Predictions can be updated anytime before lock (no additional fee)
   - After lock time, API decrypts predictions on-read (zero on-chain cost)
   - All predictions become visible simultaneously after lock
   - Prevents copying other players' predictions

Note: Sybil resistance and collusion detection deferred to v2. Low entry fee (0.10 SOL) provides natural spam deterrent.

---

## Tokenomics & Economics

### Currency

**Native SOL only.** Prize pool value fluctuates with SOL market price.

---

### Entry Fee

| Entry Fee | Prize Pool % | Platform Rake % |
|-----------|--------------|-----------------|
| **0.10 SOL** | 90% | 10% |

**Example (10K participants):**
- Total collected: 1,000 SOL
- Prize pool: 900 SOL
- Platform rake: 100 SOL

---

### Platform Rake Allocation

| Category | % of Rake | Purpose |
|----------|-----------|---------|
| Development | 40% | Ongoing development, bug fixes |
| Operations | 30% | Infrastructure, oracles, gas |
| Treasury | 30% | Future events, insurance fund |

---

### Prize Pool Distribution

| Rank | % of Pool |
|------|-----------|
| 1st | 15% |
| 2nd-3rd | 10% (5% each) |
| 4th-10th | 15% (~2.1% each) |
| 11th-100th | 25% (~0.28% each) |
| 101st-1000th | 20% (~0.02% each) |
| Top 10% (1001+) | 15% (split equally) |

---

### Treasury Management

**Prize Pool Custody:**
- Held in audited smart contract (not team wallet)
- Multi-sig for emergency withdrawals only (3 of 5 signers)
- Time-locked release: Cannot be touched until tournament ends + 30 days

---

## Technical Architecture

### Blockchain Platform: Solana

**Why Solana:**
| Factor | Solana | EVM L2 (Base/Arb) | Assessment |
|--------|--------|-------------------|------------|
| Transaction Cost | ~$0.00025 | ~$0.01-0.10 | Solana wins (10K users = significant savings) |
| Finality | 400ms | 2-12 seconds | Solana wins (better UX) |
| Ecosystem | Metaplex, Jupiter, etc. | OpenZeppelin, Uniswap | Both mature |
| Dev Experience | Rust/Anchor | Solidity | EVM easier, but you have Solana exp |
| User Wallets | Phantom, Backpack | MetaMask, Coinbase | Both well-adopted |

**Recommendation:** Solana, leveraging your existing experience and cost advantages at scale.

---

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  Next.js │  │  Wallet  │  │  State   │                      │
│  │   App    │  │ Adapter  │  │ (Zustand)│                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
└───────┼─────────────┼─────────────┼────────────────────────────┘
        │             │             │
        └─────────────┴──────┬──────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    SOLANA BLOCKCHAIN                            │
│                            │                                    │
│  ┌─────────────────────────┴─────────────────────────────┐     │
│  │                    ANCHOR PROGRAMS                      │     │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐       │     │
│  │  │ Prediction │  │  Scoring   │  │   Prize    │       │     │
│  │  │   Vault    │  │   Engine   │  │ Distributor│       │     │
│  │  └────────────┘  └────────────┘  └────────────┘       │     │
│  └───────────────────────────────────────────────────────┘     │
│                            │                                    │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    BACKEND SERVICES                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │   API    │  │ Database │  │   Jobs   │                      │
│  │  (Hono)  │  │(Supabase)│  │  (Cron)  │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

---

### Smart Contract Architecture (Anchor/Rust)

#### 1. Prediction Vault Program

**Purpose:** Handle user registration, entry fees, and prediction storage.

**Accounts:**
```rust
#[account]
pub struct Tournament {
    pub authority: Pubkey,           // Admin
    pub prize_pool: Pubkey,          // Token account
    pub total_entries: u64,
    pub total_prize_pool: u64,
    pub status: TournamentStatus,    // Registration, Locked, Active, Completed
    pub lock_time: i64,              // Single lock time for all predictions
    pub bump: u8,
}

#[account]
pub struct UserEntry {
    pub owner: Pubkey,
    pub tournament: Pubkey,
    pub entry_fee_paid: u64,         // Fixed 0.10 SOL
    pub encrypted_predictions: Vec<u8>, // Encrypted until lock
    pub total_points: u32,
    pub rank: Option<u32>,
    pub claimed: bool,
    pub timestamp: i64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct Predictions {
    pub groups: [[u8; 4]; 12],       // 12 groups, 4 team positions each
    pub knockout: [u8; 32],          // 32 match winners (bitmap)
    pub total_goals: u16,            // Tiebreaker prediction
}
```

**Instructions:**
- `initialize_tournament` - Admin creates tournament
- `register_user` - User pays entry fee
- `submit_predictions` - User submits encrypted predictions (can call multiple times before lock)
- `update_tournament_status` - Admin transitions phases

---

#### 2. Scoring Engine Program

**Purpose:** Calculate points based on match results from admin.

**Accounts:**
```rust
#[account]
pub struct MatchResult {
    pub tournament: Pubkey,
    pub match_id: u16,
    pub match_type: MatchType,       // Group, R32, R16, QF, SF, Third, Final
    pub team_a: u8,
    pub team_b: u8,
    pub score_a: u8,
    pub score_b: u8,
    pub winner: u8,                  // 0 = draw (group only), else team ID
    pub timestamp: i64,
}
```

Note: Leaderboard computed off-chain in Supabase via SQL, not stored on-chain. This reduces on-chain storage costs significantly.

**Instructions:**
- `submit_match_result` - Admin submits verified result
- `calculate_user_points` - Compute points for one user (can be batched)
- `finalize_tournament` - Lock final rankings

---

#### 3. Prize Distributor Program

**Purpose:** Handle prize pool distribution and claims.

**Accounts:**
```rust
#[account]
pub struct PrizeConfig {
    pub tournament: Pubkey,
    pub total_pool: u64,
    pub tiers: Vec<PrizeTier>,
    pub participation_threshold: u32, // Min points for participation pool
    pub finalized: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PrizeTier {
    pub rank_start: u32,
    pub rank_end: u32,
    pub percentage_bps: u16,         // Basis points (100 = 1%)
}

#[account]
pub struct PrizeClaim {
    pub user: Pubkey,
    pub tournament: Pubkey,
    pub rank: u32,
    pub prize_amount: u64,
    pub claimed: bool,
    pub claim_timestamp: Option<i64>,
}
```

**Instructions:**
- `configure_prizes` - Admin sets prize distribution
- `calculate_prize` - Compute prize for user based on rank
- `claim_prize` - User claims their winnings
- `emergency_withdraw` - Admin recovery (time-locked)

---

### Oracle Integration (v1 Simplified)

**Admin-controlled oracle for v1.** Admin verifies results from sports data sources and submits on-chain.

```
┌─────────────┐
│ Sports Data │  (API-Sports, ESPN, etc.)
│   Sources   │
└──────┬──────┘
       │
┌──────┴──────┐
│    Admin    │  (manual verification)
│   Backend   │
└──────┬──────┘
       │
┌──────┴──────┐
│  On-chain   │
│   Submit    │
└─────────────┘
```

**v1 Process:**
- Admin monitors match results from trusted sports data sources
- After match ends, admin verifies result and submits on-chain
- All submissions logged for transparency

**v2 Upgrade Path:** Multi-sig oracle with automated multi-source verification can be added later.

---

### Frontend Tech Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| Framework | Next.js 14 (App Router) | SSR, performance, SEO |
| Styling | Tailwind CSS + shadcn/ui | Fast development, consistency |
| State | Zustand + React Query | Simple, performant |
| Wallet | @solana/wallet-adapter | Standard Solana integration |

---

### Backend Services

| Service | Technology | Purpose |
|---------|------------|---------|
| API | Hono (Cloudflare Workers) | Low-latency, global edge |
| Database | Supabase (Postgres) | User data, predictions, leaderboard |
| Jobs | Cloudflare Cron | Notifications |

Note: Admin backend writes to both Solana and Supabase when submitting match results. Leaderboard computed via SQL in Supabase.

---

### Security Considerations

| Risk | Mitigation |
|------|-----------|
| Smart contract bugs | Audit by reputable firm (Sec3, OtterSec) |
| Oracle manipulation | Admin-controlled for v1 (trusted operator) |
| Front-running predictions | Encrypted-until-lock with tournament decryption key |
| Sybil attacks | Low entry fee (0.10 SOL) deters spam; enhanced detection in v2 |
| Admin key compromise | Secure key management; multi-sig can be added in v2 |
| Prize pool theft | Audited contracts, time-locked operations |

---

### Infrastructure Costs (Monthly Estimate)

| Item | Cost | Notes |
|------|------|-------|
| Solana RPC | $0-50 | Free tier or basic paid RPC |
| Cloudflare Workers | $5-50 | Edge API |
| Supabase | $25-100 | Database |
| Domain + CDN | $20 | |
| **Total** | ~$50-220/mo | Pre-launch |

**Launch month spike:** Add $200-500 for traffic surge

---

## User Experience Flow

### Onboarding
1. Connect wallet (Phantom, Backpack, etc.)
2. View tournament structure and rules
3. Make predictions (group stage + knockout bracket + total goals)
4. Pay entry fee (0.10 SOL)
5. Receive on-chain confirmation

### During Tournament
- Live leaderboard (updated in Supabase after admin submits results)
- Point updates after each match result is submitted on-chain
- View own predictions vs actual results

### Post-Tournament
- Final rankings revealed
- Prize claims (top finishers)
- Opt-in for future events

---

## Legal & Compliance Considerations (Expanded)

### Regulatory Landscape Overview

The intersection of blockchain, prediction games, and prize pools creates a complex regulatory environment that varies significantly by jurisdiction.

---

### Classification Risk Analysis

| Classification | Risk Level | Implications |
|---------------|------------|--------------|
| **Gambling** | HIGH | Requires licenses, heavy restrictions, potential criminal liability |
| **Skill-based contest** | MEDIUM | More permissible, but still regulated in some jurisdictions |
| **Money transmission** | MEDIUM | Handling user funds may require licenses |

---

### Jurisdiction-by-Jurisdiction Assessment

#### HIGH RISK - Recommend Geo-blocking

| Jurisdiction | Reason | Action |
|--------------|--------|--------|
| **United States** | Complex state-by-state gambling laws, SEC scrutiny of crypto | Block entirely or consult specialized US gaming counsel |
| **China** | Crypto banned, gambling banned | Block |
| **Singapore** | Strict gambling regulations, crypto advertising restrictions | Block |
| **UAE** | Gambling prohibited | Block |
| **Australia** | Online gambling heavily regulated | Block or obtain license |

#### MEDIUM RISK - Proceed with Caution

| Jurisdiction | Reason | Action |
|--------------|--------|--------|
| **UK** | Gambling Commission oversight, but skill games may be exempt | Legal review required |
| **Germany** | New gambling regulations, crypto-friendly | Possible with compliance |
| **Canada** | Province-by-province rules | Legal review required |
| **Japan** | Crypto legal, gambling restricted | Legal review required |

#### LOWER RISK - Generally Permissible

| Jurisdiction | Notes |
|--------------|-------|
| **Latin America** | Generally crypto-friendly, less gambling regulation |
| **Southeast Asia** (except SG) | Varies, but generally more permissive |
| **Eastern Europe** | Crypto-friendly, less enforcement |
| **Malta** | Crypto-friendly, gaming licenses available |
| **Portugal** | Crypto gains tax-free, permissive environment |

---

### Skill vs. Chance Argument

**Key legal distinction:** Games of skill are often exempt from gambling regulations.

**Arguments for SKILL classification:**

1. **Knowledge required**
   - Understanding team strengths, player form, historical performance
   - Analyzing group compositions and knockout bracket paths
   - Tournament format knowledge (48-team expansion is new)

2. **Consistent performance correlation**
   - Expert predictions outperform random guessing significantly
   - Leaderboards show skill differentiation (not random distribution)
   - Historical data from similar contests shows expert advantage

3. **No house edge on outcomes**
   - Platform doesn't influence match results
   - All users have equal information access
   - No "house" that wins when users lose

**Arguments AGAINST (challenges to defend):**
- Ultimately, match outcomes are uncertain
- Even experts can't guarantee results
- Entry fee + prize = "consideration + chance + prize" (gambling definition)

**Recommendation:** Frame as "fantasy sports-style skill competition" where possible.

---

### KYC Strategy

**No KYC required.** Wallet-only participation keeps the experience simple and permissionless.

- Entry fee is low (0.10 SOL) reducing abuse incentive
- Prize values fluctuate with SOL, not fixed fiat amounts
- Users responsible for their own tax reporting

---

### Terms of Service Requirements

**Essential clauses:**

1. **Eligibility**
   - Minimum age (18 or 21 depending on jurisdiction)
   - Restricted countries list
   - Self-exclusion option

2. **Risk disclosures**
   - "Entry fees are non-refundable"
   - "Cryptocurrency values may fluctuate"
   - "Past performance doesn't guarantee future results"

3. **Prize distribution**
   - Clear rules on how prizes are calculated
   - Tax responsibility lies with winner
   - Dispute resolution process

4. **Platform rights**
   - Right to disqualify for rule violations
   - Right to modify rules (with notice)
   - Right to cancel if participation below minimum

5. **Liability limitations**
   - Not responsible for oracle failures
   - Not responsible for blockchain congestion
   - Maximum liability capped at entry fee

---

### Tax Considerations

**For users:**
- Prize winnings are generally taxable income
- Crypto-to-crypto conversions may trigger capital gains
- Users responsible for their own tax reporting

**For platform:**
- May need to issue tax forms (1099-MISC in US if not geo-blocked)
- Rake revenue is taxable business income
- Consider entity structure (offshore vs. domestic)

**Recommendation:** Provide clear tax guidance to users; consider tax form generation for large winners.

---

### Intellectual Property Risks

| Risk | Mitigation |
|------|-----------|
| FIFA trademarks | Don't use "FIFA" or "World Cup" in branding; use "2026 Football Championship" |
| Team logos | Use generic representations; no official logos without license |
| Player likenesses | Use names only; no photos without rights |
| Data licensing | Ensure sports data provider has rights to distribute |

**Recommendation:** Use generic tournament branding, avoid official FIFA imagery.

---

### Data Privacy (GDPR/CCPA)

**Requirements:**
- Privacy policy with data collection disclosures
- Cookie consent (if applicable)
- Right to deletion (where technically feasible)
- Data minimization principles

**Blockchain considerations:**
- On-chain data is immutable (can't delete)
- Store minimal PII on-chain
- Keep personal data off-chain in Supabase (deletable)

---

### Recommended Legal Setup

| Item | Action | Priority |
|------|--------|----------|
| **Legal entity** | Establish in crypto-friendly jurisdiction (BVI, Cayman, Estonia, or Portugal) | HIGH |
| **Gaming counsel** | Engage firm specializing in crypto + gaming (Anderson Kill, Perkins Coie, etc.) | HIGH |
| **Terms of Service** | Draft comprehensive ToS with required disclosures | HIGH |
| **Privacy Policy** | GDPR-compliant privacy policy | HIGH |
| **Geo-blocking** | Implement VPN detection + country blocking | HIGH |
| **KYC provider** | Integrate for high-value participants | MEDIUM |
| **Insurance** | Explore crypto-native insurance (Nexus Mutual) | LOW |

---

### Compliance Checklist (Pre-Launch)

- [ ] Legal entity established
- [ ] Gaming/crypto legal opinion obtained
- [ ] Terms of Service finalized
- [ ] Privacy Policy finalized
- [ ] Geo-blocking implemented
- [ ] Restricted countries list defined
- [ ] KYC flow integrated for high tiers
- [ ] Age verification mechanism
- [ ] Tax guidance documentation
- [ ] Dispute resolution process defined
- [ ] Smart contract audit (includes legal review of logic)

---

## Open Questions & Recommendations

### Resolved
- Complexity: Full bracket only (group stage + knockout), no bonus predictions
- Predictions: All submitted upfront before tournament starts
- Tiebreaker: Total tournament goals prediction
- Revenue: Entry fee (0.10 SOL) + platform rake (10%)
- Currency: Native SOL only (no stablecoins)
- KYC: None required (wallet-only participation)
- Scale: Design for 10K+
- Oracle: Admin-controlled for v1
- NFTs: Deferred to v2
- Wallet abstraction: Deferred to v2

### Still Open

| Question | Recommendation |
|----------|----------------|
| Sports data source | API-Sports, SportMonks, or ESPN API for match results |

---

## Development Phases

### Phase 1: Foundation
- Smart contract architecture design
- Core prediction vault contract
- Basic frontend with wallet connection
- Testnet deployment

### Phase 2: Game Logic
- Scoring engine (admin submits results)
- Point calculation system
- Off-chain leaderboard via Supabase

### Phase 3: Polish
- Prize distributor contract
- Mobile-responsive UI
- Notification system

### Phase 4: Launch Prep
- Security audit
- Load testing (10K+ users)
- Legal review
- Community building / marketing

### Phase 5: Post-Launch
- Monitor and support tournament
- Prize distribution
- Post-mortem analysis
- Template for future events

---

## Next Steps

1. Finalize blockchain platform decision (Solana recommended)
2. Define exact point values and test for balance
3. Begin smart contract development (Prediction Vault first)
4. Set up Supabase schema for leaderboard
5. Legal consultation for target markets
