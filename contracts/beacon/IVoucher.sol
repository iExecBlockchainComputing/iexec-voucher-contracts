// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

interface IVoucher {
    event AccountAuthorized(address indexed account);
    event AccountUnauthorized(address indexed account);

    function getExpiration() external view returns (uint256);

    function getType() external view returns (uint256);

    function getVoucherHub() external view returns (address);

    function authorizeAccount(address account) external;

    function unauthorizeAccount(address account) external;

    function isAccountAuthorized(address account) external view returns (bool);
}
