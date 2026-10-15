// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

contract MarketHandler is Test {
    LaunchToken public immutable token;
    BondingCurveMarket public immutable market;

    constructor(LaunchToken token_, BondingCurveMarket market_) {
        token = token_;
        market = market_;
        token.approve(address(market), type(uint256).max);
        vm.deal(address(this), 1_000 ether);
    }

    receive() external payable {}

    function buy(uint96 rawAmount) external {
        uint256 amount = bound(uint256(rawAmount), 1e12, 0.05 ether);
        vm.deal(address(this), address(this).balance + amount);
        try market.buy{value: amount}(0, block.timestamp) {} catch {}
    }

    function sell(uint96 rawAmount) external {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) return;
        uint256 amount = bound(uint256(rawAmount), 1, balance);
        try market.sell(amount, 0, block.timestamp) {} catch {}
    }
}

contract LaunchpadInvariantTest is StdInvariant, Test {
    LaunchToken internal token;
    BondingCurveMarket internal market;
    MarketHandler internal handler;

    function setUp() public {
        LaunchpadFactory factory = new LaunchpadFactory(makeAddr("protocol"));
        (address tokenAddress, address marketAddress) =
            factory.createToken("Micow Invariant", "MCWI", "ipfs://invariant");
        token = LaunchToken(tokenAddress);
        market = BondingCurveMarket(payable(marketAddress));
        handler = new MarketHandler(token, market);
        targetContract(address(handler));
    }

    function invariant_TotalSupplyNeverChanges() public view {
        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
    }

    function invariant_TokenInventoryIsConserved() public view {
        assertEq(token.balanceOf(address(market)) + token.balanceOf(address(handler)), token.totalSupply());
    }

    function invariant_EthBalanceCoversReservesAndFeeLiabilities() public view {
        assertGe(address(market).balance, market.realEthReserve() + market.totalClaimableFees());
    }

    function invariant_FeeLiabilityMatchesRecipientBalances() public view {
        assertEq(
            market.claimableFees(market.creator()) + market.claimableFees(market.protocolFeeRecipient()),
            market.totalClaimableFees()
        );
    }

    function invariant_FeesStayWithinHardCap() public view {
        assertLe(
            uint256(market.protocolFeeBps()) + uint256(market.creatorFeeBps()),
            uint256(market.MAX_COMBINED_FEE_BPS())
        );
    }
}
