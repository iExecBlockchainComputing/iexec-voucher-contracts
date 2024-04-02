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
    event VoucherCreated(address indexed voucher, address owner, uint256 expiration);
    event VoucherTypeCreated(uint256 indexed id, string description, uint256 duration);
    event VoucherTypeDescriptionUpdated(uint256 indexed id, string description);
    event VoucherTypeDurationUpdated(uint256 indexed id, uint256 duration);
    event EligibleAssetAdded(uint256 indexed id, address asset);
    event EligibleAssetRemoved(uint256 indexed id, address asset);

    /**
     * @notice Create a new voucher for the specified owner.
     * @param owner The address of the voucher owner.
     * @param voucherType The ID of the voucher type.
     * @return voucherAddress The address of the created voucher contract.
     */
    function createVoucher(
        address owner,
        uint256 voucherType
    ) external returns (address voucherAddress);

    /**
     * @notice Get the voucher address of a given account.
     * @param account The address of the voucher owner.
     * @return voucherAddress The address of the voucher contract.
     */
    function getVoucher(address account) external view returns (address voucherAddress);

    /**
     * @notice Get the voucher beacon address.
     * @return voucherBeacon The address of the voucher beacon.
     */
    function getVoucherBeacon() external view returns (address voucherBeacon);

    /**
     * @notice Get the iExec Poco address.
     * @return iexecPoco The address of the iExec Poco contract.
     */
    function getIexecPoco() external view returns (address iexecPoco);

    /**
     * @notice Get the count of voucher types.
     * @return count The count of voucher types.
     */
    function getVoucherTypeCount() external view returns (uint256 count);

    /**
     * @notice Get the voucher type details by ID.
     * @param id The ID of the voucher type.
     * @return VoucherType The details of the voucher type.
     */
    function getVoucherType(uint256 id) external view returns (VoucherType memory);

    /**
     * @notice Add an eligible asset for a voucher type.
     * @param voucherTypeId The ID of the voucher type.
     * @param asset The address of the asset to add.
     */
    function addEligibleAsset(uint256 voucherTypeId, address asset) external;

    /**
     * @notice Remove an eligible asset for a voucher type.
     * @param voucherTypeId The ID of the voucher type.
     * @param asset The address of the asset to remove.
     */
    function removeEligibleAsset(uint256 voucherTypeId, address asset) external;

    /**
     * @notice Check if an asset is eligible to match orders sponsoring.
     * @param voucherTypeId The ID of the voucher type.
     * @param asset The address of the asset to check.
     * @return isEligible True if the asset is eligible, otherwise False.
     */
    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId,
        address asset
    ) external view returns (bool isEligible);
}
