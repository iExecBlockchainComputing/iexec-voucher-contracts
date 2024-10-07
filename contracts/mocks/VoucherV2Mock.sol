// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

contract VoucherV2Mock is Initializable {
    /// @custom:storage-location erc7201:iexec.voucher.storage.Voucher
    struct VoucherStorage {
        address _owner;
        address _voucherHub;
        uint256 _expiration;
        uint256 _type;
        mapping(address => bool) _authorizedAccounts;
        mapping(bytes32 dealId => uint256) _sponsoredAmounts;
        mapping(bytes32 taskId => bool) _refundedTasks;
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
    function initializeV2(uint256 newStateVariable) external reinitializer(2) {
        VoucherStorage storage $ = _getVoucherStorage();
        $._newStateVariable = newStateVariable;
    }

    function getExpiration() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._expiration;
    }

    function getNewStateVariable() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._newStateVariable;
    }

    function owner() public view returns (address) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._owner;
    }

    function _getVoucherStorage() private pure returns (VoucherStorage storage $) {
        assembly ("memory-safe") {
            $.slot := VOUCHER_STORAGE_LOCATION
        }
    }
}
