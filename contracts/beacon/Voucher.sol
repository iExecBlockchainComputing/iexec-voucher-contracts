// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IVoucher} from "./IVoucher.sol";

/**
 * @title Implementation of the voucher contract.
 * Deployed along the Beacon contract using "Upgrades" plugin of OZ.
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
     * @param owner The owner of the contract.
     * @param voucherType The type of the voucher.
     * @param expiration The expiration timestamp of the voucher.
     * @param voucherHub The address of the voucher hub.
     */
    function initialize(
        address owner,
        address voucherHub,
        uint256 expiration,
        uint256 voucherType
    ) external initializer {
        __Ownable_init(owner);
        VoucherStorage storage $ = _getVoucherStorage();
        $._voucherHub = voucherHub;
        $._expiration = expiration;
        $._type = voucherType;
        // TODO: deposit sRLC.
    }

    /**
     * Retrieve the address of the voucher hub associated with the voucher.
     * @return voucherHubAddress The address of the voucher hub.
     */
    function getVoucherHub() external view returns (address) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._voucherHub;
    }

    /**
     * Retrieve the expiration timestamp of the voucher.
     * @return expirationTimestamp The expiration timestamp.
     */
    function getExpiration() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._expiration;
    }

    /**
     * Retrieve the type of the voucher.
     * @return voucherType The type of the voucher.
     */
    function getType() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._type;
    }

    /**
     * Sets authorization for an account.
     * @param account The account to authorize.
     */
    function authorizeAccount(address account) external onlyOwner {
        _setAccountAuthorization(account, true);
        emit AccountAuthorized(account);
    }

    /**
     * Unsets authorization for an account.
     * @param account The account to remove authorization from.
     */
    function unauthorizeAccount(address account) external onlyOwner {
        _setAccountAuthorization(account, false);
        emit AccountUnauthorized(account);
    }

    /**
     * Checks if an account is authorized for.
     * @param account The account to check.
     * @return isAuthorized True if the account is authorized, false otherwise.
     */
    function isAccountAuthorized(address account) external view returns (bool) {
        VoucherStorage storage $ = _getVoucherStorage();
        return account == owner() || $._authorizedAccounts[account];
    }

    /**
     * Internal function to set authorization for an account.
     * @param account The account to set authorization for.
     * @param isAuthorized Whether to authorize or unauthorize the account.
     */
    function _setAccountAuthorization(address account, bool isAuthorized) private {
        require(account != owner(), "Voucher: owner is already authorized.");
        VoucherStorage storage $ = _getVoucherStorage();
        $._authorizedAccounts[account] = isAuthorized;
    }
}
