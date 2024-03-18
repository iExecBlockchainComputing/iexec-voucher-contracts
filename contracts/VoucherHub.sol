// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IVoucherHub} from "./IVoucherHub.sol";

pragma solidity ^0.8.20;

contract VoucherHub is OwnableUpgradeable, UUPSUpgradeable, IVoucherHub {
    struct VoucherType {
        string voucherDescription;
        uint256 voucherDuration;
    }
    /// @custom:storage-location erc7201:iexec.voucher.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecPoco;
        VoucherTypeInfo[] _voucherTypeInfos;
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

    function createVoucherType(
        string memory voucherTypeDescription,
        uint256 voucherTypeduration
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypeInfos.push(VoucherTypeInfo(voucherTypeDescription, voucherTypeduration));
        emit NewVoucherTypeCreated(
            $._voucherTypeInfos.length,
            voucherTypeDescription,
            voucherTypeduration
        );
    }

    function modifyVoucherDescription(
        uint256 voucherTypeId,
        string memory newVoucherDescription
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(
            voucherTypeId < $._voucherTypeInfos.length + 1 && voucherTypeId > 0,
            "VoucherHub: Index out of bounds"
        );
        $._voucherTypeInfos[voucherTypeId - 1].voucherDescription = newVoucherDescription;
        emit VoucherTypeDescriptionUpdated(voucherTypeId, newVoucherDescription);
    }

    function modifyVoucherDuration(uint256 voucherTypeId, uint256 newDuration) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(
            voucherTypeId < $._voucherTypeInfos.length + 1 && voucherTypeId > 0,
            "VoucherHub: Index out of bounds"
        );
        $._voucherTypeInfos[voucherTypeId - 1].voucherDuration = newDuration;
        emit VoucherTypeDurationUpdated(voucherTypeId, newDuration);
    }

    function getVoucherTypeInfo(
        uint256 voucherTypeId
    ) public view returns (string memory, uint256) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(
            voucherTypeId < $._voucherTypeInfos.length + 1 && voucherTypeId > 0,
            "VoucherHub: Index out of bounds"
        );
        VoucherTypeInfo storage info = $._voucherTypeInfos[voucherTypeId - 1];
        return (info.voucherDescription, info.voucherDuration);
    }

    function getVoucherTypeCount() public view returns (uint256) {
        return _getVoucherHubStorage()._voucherTypeInfos.length;
    }

    function setEligibleAsset(uint256 voucherTypeId, address asset) public onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, true);
    }

    function unsetEligibleAsset(uint256 voucherTypeId, address asset) public onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, false);
    }
    function _setAssetEligibility(uint256 voucherTypeId, address asset, bool isEligible) private {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[voucherTypeId][asset] = isEligible;
        emit AssetEligibilitySet(voucherTypeId, asset, isEligible);
    }
    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId,
        address asset
    ) public view returns (bool) {
        return
            _getVoucherHubStorage()._isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[
                voucherTypeId
            ][asset];
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
