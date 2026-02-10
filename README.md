# Thanatos Protocol

**ZK Dead Man's Switch for Private Crypto Inheritance on Starknet**

Thanatos Protocol lets you set up a trustless, privacy-preserving crypto inheritance mechanism. Prove you are alive with zero-knowledge proofs. If you stop checking in, your vault automatically activates for your beneficiary — without ever revealing their identity on-chain.

---

## Architecture

```
+------------------+       ZK Proof       +---------------------+
|   Owner Browser  |  ─────────────────>  |  LivenessRegistry   |
|  (Noir prover)   |                      |  (Cairo contract)   |
+------------------+                      +----------+----------+
                                                     |
                                          report_missed (keepers)
                                                     |
                                                     v
+------------------+                      +----------+----------+
|  Beneficiary     |  <─── claim() ─────  |  VaultController    |
|  (knows secret)  |                      |  (ERC-20 escrow)    |
+------------------+                      +---------------------+

+-----------------+        staking         +---------------------+
|  Keeper Network |  <──────────────────>  |  KeeperRegistry     |
|  (automated)    |                        |  (STRK staking)     |
+-----------------+                        +---------------------+
```

### Components

| Component | Technology | Description |
|-----------|-----------|-------------|
| Liveness Circuit | Noir 1.0.0-beta.3 | Semaphore-style ZK proof of identity and epoch commitment |
| LivenessRegistry | Cairo 2.12.2 | Semaphore Merkle group, check-in logic, missed-check-in tracking |
| VaultController | Cairo 2.12.2 | ERC-20 deposit escrow, activation, and beneficiary claim |
| KeeperRegistry | Cairo 2.12.2 | STRK staking for keeper network participation |
| Frontend | Next.js 15, Tailwind 4 | Browser-based identity, proof generation, and contract interaction |

---

## How It Works

### For the Vault Owner

1. **Generate a Semaphore identity** in the browser: `(secret, nullifier, commitment = Poseidon2(secret, nullifier))`
2. **Register** the identity commitment in the Semaphore Merkle group on-chain, linked to a vault commitment and a check-in interval.
3. **Deposit tokens** into VaultController along with the encrypted beneficiary identifier.
4. **Check in periodically** by generating a ZK proof locally and submitting it on-chain. The proof demonstrates:
   - Membership in the Semaphore group (Merkle proof)
   - A unique epoch nullifier `Poseidon2(nullifier, epoch)` -- prevents replay
   - A signal commitment `Poseidon2(epoch)` -- epoch binding
5. **Vault stays locked** as long as check-ins happen within the interval + grace period.

### Automatic Activation (Dead Man's Switch)

After N consecutive missed check-in intervals (default: 3), any keeper can call `report_missed`. When the threshold is reached, `VaultController.activate()` is called atomically.

### For the Beneficiary

1. The vault owner shares the **vault commitment** and a **claim key** off-band.
2. The beneficiary monitors the vault using the claim page.
3. Once the vault is activated, they call `claim()` with their claim key.

---

## ZK Circuit

The liveness proof circuit (`circuits/liveness/src/main.nr`) is written in Noir and compiled with the Barretenberg backend.

**Private inputs:**
- `identity_secret` -- random field element
- `identity_nullifier` -- random field element
- `merkle_path[20]` -- sibling hashes along the Merkle path
- `merkle_indices[20]` -- 0 (left) or 1 (right) for each level

**Public inputs:**
- `root` -- current Semaphore group Merkle root (on-chain)
- `nullifier_hash` -- `Poseidon2(identity_nullifier, epoch)` -- epoch-unique, prevents replay
- `signal_hash` -- `Poseidon2(epoch)` -- epoch commitment
- `epoch` -- current epoch number

**Circuit constraints:**
1. `identity_commitment = Poseidon2(secret, nullifier)`
2. Walk Merkle tree: `current = Poseidon2(left, right)` for each level; assert `current == root`
3. Assert `Poseidon2(nullifier, epoch) == nullifier_hash`
4. Assert `Poseidon2(epoch) == signal_hash`

---

## Setup

### Prerequisites

| Tool | Version |
|------|---------|
| nargo | 1.0.0-beta.3 |
| scarb | 2.12.2 |
| starkli | 0.4.2+ |
| node | 23.x |
| bun | 1.3.9+ |

### 1. Clone and build

```bash
git clone https://github.com/your-org/ThanatosProtocol
cd ThanatosProtocol

# Compile the ZK circuit
cd circuits/liveness
nargo compile

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
NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=0x...
NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=0x...
NEXT_PUBLIC_STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_SEPOLIA_RPC_URL=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
```

### 3. Deploy contracts

```bash
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
4. Wait ~30s for the Barretenberg proof to generate in-browser
5. Confirm the transaction

### Claim (Beneficiary)

1. Visit `/claim`
2. Enter the vault commitment (shared by the owner off-band)
3. Wait for vault activation (or poll the dashboard)
4. Enter your claim key and recipient address
5. Submit the claim transaction

### Simulate Missed Check-ins (Testing)

```bash
export LIVENESS_REGISTRY=0x...
export NULLIFIER_HASH=0x...
bash scripts/simulate_missed.sh 3
```

---

## Security Notes

- **Identity backup is critical.** If you lose your `identity_secret` and `identity_nullifier`, you cannot generate check-in proofs and your vault will eventually activate.
- **Beneficiary confidentiality.** The beneficiary's claim key is stored on-chain as chunked field elements. Until a claim is submitted, their identity is not linked to the vault on-chain.
- **Smart contracts are unaudited.** Do not use on mainnet with significant funds before an independent audit.
- **Proof verification is MVP-grade.** The current on-chain verifier checks only the Merkle root match. Full Garaga integration is required for production security.

---

## Development

### Run tests

```bash
cd contracts
snforge test
```

### Generate a test proof (CLI)

```bash
bash scripts/generate_test_proof.sh
```

### Project structure

```
.
+-- circuits/liveness/         Noir ZK circuit
+-- contracts/src/             Cairo Starknet contracts
+-- contracts/tests/           snforge test suite
+-- frontend/src/              Next.js frontend
+-- scripts/                   Deployment and testing scripts
+-- CLAUDE.md                  AI developer guide
+-- README.md                  This file
```

---

## License

MIT. Built with Noir, Cairo, and Starknet.
