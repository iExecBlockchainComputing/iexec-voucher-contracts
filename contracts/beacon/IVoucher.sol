// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

/**
 * @title Interface of the voucher contract.
 */
interface IVoucher {
    event AccountAuthorized(address indexed account);
    event AccountUnauthorized(address indexed account);

    function getExpiration() external view returns (uint256 expirationTimestamp);

    function getType() external view returns (uint256 voucherType);

    function getVoucherHub() external view returns (address voucherHubAddress);

    function authorizeAccount(address account) external;

    function unauthorizeAccount(address account) external;

    function isAccountAuthorized(address account) external view returns (bool isAuthorized);
}
