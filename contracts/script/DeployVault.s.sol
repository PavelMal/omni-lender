// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/SimpleYieldVault.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Deploy SimpleYieldVault to Sepolia.
 *
 * Usage:
 *   forge script script/DeployVault.s.sol:DeployVault \
 *     --rpc-url $SEPOLIA_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast
 */
contract DeployVault is Script {
    address constant USDT = 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        SimpleYieldVault vault = new SimpleYieldVault(IERC20(USDT), deployer);

        vm.stopBroadcast();

        console.log("SimpleYieldVault deployed at:", address(vault));
        console.log("Owner:", deployer);
        console.log("Underlying:", USDT);
        console.log("Share token: svUSDT");
    }
}
