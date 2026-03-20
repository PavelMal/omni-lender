// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

/**
 * @title SimpleYieldVault
 * @notice ERC-4626 vault that accepts USDT deposits and accrues yield.
 *         Owner can drip yield by sending USDT directly to the vault.
 *
 * For the hackathon demo: agents deposit USDT, receive vault shares (svUSDT).
 * The share price increases as yield is added, so withdrawals return more than deposited.
 *
 * This is a real ERC-4626 vault — any agent with our universal adapter can interact with it.
 */
contract SimpleYieldVault is ERC4626 {
    address public immutable owner;

    constructor(
        IERC20 _usdt,
        address _owner
    )
        ERC20("Simple Vault USDT", "svUSDT")
        ERC4626(_usdt)
    {
        owner = _owner;
    }

    /// @notice Owner can add yield by simply transferring USDT to this contract.
    /// The totalAssets increases, making each share worth more USDT.
    /// No special function needed — ERC4626.totalAssets() reads balanceOf(this).

    /// @notice Decimals match underlying (USDT = 6)
    function decimals() public pure override(ERC4626) returns (uint8) {
        return 6;
    }
}
