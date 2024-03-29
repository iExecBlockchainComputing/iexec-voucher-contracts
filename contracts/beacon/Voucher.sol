// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IVoucher} from "./IVoucher.sol";

/**
 * @title Implementation of the voucher contract.
 * @notice Deployed along the Beacon contract using "Upgrades" plugin of OZ.
 */
contract Voucher is OwnableUpgradeable, IVoucher {
    /// @custom:storage-location erc7201:iexec.voucher.storage.Voucher
    struct VoucherStorage {
        address _voucherHub;
        uint256 _expiration;
        uint256 _type;
        mapping(address => bool) _authorizedAccounts;
    }

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.Voucher")) - 1))
    // & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_STORAGE_LOCATION =
        0xc2e244293dc04d6c7fa946e063317ff8e6770fd48cbaff411a60f1efc8a7e800;

    function _getVoucherStorage() private pure returns (VoucherStorage storage $) {
        assembly {
            $.slot := VOUCHER_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Initialize implementation contract.
     * @param expiration initial expiration.
     */
    function initialize(
        address owner,
        uint256 vtype,
        uint256 expiration,
        address voucherHub
    ) external initializer {
        __Ownable_init(owner);
        VoucherStorage storage $ = _getVoucherStorage();
        $._type = vtype;
        $._voucherHub = voucherHub;
        $._expiration = expiration;
        $._authorizedAccounts[owner] = true;
        // deposit
        emit AuthorizationSet(owner);
    }

    function getHub() external view returns (address voucherHubAddress) {
        VoucherStorage storage $ = _getVoucherStorage();
        voucherHubAddress = $._voucherHub;
    }

    function getExpiration() external view override returns (uint256 expirationTimestamp) {
        VoucherStorage storage $ = _getVoucherStorage();
        expirationTimestamp = $._expiration;
    }

    function getType() external view returns (uint256 voucherType) {
        VoucherStorage storage $ = _getVoucherStorage();
        voucherType = $._type;
    }

    function setAuthorization(address account) external onlyOwner {
        VoucherStorage storage voucherStorage = _getVoucherStorage();
        voucherStorage._authorizedAccounts[account] = true;
        emit AuthorizationSet(account);
    }

    function unsetAuthorization(address account) external onlyOwner {
        VoucherStorage storage voucherStorage = _getVoucherStorage();
        voucherStorage._authorizedAccounts[account] = false;
        emit AuthorizationUnset(account);
    }

    function isAccountAuthorized(address account) external view returns (bool isAuthorized) {
        VoucherStorage storage voucherStorage = _getVoucherStorage();
        isAuthorized = voucherStorage._authorizedAccounts[account];
    }
}
