// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

interface IVoucherHub {
    event VoucherCreated();
    event VoucherTypeAdded(uint256 indexed voucherTypeId, string description);
    event VoucherDurationSet(uint256 indexed voucherTypeId, uint256 duration);
    event AssetEligibilitySet(uint256 indexed voucherTypeId, address asset, bool isEligible);
}
