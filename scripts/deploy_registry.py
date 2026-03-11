#!/usr/bin/env python3
"""
Declare and deploy the new LivenessRegistry contract using starknet.py.
Handles the Cairo compiler CASM hash mismatch that affects starkli/sncast.

Usage:
    python3 scripts/deploy_registry.py

Requires:
    pip install starknet-py
"""

import asyncio
import json
import sys
from pathlib import Path

from starknet_py.net.account.account import Account
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.signer.stark_curve_signer import KeyPair, StarkCurveSigner
from starknet_py.net.models import StarknetChainId
from starknet_py.net.models.transaction import DeclareV3
from starknet_py.contract import Contract
from starknet_py.hash.casm_class_hash import compute_casm_class_hash
from starknet_py.hash.class_hash import compute_class_hash
from starknet_py.common import create_compiled_contract, create_sierra_compiled_contract

PROJECT_ROOT = Path(__file__).parent.parent

# ─── Config ───────────────────────────────────────────────────────────────────
RPC_URL = "https://rpc.starknet-testnet.lava.build"
KEYSTORE_PATH = Path.home() / "Documents/stark_keystore/a"
ACCOUNT_PATH  = Path.home() / "Documents/stark_keystore/account"
KEYSTORE_PASSWORD = ""  # empty password

# Already-deployed contracts (don't redeploy)
VAULT_CONTROLLER  = 0x00bc6078749b2078604b0aa03ff05e68fa700045dd70152134cf5e8181752ac4
GARAGA_VERIFIER   = 0x119174a06b0da1aaf3a4f497145d6f97e56e4aa4c917a0fbb69253b79a49750

SIERRA_PATH = PROJECT_ROOT / "contracts/target/dev/thanatos_protocol_LivenessRegistry.contract_class.json"
CASM_PATH   = PROJECT_ROOT / "contracts/target/dev/thanatos_protocol_LivenessRegistry.compiled_contract_class.json"
ENV_LOCAL   = PROJECT_ROOT / "frontend/.env.local"
# ──────────────────────────────────────────────────────────────────────────────


def load_private_key_from_keystore(keystore_path: Path, password: str) -> int:
    """Decrypt an encrypted JSON keystore (Ethereum/Starknet format) to get the private key."""
    from eth_keyfile import decode_keyfile_json
    with open(keystore_path) as f:
        keystore = json.load(f)
    private_key_bytes = decode_keyfile_json(keystore, password.encode())
    return int.from_bytes(private_key_bytes, "big")


async def main():
    print("=" * 54)
    print("  LivenessRegistry — Declare + Deploy")
    print("=" * 54)

    # ── Load account ──────────────────────────────────────────
    with open(ACCOUNT_PATH) as f:
        account_data = json.load(f)
    account_address = int(account_data["deployment"]["address"], 16)
    print(f"Account:  0x{account_address:064x}")

    private_key = load_private_key_from_keystore(KEYSTORE_PATH, KEYSTORE_PASSWORD)
    key_pair = KeyPair.from_private_key(private_key)
    print(f"Pubkey:   0x{key_pair.public_key:064x}")

    # ── Client + Account ──────────────────────────────────────
    client = FullNodeClient(node_url=RPC_URL)
    signer = StarkCurveSigner(account_address, key_pair, StarknetChainId.SEPOLIA)
    account = Account(
        address=account_address,
        client=client,
        signer=signer,
        chain=StarknetChainId.SEPOLIA,
    )

    # ── Load compiled contract ────────────────────────────────
    print("\n[1/3] Loading compiled contract...")
    with open(SIERRA_PATH) as f:
        sierra_json = json.load(f)
    with open(CASM_PATH) as f:
        casm_json = json.load(f)

    # ── Declare ───────────────────────────────────────────────
    print("[2/3] Declaring LivenessRegistry...")
    declare_result = await Contract.declare_v3(
        account=account,
        compiled_contract=json.dumps(sierra_json),
        compiled_contract_casm=json.dumps(casm_json),
        auto_estimate=True,
    )
    print(f"      Declare tx: 0x{declare_result.hash:064x}")
    print("      Waiting for confirmation...")
    await declare_result.wait_for_acceptance()
    class_hash = declare_result.class_hash
    print(f"      Class hash: 0x{class_hash:064x}")

    # ── Deploy ────────────────────────────────────────────────
    print("\n[3/3] Deploying LivenessRegistry...")
    owner = account_address
    deploy_result = await declare_result.deploy_v3(
        constructor_args=[VAULT_CONTROLLER, GARAGA_VERIFIER, owner],
        auto_estimate=True,
    )
    print(f"      Deploy tx: 0x{deploy_result.hash:064x}")
    print("      Waiting for confirmation...")
    await deploy_result.wait_for_acceptance()
    registry_address = deploy_result.deployed_contract.address
    print(f"      LivenessRegistry: 0x{registry_address:064x}")

    # ── Update .env.local ─────────────────────────────────────
    addr_hex = f"0x{registry_address:064x}"
    if ENV_LOCAL.exists():
        text = ENV_LOCAL.read_text()
        import re
        text = re.sub(
            r"^NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS=.*$",
            f"NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS={addr_hex}",
            text, flags=re.MULTILINE,
        )
        ENV_LOCAL.write_text(text)
        print(f"\nUpdated {ENV_LOCAL}")
    else:
        ENV_LOCAL.write_text(
            f"NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS={addr_hex}\n"
            f"NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS=0x{VAULT_CONTROLLER:064x}\n"
            "NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS=0x002aaaf4d8371672a7432111c087eea44872d0aaa7ef05009807bdba6af07142\n"
            "NEXT_PUBLIC_STRK_TOKEN_ADDRESS=0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d\n"
            "NEXT_PUBLIC_NETWORK=sepolia\n"
            f"NEXT_PUBLIC_SEPOLIA_RPC_URL={RPC_URL}\n"
        )
        print(f"\nCreated {ENV_LOCAL}")

    print("\n" + "=" * 54)
    print("  DONE")
    print(f"  LivenessRegistry: {addr_hex}")
    print(f"  https://sepolia.starkscan.co/contract/{addr_hex}")
    print("=" * 54)
    print("\nNOTE: Run set_registry on VaultController if needed:")
    print(f"  VaultController.set_registry({addr_hex})")


if __name__ == "__main__":
    asyncio.run(main())
