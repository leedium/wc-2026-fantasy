# CLAUDE.md

> **Version:** 2.0.0
> **Last Updated:** 2026-01-18

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

World Cup 2026 decentralized prediction game on Solana. Users pay entry fees to submit bracket predictions (group stage standings + knockout bracket), earn points for correct predictions, and claim shares of the prize pool based on final rankings.

## Tech Stack

- **Blockchain**: Solana with Anchor framework (Rust)
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Zustand, React Query
- **Wallet**: @solana/wallet-adapter (Phantom, Backpack, etc.)
- **Backend**: Hono on Cloudflare Workers, Supabase (Postgres)

## Architecture

### Smart Contracts (Anchor Programs)

Three main programs:

1. **Prediction Vault** - User registration, entry fees, encrypted prediction storage (decrypted after lock)
2. **Scoring Engine** - Point calculation from admin-submitted results (group standings + knockout results)
3. **Prize Distributor** - Prize pool management and claims

### Key Data Structures

- `Tournament` - Tournament state, single lock time, prize pool
- `UserEntry` - User predictions (encrypted until lock, then decrypted for scoring)
- `Predictions` - Groups standings + knockout bracket + total goals (tiebreaker)
- `GroupStandings` - Final group stage standings (12 groups)
- `KnockoutResult` - Individual knockout match outcomes (31 matches)
- `PrizeClaim` - Individual prize allocations

Note: Leaderboard computed off-chain in Supabase, not stored on-chain.

### Prediction Flow

1. **Submit phase**: User submits encrypted predictions before lock (can update anytime)
2. **Lock & Decrypt**: After lock time, API decrypts predictions (zero on-chain cost)
3. **Group scoring**: Admin submits final group standings (12 submissions) after group stage ends → points calculated
4. **Knockout scoring**: Admin submits knockout results as matches complete (31 submissions) → points calculated per match
5. **Tiebreaker**: Total goals prediction used to break ties
6. **Distribution**: Prizes calculated based on final rankings

## Game Mechanics

- 48 teams, 12 groups, 104 total matches
- **All predictions submitted upfront** before tournament starts (single lock time)
- Group stage: Predict positions 1-4 for all 12 groups (max 120 pts)
- Knockout: Predict winners R32→Final (max 163 pts)
- Total points: max 283 pts
- **Tiebreaker**: Total tournament goals prediction (closest to actual wins)
- Entry fee: Fixed 0.10 SOL (native SOL only, no stablecoins)
- Prize pool value fluctuates with SOL market price
- No KYC required (wallet-only participation)

## Oracle Design

Admin-controlled oracle for v1:
- **Group stage**: Admin submits final standings (positions 1-4) for each group after all group matches complete
- **Knockout stage**: Admin submits match results as each knockout game finishes

Can upgrade to multi-sig oracle in future versions.

## Git Commits

- Do not include "Co-Authored-By" lines in commit messages