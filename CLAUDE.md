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

## Deployed Contracts (Starknet Sepolia — March 2026)

| Contract | Address |
|----------|---------|
| LivenessRegistry | `0x0793e0b1466724bcb1a2685b2f7e2a30030d0dd9d08a4e02eb08f37db5014446` |
| VaultController  | `0x0299f49297d5f4649082d09c5e757f6f8db7600fe91c0f86d0eb3578e4e9abdf` |
| KeeperRegistry   | `0x002aaaf4d8371672a7432111c087eea44872d0aaa7ef05009807bdba6af07142` |

Deployer: `0x38e6676c9c0e82a6cde4c7a89592d07075a8c6ff47033216caf3d988420b99b`

RPC: `https://rpc.starknet-testnet.lava.build`

Verify on Starkscan:
- https://sepolia.starkscan.co/contract/0x0793e0b1466724bcb1a2685b2f7e2a30030d0dd9d08a4e02eb08f37db5014446
- https://sepolia.starkscan.co/contract/0x0299f49297d5f4649082d09c5e757f6f8db7600fe91c0f86d0eb3578e4e9abdf
- https://sepolia.starkscan.co/contract/0x002aaaf4d8371672a7432111c087eea44872d0aaa7ef05009807bdba6af07142

### Declaration tx hashes
- KeeperRegistry:   `0x0308ee519111fffa1fee101ea3b8bc86e0232445968a0fdeefff65342ccda397`
- VaultController:  `0x07ce9cf03b838be7dca1c5b37e9ac6f026de4a2affaeda95c6e8778c388e142c`
- LivenessRegistry: `0x052c44ab9c43c27fcea838b5d055de45863a3bc65b7016d121cc4119272fed35`

### Deployment tx hashes
- KeeperRegistry:   `0x029e4f0e939a34a4576591556e43d8320c6a40e7d8501defe071bae442ffea6d`
- VaultController:  `0x058074496968cc040b26acdabc80ebb7fb7d5793411cc4ba14d9585e2201167a`
- LivenessRegistry: `0x02c239cacef49f41aaf6fa306f691af978a6b351a0dbe3ee4c40ba413469622b`
- set_registry():   `0x06b56585d517ee66918a95729e79b00ef80eac6f40391ad9d749f847ec6daaf8`
