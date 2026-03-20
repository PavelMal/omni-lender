// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/UsdtPaymaster.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";

/**
 * Deploy UsdtPaymaster to Sepolia.
 *
 * Usage:
 *   forge script script/DeployPaymaster.s.sol:DeployPaymaster \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast
 */
contract DeployPaymaster is Script {
    // ERC-4337 EntryPoint v0.7 on Sepolia
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;
    // Tether USDT on Sepolia
    address constant USDT = 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0;
    // Initial ETH/USDT price: $2000 (6 decimals)
    uint256 constant INITIAL_PRICE = 2000e6;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        UsdtPaymaster paymaster = new UsdtPaymaster(
            IEntryPoint(ENTRY_POINT),
            deployer,   // owner
            USDT,
            INITIAL_PRICE
        );

        // Stake ETH in EntryPoint so paymaster can sponsor ops
        // Minimum stake varies by bundler; 0.01 ETH is typically enough for testnet
        IEntryPoint(ENTRY_POINT).depositTo{value: 0.01 ether}(address(paymaster));

        vm.stopBroadcast();

        console.log("UsdtPaymaster deployed at:", address(paymaster));
        console.log("Owner:", deployer);
        console.log("EntryPoint:", ENTRY_POINT);
        console.log("USDT:", USDT);
    }
}
