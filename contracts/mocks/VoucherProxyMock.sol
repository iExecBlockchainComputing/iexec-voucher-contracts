// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {VoucherProxy} from "../beacon/VoucherProxy.sol";

contract VoucherProxyMock is VoucherProxy {
    constructor(address beaconAddress) VoucherProxy(beaconAddress) {}

    function implementation() external view returns (address) {
        return _implementation();
    }
}
