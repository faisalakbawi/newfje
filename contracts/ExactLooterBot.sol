// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniswapV2Router {
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable;
    
    function factory() external pure returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/**
 * EXACT LOOTER BOT REPLICA
 * Implements the exact same architecture as professional Looter bots
 * Function: execBuy(address token) - exactly like the real Looter
 */
contract ExactLooterBot {
    address private immutable WETH;
    address private immutable ROUTER;
    address private owner;
    
    // Base network addresses
    constructor() {
        WETH = 0x4200000000000000000000000000000000000006;   // Base WETH
        ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24; // Base Uniswap V2 Router
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
    
    /**
     * EXEC BUY - EXACT LOOTER FUNCTION
     * This is the exact same function signature and logic as professional Looter bots
     */
    function execBuy(address token) external payable onlyOwner {
        require(msg.value > 0, "No ETH sent");
        require(token != address(0), "Invalid token");
        
        // Optional: Check liquidity before buying (like advanced Looters)
        if (!hasLiquidity(token)) {
            revert("No liquidity found");
        }
        
        // Build path: WETH -> Token (exactly like Looter)
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = token;
        
        // Execute the exact same swap as Looter bots
        IUniswapV2Router(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: msg.value
        }(
            0,                    // amountOutMin = 0 (exactly like Looter)
            path,                 // [WETH, token]
            address(this),        // tokens come to contract first
            block.timestamp + 300 // 5 minute deadline
        );
        
        // Post-buy verification (critical honeypot protection)
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        require(tokenBalance > 0, "Buy failed or honeypot");
        
        // Transfer tokens to owner (like Looter)
        require(IERC20(token).transfer(owner, tokenBalance), "Transfer failed");
        
        // Emit event for tracking
        emit TokenPurchased(token, msg.value, tokenBalance, owner);
    }
    
    /**
     * LIQUIDITY CHECK - Advanced Looter feature
     */
    function hasLiquidity(address token) internal view returns (bool) {
        address factory = IUniswapV2Router(ROUTER).factory();
        address pair = IUniswapV2Factory(factory).getPair(token, WETH);
        
        if (pair == address(0)) {
            return false; // No pair exists
        }
        
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        return reserve0 > 0 && reserve1 > 0;
    }
    
    /**
     * VIEW FUNCTIONS
     */
    function getLiquidityInfo(address token) external view returns (
        address pair,
        uint256 ethReserve,
        uint256 tokenReserve,
        bool hasLiq
    ) {
        address factory = IUniswapV2Router(ROUTER).factory();
        pair = IUniswapV2Factory(factory).getPair(token, WETH);
        
        if (pair != address(0)) {
            (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
            
            if (IUniswapV2Pair(pair).token0() == WETH) {
                ethReserve = reserve0;
                tokenReserve = reserve1;
            } else {
                ethReserve = reserve1;
                tokenReserve = reserve0;
            }
            
            hasLiq = ethReserve > 0 && tokenReserve > 0;
        }
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
    
    function changeOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
    
    // Events
    event TokenPurchased(address indexed token, uint256 ethSpent, uint256 tokensReceived, address indexed recipient);
}