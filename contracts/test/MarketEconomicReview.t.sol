// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

contract ForceEtherToMarket {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract RejectingMarketFeeRecipient {
    receive() external payable {
        revert("REJECT_ETH");
    }

    function createMarketAndBuy(LaunchpadFactory factory)
        external
        payable
        returns (BondingCurveMarket market)
    {
        (, address marketAddress) = factory.createToken{value: factory.CREATION_FEE()}(
            "Rejecting Economic Test", "RET", "ipfs://rejecting-economic-test"
        );
        market = BondingCurveMarket(payable(marketAddress));
        market.buy{value: msg.value - factory.CREATION_FEE()}(0, block.timestamp);
    }

    function withdrawMarketFees(BondingCurveMarket market) external {
        market.withdrawFees();
    }
}

contract MarketEconomicReviewTest is Test {
    LaunchpadFactory internal factory;
    LaunchToken internal token;
    BondingCurveMarket internal market;
    address internal protocolFeeRecipient;
    address internal creator;
    address internal trader;

    function setUp() public {
        vm.warp(1_000_000);
        protocolFeeRecipient = makeAddr("economic-protocol");
        creator = makeAddr("economic-creator");
        trader = makeAddr("economic-trader");
        factory = new LaunchpadFactory(protocolFeeRecipient);
        vm.deal(creator, 1 ether);

        vm.prank(creator);
        (address tokenAddress, address marketAddress) =
            factory.createToken{value: factory.CREATION_FEE()}("Economic Review", "ECON", "ipfs://economic-review");
        token = LaunchToken(tokenAddress);
        market = BondingCurveMarket(payable(marketAddress));
    }

    function testFuzz_BuyAndSellQuotesMatchExecutionAndAccounting(uint96 rawBuyAmount, uint96 rawSellAmount) public {
        uint256 buyAmount = bound(uint256(rawBuyAmount), 1e12, 1 ether);
        vm.deal(trader, buyAmount);

        uint256 ethReserveBeforeBuy = market.realEthReserve();
        uint256 tokenReserveBeforeBuy = market.realTokenReserve();
        uint256 protocolFeesBeforeBuy = market.claimableFees(protocolFeeRecipient);
        uint256 creatorFeesBeforeBuy = market.claimableFees(creator);
        (uint256 quotedTokensOut, uint256 quotedProtocolBuyFee, uint256 quotedCreatorBuyFee) =
            market.quoteBuy(buyAmount);

        vm.prank(trader);
        uint256 actualTokensOut = market.buy{value: buyAmount}(quotedTokensOut, block.timestamp);

        assertEq(actualTokensOut, quotedTokensOut, "buy quote differs from execution");
        assertEq(market.realEthReserve() - ethReserveBeforeBuy, buyAmount - quotedProtocolBuyFee - quotedCreatorBuyFee);
        assertEq(tokenReserveBeforeBuy - market.realTokenReserve(), quotedTokensOut);
        assertEq(market.claimableFees(protocolFeeRecipient) - protocolFeesBeforeBuy, quotedProtocolBuyFee);
        assertEq(market.claimableFees(creator) - creatorFeesBeforeBuy, quotedCreatorBuyFee);
        assertEq(address(market).balance, market.realEthReserve() + market.totalClaimableFees());

        uint256 sellAmount = bound(uint256(rawSellAmount), 1e12, actualTokensOut);
        uint256 ethReserveBeforeSell = market.realEthReserve();
        uint256 tokenReserveBeforeSell = market.realTokenReserve();
        uint256 protocolFeesBeforeSell = market.claimableFees(protocolFeeRecipient);
        uint256 creatorFeesBeforeSell = market.claimableFees(creator);
        uint256 marketBalanceBeforeSell = address(market).balance;
        (uint256 quotedEthOut, uint256 quotedProtocolSellFee, uint256 quotedCreatorSellFee) =
            market.quoteSell(sellAmount);

        vm.prank(trader);
        token.approve(address(market), sellAmount);
        vm.prank(trader);
        uint256 actualEthOut = market.sell(sellAmount, quotedEthOut, block.timestamp);

        assertEq(actualEthOut, quotedEthOut, "sell quote differs from execution");
        assertEq(
            ethReserveBeforeSell - market.realEthReserve(), quotedEthOut + quotedProtocolSellFee + quotedCreatorSellFee
        );
        assertEq(market.realTokenReserve() - tokenReserveBeforeSell, sellAmount);
        assertEq(market.claimableFees(protocolFeeRecipient) - protocolFeesBeforeSell, quotedProtocolSellFee);
        assertEq(market.claimableFees(creator) - creatorFeesBeforeSell, quotedCreatorSellFee);
        assertEq(marketBalanceBeforeSell - address(market).balance, actualEthOut);
        assertEq(address(market).balance, market.realEthReserve() + market.totalClaimableFees());
    }

    function testBuyFeeRoundingBoundaries() public view {
        (, uint256 protocol99, uint256 creator99) = market.quoteBuy(99);
        (, uint256 protocol100, uint256 creator100) = market.quoteBuy(100);
        (, uint256 protocol199, uint256 creator199) = market.quoteBuy(199);
        (, uint256 protocol200, uint256 creator200) = market.quoteBuy(200);

        assertEq(protocol99, 0);
        assertEq(creator99, 0);
        assertEq(protocol100, 1);
        assertEq(creator100, 1);
        assertEq(protocol199, 1);
        assertEq(creator199, 1);
        assertEq(protocol200, 2);
        assertEq(creator200, 2);
    }

    function testBuyRejectsTradeThatWouldExceedRealTokenInventory() public {
        vm.expectRevert(BondingCurveMarket.InsufficientLiquidity.selector);
        market.quoteBuy(3 ether);
    }

    function testForcedEtherIsSurplusNotMarketReserveOrFeeLiability() public {
        vm.deal(address(this), 1 ether);
        uint256 realReserveBefore = market.realEthReserve();
        uint256 feeLiabilityBefore = market.totalClaimableFees();

        new ForceEtherToMarket{value: 1 ether}(payable(address(market)));

        assertEq(market.realEthReserve(), realReserveBefore);
        assertEq(market.totalClaimableFees(), feeLiabilityBefore);
        assertEq(address(market).balance, realReserveBefore + feeLiabilityBefore + 1 ether);
    }

    function testCreatorAndProtocolRecipientOverlapDoesNotDoubleCountLiability() public {
        vm.deal(address(this), 1 ether);
        LaunchpadFactory overlapFactory = new LaunchpadFactory(address(this));
        (, address overlapMarketAddress) = overlapFactory.createToken{value: overlapFactory.CREATION_FEE()}(
            "Overlapping Recipients", "OVER", "ipfs://overlapping-recipients"
        );
        BondingCurveMarket overlapMarket = BondingCurveMarket(payable(overlapMarketAddress));

        overlapMarket.buy{value: 0.1 ether}(0, block.timestamp);

        assertGt(overlapMarket.claimableFees(address(this)), 0);
        assertEq(overlapMarket.claimableFees(address(this)), overlapMarket.totalClaimableFees());
        assertEq(address(overlapMarket).balance, overlapMarket.realEthReserve() + overlapMarket.totalClaimableFees());
    }

    function testRejectingFeeRecipientWithdrawalPreservesLiability() public {
        vm.deal(address(this), 1 ether);
        RejectingMarketFeeRecipient rejector = new RejectingMarketFeeRecipient();
        LaunchpadFactory rejectingFactory = new LaunchpadFactory(address(rejector));
        BondingCurveMarket rejectingMarket = rejector.createMarketAndBuy{value: 0.1 ether}(rejectingFactory);
        uint256 claimableBefore = rejectingMarket.claimableFees(address(rejector));
        uint256 totalBefore = rejectingMarket.totalClaimableFees();

        assertGt(claimableBefore, 0);
        vm.expectRevert(BondingCurveMarket.FeeWithdrawalFailed.selector);
        rejector.withdrawMarketFees(rejectingMarket);

        assertEq(rejectingMarket.claimableFees(address(rejector)), claimableBefore);
        assertEq(rejectingMarket.totalClaimableFees(), totalBefore);
        assertEq(
            address(rejectingMarket).balance, rejectingMarket.realEthReserve() + rejectingMarket.totalClaimableFees()
        );
    }
}
