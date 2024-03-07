// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

contract VoucherHub {
    event VoucherCreated();

    constructor() {
    }

    function createVoucher() public {
        emit VoucherCreated();
    }
}
