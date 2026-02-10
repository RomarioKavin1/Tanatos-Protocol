# Thanatos Protocol — Claude Project Guide

## What This Is
A ZK dead man's switch for private crypto inheritance on Starknet.

The owner periodically proves they are alive by generating a Noir ZK proof (Semaphore-style) and submitting it on-chain. If they miss N consecutive check-in intervals, staked keepers report the misses, and a vault of pre-deposited tokens is automatically unlocked for the beneficiary.

The beneficiary's identity is never revealed on-chain until a claim is submitted.

## Architecture

```
circuits/liveness/         Noir ZK circuit (Semaphore liveness proof)
contracts/                 Cairo 2.12.2 Starknet contracts
  src/
    lib.cairo              Module root
    errors.cairo           Shared error constants
    merkle.cairo           Poseidon Merkle tree utilities
    interfaces.cairo       ILivenessRegistry, IVaultController, IKeeperRegistry
    liveness_registry.cairo  Main contract: Semaphore group + check-in logic
    vault_controller.cairo   ERC-20 vault with encrypted beneficiary
    keeper_registry.cairo    STRK staking for keeper automation
  tests/
    test_liveness_registry.cairo  snforge tests
frontend/                  Next.js 15 + Tailwind 4 + starknet-react
  src/
    app/                   Next.js app router pages
    components/            React components
    lib/
      identity.ts          Semaphore identity generation + storage
      prover.ts            Noir proof generation (Barretenberg backend)
      contracts.ts         Starknet.js contract interaction layer
      starknet.ts          Provider config + helpers
scripts/
  deploy.sh                Deploys all contracts to Sepolia with starkli
  simulate_missed.sh       Calls report_missed N times for testing
  generate_test_proof.sh   Generates a test proof with nargo
```

## Key Design Decisions

1. **Semaphore identity model**: `identity_commitment = Poseidon2(secret, nullifier)`. The commitment is the Merkle leaf. The nullifier is never revealed directly; only `H(nullifier, epoch)` is published.

2. **Epoch-scoped nullifiers**: `nullifier_hash = Poseidon2(identity_nullifier, epoch)` prevents replay across epochs while allowing the same identity to check in every epoch.

3. **Sparse Merkle tree on-chain**: LivenessRegistry maintains a sparse binary Merkle tree with Poseidon hashing. New identities are appended as leaves. The root is stored on-chain and used to verify proofs.

4. **Keeper incentive**: KeeperRegistry stakes STRK. Keepers call `report_missed` and earn rewards (future: pro-rata fee share). Bad keepers can be slashed.

5. **Vault commitment**: `vault_commitment = Poseidon(identity_commitment, salt)`. The salt is shared off-chain with the beneficiary. This allows the beneficiary to discover the vault without being linked on-chain.

6. **Proof verification**: In production, the checkin function calls the Garaga Groth16/HONK verifier. In MVP, we verify only that the Merkle root matches (trusted proof submission).

## Commands

### Compile Noir circuit
```bash
cd circuits/liveness
nargo compile
```

### Build Cairo contracts
```bash
cd contracts
scarb build
```

### Run Cairo tests (requires snforge)
```bash
cd contracts
snforge test
```

### Deploy to Sepolia
```bash
export STARKNET_ACCOUNT=~/.starkli/accounts/deployer.json
export STARKNET_KEYSTORE=~/.starkli/keystores/deployer.json
bash scripts/deploy.sh
```

### Frontend dev
```bash
cd frontend
bun install
bun dev
```

### Generate test proof
```bash
bash scripts/generate_test_proof.sh
```

### Simulate missed check-ins
```bash
export LIVENESS_REGISTRY=0x...
export NULLIFIER_HASH=0x...
bash scripts/simulate_missed.sh 3
```

## File Map (key files)

| File | Purpose |
|------|---------|
| `circuits/liveness/src/main.nr` | The ZK circuit — defines the prover's knowledge |
| `contracts/src/liveness_registry.cairo` | Core protocol logic, Merkle tree, check-in |
| `contracts/src/vault_controller.cairo` | ERC-20 vault, deposit/activate/claim |
| `contracts/src/keeper_registry.cairo` | STRK staking, keeper management |
| `contracts/src/interfaces.cairo` | All contract interfaces |
| `frontend/src/lib/identity.ts` | Browser-side identity management |
| `frontend/src/lib/prover.ts` | Noir proof generation in browser |
| `frontend/src/lib/contracts.ts` | Starknet.js wrappers for all contract calls |

## Environment Variables

Create `frontend/.env.local`:
```
NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=0x...
NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
```

## Circuit Artifact Workflow

After `nargo compile` in `circuits/liveness/`, copy the artifact to the frontend:
```bash
cp circuits/liveness/target/liveness.json frontend/public/circuits/liveness.json
```
This file is already present from the initial build.

## Known Limitations (MVP)

- Proof verification on-chain is skipped (root match check only). Production needs Garaga integration.
- Beneficiary claim proof is a non-empty byte check. Production needs a ZK proof of private key knowledge.
- Keeper rewards are not yet implemented.
- No Merkle path indexer — the frontend uses dummy all-zero paths.
- The Poseidon2 implementation in `identity.ts` uses Starknet's Poseidon (compatible for Starknet contracts but must match the Noir circuit's Poseidon2 exactly).
