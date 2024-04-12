// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Testing purposes only.
 */
contract IexecPocoMock is ERC20 {
    constructor() ERC20("Staked RLC", "SRLC") {
        _mint(msg.sender, 1000000);
    }
}
