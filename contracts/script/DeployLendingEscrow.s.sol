// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/LendingEscrow.sol";

/**
 * Deploy LendingEscrow to Sepolia.
 *
 * Usage:
 *   forge script script/DeployLendingEscrow.s.sol:DeployLendingEscrow \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast
 */
contract DeployLendingEscrow is Script {
    // Tether USDT on Sepolia
    address constant USDT = 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Agent = deployer (the OmniAgent operator wallet)
        LendingEscrow escrow = new LendingEscrow(USDT, deployer);

        vm.stopBroadcast();

        console.log("LendingEscrow deployed at:", address(escrow));
        console.log("Agent (owner):", deployer);
        console.log("USDT:", USDT);
        console.log("Collateral ratio:", escrow.collateralRatioBps(), "bps");
    }
}
