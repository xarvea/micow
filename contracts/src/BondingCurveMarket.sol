// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Non-upgradeable native-ETH bonding curve for one fixed-supply LaunchToken.
contract BondingCurveMarket is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant PROTOCOL_FEE_BPS = 100;
    uint16 public constant CREATOR_FEE_BPS = 100;
    uint16 public constant MAX_COMBINED_FEE_BPS = 500;
    uint256 public constant VIRTUAL_ETH_RESERVE = 1 ether;
    uint256 public constant VIRTUAL_TOKEN_RESERVE = 1_000_000_000 ether;

    IERC20 public immutable token;
    address public immutable creator;
    address public immutable protocolFeeRecipient;
    uint16 public immutable protocolFeeBps;
    uint16 public immutable creatorFeeBps;
    uint256 public realEthReserve;
    uint256 public realTokenReserve;

    error ZeroAddress();
    error InvalidAmount();
    error DeadlineExpired();
    error SlippageExceeded(uint256 actual, uint256 minimum);
    error InsufficientLiquidity();
    error DirectETHNotAccepted();
    error InvalidFeeConfiguration();

    event Buy(
        address indexed buyer,
        uint256 ethIn,
        uint256 tokensOut,
        uint256 protocolFee,
        uint256 creatorFee
    );
    event Sell(
        address indexed seller,
        uint256 tokensIn,
        uint256 ethOut,
        uint256 protocolFee,
        uint256 creatorFee
    );

    constructor(
        address token_,
        address creator_,
        address protocolFeeRecipient_,
        uint256 initialTokenReserve_
    ) {
        if (
            token_ == address(0) ||
            creator_ == address(0) ||
            protocolFeeRecipient_ == address(0)
        ) revert ZeroAddress();
        if (initialTokenReserve_ == 0) revert InvalidAmount();
        if (PROTOCOL_FEE_BPS + CREATOR_FEE_BPS > MAX_COMBINED_FEE_BPS) {
            revert InvalidFeeConfiguration();
        }

        token = IERC20(token_);
        creator = creator_;
        protocolFeeRecipient = protocolFeeRecipient_;
        protocolFeeBps = PROTOCOL_FEE_BPS;
        creatorFeeBps = CREATOR_FEE_BPS;
        realTokenReserve = initialTokenReserve_;
    }

    receive() external payable {
        revert DirectETHNotAccepted();
    }

    /// @notice Quote buy output for a gross ETH input, including fees.
    function quoteBuy(
        uint256 grossEthIn
    ) public view returns (uint256 tokensOut, uint256 protocolFee, uint256 creatorFee) {
        if (grossEthIn == 0) revert InvalidAmount();
        (protocolFee, creatorFee) = _fees(grossEthIn);
        uint256 netEthIn = grossEthIn - protocolFee - creatorFee;
        uint256 ethTotal = realEthReserve + VIRTUAL_ETH_RESERVE;
        uint256 tokenTotal = realTokenReserve + VIRTUAL_TOKEN_RESERVE;
        uint256 newEthTotal = ethTotal + netEthIn;
        // Round the remaining token reserve up, never overpaying token output.
        uint256 newTokenTotal = Math.mulDiv(
            ethTotal,
            tokenTotal,
            newEthTotal,
            Math.Rounding.Ceil
        );
        tokensOut = tokenTotal - newTokenTotal;
        if (tokensOut == 0 || tokensOut > realTokenReserve) revert InsufficientLiquidity();
    }

    /// @notice Quote sell output for tokens in, including fees.
    function quoteSell(
        uint256 tokensIn
    ) public view returns (uint256 ethOut, uint256 protocolFee, uint256 creatorFee) {
        if (tokensIn == 0) revert InvalidAmount();
        uint256 ethTotal = realEthReserve + VIRTUAL_ETH_RESERVE;
        uint256 tokenTotal = realTokenReserve + VIRTUAL_TOKEN_RESERVE;
        uint256 newTokenTotal = tokenTotal + tokensIn;
        // Round the remaining ETH reserve up, never paying more ETH than the curve owes.
        uint256 newEthTotal = Math.mulDiv(
            ethTotal,
            tokenTotal,
            newTokenTotal,
            Math.Rounding.Ceil
        );
        uint256 grossEthOut = ethTotal - newEthTotal;
        if (grossEthOut == 0 || grossEthOut > realEthReserve) revert InsufficientLiquidity();
        (protocolFee, creatorFee) = _fees(grossEthOut);
        ethOut = grossEthOut - protocolFee - creatorFee;
    }

    function buy(
        uint256 minTokensOut,
        uint256 deadline
    ) external payable nonReentrant returns (uint256 tokensOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        uint256 protocolFee;
        uint256 creatorFee;
        (tokensOut, protocolFee, creatorFee) = quoteBuy(msg.value);
        if (tokensOut < minTokensOut) revert SlippageExceeded(tokensOut, minTokensOut);

        uint256 netEthIn = msg.value - protocolFee - creatorFee;
        realEthReserve += netEthIn;
        realTokenReserve -= tokensOut;

        _payFee(protocolFeeRecipient, protocolFee);
        _payFee(creator, creatorFee);
        token.safeTransfer(msg.sender, tokensOut);

        emit Buy(msg.sender, msg.value, tokensOut, protocolFee, creatorFee);
    }

    function sell(
        uint256 tokensIn,
        uint256 minEthOut,
        uint256 deadline
    ) external nonReentrant returns (uint256 ethOut) {
        if (block.timestamp > deadline) revert DeadlineExpired();
        uint256 protocolFee;
        uint256 creatorFee;
        (ethOut, protocolFee, creatorFee) = quoteSell(tokensIn);
        if (ethOut < minEthOut) revert SlippageExceeded(ethOut, minEthOut);

        uint256 grossEthOut = ethOut + protocolFee + creatorFee;
        if (grossEthOut > realEthReserve) revert InsufficientLiquidity();

        token.safeTransferFrom(msg.sender, address(this), tokensIn);
        realTokenReserve += tokensIn;
        realEthReserve -= grossEthOut;

        _payFee(protocolFeeRecipient, protocolFee);
        _payFee(creator, creatorFee);
        (bool success, ) = payable(msg.sender).call{value: ethOut}("");
        require(success, "ETH_TRANSFER_FAILED");

        emit Sell(msg.sender, tokensIn, ethOut, protocolFee, creatorFee);
    }

    function _fees(
        uint256 amount
    ) internal view returns (uint256 protocolFee, uint256 creatorFee) {
        protocolFee = Math.mulDiv(amount, protocolFeeBps, BPS_DENOMINATOR);
        creatorFee = Math.mulDiv(amount, creatorFeeBps, BPS_DENOMINATOR);
    }

    function _payFee(address recipient, uint256 amount) internal {
        if (amount == 0) return;
        (bool success, ) = payable(recipient).call{value: amount}("");
        require(success, "FEE_TRANSFER_FAILED");
    }
}
