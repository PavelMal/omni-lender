// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/LendingEscrow.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Simple mock ERC20 for testing
contract MockUSDT is ERC20 {
    constructor() ERC20("Mock USDT", "USDT") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract LendingEscrowTest is Test {
    LendingEscrow escrow;
    MockUSDT usdt;

    address agent;
    address borrower;

    function setUp() public {
        agent = makeAddr("agent");
        borrower = makeAddr("borrower");
        usdt = new MockUSDT();
        escrow = new LendingEscrow(address(usdt), agent);

        // Fund agent with USDT for loan disbursement
        usdt.mint(agent, 10000e6);
        // Fund borrower with USDT for repayment
        usdt.mint(borrower, 10000e6);
        // Fund borrower with ETH for collateral
        vm.deal(borrower, 1 ether);
    }

    function test_fullLoanCycle() public {
        // Step 1: Borrower deposits collateral
        vm.prank(borrower);
        escrow.depositCollateral{value: 0.1 ether}();
        assertEq(escrow.pendingCollateral(borrower), 0.1 ether);

        // Step 2: Agent approves loan ($100 USDT, $5 interest, 7 days)
        vm.startPrank(agent);
        usdt.approve(address(escrow), 100e6);
        escrow.approveLoan(borrower, 0.1 ether, 100e6, 5e6, 7 days);
        vm.stopPrank();

        // Verify loan state
        assertEq(usdt.balanceOf(borrower), 10100e6); // received $100
        assertEq(escrow.pendingCollateral(borrower), 0); // collateral locked

        // Step 3: Borrower repays
        vm.startPrank(borrower);
        usdt.approve(address(escrow), 105e6);
        uint256 ethBefore = borrower.balance;
        escrow.repayLoan(0);
        vm.stopPrank();

        // Verify repayment
        assertEq(borrower.balance, ethBefore + 0.1 ether); // collateral returned
        assertEq(usdt.balanceOf(agent), 10000e6 - 100e6 + 105e6); // agent got principal + interest
    }

    function test_liquidation() public {
        // Deposit + approve
        vm.prank(borrower);
        escrow.depositCollateral{value: 0.1 ether}();

        vm.startPrank(agent);
        usdt.approve(address(escrow), 100e6);
        escrow.approveLoan(borrower, 0.1 ether, 100e6, 5e6, 1 days);
        vm.stopPrank();

        // Cannot liquidate before due
        vm.prank(agent);
        vm.expectRevert("Loan not overdue");
        escrow.liquidate(0);

        // Warp past due date
        vm.warp(block.timestamp + 1 days + 1);

        // Agent liquidates
        uint256 agentEthBefore = agent.balance;
        vm.prank(agent);
        escrow.liquidate(0);

        // Agent got collateral
        assertEq(agent.balance, agentEthBefore + 0.1 ether);

        // Loan is no longer active
        assertTrue(escrow.isOverdue(0) == false); // not active anymore
    }

    function test_withdrawPendingCollateral() public {
        vm.startPrank(borrower);
        escrow.depositCollateral{value: 0.05 ether}();
        uint256 ethBefore = borrower.balance;
        escrow.withdrawCollateral();
        assertEq(borrower.balance, ethBefore + 0.05 ether);
        vm.stopPrank();
    }

    function test_cannotRepayOthersLoan() public {
        vm.prank(borrower);
        escrow.depositCollateral{value: 0.1 ether}();

        vm.startPrank(agent);
        usdt.approve(address(escrow), 100e6);
        escrow.approveLoan(borrower, 0.1 ether, 100e6, 5e6, 7 days);
        vm.stopPrank();

        // Random address tries to repay
        address rando = address(0xC);
        usdt.mint(rando, 105e6);
        vm.startPrank(rando);
        usdt.approve(address(escrow), 105e6);
        vm.expectRevert("Not your loan");
        escrow.repayLoan(0);
        vm.stopPrank();
    }

    function test_directEthDeposit() public {
        vm.prank(borrower);
        (bool ok,) = address(escrow).call{value: 0.05 ether}("");
        assertTrue(ok);
        assertEq(escrow.pendingCollateral(borrower), 0.05 ether);
    }
}
