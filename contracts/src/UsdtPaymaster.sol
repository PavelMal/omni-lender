// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "account-abstraction/core/BasePaymaster.sol";
import "account-abstraction/interfaces/PackedUserOperation.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title UsdtPaymaster
 * @notice ERC-4337 Paymaster that sponsors gas and deducts cost from user's USDT allowance.
 *
 * Flow:
 * 1. User approves USDT to this paymaster address
 * 2. Agent creates UserOperation with paymasterAndData pointing here
 * 3. validatePaymasterUserOp checks user has sufficient USDT allowance
 * 4. postOp deducts actual gas cost (converted to USDT) from user via transferFrom
 *
 * Gas price oracle is simplified for Sepolia testnet — uses a fixed ETH/USDT rate.
 */
contract UsdtPaymaster is BasePaymaster {
    IERC20 public immutable usdt;

    /// @notice Fixed price: 1 ETH = pricePerEth USDT (6 decimals). E.g. 2000e6 = $2000
    uint256 public pricePerEth;

    /// @notice Markup on gas cost (basis points). 10000 = 100% = no markup. 11000 = 10% markup.
    uint256 public markup = 11000; // 10% markup

    event GasDeducted(address indexed user, uint256 actualGasCost, uint256 usdtCharged);
    event PriceUpdated(uint256 newPrice);

    constructor(
        IEntryPoint _entryPoint,
        address _owner,
        address _usdt,
        uint256 _pricePerEth
    ) BasePaymaster(_entryPoint, _owner) {
        usdt = IERC20(_usdt);
        pricePerEth = _pricePerEth;
    }

    /// @notice Owner can update ETH/USDT price
    function setPrice(uint256 _pricePerEth) external onlyOwner {
        pricePerEth = _pricePerEth;
        emit PriceUpdated(_pricePerEth);
    }

    /// @notice Owner can update markup
    function setMarkup(uint256 _markup) external onlyOwner {
        markup = _markup;
    }

    /**
     * @notice Validate that the user has enough USDT allowance to cover gas.
     * paymasterAndData layout: [paymaster address (20 bytes)]
     * (no extra data needed — we read allowance on-chain)
     */
    function _validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32, /* userOpHash */
        uint256 maxCost
    ) internal view override returns (bytes memory context, uint256 validationData) {
        address sender = userOp.sender;

        // Convert max gas cost (in wei) to USDT amount
        uint256 maxUsdtCost = _ethToUsdt(maxCost);

        // Check user has approved enough USDT
        uint256 allowed = usdt.allowance(sender, address(this));
        require(allowed >= maxUsdtCost, "UsdtPaymaster: insufficient USDT allowance");

        // Check user actually has the USDT
        uint256 balance = usdt.balanceOf(sender);
        require(balance >= maxUsdtCost, "UsdtPaymaster: insufficient USDT balance");

        // Pass sender in context for postOp
        context = abi.encode(sender);
        validationData = 0; // valid signature, no time restriction
    }

    /**
     * @notice After UserOp execution, deduct actual gas cost from user's USDT.
     */
    function _postOp(
        PostOpMode, /* mode */
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /* actualUserOpFeePerGas */
    ) internal override {
        address sender = abi.decode(context, (address));

        // Convert actual gas cost to USDT with markup
        uint256 usdtCost = (_ethToUsdt(actualGasCost) * markup) / 10000;

        // Minimum charge: 0.01 USDT (10000 raw = 6 decimals)
        if (usdtCost < 10000) usdtCost = 10000;

        // Transfer USDT from user to paymaster owner (revenue)
        bool success = usdt.transferFrom(sender, owner(), usdtCost);
        require(success, "UsdtPaymaster: USDT transfer failed");

        emit GasDeducted(sender, actualGasCost, usdtCost);
    }

    /// @notice Convert wei amount to USDT (6 decimals)
    function _ethToUsdt(uint256 weiAmount) internal view returns (uint256) {
        // weiAmount is in wei (18 decimals), pricePerEth is USDT per ETH (6 decimals)
        // result = weiAmount * pricePerEth / 1e18
        return (weiAmount * pricePerEth) / 1e18;
    }

    /// @notice View: estimate USDT cost for a given gas cost in wei
    function estimateUsdtCost(uint256 gasCostWei) external view returns (uint256) {
        return (_ethToUsdt(gasCostWei) * markup) / 10000;
    }
}
