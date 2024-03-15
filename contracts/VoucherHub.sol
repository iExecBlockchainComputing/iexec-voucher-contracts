// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IVoucherHub} from "./IVoucherHub.sol";

pragma solidity ^0.8.20;

contract VoucherHub is OwnableUpgradeable, UUPSUpgradeable, IVoucherHub {
    struct VoucherTypeDescription {
        uint256 voucherTypeId;
        string description;
    }
    /// @custom:storage-location erc7201:iexec.voucher.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecPoco;
        VoucherTypeDescription[] _voucherTypeDescriptions;
        mapping(uint256 => uint256) _voucherDurationByVoucherTypeId;
        mapping(uint256 => mapping(address => bool)) _isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId;
    }

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.VoucherHub")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800;

    function _getVoucherHubStorage() private pure returns (VoucherHubStorage storage $) {
        assembly {
            $.slot := VOUCHER_HUB_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address iexecPoco) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._iexecPoco = iexecPoco;
    }

    /**
     * @notice Allows the admin to add a new voucher type with a descriptive name.
     * @dev Emits a VoucherTypeAdded event on successful addition.
     * @param voucherTypeId The unique identifier for the voucher type to be added.
     * @param description A human-readable description of the voucher type.
     */
    function addVoucherTypeDescription(
        uint256 voucherTypeId,
        string memory description
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypeDescriptions.push(VoucherTypeDescription(voucherTypeId, description));
        emit VoucherTypeAdded(voucherTypeId, description);
    }

    function getVoucherTypeDescription(uint256 index) public view returns (uint256, string memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(index < $._voucherTypeDescriptions.length, "Index out of bounds");
        VoucherTypeDescription storage description = $._voucherTypeDescriptions[index];
        return (description.voucherTypeId, description.description);
    }

    function getVoucherTypeDescriptionsCount() public view returns (uint256) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherTypeDescriptions.length;
    }

    /**
     * @notice Sets the duration for a specific voucher type.
     * @dev Can only be called by the admin. Emits a VoucherDurationSet event upon success.
     * @param voucherTypeId The unique identifier of the voucher type for which to set the duration.
     * @param duration The duration in seconds that the voucher is valid.
     */
    function setVoucherDuration(uint256 voucherTypeId, uint256 duration) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherDurationByVoucherTypeId[voucherTypeId] = duration;
        emit VoucherDurationSet(voucherTypeId, duration);
    }

    function getVoucherDurationByVoucherTypeId(
        uint256 voucherTypeId
    ) public view returns (uint256) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherDurationByVoucherTypeId[voucherTypeId];
    }

    /**
     * @notice Sets the eligibility of an asset for a specific voucher type.
     * @dev Can only be called by the admin. Emits an AssetEligibilitySet event upon success.
     * @param voucherTypeId The unique identifier of the voucher type.
     * @param asset The address of the asset to set eligibility for.
     * @param isEligible A boolean indicating whether the asset is eligible for the voucher type.
     */
    function setAssetEligibility(
        uint256 voucherTypeId,
        address asset,
        bool isEligible
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[voucherTypeId][asset] = isEligible;
        emit AssetEligibilitySet(voucherTypeId, asset, isEligible);
    }
    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId,
        address asset
    ) public view returns (bool) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[voucherTypeId][asset];
    }

    function getIexecPoco() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._iexecPoco;
    }

    function createVoucher() public {
        emit VoucherCreated();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
