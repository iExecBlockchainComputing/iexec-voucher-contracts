// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

interface IVoucherHub {
    event VoucherCreated(address voucher, address owner);

    function createVoucher(
        address account,
        uint256 expiration
    ) external returns (address voucherAddress);
    function getVoucher(address account) external view returns (address voucherAddress);
}
