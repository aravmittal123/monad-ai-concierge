// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Counts completed native-token payments routed through this contract.
/// @dev An activity counter, NOT a credit/safety rating or an ERC-8004 registry.
contract ConciergeActivity {
    mapping(address => uint256) public completedPayments;
    mapping(address => mapping(bytes32 => bool)) public usedIntents;
    bool private entered;
    event PaymentCompleted(address indexed account, address indexed recipient, uint256 amount, bytes32 indexed intentId);

    function sendMON(address payable recipient, bytes32 intentId) external payable {
        require(!entered, "Reentrant call");
        require(recipient != address(0) && recipient != msg.sender, "Invalid recipient");
        require(msg.value > 0 && msg.value <= 10 ether, "Amount out of range");
        require(intentId != bytes32(0) && !usedIntents[msg.sender][intentId], "Intent already used");
        entered = true;
        usedIntents[msg.sender][intentId] = true;
        (bool sent,) = recipient.call{value: msg.value}("");
        require(sent, "Payment failed");
        completedPayments[msg.sender] += 1;
        entered = false;
        emit PaymentCompleted(msg.sender, recipient, msg.value, intentId);
    }

    function activityScore(address account) external view returns (uint256) {
        uint256 count = completedPayments[account];
        return count > 100 ? 100 : count;
    }
}
