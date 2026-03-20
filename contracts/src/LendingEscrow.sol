// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title LendingEscrow
 * @notice Trustless collateralized lending: borrower deposits ETH, agent disburses USDT,
 *         on repayment collateral is released, on default agent claims collateral.
 *
 * Flow:
 *   1. Borrower calls depositCollateral() → ETH locked in contract
 *   2. Agent calls approveLoan() → USDT transferred to borrower, loan recorded
 *   3a. Borrower calls repayLoan() with USDT → collateral returned automatically
 *   3b. After due date, agent calls liquidate() → collateral sent to agent
 */
contract LendingEscrow {
    IERC20 public immutable usdt;
    address public immutable agent;

    /// @notice Collateral ratio in basis points. 15000 = 150% (deposit $150 ETH for $100 loan)
    uint256 public collateralRatioBps = 15000;

    struct Loan {
        address borrower;
        uint256 collateralWei;        // ETH locked
        uint256 principalUsdt;        // USDT disbursed (6 decimals)
        uint256 totalDueUsdt;         // principal + interest (6 decimals)
        uint256 dueTimestamp;
        bool active;
        bool repaid;
        bool liquidated;
    }

    uint256 public nextLoanId;
    mapping(uint256 => Loan) public loans;

    // Pending collateral before loan approval
    mapping(address => uint256) public pendingCollateral;

    event CollateralDeposited(address indexed borrower, uint256 amount);
    event CollateralWithdrawn(address indexed borrower, uint256 amount);
    event LoanApproved(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 totalDue, uint256 dueTimestamp);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 collateralReturned);
    event LoanLiquidated(uint256 indexed loanId, address indexed borrower, uint256 collateralClaimed);

    modifier onlyAgent() {
        require(msg.sender == agent, "Only agent");
        _;
    }

    constructor(address _usdt, address _agent) {
        usdt = IERC20(_usdt);
        agent = _agent;
    }

    // ─── Borrower actions ───────────────────────────────────

    /// @notice Borrower deposits ETH as collateral. Can be withdrawn before loan approval.
    function depositCollateral() external payable {
        require(msg.value > 0, "Zero collateral");
        pendingCollateral[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }

    /// @notice Borrower withdraws pending collateral (only if no active loan against it).
    function withdrawCollateral() external {
        uint256 amount = pendingCollateral[msg.sender];
        require(amount > 0, "No pending collateral");
        pendingCollateral[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit CollateralWithdrawn(msg.sender, amount);
    }

    /// @notice Borrower repays loan in USDT. Collateral is returned automatically.
    ///         Borrower must approve USDT to this contract before calling.
    function repayLoan(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(msg.sender == loan.borrower, "Not your loan");

        loan.active = false;
        loan.repaid = true;

        // Pull USDT from borrower to agent
        bool ok = usdt.transferFrom(msg.sender, agent, loan.totalDueUsdt);
        require(ok, "USDT transfer failed");

        // Return collateral
        uint256 collateral = loan.collateralWei;
        (bool sent,) = loan.borrower.call{value: collateral}("");
        require(sent, "Collateral return failed");

        emit LoanRepaid(loanId, loan.borrower, collateral);
    }

    // ─── Agent actions ──────────────────────────────────────

    /// @notice Agent approves a loan: moves collateral from pending to locked, disburses USDT.
    ///         Agent must approve USDT to this contract before calling.
    /// @param borrower Address of the borrower
    /// @param collateralAmount How much of borrower's pending collateral to lock
    /// @param principalUsdt Loan amount in USDT (6 decimals)
    /// @param interestUsdt Interest in USDT (6 decimals)
    /// @param durationSeconds Loan duration in seconds
    function approveLoan(
        address borrower,
        uint256 collateralAmount,
        uint256 principalUsdt,
        uint256 interestUsdt,
        uint256 durationSeconds
    ) external onlyAgent {
        require(pendingCollateral[borrower] >= collateralAmount, "Insufficient collateral");
        require(principalUsdt > 0, "Zero principal");

        // Lock collateral
        pendingCollateral[borrower] -= collateralAmount;

        uint256 totalDue = principalUsdt + interestUsdt;
        uint256 dueTimestamp = block.timestamp + durationSeconds;

        uint256 loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: borrower,
            collateralWei: collateralAmount,
            principalUsdt: principalUsdt,
            totalDueUsdt: totalDue,
            dueTimestamp: dueTimestamp,
            active: true,
            repaid: false,
            liquidated: false
        });

        // Disburse USDT from agent to borrower
        bool ok = usdt.transferFrom(agent, borrower, principalUsdt);
        require(ok, "USDT disbursement failed");

        emit LoanApproved(loanId, borrower, principalUsdt, totalDue, dueTimestamp);
    }

    /// @notice Agent liquidates overdue loan — claims collateral.
    function liquidate(uint256 loanId) external onlyAgent {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(block.timestamp > loan.dueTimestamp, "Loan not overdue");

        loan.active = false;
        loan.liquidated = true;

        // Send collateral to agent
        (bool ok,) = agent.call{value: loan.collateralWei}("");
        require(ok, "Collateral claim failed");

        emit LoanLiquidated(loanId, loan.borrower, loan.collateralWei);
    }

    // ─── Views ──────────────────────────────────────────────

    /// @notice Check if a loan is overdue
    function isOverdue(uint256 loanId) external view returns (bool) {
        Loan storage loan = loans[loanId];
        return loan.active && block.timestamp > loan.dueTimestamp;
    }

    /// @notice Get loan details
    function getLoan(uint256 loanId) external view returns (
        address borrower,
        uint256 collateralWei,
        uint256 principalUsdt,
        uint256 totalDueUsdt,
        uint256 dueTimestamp,
        bool active,
        bool repaid,
        bool liquidated
    ) {
        Loan storage loan = loans[loanId];
        return (
            loan.borrower,
            loan.collateralWei,
            loan.principalUsdt,
            loan.totalDueUsdt,
            loan.dueTimestamp,
            loan.active,
            loan.repaid,
            loan.liquidated
        );
    }

    /// @notice Update collateral ratio (agent only)
    function setCollateralRatio(uint256 _bps) external onlyAgent {
        collateralRatioBps = _bps;
    }

    receive() external payable {
        // Allow direct ETH deposits (treated as collateral)
        pendingCollateral[msg.sender] += msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }
}
