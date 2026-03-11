#!/usr/bin/env bash
# redeploy_registry.sh — Redeploy only LivenessRegistry with new ABI
#
# Use this when only the LivenessRegistry contract has changed.
# KeeperRegistry and VaultController are left untouched.
#
# Setup (one-time):
#   starkli signer keystore new ~/.starkli/keystores/deployer.json
#   starkli account oz init ~/.starkli/accounts/deployer.json
#   starkli account deploy ~/.starkli/accounts/deployer.json
#   (Fund with Sepolia ETH from https://starknet-faucet.vercel.app)
#
# Usage:
#   export STARKNET_ACCOUNT=~/.starkli/accounts/deployer.json
#   export STARKNET_KEYSTORE=~/.starkli/keystores/deployer.json
#   export VAULT_CONTROLLER=0x00bc6078749b2078604b0aa03ff05e68fa700045dd70152134cf5e8181752ac4
#   export GARAGA_VERIFIER=0x119174a06b0da1aaf3a4f497145d6f97e56e4aa4c917a0fbb69253b79a49750
#   bash scripts/redeploy_registry.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$PROJECT_ROOT/contracts"

STARKNET_RPC="${STARKNET_RPC:-https://rpc.starknet-testnet.lava.build}"
STARKNET_ACCOUNT="${STARKNET_ACCOUNT:-$HOME/.starkli/accounts/deployer.json}"
STARKNET_KEYSTORE="${STARKNET_KEYSTORE:-$HOME/.starkli/keystores/deployer.json}"

# Existing deployed contracts (already live on Sepolia)
VAULT_CONTROLLER="${VAULT_CONTROLLER:-0x00bc6078749b2078604b0aa03ff05e68fa700045dd70152134cf5e8181752ac4}"
GARAGA_VERIFIER="${GARAGA_VERIFIER:-0x119174a06b0da1aaf3a4f497145d6f97e56e4aa4c917a0fbb69253b79a49750}"

DEPLOYER_ADDRESS="$(python3 -c "
import json
with open('$STARKNET_ACCOUNT') as f:
    data = json.load(f)
addr = data.get('deployment', {}).get('address') or data.get('address', '0x0')
print(addr)
" 2>/dev/null || echo "0x0")"

OWNER="${OWNER:-$DEPLOYER_ADDRESS}"

STARKLI_OPTS=(
  --rpc "$STARKNET_RPC"
  --account "$STARKNET_ACCOUNT"
  --keystore "$STARKNET_KEYSTORE"
)

echo "=============================================="
echo "  Redeploy LivenessRegistry"
echo "  Starknet Sepolia"
echo "=============================================="
echo "RPC:             $STARKNET_RPC"
echo "Deployer:        $DEPLOYER_ADDRESS"
echo "Owner:           $OWNER"
echo "VaultController: $VAULT_CONTROLLER"
echo "GaragaVerifier:  $GARAGA_VERIFIER"
echo ""

# Build
echo "[1/4] Building contracts..."
cd "$CONTRACTS_DIR" && scarb build && cd "$PROJECT_ROOT"
echo "      Build complete."
echo ""

SIERRA="$CONTRACTS_DIR/target/dev/thanatos_protocol_LivenessRegistry.contract_class.json"

# Declare
echo "[2/4] Declaring LivenessRegistry..."
DECLARE_OUT=$(starkli declare "${STARKLI_OPTS[@]}" "$SIERRA" --watch 2>&1)
LIVENESS_CLASS=$(echo "$DECLARE_OUT" | grep -oE '0x[0-9a-fA-F]+' | tail -1)
echo "      Class hash: $LIVENESS_CLASS"
echo ""

# Deploy
echo "[3/4] Deploying LivenessRegistry..."
LIVENESS_ADDR=$(starkli deploy "${STARKLI_OPTS[@]}" \
  "$LIVENESS_CLASS" \
  "$VAULT_CONTROLLER" \
  "$GARAGA_VERIFIER" \
  "$OWNER" \
  --watch 2>&1 | grep -oE '0x[0-9a-fA-F]{60,}' | head -1)
echo "      LivenessRegistry: $LIVENESS_ADDR"
echo ""

# Wire VaultController → new LivenessRegistry
echo "[4/4] Updating VaultController.set_registry()..."
starkli invoke "${STARKLI_OPTS[@]}" \
  "$VAULT_CONTROLLER" set_registry "$LIVENESS_ADDR" \
  --watch
echo "      VaultController now points to: $LIVENESS_ADDR"
echo ""

# Update .env.local
ENV_FILE="$PROJECT_ROOT/frontend/.env.local"
if [ -f "$ENV_FILE" ]; then
  # Replace existing LIVENESS_REGISTRY line
  sed -i.bak "s|^NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=.*|NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=$LIVENESS_ADDR|" "$ENV_FILE"
  rm -f "$ENV_FILE.bak"
  echo "Updated $ENV_FILE"
else
  cat > "$ENV_FILE" <<EOF
NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=$LIVENESS_ADDR
NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=$VAULT_CONTROLLER
NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=0x002aaaf4d8371672a7432111c087eea44872d0aaa7ef05009807bdba6af07142
NEXT_PUBLIC_STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d
NEXT_PUBLIC_NETWORK=sepolia
NEXT_PUBLIC_SEPOLIA_RPC_URL=$STARKNET_RPC
EOF
  echo "Wrote $ENV_FILE"
fi
echo ""

echo "=============================================="
echo "  DONE — LivenessRegistry redeployed"
echo "  $LIVENESS_ADDR"
echo "  https://sepolia.starkscan.co/contract/$LIVENESS_ADDR"
echo "=============================================="
