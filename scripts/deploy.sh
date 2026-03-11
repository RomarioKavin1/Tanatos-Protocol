#!/usr/bin/env bash
# deploy.sh — Deploy Thanatos Protocol contracts to Starknet Sepolia
#
# Prerequisites:
#   - starkli 0.4.2+  (starkli --version)
#   - scarb 2.12.2+   (scarb --version)
#   - A funded Starknet Sepolia account
#
# Setup:
#   starkli signer keystore new ~/.starkli/keystores/deployer.json
#   starkli account oz init ~/.starkli/accounts/deployer.json
#   starkli account deploy ~/.starkli/accounts/deployer.json
#   (Fund the account with Sepolia ETH from https://starknet-faucet.vercel.app)
#
# Usage:
#   export STARKNET_ACCOUNT=~/.starkli/accounts/deployer.json
#   export STARKNET_KEYSTORE=~/.starkli/keystores/deployer.json
#   bash scripts/deploy.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"

# ---------------------------------------------------------------------------
# Config (override via environment)
# ---------------------------------------------------------------------------
STARKNET_RPC="${STARKNET_RPC:-https://starknet-sepolia.public.blastapi.io/rpc/v0_7}"
STARKNET_ACCOUNT="${STARKNET_ACCOUNT:-$HOME/.starkli/accounts/deployer.json}"
STARKNET_KEYSTORE="${STARKNET_KEYSTORE:-$HOME/.starkli/keystores/deployer.json}"

# STRK token on Sepolia
STRK_TOKEN="${STRK_TOKEN:-0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d}"

# Garaga UltraHonk verifier on Sepolia (0x0 = MVP stub, proof not verified on-chain)
# To enable full ZK verification, deploy a Garaga verifier and set this address.
GARAGA_VERIFIER="${GARAGA_VERIFIER:-0x0}"

# Read deployer address from account file
DEPLOYER_ADDRESS="$(python3 -c "
import json, sys
with open('$STARKNET_ACCOUNT') as f:
    data = json.load(f)
addr = data.get('deployment', {}).get('address') or data.get('address', '0x0')
print(addr)
" 2>/dev/null || echo "0x0")"

OWNER="${OWNER:-$DEPLOYER_ADDRESS}"
FEE_COLLECTOR="${FEE_COLLECTOR:-$DEPLOYER_ADDRESS}"

ZERO_ADDRESS="0x0000000000000000000000000000000000000000000000000000000000000000"

STARKLI_OPTS=(
  --rpc "$STARKNET_RPC"
  --account "$STARKNET_ACCOUNT"
  --keystore "$STARKNET_KEYSTORE"
)

echo "=============================================="
echo "  Thanatos Protocol — Deployment Script"
echo "  Starknet Sepolia"
echo "=============================================="
echo "RPC:            $STARKNET_RPC"
echo "Account:        $STARKNET_ACCOUNT"
echo "Deployer:       $DEPLOYER_ADDRESS"
echo "Owner:          $OWNER"
echo "Fee Collector:  $FEE_COLLECTOR"
echo "Garaga:         $GARAGA_VERIFIER"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Build contracts
# ---------------------------------------------------------------------------
echo "[1/6] Building contracts with Scarb..."
cd "$CONTRACTS_DIR"
scarb build
cd "$PROJECT_ROOT"
echo "      Build complete."
echo ""

SIERRA_DIR="$CONTRACTS_DIR/target/dev"

# ---------------------------------------------------------------------------
# Helper: declare a contract class, return class hash
# ---------------------------------------------------------------------------
declare_contract() {
  local name="$1"
  local sierra_file="$SIERRA_DIR/thanatos_protocol_${name}.contract_class.json"

  if [ ! -f "$sierra_file" ]; then
    echo "ERROR: Sierra file not found: $sierra_file" >&2
    exit 1
  fi

  echo "      Declaring $name..." >&2

  # starkli declare prints "Class hash declared: 0x..." or "Not declaring class as it's already declared"
  local output
  output=$(starkli declare "${STARKLI_OPTS[@]}" "$sierra_file" --watch 2>&1)

  local class_hash
  class_hash=$(echo "$output" | grep -oE '0x[0-9a-fA-F]+' | tail -1)

  echo "      $name class hash: $class_hash" >&2
  echo "$class_hash"
}

# ---------------------------------------------------------------------------
# Step 2: Declare all contract classes
# ---------------------------------------------------------------------------
echo "[2/6] Declaring contract classes..."
KEEPER_CLASS=$(declare_contract "KeeperRegistry")
VAULT_CLASS=$(declare_contract "VaultController")
LIVENESS_CLASS=$(declare_contract "LivenessRegistry")
echo ""

# ---------------------------------------------------------------------------
# Step 3: Deploy KeeperRegistry (no dependencies)
# ---------------------------------------------------------------------------
echo "[3/6] Deploying KeeperRegistry..."
KEEPER_ADDR=$(starkli deploy "${STARKLI_OPTS[@]}" \
  "$KEEPER_CLASS" \
  "$STRK_TOKEN" \
  "$OWNER" \
  --watch 2>&1 | grep -oE '0x[0-9a-fA-F]{60,}' | head -1)
echo "      KeeperRegistry: $KEEPER_ADDR"
echo ""

# ---------------------------------------------------------------------------
# Step 4: Deploy VaultController with zero address for liveness_registry.
# We use set_registry() after LivenessRegistry is deployed to wire them up.
# This solves the circular deployment dependency cleanly.
# ---------------------------------------------------------------------------
echo "[4/6] Deploying VaultController (registry will be set in step 6)..."
VAULT_ADDR=$(starkli deploy "${STARKLI_OPTS[@]}" \
  "$VAULT_CLASS" \
  "$ZERO_ADDRESS" \
  "$OWNER" \
  "$FEE_COLLECTOR" \
  --watch 2>&1 | grep -oE '0x[0-9a-fA-F]{60,}' | head -1)
echo "      VaultController: $VAULT_ADDR"
echo ""

# ---------------------------------------------------------------------------
# Step 5: Deploy LivenessRegistry (needs VaultController address)
# ---------------------------------------------------------------------------
echo "[5/6] Deploying LivenessRegistry..."
LIVENESS_ADDR=$(starkli deploy "${STARKLI_OPTS[@]}" \
  "$LIVENESS_CLASS" \
  "$VAULT_ADDR" \
  "$GARAGA_VERIFIER" \
  "$OWNER" \
  --watch 2>&1 | grep -oE '0x[0-9a-fA-F]{60,}' | head -1)
echo "      LivenessRegistry: $LIVENESS_ADDR"
echo ""

# ---------------------------------------------------------------------------
# Step 6: Wire VaultController → LivenessRegistry via set_registry()
# This is a one-time owner-only call that sets the authorized activator address.
# ---------------------------------------------------------------------------
echo "[6/6] Wiring VaultController to LivenessRegistry..."
starkli invoke "${STARKLI_OPTS[@]}" \
  "$VAULT_ADDR" set_registry "$LIVENESS_ADDR" \
  --watch
echo "      VaultController.liveness_registry = $LIVENESS_ADDR"
echo ""

# ---------------------------------------------------------------------------
# Write .env.local for the frontend
# ---------------------------------------------------------------------------
ENV_FILE="$PROJECT_ROOT/frontend/.env.local"
cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=$LIVENESS_ADDR
NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=$VAULT_ADDR
NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=$KEEPER_ADDR
NEXT_PUBLIC_STRK_TOKEN_ADDRESS=$STRK_TOKEN
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_SEPOLIA_RPC_URL=$STARKNET_RPC
EOF
echo "Wrote $ENV_FILE"
echo ""

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo "=============================================="
echo "  DEPLOYMENT COMPLETE"
echo "=============================================="
echo ""
echo "  KeeperRegistry:   $KEEPER_ADDR"
echo "  VaultController:  $VAULT_ADDR"
echo "  LivenessRegistry: $LIVENESS_ADDR"
echo ""
echo "  frontend/.env.local has been written."
echo ""
echo "Next steps:"
echo "  1. cd frontend && bun install && bun dev"
echo "  2. Open http://localhost:3000 and connect your Argent X or Braavos wallet"
echo "  3. Go to /setup — generate identity, configure interval, deposit STRK"
echo "  4. Go to /checkin — generate and submit your first liveness proof"
echo "  5. To demo activation: export LIVENESS_REGISTRY=$LIVENESS_ADDR"
echo "     Then: bash scripts/simulate_missed.sh <nullifier_hash>"
echo ""
echo "  Verify contracts on Starkscan:"
echo "  https://sepolia.starkscan.co/contract/$LIVENESS_ADDR"
echo "  https://sepolia.starkscan.co/contract/$VAULT_ADDR"
