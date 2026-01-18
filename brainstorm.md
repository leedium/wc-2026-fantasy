# Brainstorm

> **Version:** 1.3.0
> **Last Updated:** 2026-01-18

## Project
Decentralized (Dapp) World Cup Lottery pick game.

## Idea / Plan
- I'd like to make a lottery game that can be played on the blockchain.
- The game will allow users to pick the outcomes from the group stages and elimination stages in the FIFA World Cup 2026.
- A pick could be an NFT of the player's team, with a limited supply of NFTS per team to make participation exclusive.
- Prizes could be issued in the form of "payout" NFTs. If a user selected the correct outcome they would earn points (NFTs)
Thus holding these NFTs would get a percentage from the prize pool.
- To resolve possible ties, total goals in the tournament could be used to determine the winner.
- Participants would pay an upfront cost in the native token or a stable con, preferably USDC or USDT.
- If game mechanic is successful, the model could be applied to other sports events or leagues.

## Decisions Made (v1.3)
- **Blockchain**: Solana with Anchor framework
- **Entry fee**: 2 tiers - Standard ($25) and Premium ($100) USDC
- **NFTs**: 3 types only - Participant, Leaderboard (top 100), Champion Caller
- **Predictions**: All submitted upfront before tournament (group stage + full knockout bracket)
- **No bonus predictions**: Keeping it simple - just group standings and knockout bracket
- **Tiebreaker**: Total tournament goals prediction (closest to actual wins)
- **Scoring**: Points for correct group positions and knockout winners
- **Prize distribution**: 100% based on leaderboard rank (no special bonus pools)

## Problems / Questions (Remaining)
- ~~Need help in designing the gaming model / mechanic~~ → RESOLVED (see PRD.md)
- ~~Need help in selection the blockchain platform~~ → RESOLVED (Solana)
- ~~What should the prize pool be?~~ → RESOLVED (tiered entry fees, see PRD.md)
- ~~What should the tokenomics be?~~ → RESOLVED (see PRD.md)
- ~~How much should the upfront cost be?~~ → RESOLVED ($10-$500 tiers)
- ~~Should participation be free or should there be a fee for entry?~~ → RESOLVED (paid entry)
- ~~How many NFTs are needed to participate?~~ → RESOLVED (0 - NFTs are rewards)
- ~~Are NFTs even needed?~~ → RESOLVED (yes, for achievements only)



