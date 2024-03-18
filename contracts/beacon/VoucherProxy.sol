// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {VoucherBase} from "./VoucherBase.sol";

contract VoucherProxy is Ownable, BeaconProxy, VoucherBase {
    constructor(
        address _beacon,
        bytes memory _data
    ) Ownable(_msgSender()) BeaconProxy(_beacon, _data) {}

    /**
     * TODO remove if not useful.
     */
    function beacon() external view returns (address) {
        return _getBeacon();
    }

    /**
     * TODO remove if not useful.
     */
    function implementation() public view returns (address) {
        return _implementation();
    }

    /**
     * TODO
     * @dev Remove warning:
     * "This contract has a payable fallback function, but no receive
     * ether function. Consider adding a receive ether function"
     */
    receive() external payable {}
}
