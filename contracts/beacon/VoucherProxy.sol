// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title Beacon proxy contract instance that is deployed per user.
 *
 */
contract VoucherProxy is BeaconProxy {
    constructor(
        address beaconAddress,
        bytes memory initialization
    ) BeaconProxy(beaconAddress, initialization) {}

    /**
     * TODO
     * @dev Removes warning:
     * "This contract has a payable fallback function, but no receive
     * ether function. Consider adding a receive ether function"
     */
    receive() external payable {}

    /**
     * Get beacon address.
     */
    function beacon() external view returns (address) {
        return _getBeacon();
    }

    /**
     * Get implementation address.
     * @dev Used in tests.
     */
    function implementation() external view returns (address) {
        return _implementation();
    }
}
