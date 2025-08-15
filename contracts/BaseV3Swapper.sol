// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256) external;
    function transfer(address to, uint256 value) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface ISwapRouter {
    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

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

    function exactInput(ExactInputParams calldata params) external payable returns (uint256 amountOut);
    function exactInputSingle(ExactInputSingleParams calldata params) external payable returns (uint256 amountOut);
}

/**
 * @title BaseV3Swapper
 * @dev Single-transaction swap + fee collection for Base network
 * Combines Uniswap V3 swap with treasury fee transfer in one transaction
 */
contract BaseV3Swapper is ReentrancyGuard, Ownable {
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant SWAP_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    
    event SwapExecuted(
        address indexed user,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 feeCollected
    );

    modifier validAddress(address addr) {
        require(addr != address(0), "Invalid address");
        _;
    }

    /**
     * @dev Execute exact input swap with path
     * @param params Swap parameters including path, recipient, amounts
     */
    function exactInput(
        ISwapRouter.ExactInputParams memory params
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(msg.value > 0, "No ETH sent");
        require(params.amountIn <= msg.value, "Insufficient ETH");

        // Wrap ETH to WETH
        IWETH(WETH).deposit{value: params.amountIn}();
        
        // Approve router to spend WETH
        IWETH(WETH).transfer(SWAP_ROUTER, params.amountIn);

        // Set deadline
        params.deadline = block.timestamp + 300; // 5 minutes

        // Execute swap
        amountOut = ISwapRouter(SWAP_ROUTER).exactInput(params);

        emit SwapExecuted(
            msg.sender,
            address(0), // tokenOut extracted from path would be complex
            params.amountIn,
            amountOut,
            0
        );

        return amountOut;
    }

    /**
     * @dev Collect fee and transfer to treasury
     * @param treasury Treasury wallet address
     * @param feeAmount Fee amount in ETH
     */
    function collectFee(
        address treasury,
        uint256 feeAmount
    ) external payable validAddress(treasury) {
        require(feeAmount <= msg.value, "Fee exceeds sent value");
        require(feeAmount > 0, "Fee must be positive");

        // Transfer fee to treasury
        (bool success, ) = treasury.call{value: feeAmount}("");
        require(success, "Fee transfer failed");
    }

    /**
     * @dev Execute multiple calls in a single transaction
     * @param data Array of encoded function calls
     */
    function multicall(bytes[] calldata data) external payable nonReentrant returns (bytes[] memory results) {
        results = new bytes[](data.length);
        
        for (uint256 i = 0; i < data.length; i++) {
            (bool success, bytes memory result) = address(this).delegatecall(data[i]);
            require(success, "Multicall failed");
            results[i] = result;
        }
        
        return results;
    }

    /**
     * @dev Emergency function to recover stuck ETH
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");
        
        (bool success, ) = owner().call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev Emergency function to recover stuck tokens
     */
    function emergencyRecoverToken(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(amount > 0, "Amount must be positive");
        
        IERC20(token).transfer(owner(), amount);
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {}

    /**
     * @dev Fallback function
     */
    fallback() external payable {}
}
