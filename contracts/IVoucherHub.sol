// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

interface IVoucherHub {
    event VoucherCreated();
    event NewVoucherTypeCreated(uint256 indexed id, string description, uint256 duration);
    event VoucherTypeDescriptionUpdated(uint256 indexed id, string description);
    event VoucherTypeDurationUpdated(uint256 indexed id, uint256 duration);
    event AssetEligibilitySet(uint256 indexed id, address asset, bool isEligible);
}
