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
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IUniswapV2Pair {
    function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
}

/**
 * LOOTER-STYLE BUY CONTRACT
 * Implements the exact same logic as professional looter bots
 */
contract LooterBuyContract {
    address public owner;
    address public constant ROUTER = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24; // Base Uniswap V2 Router
    address public constant WETH = 0x4200000000000000000000000000000000000006; // Base WETH
    address public constant FACTORY = 0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6; // Base Uniswap V2 Factory
    
    uint256 public constant MIN_LIQUIDITY = 1 ether; // Minimum liquidity requirement
    uint256 public constant MAX_SLIPPAGE = 50; // 50% max slippage for micro-cap tokens
    
    event TokenPurchased(address indexed token, uint256 ethSpent, uint256 tokensReceived, address indexed recipient);
    event LiquidityCheck(address indexed token, uint256 tokenReserve, uint256 ethReserve);
    event HoneypotDetected(address indexed token, string reason);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * MAIN BUY FUNCTION - Looter Style
     * Implements all the protections seen in professional bots
     */
    function buyToken(
        address token,
        address recipient,
        uint256 minLiquidity,
        bool skipLiquidityCheck
    ) external payable {
        require(msg.value > 0, "No ETH sent");
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        
        // 1. LIQUIDITY CHECK (like professional bots)
        if (!skipLiquidityCheck) {
            _checkLiquidity(token, minLiquidity);
        }
        
        // 2. HONEYPOT PRE-CHECK
        _preCheckHoneypot(token);
        
        // 3. EXECUTE BUY (Looter's exact method)
        uint256 tokensBefore = IERC20(token).balanceOf(address(this));
        
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = token;
        
        // Use the exact same function as Looter
        IUniswapV2Router(ROUTER).swapExactETHForTokensSupportingFeeOnTransferTokens{
            value: msg.value
        }(
            0, // amountOutMin = 0 (maximum flexibility like Looter)
            path,
            address(this), // Tokens come to contract first
            block.timestamp + 300 // 5 minute deadline
        );
        
        // 4. POST-BUY VERIFICATION (Critical honeypot protection)
        uint256 tokensAfter = IERC20(token).balanceOf(address(this));
        uint256 tokensReceived = tokensAfter - tokensBefore;
        
        require(tokensReceived > 0, "Buy failed or honeypot detected");
        
        // 5. TRANSFER TO RECIPIENT (like Looter)
        require(IERC20(token).transfer(recipient, tokensReceived), "Transfer failed");
        
        emit TokenPurchased(token, msg.value, tokensReceived, recipient);
    }
    
    /**
     * LIQUIDITY CHECK - Prevents buying tokens with insufficient liquidity
     */
    function _checkLiquidity(address token, uint256 minLiquidity) internal {
        address pair = IUniswapV2Factory(FACTORY).getPair(WETH, token);
        require(pair != address(0), "No liquidity pair exists");
        
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        
        uint256 ethReserve;
        uint256 tokenReserve;
        
        if (IUniswapV2Pair(pair).token0() == WETH) {
            ethReserve = reserve0;
            tokenReserve = reserve1;
        } else {
            ethReserve = reserve1;
            tokenReserve = reserve0;
        }
        
        require(ethReserve >= minLiquidity, "Insufficient ETH liquidity");
        require(tokenReserve > 0, "No token liquidity");
        
        emit LiquidityCheck(token, tokenReserve, ethReserve);
    }
    
    /**
     * PRE-CHECK HONEYPOT - Basic checks before buying
     */
    function _preCheckHoneypot(address token) internal view {
        // Check if token contract exists
        uint256 size;
        assembly {
            size := extcodesize(token)
        }
        require(size > 0, "Token contract does not exist");
        
        // Additional checks can be added here
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
    function getLiquidityInfo(address token) external view returns (
        address pair,
        uint256 ethReserve,
        uint256 tokenReserve,
        bool hasLiquidity
    ) {
        pair = IUniswapV2Factory(FACTORY).getPair(WETH, token);
        
        if (pair != address(0)) {
            (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
            
            if (IUniswapV2Pair(pair).token0() == WETH) {
                ethReserve = reserve0;
                tokenReserve = reserve1;
            } else {
                ethReserve = reserve1;
                tokenReserve = reserve0;
            }
            
            hasLiquidity = ethReserve > 0 && tokenReserve > 0;
        }
    }
    
    function getExpectedTokens(address token, uint256 ethAmount) external view returns (uint256) {
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = token;
        
        try IUniswapV2Router(ROUTER).getAmountsOut(ethAmount, path) returns (uint[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }
    
    // Receive ETH
    receive() external payable {}
}