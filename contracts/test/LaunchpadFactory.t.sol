// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

contract LaunchpadFactoryTest is Test {
    LaunchpadFactory internal factory;
    address internal protocolFeeRecipient;
    address internal creator;

    function setUp() public {
        protocolFeeRecipient = makeAddr("protocol");
        creator = makeAddr("creator");
        factory = new LaunchpadFactory(protocolFeeRecipient);
        vm.deal(creator, 1 ether);
    }

    function testCreateTokenHasFixedSupplyAndDedicatedMarket() public {
        vm.prank(creator);
        (address tokenAddress, address marketAddress) =
            factory.createToken{value: factory.CREATION_FEE()}("Micow Test", "MCWT", "ipfs://example-metadata");

        LaunchToken token = LaunchToken(tokenAddress);
        BondingCurveMarket market = BondingCurveMarket(payable(marketAddress));

        assertEq(token.totalSupply(), token.TOTAL_SUPPLY());
        assertEq(token.balanceOf(marketAddress), token.TOTAL_SUPPLY());
        assertEq(token.balanceOf(creator), 0);
        assertEq(factory.marketForToken(tokenAddress), marketAddress);
        assertEq(address(market.token()), tokenAddress);
        assertEq(market.creator(), creator);
        assertEq(market.protocolFeeRecipient(), protocolFeeRecipient);
    }

    function testCreationFeeMustBeExact() public {
        vm.expectRevert(
            abi.encodeWithSelector(LaunchpadFactory.IncorrectCreationFee.selector, factory.CREATION_FEE(), 0)
        );
        vm.prank(creator);
        factory.createToken("Micow Test", "MCWT", "ipfs://example-metadata");

        vm.expectRevert(
            abi.encodeWithSelector(
                LaunchpadFactory.IncorrectCreationFee.selector, factory.CREATION_FEE(), factory.CREATION_FEE() + 1
            )
        );
        vm.prank(creator);
        factory.createToken{value: factory.CREATION_FEE() + 1}("Micow Test", "MCWT", "ipfs://example-metadata");
    }

    function testCreationFeeAccruesAndTreasuryCanWithdraw() public {
        vm.prank(creator);
        factory.createToken{value: factory.CREATION_FEE()}("Micow Test", "MCWT", "ipfs://example-metadata");

        assertEq(factory.claimableTreasuryFees(protocolFeeRecipient), factory.CREATION_FEE());
        assertEq(factory.totalClaimableTreasuryFees(), factory.CREATION_FEE());
        assertEq(address(factory).balance, factory.totalClaimableTreasuryFees());

        uint256 beforeBalance = protocolFeeRecipient.balance;
        vm.prank(protocolFeeRecipient);
        factory.withdrawTreasuryFees();
        assertEq(protocolFeeRecipient.balance, beforeBalance + factory.CREATION_FEE());
        assertEq(factory.claimableTreasuryFees(protocolFeeRecipient), 0);
        assertEq(factory.totalClaimableTreasuryFees(), 0);
        assertEq(address(factory).balance, 0);
    }

    function testOnlyTreasuryCanWithdraw() public {
        vm.prank(creator);
        factory.createToken{value: factory.CREATION_FEE()}("Micow Test", "MCWT", "ipfs://example-metadata");
        vm.prank(creator);
        vm.expectRevert(LaunchpadFactory.UnauthorizedTreasury.selector);
        factory.withdrawTreasuryFees();
    }

    function testFailedCreationDoesNotAccrueFee() public {
        vm.expectRevert(LaunchpadFactory.EmptyNameOrSymbol.selector);
        vm.prank(creator);
        factory.createToken{value: factory.CREATION_FEE()}("", "MCWT", "ipfs://example-metadata");
        assertEq(factory.totalClaimableTreasuryFees(), 0);
        assertEq(address(factory).balance, 0);
    }

    function testRejectZeroProtocolFeeRecipient() public {
        vm.expectRevert(LaunchpadFactory.ZeroAddress.selector);
        new LaunchpadFactory(address(0));
    }

    function testRejectEmptyName() public {
        vm.expectRevert(LaunchpadFactory.EmptyNameOrSymbol.selector);
        vm.prank(creator);
        factory.createToken{value: factory.CREATION_FEE()}("", "MCWT", "");
    }

    function testRejectEmptySymbol() public {
        vm.expectRevert(LaunchpadFactory.EmptyNameOrSymbol.selector);
        vm.prank(creator);
        factory.createToken{value: factory.CREATION_FEE()}("Micow Test", "", "");
    }
}
