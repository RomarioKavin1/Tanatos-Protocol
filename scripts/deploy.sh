#!/usr/bin/env bash
# deploy.sh — Deploy Thanatos Protocol contracts to Starknet Sepolia
#
# Prerequisites:
#   - starkli 0.4.2+  (starkli --version)
#   - scarb 2.12.2+   (scarb --version)
#   - A funded Starknet Sepolia account (set via STARKNET_ACCOUNT and STARKNET_KEYSTORE)
#
# Usage:
#   export STARKNET_ACCOUNT=~/.starkli/accounts/deployer.json
#   export STARKNET_KEYSTORE=~/.starkli/keystores/deployer.json
#   export STARKNET_RPC=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
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

# Token addresses on Sepolia
STRK_TOKEN="${STRK_TOKEN:-0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d}"

# Placeholder: owner and fee collector defaults to deployer address
DEPLOYER_ADDRESS="$(starkli account fetch --output /dev/stdout "$STARKNET_ACCOUNT" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin)['deployment']['address'])" 2>/dev/null || echo "0x0")"
OWNER="${OWNER:-$DEPLOYER_ADDRESS}"
FEE_COLLECTOR="${FEE_COLLECTOR:-$DEPLOYER_ADDRESS}"

# Garaga verifier — set to zero address for MVP (proof validation skipped)
GARAGA_VERIFIER="${GARAGA_VERIFIER:-0x0}"

echo "=============================================="
echo "  Thanatos Protocol — Deployment Script"
echo "=============================================="
echo "Network:       Starknet Sepolia"
echo "RPC:           $STARKNET_RPC"
echo "Account:       $STARKNET_ACCOUNT"
echo "Owner:         $OWNER"
echo "Fee Collector: $FEE_COLLECTOR"
echo ""

# ---------------------------------------------------------------------------
# Step 1: Build contracts
# ---------------------------------------------------------------------------
echo "[1/5] Building contracts with Scarb..."
cd "$CONTRACTS_DIR"
scarb build
echo "      Build complete."
echo ""

SIERRA_DIR="$CONTRACTS_DIR/target/dev"

# ---------------------------------------------------------------------------
# Step 2: Declare contract classes
# ---------------------------------------------------------------------------
echo "[2/5] Declaring contract classes on Sepolia..."

STARKLI_OPTS=(
  --rpc "$STARKNET_RPC"
  --account "$STARKNET_ACCOUNT"
  --keystore "$STARKNET_KEYSTORE"
)

declare_contract() {
  local name="$1"
  local sierra_file="$SIERRA_DIR/thanatos_protocol_${name}.contract_class.json"

  if [ ! -f "$sierra_file" ]; then
    echo "ERROR: Sierra file not found: $sierra_file"
    exit 1
  fi

  echo "      Declaring $name..."
  local class_hash
  class_hash=$(starkli declare "${STARKLI_OPTS[@]}" "$sierra_file" --watch 2>&1 | grep "Class hash declared:" | awk '{print $NF}')
  echo "      $name class hash: $class_hash"
  echo "$class_hash"
}

LIVENESS_CLASS=$(declare_contract "LivenessRegistry")
VAULT_CLASS=$(declare_contract "VaultController")
KEEPER_CLASS=$(declare_contract "KeeperRegistry")

echo ""

# ---------------------------------------------------------------------------
# Step 3: Deploy KeeperRegistry (no deps)
# ---------------------------------------------------------------------------
echo "[3/5] Deploying KeeperRegistry..."
KEEPER_ADDR=$(starkli deploy "${STARKLI_OPTS[@]}" \
  "$KEEPER_CLASS" \
  "$STRK_TOKEN" \
  "$OWNER" \
  --watch 2>&1 | grep "Contract deployed:" | awk '{print $NF}')
echo "      KeeperRegistry: $KEEPER_ADDR"
echo ""

# ---------------------------------------------------------------------------
# Step 4: Deploy VaultController (needs LivenessRegistry address — deploy placeholder first)
# We deploy with the owner address as placeholder for liveness_registry,
# then the LivenessRegistry will be set after deployment.
#
# For a cleaner flow, we deploy VaultController with a predicted LivenessRegistry address.
# Since starkli deploy is deterministic given the same salt, we use salt=0 for LivenessRegistry.
# ---------------------------------------------------------------------------
echo "[4/5] Deploying VaultController (with owner as placeholder for registry)..."
# We'll pass OWNER as placeholder; a proper setup would use a factory/initializer pattern.
VAULT_ADDR=$(starkli deploy "${STARKLI_OPTS[@]}" \
  "$VAULT_CLASS" \
  "$OWNER" \
  "$OWNER" \
  "$FEE_COLLECTOR" \
  --watch 2>&1 | grep "Contract deployed:" | awk '{print $NF}')
echo "      VaultController: $VAULT_ADDR"
echo ""

# ---------------------------------------------------------------------------
# Step 5: Deploy LivenessRegistry
# ---------------------------------------------------------------------------
echo "[5/5] Deploying LivenessRegistry..."
LIVENESS_ADDR=$(starkli deploy "${STARKLI_OPTS[@]}" \
  "$LIVENESS_CLASS" \
  "$VAULT_ADDR" \
  "$GARAGA_VERIFIER" \
  "$OWNER" \
  --watch 2>&1 | grep "Contract deployed:" | awk '{print $NF}')
echo "      LivenessRegistry: $LIVENESS_ADDR"
echo ""

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
echo "=============================================="
echo "  DEPLOYMENT COMPLETE"
echo "=============================================="
echo ""
echo "Contract Addresses:"
echo "  LIVENESS_REGISTRY:   $LIVENESS_ADDR"
echo "  VAULT_CONTROLLER:    $VAULT_ADDR"
echo "  KEEPER_REGISTRY:     $KEEPER_ADDR"
echo ""
echo "Add these to your frontend/.env.local:"
echo ""
echo "NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=$LIVENESS_ADDR"
echo "NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=$VAULT_ADDR"
echo "NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=$KEEPER_ADDR"
echo "NEXT_PUBLIC_STRK_TOKEN_ADDRESS=$STRK_TOKEN"
echo "NEXT_PUBLIC_NETWORK=sepolia"
echo ""
echo "NOTE: The VaultController was deployed with owner as the registry placeholder."
echo "In production, redeploy VaultController with the LivenessRegistry address:"
echo "  VAULT_CONTROLLER_LIVENESS_REGISTRY=$LIVENESS_ADDR"
