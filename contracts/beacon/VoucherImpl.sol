// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IVoucher} from "./IVoucher.sol";
import {VoucherStorageAbstract} from "./VoucherStorageAbstract.sol";

/**
 * @title Implementation of the voucher contract.
 * @notice Deployed along the Beacon contract using "Upgrades" plugin of OZ.
 */
contract VoucherImpl is Initializable, IVoucher, VoucherStorageAbstract {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Initialize implementation contract.
     * @param expiration initial expiration.
     */
    function initialize(uint256 expiration) external initializer {
        VoucherStorage storage $ = _getVoucherStorage();
        $.expiration = expiration;
        emit ExpirationUpdated(expiration);
    }

    function getExpiration() external view override returns (uint) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $.expiration;
    }
}
