// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

/**
 * @title Interface of the voucher contract.
 */
interface IVoucher {
    /**
     * @notice Event emitted when the expiration of the voucher is updated.
     * @param newExpiration The new expiration timestamp.
     */
    event ExpirationUpdated(uint256 newExpiration);

    /**
     * @notice Retrieves the expiration timestamp of the voucher.
     * @return expirationTimestamp The expiration timestamp.
     */
    function getExpiration() external view returns (uint256 expirationTimestamp);
}
