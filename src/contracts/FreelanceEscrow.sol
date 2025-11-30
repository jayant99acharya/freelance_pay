// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract FreelanceEscrow {
    address public client;
    address public freelancer;
    address public paymentToken;
    uint256 public totalAmount;
    bool public isActive;

    struct Milestone {
        uint256 amount;
        bool isPaid;
        bool isVerified;
        string verificationHash;
    }

    Milestone[] public milestones;

    event EscrowCreated(address indexed client, address indexed freelancer, uint256 totalAmount);
    event FundsDeposited(address indexed from, uint256 amount);
    event MilestoneVerified(uint256 indexed milestoneIndex, string verificationHash);
    event MilestonePaid(uint256 indexed milestoneIndex, address indexed freelancer, uint256 amount);
    event EscrowCancelled(address indexed by);

    modifier onlyClient() {
        require(msg.sender == client, "Only client can call this");
        _;
    }

    modifier onlyFreelancer() {
        require(msg.sender == freelancer, "Only freelancer can call this");
        _;
    }

    modifier onlyActive() {
        require(isActive, "Escrow is not active");
        _;
    }

    constructor(
        address _client,
        address _freelancer,
        address _paymentToken,
        uint256[] memory _milestoneAmounts
    ) {
        require(_client != address(0), "Invalid client address");
        require(_freelancer != address(0), "Invalid freelancer address");
        // Allow zero address for native token (ETH/QIE) payments
        // require(_paymentToken != address(0), "Invalid token address");
        require(_milestoneAmounts.length > 0, "At least one milestone required");

        client = _client;
        freelancer = _freelancer;
        paymentToken = _paymentToken;

        uint256 total = 0;
        for (uint256 i = 0; i < _milestoneAmounts.length; i++) {
            require(_milestoneAmounts[i] > 0, "Milestone amount must be positive");
            milestones.push(Milestone({
                amount: _milestoneAmounts[i],
                isPaid: false,
                isVerified: false,
                verificationHash: ""
            }));
            total += _milestoneAmounts[i];
        }

        totalAmount = total;
        isActive = false;

        emit EscrowCreated(_client, _freelancer, total);
    }

    function depositFunds() external payable onlyClient {
        require(!isActive, "Escrow already funded");

        if (paymentToken == address(0)) {
            // Native token payment
            require(msg.value == totalAmount, "Incorrect native token amount");
        } else {
            // ERC20 token payment
            require(msg.value == 0, "Do not send native tokens with ERC20 payment");
            require(
                IERC20(paymentToken).transferFrom(msg.sender, address(this), totalAmount),
                "Token transfer failed"
            );
        }

        isActive = true;
        emit FundsDeposited(msg.sender, totalAmount);
    }

    function verifyMilestone(uint256 _milestoneIndex, string memory _verificationHash) external onlyClient onlyActive {
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        Milestone storage milestone = milestones[_milestoneIndex];
        require(!milestone.isPaid, "Milestone already paid");
        require(!milestone.isVerified, "Milestone already verified");

        milestone.isVerified = true;
        milestone.verificationHash = _verificationHash;

        emit MilestoneVerified(_milestoneIndex, _verificationHash);
    }

    function releaseMilestonePayment(uint256 _milestoneIndex) external onlyClient onlyActive {
        require(_milestoneIndex < milestones.length, "Invalid milestone index");
        Milestone storage milestone = milestones[_milestoneIndex];
        require(milestone.isVerified, "Milestone not verified");
        require(!milestone.isPaid, "Milestone already paid");

        milestone.isPaid = true;

        if (paymentToken == address(0)) {
            // Native token payment
            (bool success, ) = freelancer.call{value: milestone.amount}("");
            require(success, "Native token transfer failed");
        } else {
            // ERC20 token payment
            require(
                IERC20(paymentToken).transfer(freelancer, milestone.amount),
                "Token transfer failed"
            );
        }

        emit MilestonePaid(_milestoneIndex, freelancer, milestone.amount);
    }

    function cancelEscrow() external onlyClient {
        require(isActive, "Escrow not active");

        uint256 refundAmount = 0;
        for (uint256 i = 0; i < milestones.length; i++) {
            if (!milestones[i].isPaid) {
                refundAmount += milestones[i].amount;
            }
        }

        if (refundAmount > 0) {
            if (paymentToken == address(0)) {
                // Native token refund
                (bool success, ) = client.call{value: refundAmount}("");
                require(success, "Native token refund failed");
            } else {
                // ERC20 token refund
                require(
                    IERC20(paymentToken).transfer(client, refundAmount),
                    "Token refund failed"
                );
            }
        }

        isActive = false;
        emit EscrowCancelled(msg.sender);
    }

    function getMilestoneCount() external view returns (uint256) {
        return milestones.length;
    }

    function getMilestone(uint256 _index) external view returns (
        uint256 amount,
        bool isPaid,
        bool isVerified,
        string memory verificationHash
    ) {
        require(_index < milestones.length, "Invalid milestone index");
        Milestone memory m = milestones[_index];
        return (m.amount, m.isPaid, m.isVerified, m.verificationHash);
    }

    function getRemainingBalance() external view returns (uint256) {
        if (paymentToken == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(paymentToken).balanceOf(address(this));
        }
    }

    // Required to receive native tokens
    receive() external payable {}
    fallback() external payable {}
}
