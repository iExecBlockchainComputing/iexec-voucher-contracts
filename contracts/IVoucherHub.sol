// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

/**
 * @title Interface of the voucher hub contract.
 */
interface IVoucherHub {
    struct VoucherType {
        string description;
        uint256 duration;
    }
    event VoucherCreated(
        address indexed voucher,
        address owner,
        uint256 voucherType,
        uint256 expiration
    );
    event VoucherTypeCreated(uint256 indexed id, string description, uint256 duration);
    event VoucherTypeDescriptionUpdated(uint256 indexed id, string description);
    event VoucherTypeDurationUpdated(uint256 indexed id, uint256 duration);
    event EligibleAssetAdded(uint256 indexed id, address asset);
    event EligibleAssetRemoved(uint256 indexed id, address asset);

    function createVoucher(
        address owner,
        uint256 voucherType
    ) external returns (address voucherAddress);

    function getVoucher(address account) external view returns (address voucherAddress);

    function getVoucherBeacon() external view returns (address voucherBeacon);

    function getIexecPoco() external view returns (address iexecPoco);

    function getVoucherTypeCount() external view returns (uint256 count);

    function getVoucherType(uint256 id) external view returns (VoucherType memory);

    function addEligibleAsset(uint256 voucherTypeId, address asset) external;

    function removeEligibleAsset(uint256 voucherTypeId, address asset) external;

    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId,
        address asset
    ) external view returns (bool isEligible);
}
