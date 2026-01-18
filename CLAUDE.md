# CLAUDE.md

> **Version:** 1.4.0
> **Last Updated:** 2026-01-18

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

World Cup 2026 decentralized prediction game on Solana. Users pay entry fees to submit bracket predictions (group stage standings + knockout bracket + bonus picks), earn points for correct predictions, receive achievement NFTs, and claim shares of the prize pool based on final rankings.

## Tech Stack

- **Blockchain**: Solana with Anchor framework (Rust)
- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Zustand, React Query
- **Wallet**: @solana/wallet-adapter + Privy for wallet abstraction
- **Backend**: Hono on Cloudflare Workers, Helius indexer, Supabase (Postgres)
- **NFTs**: Metaplex Core
- **Storage**: Arweave via Irys for NFT metadata

## Architecture

### Smart Contracts (Anchor Programs)

Four main programs:

1. **Prediction Vault** - User registration, entry fees, prediction storage with commit-reveal scheme
2. **Scoring Engine** - Point calculation from oracle-submitted match results
3. **Prize Distributor** - Prize pool management and claims
4. **Achievement NFT** - Metaplex Core NFTs for achievements (badges, streaks, leaderboard positions)

### Key Data Structures

- `Tournament` - Tournament state, single lock time, prize pool
- `UserEntry` - User predictions (hash for commit phase, revealed predictions, points, rank)
- `Predictions` - Groups standings + knockout bracket + total goals (tiebreaker)
- `MatchResult` - Oracle-verified match outcomes
- `Leaderboard` - Sorted rankings
- `PrizeClaim` - Individual prize allocations

### Prediction Flow

1. **Commit phase**: User submits hash of full predictions (groups + knockout + total goals) + salt before tournament starts
2. **Reveal phase**: User reveals predictions after lock (verified against hash)
3. **Scoring**: Points calculated as match results come in via oracle
4. **Tiebreaker**: Total goals prediction used to break ties
5. **Distribution**: Prizes calculated based on final rankings

## Game Mechanics

- 48 teams, 12 groups, 104 total matches
- **All predictions submitted upfront** before tournament starts (single lock time)
- Group stage: Predict positions 1-4 for all 12 groups (max 120 pts)
- Knockout: Predict winners R32→Final (max 163 pts, 1.5x upset bonus)
- Total points: max 283 pts
- **Tiebreaker**: Total tournament goals prediction (closest to actual wins)
- Entry fee: Fixed 0.10 SOL (native SOL only, no stablecoins)
- Prize pool value fluctuates with SOL market price
- No KYC required (wallet-only participation)

## Oracle Design

Multi-source sports data verification (API-Sports, SportMonks, ESPN) with 3-of-5 multi-sig for on-chain submission. 30-minute delay after matches for result verification.