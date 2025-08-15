// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * EXACT LOOTER BOT CLONE
 * Replicates the exact functionality of professional Looter bots
 * Contract: 0xe111b0C3605aDc45CFb0CD75E5543F63CC3ec425
 * Function: execBuy() with signature 0xc981cc3c
 */

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
    
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    
    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

contract ExactLooterBotClone {
    address private constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481; // Base Uniswap V3
    address private constant WETH = 0x4200000000000000000000000000000000000006; // WETH Base
    
    address public owner;
    
    // Events matching professional Looter bots
    event ExecBuy(address indexed token, uint256 ethAmount, uint256 tokensReceived, address indexed recipient);
    event LooterBuyExecuted(address indexed user, address indexed token, uint256 amountIn, uint256 amountOut);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * EXEC BUY - EXACT FUNCTION SIGNATURE: 0xc981cc3c
     * This matches the professional Looter bot exactly
     */
    function execBuy(
        uint256 slippage,
        bytes calldata path,
        uint256 amountOutMin,
        uint256 deadline,
        uint256 unused1,
        uint256 unused2,
        bytes calldata extraData,
        uint256 maxGasPrice
    ) external payable onlyOwner {
        require(msg.value > 0, "No ETH sent");
        require(path.length >= 43, "Invalid path"); // WETH + fee + token = 43 bytes minimum
        
        // Extract token address from path (last 20 bytes)
        address tokenOut;
        assembly {
            tokenOut := div(calldataload(add(path.offset, sub(path.length, 20))), 0x1000000000000000000000000)
        }
        
        require(tokenOut != address(0), "Invalid token");
        
        // Get token balance before
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
        
        // Approve router to spend WETH
        IWETH(WETH).transfer(UNISWAP_V3_ROUTER, msg.value);
        
        // Execute swap using exact input with path
        IUniswapV3Router.ExactInputParams memory params = IUniswapV3Router.ExactInputParams({
            path: path,
            recipient: address(this),
            deadline: deadline > 0 ? deadline : block.timestamp + 300,
            amountIn: msg.value,
            amountOutMinimum: 0 // Looter style - accept any amount
        });
        
        uint256 amountOut = IUniswapV3Router(UNISWAP_V3_ROUTER).exactInput(params);
        
        // Get actual tokens received
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        uint256 tokensReceived = balanceAfter - balanceBefore;
        
        // Transfer tokens to owner
        if (tokensReceived > 0) {
            IERC20(tokenOut).transfer(owner, tokensReceived);
        }
        
        // Emit events like professional Looter bots
        emit ExecBuy(tokenOut, msg.value, tokensReceived, owner);
        emit LooterBuyExecuted(owner, tokenOut, msg.value, tokensReceived);
    }
    
    /**
     * ALTERNATIVE EXEC BUY - FOR SINGLE POOL SWAPS
     */
    function execBuySingle(
        address tokenOut,
        uint24 fee,
        uint256 amountOutMinimum
    ) external payable onlyOwner {
        require(msg.value > 0, "No ETH sent");
        require(tokenOut != address(0), "Invalid token");
        
        // Get token balance before
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: msg.value}();
        
        // Approve router
        IERC20(WETH).approve(UNISWAP_V3_ROUTER, msg.value);
        
        // Execute single swap
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: WETH,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: msg.value,
            amountOutMinimum: 0, // Looter style
            sqrtPriceLimitX96: 0
        });
        
        uint256 amountOut = IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params);
        
        // Get actual tokens received
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        uint256 tokensReceived = balanceAfter - balanceBefore;
        
        // Transfer to owner
        if (tokensReceived > 0) {
            IERC20(tokenOut).transfer(owner, tokensReceived);
        }
        
        emit ExecBuy(tokenOut, msg.value, tokensReceived, owner);
        emit LooterBuyExecuted(owner, tokenOut, msg.value, tokensReceived);
    }
    
    /**
     * EMERGENCY FUNCTIONS
     */
    function emergencyWithdraw() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }
    
    function emergencyWithdrawToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).transfer(owner, balance);
        }
    }
    
    function emergencyWithdrawWETH() external onlyOwner {
        uint256 balance = IWETH(WETH).balanceOf(address(this));
        if (balance > 0) {
            IWETH(WETH).withdraw(balance);
            payable(owner).transfer(balance);
        }
    }
    
    /**
     * VIEW FUNCTIONS
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }
    
    function getETHBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // Allow contract to receive ETH
    receive() external payable {}
    fallback() external payable {}
}