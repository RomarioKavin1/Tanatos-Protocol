#!/usr/bin/env bash
# generate_test_proof.sh — Generate a test liveness proof with nargo
#
# This script:
#   1. Creates a Prover.toml with test inputs
#   2. Runs nargo execute to get the witness
#   3. (Optionally) runs nargo prove to generate the full proof
#
# Usage:
#   bash scripts/generate_test_proof.sh [--prove]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CIRCUIT_DIR="$PROJECT_ROOT/circuits/liveness"

PROVE_FLAG="${1:-}"

echo "=============================================="
echo "  Thanatos Protocol — Test Proof Generator"
echo "=============================================="
echo "Circuit dir: $CIRCUIT_DIR"
echo ""

cd "$CIRCUIT_DIR"

# ---------------------------------------------------------------------------
# Compute expected public inputs using Python (Poseidon2 approximation)
# For real values, use the actual Poseidon2 implementation.
# Here we use simple field arithmetic placeholders for demonstration.
# ---------------------------------------------------------------------------

# Test identity
IDENTITY_SECRET="0x0000000000000000000000000000000000000000000000000000000075bcd15"   # 123456789
IDENTITY_NULLIFIER="0x000000000000000000000000000000000000000000000000000000003ade68b1" # 987654321

# Epoch = 1 (test epoch)
EPOCH="0x0000000000000000000000000000000000000000000000000000000000000001"

# For a real proof, the root must match the Merkle tree containing the identity commitment.
# For this test, we use an all-zero Merkle path, which means the computed root will be
# the hash of all zeros bubbled up 20 levels. We precompute this value here.
#
# In a real workflow:
#   1. Register on-chain (which computes and stores the root)
#   2. Query the root from the contract
#   3. Get the Merkle path from an indexer
#   4. Pass the real root and path here

# Placeholder root (replace with actual on-chain root after registration)
ROOT="0x0000000000000000000000000000000000000000000000000000000000000000"

# Placeholder hashes — replace with actual Poseidon2 outputs
# nullifier_hash = Poseidon2(identity_nullifier, epoch)
# signal_hash    = Poseidon2(epoch)
NULLIFIER_HASH="0x0000000000000000000000000000000000000000000000000000000000000000"
SIGNAL_HASH="0x0000000000000000000000000000000000000000000000000000000000000000"

# ---------------------------------------------------------------------------
# Generate Prover.toml
# ---------------------------------------------------------------------------
echo "Generating Prover.toml with test inputs..."

cat > "$CIRCUIT_DIR/Prover.toml" << EOF
# Test inputs for Thanatos Protocol liveness proof
# These are NOT valid proof inputs — they demonstrate the format.
# For a valid proof, compute the correct hashes using Poseidon2.

identity_secret = "$IDENTITY_SECRET"
identity_nullifier = "$IDENTITY_NULLIFIER"

# 20-level Merkle path (all zeros = empty tree)
merkle_path = [
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x0000000000000000000000000000000000000000000000000000000000000000",
]

# All left children (index = 0 means current node is left child)
merkle_indices = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

# Public inputs (these must match circuit assertions)
root = "$ROOT"
nullifier_hash = "$NULLIFIER_HASH"
signal_hash = "$SIGNAL_HASH"
epoch = "$EPOCH"
EOF

echo "  Prover.toml written."
echo ""

# ---------------------------------------------------------------------------
# Run nargo execute (generate witness)
# ---------------------------------------------------------------------------
echo "Running nargo execute..."
echo ""
echo "NOTE: This will fail if the public inputs don't satisfy the circuit constraints."
echo "      Use real Poseidon2 hashes for a valid witness."
echo ""

if nargo execute 2>&1; then
  echo ""
  echo "Witness generated successfully."

  # Optionally generate full proof
  if [ "$PROVE_FLAG" = "--prove" ]; then
    echo ""
    echo "Generating full proof with nargo prove..."
    nargo prove
    echo ""
    echo "Proof generated: target/liveness.proof"
    echo ""
    echo "Copy the compiled artifact for the frontend:"
    echo "  cp target/liveness.json $PROJECT_ROOT/frontend/public/circuits/liveness.json"
  else
    echo ""
    echo "To generate a full proof, run:"
    echo "  bash scripts/generate_test_proof.sh --prove"
    echo ""
    echo "To use the compiled circuit in the frontend:"
    echo "  mkdir -p $PROJECT_ROOT/frontend/public/circuits"
    echo "  cp target/liveness.json $PROJECT_ROOT/frontend/public/circuits/liveness.json"
  fi
else
  echo ""
  echo "Witness generation failed (expected with placeholder inputs)."
  echo "This is normal — the Prover.toml contains placeholder values."
  echo ""
  echo "To generate a valid proof:"
  echo "  1. Register an identity on-chain to get the group root"
  echo "  2. Compute Poseidon2(nullifier, epoch) for nullifier_hash"
  echo "  3. Compute Poseidon2(epoch) for signal_hash"
  echo "  4. Compute the Merkle path from the group tree"
  echo "  5. Update Prover.toml with real values"
  echo "  6. Run: nargo execute && nargo prove"
fi

echo ""
echo "Circuit artifact location: $CIRCUIT_DIR/target/liveness.json"
echo "Frontend circuits dir:     $PROJECT_ROOT/frontend/public/circuits/"
