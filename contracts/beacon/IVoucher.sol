// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

/**
 * @title Interface of the voucher contract.
 */
interface IVoucher {
    event AccountAuthorized(address indexed account);
    event AccountUnauthorized(address indexed account);

    /**
     * @notice Retrieve the expiration timestamp of the voucher.
     * @return expirationTimestamp The expiration timestamp.
     */
    function getExpiration() external view returns (uint256 expirationTimestamp);

    /**
     * @notice Retrieve the type of the voucher.
     * @return voucherType The type of the voucher.
     */
    function getType() external view returns (uint256 voucherType);

    /**
     * @notice Retrieve the address of the voucher hub associated with the voucher.
     * @return voucherHubAddress The address of the voucher hub.
     */
    function getHub() external view returns (address voucherHubAddress);

    /**
     * @notice Sets authorization for an account.
     * @param account The account to authorize.
     */
    function authorizeAccount(address account) external;

    /**
     * @notice Unsets authorization for an account.
     * @param account The account to remove authorization from.
     */
    function unauthorizeAccount(address account) external;

    /**
     * @notice Checks if an account is authorized.
     * @param account The account to check.
     * @return isAuthorized True if the account is authorized, false otherwise.
     */
    function isAccountAuthorized(address account) external view returns (bool isAuthorized);
}
