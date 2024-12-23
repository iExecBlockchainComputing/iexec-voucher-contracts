// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {VoucherHubV2} from "../VoucherHubV2.sol";

/**
 * @notice This contract is for upgradeability testing purposes only.
 */

contract VoucherHubV3Mock is VoucherHubV2 {
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800;

    struct VoucherHubStorageV3 {
        address _iexecPoco;
        address _voucherBeacon;
        /// @dev This hash should be updated when `VoucherProxy` is updated.
        bytes32 _voucherCreationCodeHash;
        VoucherType[] _voucherTypes;
        mapping(uint256 voucherTypeId => mapping(address asset => bool)) _matchOrdersEligibility;
        mapping(address voucherAddress => bool) _isVoucher;
        string _foo;
    }

    function initializeV3(string calldata bar) public reinitializer(3) {
        VoucherHubStorageV3 storage $ = _getVoucherHubStorageV3();
        $._foo = bar;
    }

    function foo() external view returns (string memory) {
        VoucherHubStorageV3 storage $ = _getVoucherHubStorageV3();
        return $._foo;
    }

    function _getVoucherHubStorageV3() private pure returns (VoucherHubStorageV3 storage $) {
        assembly ("memory-safe") {
            $.slot := VOUCHER_HUB_STORAGE_LOCATION
        }
    }
}
