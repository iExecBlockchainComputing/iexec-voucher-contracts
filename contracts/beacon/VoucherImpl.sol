// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IVoucher} from "./IVoucher.sol";
import {VoucherBase} from "./VoucherBase.sol";

/**
 * @title Implementation of the voucher contract.
 * @notice Deployed along the Beacon contract using "Upgrades" plugin of OZ.
 */
contract VoucherImpl is Initializable, IVoucher, VoucherBase {
    /**
     * Initialize implementation contract.
     * @param _version initial version.
     */
    function initialize(uint _version) external initializer {
        version = _version;
    }

    // TODO remove
    function setVersion(uint _newVersion) external override {
        version = _newVersion;
    }

    // TODO remove
    function getVersion() external view override returns (uint) {
        return version;
    }
}
