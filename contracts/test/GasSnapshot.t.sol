// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

/// @notice Emits operation-level gas measurements. Values are collected from forge test -vvv
/// under the pinned foundry.toml compiler/EVM/optimizer settings; they are not CI thresholds.
contract GasSnapshotTest is Test {
    LaunchpadFactory internal factory;
    LaunchToken internal token;
    BondingCurveMarket internal market;

    address internal protocolFeeRecipient;
    address internal creator;
    address internal trader;

    function setUp() public {
        vm.warp(1_000_000);
        protocolFeeRecipient = makeAddr("gas-protocol-recipient");
        creator = makeAddr("gas-creator");
        trader = makeAddr("gas-trader");
        factory = new LaunchpadFactory(protocolFeeRecipient);
        vm.deal(creator, 10 ether);

        uint256 creationFee = factory.CREATION_FEE();
        vm.prank(creator);
        (address tokenAddress, address marketAddress) =
            factory.createToken{value: creationFee}("Gas Snapshot", "GAS", "ipfs://gas-snapshot");
        token = LaunchToken(tokenAddress);
        market = BondingCurveMarket(payable(marketAddress));
        vm.deal(trader, 10 ether);
    }

    function testGas_FactoryDeployment() public {
        address recipient = makeAddr("gas-deploy-recipient");
        uint256 startGas = gasleft();
        LaunchpadFactory deployed = new LaunchpadFactory(recipient);
        uint256 gasUsed = startGas - gasleft();
        vm.expectRevert(LaunchpadFactory.UnauthorizedTreasury.selector);
        deployed.withdrawTreasuryFees();
        assertGt(address(deployed).code.length, 0);
        emit log_named_uint("gas.factory_deployment", gasUsed);
    }

    function testGas_TokenCreation() public {
        uint256 creationFee = factory.CREATION_FEE();
        uint256 startGas = gasleft();
        vm.prank(creator);
        factory.createToken{value: creationFee}("Gas Token", "GT", "ipfs://gas-token");
        emit log_named_uint("gas.token_creation_including_token_and_market", startGas - gasleft());
    }

    function testGas_Buy() public {
        uint256 startGas = gasleft();
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);
        emit log_named_uint("gas.buy", startGas - gasleft());
    }

    function testGas_Sell() public {
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);
        uint256 amount = token.balanceOf(trader);
        vm.prank(trader);
        token.approve(address(market), amount);

        uint256 startGas = gasleft();
        vm.prank(trader);
        market.sell(amount, 0, block.timestamp);
        emit log_named_uint("gas.sell", startGas - gasleft());
    }

    function testGas_MarketFeeWithdrawal() public {
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);

        uint256 startGas = gasleft();
        vm.prank(protocolFeeRecipient);
        market.withdrawFees();
        emit log_named_uint("gas.market_fee_withdrawal", startGas - gasleft());
    }

    function testGas_TreasuryCreationFeeWithdrawal() public {
        uint256 startGas = gasleft();
        vm.prank(protocolFeeRecipient);
        factory.withdrawTreasuryFees();
        emit log_named_uint("gas.treasury_creation_fee_withdrawal", startGas - gasleft());
    }
}
