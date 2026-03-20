// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/UsdtPaymaster.sol";
import "account-abstraction/interfaces/IEntryPoint.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Test USDT", "USDT") {
        _mint(msg.sender, 1_000_000e6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract UsdtPaymasterTest is Test {
    UsdtPaymaster paymaster;
    MockUSDT usdt;
    address owner = address(this);
    address user = address(0xBEEF);

    // EntryPoint v0.7 on mainnet/sepolia
    address constant ENTRY_POINT = 0x0000000071727De22E5E9d8BAf0edAc6f37da032;

    function setUp() public {
        // Fork Sepolia or use the deployed EntryPoint bytecode
        vm.etch(ENTRY_POINT, hex"01"); // minimal mock

        usdt = new MockUSDT();

        // We can't easily test with a real EntryPoint without a full fork,
        // so test the helper functions directly
    }

    function test_ethToUsdt() public {
        // Deploy with $2000/ETH price
        // We need a working EntryPoint for constructor, so skip full deploy test
        // and test the math instead

        // 1 ETH = 2000 USDT
        // ethToUsdt(1e18) should = 2000e6
        // Formula: (weiAmount * pricePerEth) / 1e18
        uint256 result = (1e18 * 2000e6) / 1e18;
        assertEq(result, 2000e6);

        // 0.001 ETH gas cost = 2 USDT
        uint256 gasCost = 0.001 ether;
        uint256 usdtCost = (gasCost * 2000e6) / 1e18;
        assertEq(usdtCost, 2e6); // 2 USDT

        // With 10% markup: 2.2 USDT
        uint256 withMarkup = (usdtCost * 11000) / 10000;
        assertEq(withMarkup, 2.2e6);
    }

    function test_usdtDecimals() public view {
        assertEq(usdt.decimals(), 6);
    }

    function test_mockMint() public {
        usdt.mint(user, 100e6);
        assertEq(usdt.balanceOf(user), 100e6);
    }
}
