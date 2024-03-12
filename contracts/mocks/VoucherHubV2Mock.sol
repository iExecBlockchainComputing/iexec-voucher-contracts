// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {VoucherHub} from "../VoucherHub.sol";

pragma solidity ^0.8.20;

contract VoucherHubV2Mock is VoucherHub {
    // For production use, please instead use ERC7201 when adding new variables
    string public foo;

    function initializeV2(string calldata _foo) public reinitializer(2) {
        __UUPSUpgradeable_init();
        foo = _foo;
    }
}
