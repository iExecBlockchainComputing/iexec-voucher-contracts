// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

/**
 * @title Interface of the voucher contract.
 */
interface IVoucher {
    event VersionUpdated(uint newVersion);

    function getVersion() external returns (uint);
}
