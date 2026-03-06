#!/usr/bin/env bash
# simulate_missed.sh — Simulate missed check-ins for testing Thanatos Protocol
#
# This script calls report_missed on the LivenessRegistry for a given nullifier_hash.
# It can be called repeatedly to simulate N consecutive missed check-ins and
# trigger vault activation.
#
# Usage:
#   export STARKNET_RPC=https://starknet-sepolia.public.blastapi.io/rpc/v0_7
#   export STARKNET_ACCOUNT=~/.starkli/accounts/deployer.json
#   export STARKNET_KEYSTORE=~/.starkli/keystores/deployer.json
#   export LIVENESS_REGISTRY=0x...
#   export NULLIFIER_HASH=0x...
#   bash scripts/simulate_missed.sh [num_reports]

set -euo pipefail

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
STARKNET_RPC="${STARKNET_RPC:-https://starknet-sepolia.public.blastapi.io/rpc/v0_7}"
STARKNET_ACCOUNT="${STARKNET_ACCOUNT:-$HOME/.starkli/accounts/deployer.json}"
STARKNET_KEYSTORE="${STARKNET_KEYSTORE:-$HOME/.starkli/keystores/deployer.json}"
LIVENESS_REGISTRY="${LIVENESS_REGISTRY:-}"
NULLIFIER_HASH="${NULLIFIER_HASH:-}"

NUM_REPORTS="${1:-3}"

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------
if [ -z "$LIVENESS_REGISTRY" ]; then
  echo "ERROR: LIVENESS_REGISTRY environment variable is not set."
  echo "Usage: LIVENESS_REGISTRY=0x... NULLIFIER_HASH=0x... bash scripts/simulate_missed.sh [n]"
  exit 1
fi

if [ -z "$NULLIFIER_HASH" ]; then
  echo "ERROR: NULLIFIER_HASH environment variable is not set."
  exit 1
fi

echo "=============================================="
echo "  Simulate Missed Check-ins"
echo "=============================================="
echo "Registry:      $LIVENESS_REGISTRY"
echo "Nullifier:     $NULLIFIER_HASH"
echo "Reports:       $NUM_REPORTS"
echo "Network RPC:   $STARKNET_RPC"
echo ""

STARKLI_OPTS=(
  --rpc "$STARKNET_RPC"
  --account "$STARKNET_ACCOUNT"
  --keystore "$STARKNET_KEYSTORE"
)

# ---------------------------------------------------------------------------
# Query current state
# ---------------------------------------------------------------------------
echo "Current state:"
MISSED_COUNT=$(starkli call \
  --rpc "$STARKNET_RPC" \
  "$LIVENESS_REGISTRY" \
  get_missed_count \
  "$NULLIFIER_HASH" 2>/dev/null | tr -d '[]" \n' || echo "0")
echo "  Current missed count: $MISSED_COUNT"

LAST_CHECKIN=$(starkli call \
  --rpc "$STARKNET_RPC" \
  "$LIVENESS_REGISTRY" \
  get_last_checkin \
  "$NULLIFIER_HASH" 2>/dev/null | tr -d '[]" \n' || echo "0")
echo "  Last check-in timestamp: $LAST_CHECKIN"
echo ""

# ---------------------------------------------------------------------------
# Submit report_missed N times
# ---------------------------------------------------------------------------
for i in $(seq 1 "$NUM_REPORTS"); do
  echo "Submitting report_missed ($i/$NUM_REPORTS)..."
  TX=$(starkli invoke "${STARKLI_OPTS[@]}" \
    "$LIVENESS_REGISTRY" \
    report_missed \
    "$NULLIFIER_HASH" \
    --watch 2>&1 | grep "Transaction hash:" | awk '{print $NF}')

  if [ -n "$TX" ]; then
    echo "  TX: $TX"
    echo "  https://sepolia.starkscan.co/tx/$TX"
  else
    echo "  Transaction submitted (check Starkscan for status)."
  fi

  # Query updated state
  NEW_MISSED=$(starkli call \
    --rpc "$STARKNET_RPC" \
    "$LIVENESS_REGISTRY" \
    get_missed_count \
    "$NULLIFIER_HASH" 2>/dev/null | tr -d '[]" \n' || echo "?")
  echo "  New missed count: $NEW_MISSED"

  if [ "$i" -lt "$NUM_REPORTS" ]; then
    echo "  Waiting 3 seconds before next report..."
    sleep 3
  fi
done

echo ""
echo "Done. Submitted $NUM_REPORTS report(s)."
echo ""
echo "If missed count reached 3, the vault should now be activated."
echo "Check vault status:"
echo "  starkli call --rpc $STARKNET_RPC <VAULT_CONTROLLER> is_activated <VAULT_COMMITMENT>"
