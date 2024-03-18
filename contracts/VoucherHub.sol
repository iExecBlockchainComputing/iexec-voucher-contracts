// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IVoucherHub} from "./IVoucherHub.sol";

pragma solidity ^0.8.20;

contract VoucherHub is OwnableUpgradeable, UUPSUpgradeable, IVoucherHub {
    struct VoucherType {
        string description;
        uint256 duration;
    }
    /// @custom:storage-location erc7201:iexec.voucher.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecPoco;
        VoucherType[] _voucherTypes;
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

    // TODO: Replace most onlyOwner to onlyVoucherManager
    function createVoucherType(
        string memory voucherTypeDescription,
        uint256 voucherTypeduration
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypes.push(VoucherType(voucherTypeDescription, voucherTypeduration));
        emit NewVoucherTypeCreated(
            $._voucherTypes.length,
            voucherTypeDescription,
            voucherTypeduration
        );
    }

    function updateVoucherTypeDescription(
        uint256 voucherTypeId,
        string memory newVoucherTypeDescription
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(
            voucherTypeId < $._voucherTypes.length + 1 && voucherTypeId > 0,
            "VoucherHub: Index out of bounds"
        );
        $._voucherTypes[voucherTypeId - 1].description = newVoucherTypeDescription;
        emit VoucherTypeDescriptionUpdated(voucherTypeId, newVoucherTypeDescription);
    }

    function updateVoucherTypeDuration(
        uint256 voucherTypeId,
        uint256 newVoucherTypeDuration
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(
            voucherTypeId < $._voucherTypes.length + 1 && voucherTypeId > 0,
            "VoucherHub: Index out of bounds"
        );
        $._voucherTypes[voucherTypeId - 1].duration = newVoucherTypeDuration;
        emit VoucherTypeDurationUpdated(voucherTypeId, newVoucherTypeDuration);
    }

    function getVoucherType(uint256 voucherTypeId) public view returns (VoucherType memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(
            voucherTypeId < $._voucherTypes.length + 1 && voucherTypeId > 0,
            "VoucherHub: Index out of bounds"
        );
        VoucherType storage info = $._voucherTypes[voucherTypeId - 1];
        return info;
    }

    function getVoucherTypeCount() public view returns (uint256) {
        return _getVoucherHubStorage()._voucherTypes.length;
    }

    function setEligibleAsset(uint256 voucherTypeId, address asset) public onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, true);
        emit SetEligibleAsset(voucherTypeId, asset);
    }

    function unsetEligibleAsset(uint256 voucherTypeId, address asset) public onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, false);
        emit UnsetEligibleAsset(voucherTypeId, asset);
    }
    function _setAssetEligibility(uint256 voucherTypeId, address asset, bool isEligible) private {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[voucherTypeId][asset] = isEligible;
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
