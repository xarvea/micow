// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Fixed-supply launch token. Supply is minted once to the factory.
contract LaunchToken is ERC20 {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 ether;

    constructor(
        string memory name_,
        string memory symbol_,
        address initialHolder
    ) ERC20(name_, symbol_) {
        if (initialHolder == address(0)) revert ZeroAddress();
        _mint(initialHolder, TOTAL_SUPPLY);
    }

    error ZeroAddress();
}
