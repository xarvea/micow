// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {DeployTestnet} from "../script/DeployTestnet.s.sol";

contract DeployTestnetTest is Test {
    function testRejectsNonTestnetChainBeforeReadingSecrets() public {
        DeployTestnet script = new DeployTestnet();
        vm.expectRevert(abi.encodeWithSignature("Error(string)", "TESTNET_ONLY"));
        script.assertTestnetChain(1);
    }

    function testAcceptsRobinhoodTestnetChain() public {
        DeployTestnet script = new DeployTestnet();
        script.assertTestnetChain(46630);
    }
}
