// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IVoucher} from "../beacon/IVoucher.sol";

contract VoucherImplV2Mock is OwnableUpgradeable, IVoucher {
    /// @custom:storage-location erc7201:iexec.voucher.storage.Voucher
    struct VoucherStorage {
        address _creditERC20;
        uint256 _expiration;
        uint256 _type;
        mapping(address => bool) _authorizedAccounts;
        uint256 _newStateVariable;
    }

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.Voucher")) - 1))
    // & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_STORAGE_LOCATION =
        0xc2e244293dc04d6c7fa946e063317ff8e6770fd48cbaff411a60f1efc8a7e800;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Initialize new implementation contract.
     * @param newStateVariable test variable.
     */
    function initialize(uint256 newStateVariable) external reinitializer(2) {
        VoucherStorage storage $ = _getVoucherStorage();
        $._newStateVariable = newStateVariable;
    }

    function getExpiration() external view override returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._expiration;
    }

    function getNewStateVariable() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._newStateVariable;
    }

    function _getVoucherStorage() private pure returns (VoucherStorage storage $) {
        assembly {
            $.slot := VOUCHER_STORAGE_LOCATION
        }
    }
}
