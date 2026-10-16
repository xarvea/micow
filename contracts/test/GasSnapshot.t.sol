// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";
import {LaunchToken} from "../src/LaunchToken.sol";
import {BondingCurveMarket} from "../src/BondingCurveMarket.sol";

/// @dev Foundry 1.8.5 supports this cheatcode, while the pinned forge-std Vm interface may not expose it yet.
interface IGasSnapshotVm {
    function snapshotGasLastFrame(string calldata name) external returns (uint256 gasUsed);
}

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
        LaunchpadFactory deployed = new LaunchpadFactory(recipient);
        uint256 gasUsed = IGasSnapshotVm(address(vm)).snapshotGasLastFrame("factory_deployment");
        vm.expectRevert(LaunchpadFactory.UnauthorizedTreasury.selector);
        deployed.withdrawTreasuryFees();
        assertGt(address(deployed).code.length, 0);
        emit log_named_uint("gas.factory_deployment", gasUsed);
    }

    function testGas_TokenCreation() public {
        uint256 creationFee = factory.CREATION_FEE();
        vm.prank(creator);
        factory.createToken{value: creationFee}("Gas Token", "GT", "ipfs://gas-token");
        uint256 gasUsed = IGasSnapshotVm(address(vm)).snapshotGasLastFrame("token_creation_including_token_and_market");
        emit log_named_uint("gas.token_creation_including_token_and_market", gasUsed);
    }

    function testGas_Buy() public {
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);
        uint256 gasUsed = IGasSnapshotVm(address(vm)).snapshotGasLastFrame("buy");
        emit log_named_uint("gas.buy", gasUsed);
    }

    function testGas_Sell() public {
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);
        uint256 amount = token.balanceOf(trader);
        vm.prank(trader);
        token.approve(address(market), amount);

        vm.prank(trader);
        market.sell(amount, 0, block.timestamp);
        uint256 gasUsed = IGasSnapshotVm(address(vm)).snapshotGasLastFrame("sell");
        emit log_named_uint("gas.sell", gasUsed);
    }

    function testGas_MarketFeeWithdrawal() public {
        vm.prank(trader);
        market.buy{value: 0.1 ether}(0, block.timestamp);

        vm.prank(protocolFeeRecipient);
        market.withdrawFees();
        uint256 gasUsed = IGasSnapshotVm(address(vm)).snapshotGasLastFrame("market_fee_withdrawal");
        emit log_named_uint("gas.market_fee_withdrawal", gasUsed);
    }

    function testGas_TreasuryCreationFeeWithdrawal() public {
        vm.prank(protocolFeeRecipient);
        factory.withdrawTreasuryFees();
        uint256 gasUsed = IGasSnapshotVm(address(vm)).snapshotGasLastFrame("treasury_creation_fee_withdrawal");
        emit log_named_uint("gas.treasury_creation_fee_withdrawal", gasUsed);
    }
}
