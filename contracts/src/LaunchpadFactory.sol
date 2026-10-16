// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {BondingCurveMarket} from "./BondingCurveMarket.sol";

/// @notice Deploys fixed-supply tokens and dedicated markets; creation fees are treasury pull liabilities.
contract LaunchpadFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant CREATION_FEE = 0.0006 ether;

    address public immutable protocolFeeRecipient;
    mapping(address token => address market) public marketForToken;
    mapping(address recipient => uint256 amount) public claimableTreasuryFees;
    uint256 public totalClaimableTreasuryFees;

    error ZeroAddress();
    error EmptyNameOrSymbol();
    error IncorrectCreationFee(uint256 expected, uint256 actual);
    error UnauthorizedTreasury();
    error NoTreasuryFeesToWithdraw();
    error TreasuryFeeWithdrawalFailed();

    event TokenCreated(
        address indexed creator,
        address indexed token,
        address indexed market,
        string name,
        string symbol,
        uint256 totalSupply,
        string metadataURI
    );
    event CreationFeeAccrued(address indexed treasury, address indexed creator, uint256 amount);
    event TreasuryFeesWithdrawn(address indexed treasury, uint256 amount);

    constructor(address protocolFeeRecipient_) {
        if (protocolFeeRecipient_ == address(0)) revert ZeroAddress();
        protocolFeeRecipient = protocolFeeRecipient_;
    }

    function createToken(string calldata name_, string calldata symbol_, string calldata metadataURI_)
        external
        payable
        nonReentrant
        returns (address tokenAddress, address marketAddress)
    {
        if (bytes(name_).length == 0 || bytes(symbol_).length == 0) revert EmptyNameOrSymbol();
        if (msg.value != CREATION_FEE) revert IncorrectCreationFee(CREATION_FEE, msg.value);

        LaunchToken token = new LaunchToken(name_, symbol_, address(this));
        BondingCurveMarket market =
            new BondingCurveMarket(address(token), msg.sender, protocolFeeRecipient, token.TOTAL_SUPPLY());
        tokenAddress = address(token);
        marketAddress = address(market);
        marketForToken[tokenAddress] = marketAddress;
        IERC20(tokenAddress).safeTransfer(marketAddress, token.TOTAL_SUPPLY());

        // Pull-based custody: never call the treasury in the token-creation path.
        claimableTreasuryFees[protocolFeeRecipient] += msg.value;
        totalClaimableTreasuryFees += msg.value;
        emit CreationFeeAccrued(protocolFeeRecipient, msg.sender, msg.value);
        emit TokenCreated(msg.sender, tokenAddress, marketAddress, name_, symbol_, token.TOTAL_SUPPLY(), metadataURI_);
    }

    function withdrawTreasuryFees() external nonReentrant returns (uint256 amount) {
        if (msg.sender != protocolFeeRecipient) revert UnauthorizedTreasury();
        amount = claimableTreasuryFees[protocolFeeRecipient];
        if (amount == 0) revert NoTreasuryFeesToWithdraw();

        claimableTreasuryFees[protocolFeeRecipient] = 0;
        totalClaimableTreasuryFees -= amount;

        (bool success,) = payable(protocolFeeRecipient).call{value: amount}("");
        if (!success) revert TreasuryFeeWithdrawalFailed();
        emit TreasuryFeesWithdrawn(protocolFeeRecipient, amount);
    }
}
