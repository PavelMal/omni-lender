// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/SimpleYieldVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockUSDT2 is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract SimpleYieldVaultTest is Test {
    SimpleYieldVault vault;
    MockUSDT2 usdt;
    address user;
    address owner;

    function setUp() public {
        user = makeAddr("user");
        owner = makeAddr("owner");
        usdt = new MockUSDT2();
        vault = new SimpleYieldVault(IERC20(address(usdt)), owner);

        usdt.mint(user, 1000e6);
        usdt.mint(owner, 1000e6);
    }

    function test_depositAndWithdraw() public {
        // User deposits 100 USDT
        vm.startPrank(user);
        usdt.approve(address(vault), 100e6);
        uint256 shares = vault.deposit(100e6, user);
        vm.stopPrank();

        assertEq(shares, 100e6);
        assertEq(vault.balanceOf(user), 100e6);
        assertEq(vault.totalAssets(), 100e6);

        // User withdraws all
        vm.startPrank(user);
        vault.withdraw(100e6, user, user);
        vm.stopPrank();

        assertEq(usdt.balanceOf(user), 1000e6); // back to original
        assertEq(vault.totalAssets(), 0);
    }

    function test_yieldAccrual() public {
        // User deposits 100 USDT
        vm.startPrank(user);
        usdt.approve(address(vault), 100e6);
        vault.deposit(100e6, user);
        vm.stopPrank();

        // Owner drips 10 USDT yield into vault
        vm.startPrank(owner);
        usdt.transfer(address(vault), 10e6);
        vm.stopPrank();

        // Vault now has 110 USDT, user owns all shares
        assertEq(vault.totalAssets(), 110e6);

        // User redeems all shares — gets 110 USDT (100 + 10 yield)
        vm.startPrank(user);
        vault.redeem(vault.balanceOf(user), user, user);
        vm.stopPrank();

        assertApproxEqAbs(usdt.balanceOf(user), 1010e6, 1); // rounding tolerance 1 wei
    }

    function test_erc4626Interface() public view {
        assertEq(vault.asset(), address(usdt));
        assertEq(vault.decimals(), 6);
        assertEq(vault.name(), "Simple Vault USDT");
        assertEq(vault.symbol(), "svUSDT");
    }
}
