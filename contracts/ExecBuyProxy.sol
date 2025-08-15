// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * EXEC BUY PROXY CONTRACT
 * Makes transactions show "Exec Buy" instead of "Swap"
 * Exactly like professional Looter bots
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IUniswapV2Router {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
    
    function WETH() external pure returns (address);
}

contract ExecBuyProxy {
    address private constant ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24; // Uniswap V2 Base
    address private constant WETH = 0x4200000000000000000000000000000000000006; // WETH Base
    
    address public owner;
    
    event ExecBuy(address indexed token, uint256 ethAmount, uint256 tokensReceived);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * EXEC BUY - EXACTLY LIKE PROFESSIONAL LOOTER BOTS
     * This function name will show in transaction history
     */
    function execBuy(address token) external payable onlyOwner {
        require(msg.value > 0, "No ETH sent");
        require(token != address(0), "Invalid token");
        
        // Get token balance before
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Create path: WETH -> Token
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = token;
        
        // Execute swap through router
        IUniswapV2Router(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: msg.value}(
            0, // Accept any amount (Looter style)
            path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );
        
        // Get tokens received
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        uint256 tokensReceived = balanceAfter - balanceBefore;
        
        // Transfer tokens to owner
        if (tokensReceived > 0) {
            IERC20(token).transfer(owner, tokensReceived);
        }
        
        emit ExecBuy(token, msg.value, tokensReceived);
    }
    
    /**
     * EXEC BUY TO SPECIFIC ADDRESS
     */
    function execBuyTo(address token, address to) external payable onlyOwner {
        require(msg.value > 0, "No ETH sent");
        require(token != address(0), "Invalid token");
        require(to != address(0), "Invalid recipient");
        
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = token;
        
        // Execute swap directly to recipient
        IUniswapV2Router(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{value: msg.value}(
            0,
            path,
            to,
            block.timestamp + 300
        );
        
        emit ExecBuy(token, msg.value, 0); // Can't measure tokens when sent directly
    }
    
    /**
     * EMERGENCY FUNCTIONS
     */
    function emergencyWithdrawETH() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    function emergencyWithdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
        }
    }
    
    /**
     * VIEW FUNCTIONS
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
}