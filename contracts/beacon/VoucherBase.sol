// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

/**
 * @title Storage of the voucher proxy contract.
 * @notice Extracted here to be shared with the implementation contract.
 */
abstract contract VoucherBase {
    // TODO use erc7201 (erc7201:iexec.voucher.storage.Voucher)
    // TODO remove
    uint internal version;
}
