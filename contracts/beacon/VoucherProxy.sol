// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";

/**
 * @title Beacon proxy contract instance that is deployed per user.
 * @notice Deployed by the VoucherHub contract.
 * @dev /!\ Important notice:
 *  When updating this `VoucherProxy` contract (when bumping open-zeppelin version
 *  for instance), do not forget to update `VoucherHub#_voucherCreationCodeHash`.
 */
contract VoucherProxy is BeaconProxy {
    /**
     * @dev /!\ Caution if this contract is deployed without using the
     * VoucherHub contract.
     * @dev /!\ Do not forget to initialize this contract after creation,
     * ideally, in the same transaction.
     *
     * @dev This contract is deployed by the VoucherHub contract using create2
     * mechanism. The initialization process is excluded from the constructor
     * to make computing the contract address easier and not dependent
     * on a lot of inputs (constructor args) that could later be difficult to
     * gather. In this case, computing the address of the contract requires
     * knowing its bytecode, the used salt (contract owner address), and only
     * one constructor argument (beaconAddress) which is already available in the
     * storage of the factory contract (VoucherHub).
     *
     * @dev By design, only 1 contract instance is created by account as explained
     * above. This is a business requirement.
     * The voucher type could be introduced to make it possible to have 1 instance
     * by account by type.
     *
     * @param beaconAddress used by the proxy.
     */
    constructor(address beaconAddress) BeaconProxy(beaconAddress, new bytes(0)) {}

    receive() external payable {
        revert("VoucherProxy: Receive function not supported");
    }

    /**
     * Get implementation address.
     * @dev Used in tests.
     */
    function implementation() external view returns (address) {
        return _implementation();
    }
}
