# DevDAO

DevDAO is a small GenLayer MVP for developer-focused governance. Developers submit project funding proposals, GenLayer validators produce an advisory AI evaluation, and DAO members vote YES or NO.

## Why GenLayer

The contract uses GenLayer intelligent-contract execution for proposal evaluation. Proposal data is sent into a validator prompt, validators check the returned JSON shape, and the validated evaluation is stored with the proposal. The frontend reads the stored result from the deployed contract.

## Architecture

```text
contracts/DevDAO.py          Intelligent contract
tests/direct/test_devdao.py  Fast direct-mode contract tests
frontend/                    Next.js app for wallet, proposals, AI review, voting
deploy/deployScript.ts       GenLayer deployment script
```

The MVP intentionally avoids tokenomics, delegated voting, staking, treasury execution, NFT membership, and multi-sig flows. The treasury balance shown in the UI is a labeled demo value.

## Contract

`DevDAO.py` supports:

- Proposal creation and storage
- Required field validation
- GenLayer AI validator evaluation
- Structured evaluation validation
- Proposal retrieval
- YES/NO voting
- Vote tracking and status updates
- Member counting based on proposal/vote participation

AI evaluation fields:

```json
{
  "feasibility": 9,
  "impact": 9,
  "technical_risk": 7,
  "budget": 8,
  "overall_score": 8.4,
  "recommendation": "APPROVE",
  "reasoning": "...",
  "validator_agreement": "4/5 validators agree"
}
```

## Local Setup

```shell
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
npm install
cd frontend
npm install
```

## Test

Run the focused DevDAO direct tests:

```shell
source .venv/bin/activate
pytest tests/direct/test_devdao.py -v
```

Run contract linting:

```shell
source .venv/bin/activate
genvm-lint check contracts/DevDAO.py
```

Run the frontend type check:

```shell
cd frontend
npm run lint
```

Build the frontend:

```shell
cd frontend
npm run build
```

## Run Frontend Locally

Without a deployed contract, the frontend runs in labeled demo mode:

```shell
cd frontend
npm run dev
```

Open `http://localhost:3000`.

With a deployed contract, create `frontend/.env.local`:

```shell
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studio
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
```

## Deploy Contract

Choose the target network and deploy:

```shell
genlayer network
genlayer deploy
```

The deployment script deploys `contracts/DevDAO.py`. Copy the printed contract address into `frontend/.env.local` as `NEXT_PUBLIC_CONTRACT_ADDRESS`.

## Vercel

Build locally before deployment:

```shell
cd frontend
npm run build
```

Deploy:

```shell
cd frontend
npx vercel
```

Set these Vercel environment variables:

```shell
NEXT_PUBLIC_CONTRACT_ADDRESS=0x...
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_GENLAYER_CHAIN_ID=61999
NEXT_PUBLIC_GENLAYER_CHAIN_NAME=GenLayer Studio
NEXT_PUBLIC_GENLAYER_SYMBOL=GEN
```

Production deploy:

```shell
cd frontend
npx vercel --prod
```
