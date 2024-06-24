// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {VoucherHub} from "../VoucherHub.sol";

/**
 * @notice This contract is for upgradeability testing purposes only.
 */

contract VoucherHubV2Mock is VoucherHub {
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800;

    struct VoucherHubStorageV2 {
        address _iexecPoco;
        address _voucherBeacon;
        /// @dev This hash should be updated when `VoucherProxy` is updated.
        bytes32 _voucherCreationCodeHash;
        VoucherType[] _voucherTypes;
        mapping(uint256 voucherTypeId => mapping(address asset => bool)) _matchOrdersEligibility;
        mapping(address voucherAddress => bool) _isVoucher;
        string _foo;
    }

    function initializeV2(string calldata bar) public reinitializer(2) {
        VoucherHubStorageV2 storage $ = _getVoucherHubStorageV2();
        $._foo = bar;
    }

    function foo() external view returns (string memory) {
        VoucherHubStorageV2 storage $ = _getVoucherHubStorageV2();
        return $._foo;
    }

    function _getVoucherHubStorageV2() private pure returns (VoucherHubStorageV2 storage $) {
        assembly ("memory-safe") {
            $.slot := VOUCHER_HUB_STORAGE_LOCATION
        }
    }
}
