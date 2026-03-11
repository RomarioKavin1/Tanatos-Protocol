# Thanatos Protocol

**ZK Dead Man's Switch for Private Crypto Inheritance on Starknet**

Thanatos Protocol is a trustless, privacy-preserving crypto inheritance mechanism built on three interlocking ZK primitives: a **Cairo-native Semaphore group** for anonymous liveness attestation, a **Noir circuit verified on-chain by Garaga**, and a **Poseidon-committed beneficiary** whose identity is sealed until the moment of claim.

Prove you are alive periodically with zero-knowledge proofs. If you stop, your vault activates and your beneficiary claims — without any party ever being linked to a wallet address on-chain.

## What's Novel

| Primitive | Novelty |
|-----------|---------|
| **Semaphore on Starknet** | Cairo-native Semaphore group with BN254 Poseidon2 Merkle tree (depth 20). First production deployment of Semaphore-style anonymous signaling on Starknet. |
| **Noir → Garaga → Starknet** | End-to-end pipeline: Noir circuit compiled with Barretenberg UltraHonk, calldata generated via `garaga.getZKHonkCallData()`, verified by a Garaga-generated Cairo verifier live on Sepolia. |
| **ZK Proof of Life** | First application of ZK proofs for temporal liveness attestation. The *absence* of a proof becomes a cryptographic signal — without revealing who failed to check in. |
| **Epoch-bound nullifiers** | `nullifier = Poseidon2(identity_nullifier, epoch)` — each time window gets a unique, unrepeatable commitment. Anti-replay is enforced by the circuit itself, not the contract. |
| **Three-layer privacy** | (1) Owner wallet never on-chain — ZK group membership only. (2) Beneficiary identity sealed as `Poseidon(address, salt)` until claim. (3) No correlation between check-ins across epochs. |

---

## Architecture

```
+------------------+     ZK Proof (UltraHonk)     +---------------------+
|   Owner Browser  |  ─────────────────────────>  |  LivenessRegistry   |
|  (Noir + bb.js)  |                              |  (Cairo contract)   |
+------------------+                              +----------+----------+
                                                             |
                                                  verifies via Garaga
                                                             |
                                                             v
                                                  +---------------------+
                                                  | Garaga UltraHonk    |
                                                  | Verifier Contract   |
                                                  | (Sepolia)           |
                                                  +---------------------+
                                                             |
                                                  report_missed (keepers)
                                                             |
                                                             v
+------------------+                              +----------+----------+
|  Beneficiary     |  <─────── claim() ─────────  |  VaultController    |
|  (knows secret)  |                              |  (ERC-20 escrow)    |
+------------------+                              +---------------------+

+-----------------+          staking              +---------------------+
|  Keeper Network |  <──────────────────────────> |  KeeperRegistry     |
|  (automated)    |                               |  (STRK staking)     |
+-----------------+                               +---------------------+
```

### Components

| Component | Technology | Description |
|-----------|-----------|-------------|
| Liveness Circuit | Noir 1.0.0-beta.16 + bb 3.0.0-nightly | Semaphore-style ZK proof: Merkle membership + epoch nullifier |
| Garaga Verifier | Cairo 2.x, garaga 1.0.1 | On-chain UltraKeccakZKHonk proof verifier (generated from VK) |
| LivenessRegistry | Cairo 2.x | Semaphore Merkle group, check-in with ZK verification, missed-count tracking |
| VaultController | Cairo 2.x | ERC-20 deposit escrow, activation, and beneficiary claim |
| KeeperRegistry | Cairo 2.x | STRK staking for keeper network participation |
| Frontend | Next.js 15, @aztec/bb.js 4.x, garaga npm | Browser-based identity, in-browser proof generation, Starknet submission |

---

## Deployed Contracts (Starknet Sepolia)

| Contract | Address |
|----------|---------|
| LivenessRegistry | `0x03889ea44e371e10ea1f7f1ccbe35b3291e649038862d44092994e81d8d394e8` |
| VaultController | `0x00bc6078749b2078604b0aa03ff05e68fa700045dd70152134cf5e8181752ac4` |
| KeeperRegistry | `0x002aaaf4d8371672a7432111c087eea44872d0aaa7ef05009807bdba6af07142` |
| Garaga UltraHonk Verifier | `0x119174a06b0da1aaf3a4f497145d6f97e56e4aa4c917a0fbb69253b79a49750` |
| STRK Token | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |

---

## How It Works

### For the Vault Owner

1. **Generate a Semaphore identity** in the browser: `(secret, nullifier, commitment = Poseidon2(secret, nullifier))`
2. **Register** the identity commitment in the Semaphore Merkle group on-chain, linked to a vault commitment and a check-in interval.
3. **Deposit tokens** into VaultController along with the encrypted beneficiary identifier.
4. **Check in periodically** by generating a ZK proof locally and submitting it on-chain. The proof demonstrates:
   - Membership in the Semaphore group (Merkle path of depth 20)
   - A unique epoch nullifier `Poseidon2(nullifier, epoch)` — prevents replay
   - A signal commitment `Poseidon2(epoch)` — epoch binding
5. **Vault stays locked** as long as check-ins happen within the interval + grace period.

### Automatic Activation (Dead Man's Switch)

After N consecutive missed check-in intervals (default: 3), any keeper can call `report_missed`. When the threshold is reached, `VaultController.activate()` is called atomically.

### For the Beneficiary

1. The vault owner shares the **vault commitment** and a **claim key** off-band.
2. The beneficiary monitors the vault using the claim page.
3. Once the vault is activated, they call `claim()` with their claim key.

---

## ZK Proof System

### Circuit (`circuits/liveness/src/main.nr`)

Written in Noir and compiled with nargo 1.0.0-beta.16. Uses the BN254 Poseidon2 hash function implemented directly via `std::hash::poseidon2_permutation`.

**Hash construction:**
```
poseidon2_hash_2(a, b) = poseidon2_permutation([a, b, 0, 2], 4)[0]
poseidon2_hash_1(a)    = poseidon2_permutation([a, 0, 0, 1], 4)[0]
```

**Private inputs:**
- `identity_secret` — random field element
- `identity_nullifier` — random field element
- `merkle_path[20]` — sibling hashes along the Merkle path (depth 20)
- `merkle_indices[20]` — 0 (left child) or 1 (right child) at each level

**Public inputs:**
- `root` — current Semaphore group Merkle root (on-chain)
- `nullifier_hash` — `Poseidon2(identity_nullifier, epoch)` — epoch-unique, prevents replay
- `signal_hash` — `Poseidon2(epoch)` — epoch commitment
- `epoch` — current epoch number (`block_timestamp / interval`)

**Circuit constraints:**
1. `identity_commitment = Poseidon2(secret, nullifier)`
2. Walk Merkle tree: `current = Poseidon2(left, right)` for each of 20 levels; assert `current == root`
3. Assert `Poseidon2(nullifier, epoch) == nullifier_hash`
4. Assert `Poseidon2(epoch) == signal_hash`

### Proof Generation (Browser)

```
Noir circuit (ACVM witness execution)
        ↓
@aztec/bb.js 4.x UltraHonkBackend
  generateProof({ verifierTarget: "starknet" })
  getVerificationKey({ verifierTarget: "starknet" })
        ↓
garaga npm 1.0.1
  getZKHonkCallData(proof, publicInputs, vk)
  → bigint[] (full_proof_with_hints with KZG pairing hints)
        ↓
LivenessRegistry.checkin(proof: Array<felt252>, ...)
```

### On-Chain Verification

The Garaga verifier contract was generated from the circuit's verification key:
```bash
# Generate VK (keccak oracle hash — compatible with garaga on macOS bb builds)
bb write_vk --scheme ultra_honk --oracle_hash keccak \
  -b circuits/liveness/target/liveness.json \
  -o circuits/liveness/target/vk_output/vk_keccak.bin

# Generate Cairo verifier from VK
garaga gen --system ultra_keccak_zk_honk --vk circuits/liveness/target/vk_output/vk_keccak.bin \
  --output_dir liveness_verifier
```

The `verify_ultra_keccak_zk_honk_proof(full_proof_with_hints: Span<felt252>)` call returns the 4 public inputs as `Span<u256>`. `LivenessRegistry.checkin()` validates each against the submitted parameters and the stored Merkle root.

---

## Setup

### Prerequisites

| Tool | Version |
|------|---------|
| nargo | 1.0.0-beta.16 |
| bb (Barretenberg CLI) | 3.0.0-nightly.20251104 |
| scarb | 2.12.2 |
| garaga (Python CLI) | 1.0.1 |
| starkli | 0.4.2+ |
| node | 20.x+ |
| bun | 1.x+ |

> **Note on Garaga Python CLI:** `pip install garaga` installs an empty native extension on some platforms. Build from source instead:
> ```bash
> git clone https://github.com/keep-starknet-strange/garaga /tmp/garaga_src
> python3.10 -m venv /tmp/garaga_venv
> VIRTUAL_ENV=/tmp/garaga_venv /tmp/garaga_venv/bin/maturin develop --features python \
>   --manifest-path /tmp/garaga_src/hydra/Cargo.toml
> /tmp/garaga_venv/bin/pip install -e /tmp/garaga_src
> ```

> **Note on bb oracle hash:** The macOS bb 3.0.0-nightly build has Starknet Garaga Extensions disabled. Use `--oracle_hash keccak` (not `starknet`) when generating the VK. This produces a 1888-byte VK (28 G1 points) compatible with garaga.

### 1. Clone and build

```bash
git clone https://github.com/your-org/ThanatosProtocol
cd ThanatosProtocol

# Compile the ZK circuit (requires nargo 1.0.0-beta.16)
cd circuits/liveness
nargo compile

# Generate VK for garaga
mkdir -p target/vk_output
bb write_vk --scheme ultra_honk --oracle_hash keccak \
  -b target/liveness.json \
  -o target/vk_output/vk_keccak.bin

# Build Cairo contracts
cd ../../contracts
scarb build

# Install frontend dependencies
cd ../frontend
bun install

# Copy circuit artifact to frontend public directory
mkdir -p public/circuits
cp ../circuits/liveness/target/liveness.json public/circuits/liveness.json
```

### 2. Configure environment

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=0x03889ea44e371e10ea1f7f1ccbe35b3291e649038862d44092994e81d8d394e8
NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=0x00bc6078749b2078604b0aa03ff05e68fa700045dd70152134cf5e8181752ac4
NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=0x002aaaf4d8371672a7432111c087eea44872d0aaa7ef05009807bdba6af07142
NEXT_PUBLIC_STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://rpc.starknet-testnet.lava.build
```

### 3. Deploy contracts

The Garaga verifier must be deployed first (requires the circuit's VK):

```bash
# Generate and deploy the Garaga verifier
cd liveness_verifier
# Create .secrets with SEPOLIA_RPC_URL, SEPOLIA_ACCOUNT_ADDRESS, SEPOLIA_ACCOUNT_PRIVATE_KEY
garaga declare --system ultra_keccak_zk_honk --contract HonkVerifier \
  --network sepolia --secrets .secrets

# Deploy Cairo contracts
export STARKNET_ACCOUNT=~/.starkli/accounts/deployer.json
export STARKNET_KEYSTORE=~/.starkli/keystores/deployer.json
bash scripts/deploy.sh
```

### 4. Run frontend

```bash
cd frontend
bun dev
# Open http://localhost:3000
```

---

## Usage

### Setup Vault (Owner)

1. Visit `/setup`
2. Connect your Starknet wallet (ArgentX or Braavos)
3. Generate your identity (stored in browser localStorage)
4. Download the identity backup file (critical!)
5. Configure your check-in interval
6. Enter your beneficiary's claim key
7. Deposit tokens and deploy

### Check In (Owner)

1. Visit `/checkin`
2. Connect wallet
3. Click "Generate Proof & Check In"
4. Wait ~30s for the UltraHonk proof to generate in-browser via bb.js
5. Garaga calldata (proof + KZG pairing hints) is assembled and submitted
6. Confirm the Starknet transaction

### Claim (Beneficiary)

1. Visit `/claim`
2. Enter the vault commitment (shared by the owner off-band)
3. Wait for vault activation (or poll the dashboard)
4. Enter your claim key and recipient address
5. Submit the claim transaction

---

## Security Notes

- **Identity backup is critical.** If you lose your `identity_secret` and `identity_nullifier`, you cannot generate check-in proofs and your vault will eventually activate.
- **Beneficiary confidentiality.** The beneficiary's claim key is stored on-chain as chunked field elements. Until a claim is submitted, their identity is not linked to the vault on-chain.
- **Smart contracts are unaudited.** Do not use on mainnet with significant funds before an independent audit.
- **ZK verification is live on Sepolia.** The Garaga UltraKeccakZKHonk verifier validates the full proof on-chain. The LivenessRegistry falls back to root-only checking only if the verifier address is set to zero (dev mode).
- **Epoch replay protection.** Each `(nullifier_hash, epoch)` pair can only be used once. Epoch = `block_timestamp / interval`.

---

## Development

### Run tests

```bash
cd contracts
snforge test
```

### Project structure

```
.
├── circuits/liveness/         Noir ZK circuit (main.nr)
│   └── target/
│       ├── liveness.json      Compiled circuit artifact
│       └── vk_output/
│           └── vk_keccak.bin  Verification key for garaga
├── liveness_verifier/         Cairo verifier generated by garaga gen
├── contracts/src/             Cairo Starknet contracts
│   ├── liveness_registry.cairo
│   ├── vault_controller.cairo
│   └── keeper_registry.cairo
├── contracts/tests/           snforge test suite
├── frontend/src/
│   ├── lib/
│   │   ├── identity.ts        Semaphore identity + Poseidon2 hashing
│   │   ├── merkle.ts          BN254 Poseidon2 Merkle tree (off-chain)
│   │   ├── prover.ts          Noir + bb.js + garaga proof generation
│   │   ├── contracts.ts       Starknet contract read/write helpers
│   │   └── starknet.ts        Starknet.js provider + formatting
│   └── components/
│       ├── CheckIn.tsx        Proof generation and submission UI
│       ├── Register.tsx       Vault setup UI
│       └── Claim.tsx          Beneficiary claim UI
├── scripts/                   Deployment and testing scripts
├── CLAUDE.md                  AI developer guide
└── README.md                  This file
```

---

## License

MIT. Built with Noir, Cairo, and Starknet.
