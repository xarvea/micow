// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

contract BondingCurveMarketTest is Test {
    LaunchToken internal token;
    BondingCurveMarket internal market;
    address internal protocolRecipient;
    address internal creator;
    address internal trader;

    function setUp() public {
        vm.warp(100);
        protocolRecipient = makeAddr("protocol");
        creator = makeAddr("creator");
        trader = makeAddr("trader");
        LaunchpadFactory factory = new LaunchpadFactory(protocolRecipient);
        vm.prank(creator);
        (address tokenAddress, address marketAddress) = factory.createToken(
            "Micow Test",
            "MCWT",
            "ipfs://example-metadata"
        );
        token = LaunchToken(tokenAddress);
        market = BondingCurveMarket(payable(marketAddress));
        vm.deal(trader, 10 ether);
    }

    function testBuyAndSellPreserveReserveAccounting() public {
        vm.prank(trader);
        uint256 bought = market.buy{value: 0.1 ether}(1, block.timestamp);
        assertGt(bought, 0);
        assertEq(token.balanceOf(trader), bought);
        assertEq(address(market).balance, market.realEthReserve());

        vm.prank(trader);
        token.approve(address(market), bought / 2);
        vm.prank(trader);
        uint256 ethOut = market.sell(bought / 2, 1, block.timestamp);
        assertGt(ethOut, 0);
        assertEq(address(market).balance, market.realEthReserve());
        assertEq(
            token.balanceOf(address(market)) + token.balanceOf(trader),
            token.totalSupply()
        );
    }

    function testBuyRevertsWhenSlippageLimitIsImpossible() public {
        vm.expectRevert(BondingCurveMarket.SlippageExceeded.selector);
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

    function testDirectEtherTransferReverts() public {
        vm.prank(trader);
        (bool success, ) = address(market).call{value: 1 ether}("");
        assertFalse(success);
    }

    function testFuzz_BuyKeepsRealReservesSolvent(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1e12, 1 ether);
        vm.deal(trader, amount);
        vm.prank(trader);
        market.buy{value: amount}(0, block.timestamp);

        assertGt(token.balanceOf(trader), 0);
        assertEq(address(market).balance, market.realEthReserve());
        assertLe(market.realTokenReserve(), token.totalSupply());
    }

    function testFuzz_SellKeepsRealReservesSolvent(
        uint96 rawBuyAmount,
        uint96 rawSellAmount
    ) public {
        uint256 buyAmount = bound(uint256(rawBuyAmount), 1e12, 1 ether);
        vm.deal(trader, buyAmount);
        vm.prank(trader);
        uint256 bought = market.buy{value: buyAmount}(0, block.timestamp);
        uint256 sellAmount = bound(uint256(rawSellAmount), 1, bought);

        vm.prank(trader);
        token.approve(address(market), sellAmount);
        vm.prank(trader);
        market.sell(sellAmount, 0, block.timestamp);

        assertEq(address(market).balance, market.realEthReserve());
        assertEq(
            token.balanceOf(address(market)) + token.balanceOf(trader),
            token.totalSupply()
        );
    }
}
