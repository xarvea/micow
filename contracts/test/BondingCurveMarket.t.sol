// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

contract RejectingFeeRecipient {
    receive() external payable {
        revert("NO_ETH");
    }

    function createAndBuy(LaunchpadFactory factory)
        external
        payable
        returns (address tokenAddress, address marketAddress, uint256 tokensOut)
    {
        (tokenAddress, marketAddress) =
            factory.createToken{value: 0.0006 ether}("Rejecting Creator", "REJ", "ipfs://rejecting");
        tokensOut = BondingCurveMarket(payable(marketAddress)).buy{value: msg.value - factory.CREATION_FEE()}(
            0, block.timestamp
        );
    }

    function withdrawFactoryFees(LaunchpadFactory factory) external {
        factory.withdrawTreasuryFees();
    }
}

contract ReentrantFeeRecipient {
    BondingCurveMarket public market;

    receive() external payable {
        market.withdrawFees();
    }

    function createAndBuy(LaunchpadFactory factory) external payable returns (BondingCurveMarket createdMarket) {
        (address tokenAddress, address marketAddress) =
            factory.createToken{value: factory.CREATION_FEE()}("Reentrant Creator", "RENT", "ipfs://reentrant");
        require(tokenAddress != address(0), "NO_TOKEN");
        market = BondingCurveMarket(payable(marketAddress));
        createdMarket = market;
        market.buy{value: msg.value - factory.CREATION_FEE()}(0, block.timestamp);
    }

    function withdraw() external {
        market.withdrawFees();
    }

    function withdrawFactoryFees(LaunchpadFactory factory) external {
        factory.withdrawTreasuryFees();
    }
}

contract BondingCurveMarketTest is Test {
    LaunchToken internal token;
    BondingCurveMarket internal market;
    address internal protocolFeeRecipient;
    address internal creator;
    address internal trader;

    function setUp() public {
        vm.warp(100);
        protocolFeeRecipient = makeAddr("protocol");
        creator = makeAddr("creator");
        trader = makeAddr("trader");
        vm.deal(creator, 1 ether);
        LaunchpadFactory factory = new LaunchpadFactory(protocolFeeRecipient);
        uint256 creationFee = factory.CREATION_FEE();
        vm.prank(creator);
        (address tokenAddress, address marketAddress) =
            factory.createToken{value: creationFee}("Micow Test", "MCWT", "ipfs://example-metadata");
        token = LaunchToken(tokenAddress);
        market = BondingCurveMarket(payable(marketAddress));
        vm.deal(trader, 10 ether);
    }

    function testBuyAndSellPreserveReserveAccounting() public {
        (uint256 quotedBuy,,) = market.quoteBuy(0.1 ether);
        vm.prank(trader);
        uint256 bought = market.buy{value: 0.1 ether}(quotedBuy, block.timestamp);
        assertEq(bought, quotedBuy);
        assertGt(bought, 0);
        assertEq(token.balanceOf(trader), bought);
        assertEq(address(market).balance, market.realEthReserve() + market.totalClaimableFees());

        uint256 sellAmount = bought / 2;
        (uint256 quotedSell,,) = market.quoteSell(sellAmount);
        vm.prank(trader);
        token.approve(address(market), sellAmount);
        vm.prank(trader);
        uint256 ethOut = market.sell(sellAmount, quotedSell, block.timestamp);
        assertEq(ethOut, quotedSell);
        assertGt(ethOut, 0);
        assertEq(address(market).balance, market.realEthReserve() + market.totalClaimableFees());
        assertEq(token.balanceOf(address(market)) + token.balanceOf(trader), token.totalSupply());
    }

    function testBuyRevertsWhenSlippageLimitIsImpossible() public {
        (uint256 expectedOut,,) = market.quoteBuy(0.1 ether);
        vm.expectRevert(
            abi.encodeWithSelector(BondingCurveMarket.SlippageExceeded.selector, expectedOut, type(uint256).max)
        );
        vm.prank(trader);
        market.buy{value: 0.1 ether}(type(uint256).max, block.timestamp);
    }

    function testBuyRejectsExpiredDeadline() public {
        vm.expectRevert(BondingCurveMarket.DeadlineExpired.selector);
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp - 1);
    }

    function testSellRequiresApproval() public {
        vm.prank(trader);
        uint256 bought = market.buy{value: 0.1 ether}(0, block.timestamp);
        vm.expectRevert();
        vm.prank(trader);
        market.sell(bought / 2, 0, block.timestamp);
    }

    function testTinySellRevertsWhenOutputRoundsToZero() public {
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);
        vm.prank(trader);
        token.approve(address(market), 1);
        vm.expectRevert(BondingCurveMarket.InsufficientLiquidity.selector);
        vm.prank(trader);
        market.sell(1, 0, block.timestamp);
    }

    function testFeeRecipientsCanWithdrawAccruedFees() public {
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);
        uint256 creatorFees = market.claimableFees(creator);
        assertGt(market.claimableFees(protocolFeeRecipient), 0);
        assertGt(creatorFees, 0);

        uint256 beforeBalance = creator.balance;
        vm.prank(creator);
        market.withdrawFees();
        assertEq(creator.balance, beforeBalance + creatorFees);
        assertEq(market.claimableFees(creator), 0);
    }

    function testRejectingFeeRecipientCannotBlockTrading() public {
        RejectingFeeRecipient rejector = new RejectingFeeRecipient();
        LaunchpadFactory rejectingFactory = new LaunchpadFactory(address(rejector));
        vm.deal(address(this), 1 ether);
        (address tokenAddress, address marketAddress, uint256 tokensOut) =
            rejector.createAndBuy{value: 0.1 ether}(rejectingFactory);
        BondingCurveMarket rejectingMarket = BondingCurveMarket(payable(marketAddress));

        assertGt(tokensOut, 0);
        assertEq(LaunchToken(tokenAddress).balanceOf(address(rejector)), tokensOut);
        assertGt(rejectingMarket.claimableFees(address(rejector)), 0);
        assertEq(
            address(rejectingMarket).balance, rejectingMarket.realEthReserve() + rejectingMarket.totalClaimableFees()
        );
    }

    function testRejectingTreasuryCannotBlockCreationAndKeepsLiabilityOnFailedWithdrawal() public {
        RejectingFeeRecipient rejector = new RejectingFeeRecipient();
        LaunchpadFactory rejectingFactory = new LaunchpadFactory(address(rejector));
        vm.deal(address(this), 1 ether);
        rejector.createAndBuy{value: 0.1 ether}(rejectingFactory);

        assertEq(rejectingFactory.claimableTreasuryFees(address(rejector)), rejectingFactory.CREATION_FEE());
        vm.expectRevert(LaunchpadFactory.TreasuryFeeWithdrawalFailed.selector);
        rejector.withdrawFactoryFees(rejectingFactory);
        assertEq(rejectingFactory.claimableTreasuryFees(address(rejector)), rejectingFactory.CREATION_FEE());
        assertEq(rejectingFactory.totalClaimableTreasuryFees(), rejectingFactory.CREATION_FEE());
    }

    function testFeeWithdrawalCannotReenter() public {
        ReentrantFeeRecipient reentrant = new ReentrantFeeRecipient();
        LaunchpadFactory reentrantFactory = new LaunchpadFactory(address(reentrant));
        vm.deal(address(this), 1 ether);
        BondingCurveMarket reentrantMarket = reentrant.createAndBuy{value: 0.1 ether}(reentrantFactory);
        uint256 claimable = reentrantMarket.claimableFees(address(reentrant));
        assertGt(claimable, 0);

        vm.expectRevert(BondingCurveMarket.FeeWithdrawalFailed.selector);
        reentrant.withdraw();

        assertEq(reentrantMarket.claimableFees(address(reentrant)), claimable);
        assertEq(reentrantMarket.totalClaimableFees(), claimable);
    }

    function testDirectEtherTransferReverts() public {
        vm.prank(trader);
        (bool success,) = address(market).call{value: 1 ether}("");
        assertFalse(success);
    }

    function testFuzz_BuyKeepsRealReservesSolvent(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1e12, 1 ether);
        vm.deal(trader, amount);
        vm.prank(trader);
        market.buy{value: amount}(0, block.timestamp);

        assertGt(token.balanceOf(trader), 0);
        assertEq(address(market).balance, market.realEthReserve() + market.totalClaimableFees());
        assertLe(market.realTokenReserve(), token.totalSupply());
    }

    function testFuzz_SellKeepsRealReservesSolvent(uint96 rawBuyAmount, uint96 rawSellAmount) public {
        uint256 buyAmount = bound(uint256(rawBuyAmount), 1e12, 1 ether);
        vm.deal(trader, buyAmount);
        vm.prank(trader);
        uint256 bought = market.buy{value: buyAmount}(0, block.timestamp);
        uint256 sellAmount = bound(uint256(rawSellAmount), 1e12, bought);

        vm.prank(trader);
        token.approve(address(market), sellAmount);
        vm.prank(trader);
        market.sell(sellAmount, 0, block.timestamp);

        assertEq(address(market).balance, market.realEthReserve() + market.totalClaimableFees());
        assertEq(token.balanceOf(address(market)) + token.balanceOf(trader), token.totalSupply());
    }
}
