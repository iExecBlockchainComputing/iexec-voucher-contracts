// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {VoucherBase} from "./VoucherBase.sol";

/**
 * @title Beacon proxy contract instance that is deployed per user.
 *
 * @dev TODO use oz/OwnableUpgradeable if compatible to benefit from erc7201 storage
 * (openzeppelin.storage.Ownable).
 */
contract VoucherProxy is Ownable, BeaconProxy, VoucherBase {
    constructor(
        address ownerAddress,
        address beaconAddress,
        bytes memory initialization
    ) Ownable(ownerAddress) BeaconProxy(beaconAddress, initialization) {}

    /**
     * TODO
     * @dev Removes warning:
     * "This contract has a payable fallback function, but no receive
     * ether function. Consider adding a receive ether function"
     */
    receive() external payable {}

    /**
     * TODO remove if not useful.
     * Currently used in tests.
     */
    function beacon() external view returns (address) {
        return _getBeacon();
    }

    /**
     * TODO remove if not useful.
     * Currently used in tests.
     */
    function implementation() external view returns (address) {
        return _implementation();
    }
}
