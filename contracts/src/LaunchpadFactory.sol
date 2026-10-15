// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {LaunchToken} from "./LaunchToken.sol";
import {BondingCurveMarket} from "./BondingCurveMarket.sol";
contract LaunchpadFactory {
    using SafeERC20 for IERC20;
    address public immutable protocolFeeRecipient;
    mapping(address token => address market) public marketForToken;
    error ZeroAddress();
    error EmptyNameOrSymbol();
    event TokenCreated(address indexed creator, address indexed token, address indexed market, string name, string symbol, uint256 totalSupply, string metadataURI);
    constructor(address protocolFeeRecipient_) {
        if (protocolFeeRecipient_ == address(0)) revert ZeroAddress();
        protocolFeeRecipient = protocolFeeRecipient_;
    }
    function createToken(string calldata name_, string calldata symbol_, string calldata metadataURI_)
        external
        returns (address tokenAddress, address marketAddress)
    {
        if (bytes(name_).length == 0 || bytes(symbol_).length == 0) revert EmptyNameOrSymbol();
        LaunchToken token = new LaunchToken(name_, symbol_, address(this));
        BondingCurveMarket market = new BondingCurveMarket(address(token), msg.sender, protocolFeeRecipient, token.TOTAL_SUPPLY());
        tokenAddress = address(token);
        marketAddress = address(market);
        marketForToken[tokenAddress] = marketAddress;
        IERC20(tokenAddress).safeTransfer(marketAddress, token.TOTAL_SUPPLY());
        emit TokenCreated(msg.sender, tokenAddress, marketAddress, name_, symbol_, token.TOTAL_SUPPLY(), metadataURI_);
    }
}
