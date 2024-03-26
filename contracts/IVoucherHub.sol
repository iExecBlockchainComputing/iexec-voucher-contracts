// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

interface IVoucherHub {
    event VoucherCreated(address indexed voucher, address owner, uint256 expiration);
    event VoucherTypeCreated(uint256 indexed id, string description, uint256 duration);
    event VoucherTypeDescriptionUpdated(uint256 indexed id, string description);
    event VoucherTypeDurationUpdated(uint256 indexed id, uint256 duration);
    event EligibleAssetAdded(uint256 indexed id, address asset);
    event EligibleAssetRemoved(uint256 indexed id, address asset);

    function createVoucher(
        address account,
        uint256 voucherType,
        uint256 creditBalance,
        uint256 expiration
    ) external returns (address voucherAddress);
    function getVoucher(address account) external view returns (address voucherAddress);
}
