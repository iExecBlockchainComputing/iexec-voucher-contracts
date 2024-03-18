// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {VoucherBase} from "./VoucherBase.sol";

contract VoucherProxy is Ownable, BeaconProxy, VoucherBase {
    constructor(
        address beacon,
        bytes memory data
    ) Ownable(_msgSender()) BeaconProxy(beacon, data) {}

    function implementation() public view returns (address) {
        return _implementation();
    }

    receive() external payable {} // TODO
}
