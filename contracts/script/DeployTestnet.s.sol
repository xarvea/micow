// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {LaunchpadFactory} from "../src/LaunchpadFactory.sol";

/// @notice Testnet-only deployment script. The broadcaster key is supplied externally.
contract DeployTestnet is Script {
    uint256 internal constant ROBINHOOD_TESTNET_CHAIN_ID = 46630;

    function run() external returns (LaunchpadFactory factory) {
        require(block.chainid == ROBINHOOD_TESTNET_CHAIN_ID, "TESTNET_ONLY");
        address protocolFeeRecipient = vm.envAddress("PROTOCOL_FEE_RECIPIENT");
        require(protocolFeeRecipient != address(0), "ZERO_FEE_RECIPIENT");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        factory = new LaunchpadFactory(protocolFeeRecipient);
        vm.stopBroadcast();

        console2.log("LaunchpadFactory", address(factory));
        console2.log("ProtocolFeeRecipient", protocolFeeRecipient);
        console2.log("ChainId", block.chainid);
    }
}
