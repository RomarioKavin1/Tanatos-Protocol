# Thanatos Protocol — Developer Guide

## Project Status
- [x] Noir liveness circuit (circuits/liveness) — compiles with nargo 1.0.0-beta.3
- [x] Cairo contracts (contracts/) — compiles with scarb 2.12.2, 3 contracts deployed-ready
- [x] Next.js frontend (frontend/) — builds clean, 6 routes, 0 TS errors
- [x] Deployment scripts (scripts/) — starkli-based Sepolia deploy
- [ ] Testnet deployment — run scripts/deploy.sh after funding account
- [ ] Garaga verifier live integration — stub in place, production hook ready

## Commands

### Circuit
```bash
cd circuits/liveness
nargo compile              # compile → target/liveness.json
nargo check                # type check only
cp target/liveness.json ../frontend/public/circuits/liveness.json
```

### Contracts
```bash
cd contracts
scarb build                # compile → target/dev/*.contract_class.json
scarb test                 # run snforge unit tests
```

### Frontend
```bash
cd frontend
bun install                # install deps
bun dev                    # dev server at http://localhost:3000
bun run build              # production build (must pass before demo)
bun run generate-proof     # CLI proof generation test (Node)
```

### Deploy to Sepolia
```bash
export STARKNET_ACCOUNT=~/.starkli-wallets/deployer/account.json
export STARKNET_KEYSTORE=~/.starkli-wallets/deployer/keystore.json
export STARKNET_RPC=https://starknet-sepolia.public.blastapi.io/rpc/v0_8
./scripts/deploy.sh
```

### Simulate vault activation (testnet demo)
```bash
export REGISTRY_ADDRESS=<deployed_address>
export NULLIFIER_HASH=<test_nullifier>
./scripts/simulate_missed.sh 3   # trigger 3 missed check-ins → activation
```

## Architecture

```
[ Owner Device (Noir Prover) ]
         │ ZK Proof (starknet target)
         ▼
[ LivenessRegistry (Cairo) ] ←── monitors ──→ [ KeeperRegistry (Cairo) ]
         │ activate(vault_commitment)
         ▼
[ VaultController (Cairo) ]
         │ VaultActivated event
         ▼
[ Beneficiary (event scanner) ] ──→ claim proof ──→ [ VaultController ]
```

## Key Files
| File | Purpose |
|------|---------|
| `circuits/liveness/src/main.nr` | Semaphore ZK circuit (epoch-bound nullifier) |
| `contracts/src/liveness_registry.cairo` | Semaphore group + check-in tracking |
| `contracts/src/vault_controller.cairo` | Asset escrow + sealed beneficiary |
| `contracts/src/keeper_registry.cairo` | STRK staking for keeper network |
| `contracts/src/interfaces.cairo` | ABI interfaces for cross-contract dispatch |
| `frontend/src/lib/identity.ts` | Identity generation + AES-GCM encrypted storage |
| `frontend/src/lib/prover.ts` | Client-side ZK proof generation (Noir + bb.js) |
| `frontend/src/lib/contracts.ts` | Typed starknet.js contract wrappers |
| `scripts/deploy.sh` | Full Sepolia deployment via starkli |

## ZK Proof Flow

1. Owner calls `generateLivenessProof()` in the browser
2. `Barretenberg.new({ threads: 1 })` initialises WASM backend
3. `noir.execute(inputs)` → compressed witness
4. `backend.generateProof(witness, { verifierTarget: 'starknet' })` → proof
5. `serializeProofForStarknet()` → felt252 array calldata
6. Calldata submitted to `LivenessRegistry.checkin(proof, nullifier_hash, signal_hash, root, epoch)`

The `verifierTarget: 'starknet'` flag makes Barretenberg use the Poseidon2
hash function that Garaga's on-chain Starknet verifier expects.

## Epoch Binding (Anti-replay)

- `epoch = Math.floor(Date.now() / 1000 / interval_seconds)`
- `nullifier_hash = Poseidon2(identity_nullifier, epoch)` — one per period
- `signal_hash = Poseidon2(epoch)` — binds proof to specific epoch
- `used_epoch_nullifiers[(nullifier_hash, epoch)]` prevents replay within a period

## Contract Addresses (Sepolia — post deploy)
Set these in `frontend/.env.local`:
```
NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=0x...
NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=0x...
```

## Package Versions (locked)
- nargo: 1.0.0-beta.3
- scarb: 2.12.2 (Cairo 2.12.2)
- @noir-lang/noir_js: 1.0.0-beta.19
- @aztec/bb.js: 4.1.0-rc.2 (UltraHonkBackend)
- starknet.js: ^6.18.0
- @starknet-react/core: ^3.7.2
- Next.js: 15.2.2
