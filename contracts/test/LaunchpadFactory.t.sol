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
    }

    function testCreateTokenHasFixedSupplyAndDedicatedMarket() public {
        vm.prank(creator);
        (address tokenAddress, address marketAddress) =
            factory.createToken("Micow Test", "MCWT", "ipfs://example-metadata");

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

    function testRejectZeroProtocolFeeRecipient() public {
        vm.expectRevert(LaunchpadFactory.ZeroAddress.selector);
        new LaunchpadFactory(address(0));
    }

    function testRejectEmptyName() public {
        vm.expectRevert(LaunchpadFactory.EmptyNameOrSymbol.selector);
        vm.prank(creator);
        factory.createToken("", "MCWT", "");
    }

    function testRejectEmptySymbol() public {
        vm.expectRevert(LaunchpadFactory.EmptyNameOrSymbol.selector);
        vm.prank(creator);
        factory.createToken("Micow Test", "", "");
    }
}
