// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IVoucherHub} from "./IVoucherHub.sol";

pragma solidity ^0.8.20;

contract VoucherHub is OwnableUpgradeable, UUPSUpgradeable, IVoucherHub {
    struct VoucherTypeInfo {
        string voucherDescription;
        uint256 voucherDuration;
    }
    /// @custom:storage-location erc7201:iexec.voucher.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecPoco;
        VoucherTypeInfos[] _voucherTypeInfo;
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
        _getVoucherHubStorage()._iexecPoco = iexecPoco;
    }

    /* 
    Create a new voucher type
    */

    function createVoucherType(
        string memory voucherTypeDescription,
        uint256 voucherTypeduration
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypeDescriptions.push(VoucherTypeInfos(description, duration));
        emit NewVoucherTypeCreated($._voucherTypeDescriptions.length, description, duration);
    }

    /* 
    Manage voucher type information 
    Set new voucher description for the given voucher type
    */

    function modifyVoucherDescription(
        uint256 voucherTypeId,
        string memory newVoucherDescription
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(voucherTypeId < $._voucherTypeDescriptions.length + 1, "Index out of bounds");
        VoucherTypeInfos storage voucherTypeInfo = $._voucherTypeDescriptions[voucherTypeId - 1];
        voucherTypeInfo.voucherDescription = newVoucherDescription;
        $._voucherTypeDescriptions[voucherTypeId - 1] = voucherTypeInfos;
        emit SetNewVoucherDescription(voucherTypeId, newVoucherDescription);
    }

    /* 
    Manage voucher type information 
    Set new voucher duration for the given voucher type
    */
    function modifyVoucherDuration(uint256 voucherTypeId, uint256 newDuration) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(voucherTypeId < $._voucherTypeDescriptions.length + 1, "Index out of bounds");
        VoucherTypeInfos storage voucherTypeInfos = $._voucherTypeDescriptions[voucherTypeId - 1];
        voucherTypeInfos.voucherDuration = newDuration;
        $._voucherTypeDescriptions[voucherTypeId - 1] = voucherTypeInfos;
        emit SetNewVoucherDuration(voucherTypeId, newDuration);
    }

    /**
     * Getting voucher information for a given type
     * @param voucherTypeId
     * @return
     * @return
     */

    function getVoucherTypeInfos(
        uint256 voucherTypeId
    ) public view returns (uint256, string memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(
            voucherTypeId < $._voucherTypeDescriptions.length + 1,
            "voucherTypeId out of bounds"
        );
        VoucherTypeInfos storage voucherTypeInfos = $._voucherTypeDescriptions[voucherTypeId - 1];
        return (voucherTypeInfos.voucherDescription, voucherTypeInfos.voucherDuration);
    }

    function getVoucherTypeCount() public view returns (uint256) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherTypeDescriptions.length;
    }

    /**
     * @notice Sets the eligibility of an asset for a specific voucher type.
     * @dev Can only be called by the admin. Emits an AssetEligibilitySet event upon success.
     * @param voucherTypeId The unique identifier of the voucher type.
     * @param asset The address of the asset to set eligibility for.
     * @param isEligible A boolean indicating whether the asset is eligible for the voucher type.
     */

    function setEligibleAsset(uint256 voucherTypeId, address asset) public onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, true);
    }

    function unsetEligibleAsset(uint256 voucherTypeId, address asset) public onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, false);
    }
    function _setAssetEligibility(
        uint256 voucherTypeId,
        address asset,
        bool isEligible
    ) private onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[voucherTypeId][asset] = isEligible;
        emit AssetEligibilitySet(voucherTypeId, asset, isEligible);
    }
    /**
     *
     * @param voucherTypeId
     * @param asset
     */
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
