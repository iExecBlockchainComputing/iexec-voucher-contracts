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
        address iexecPoco;
        VoucherType[] voucherTypes;
        mapping(uint256 => mapping(address => bool)) isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId;
    }

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.VoucherHub")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800;

    modifier whenVoucherTypeExists(uint256 voucherTypeId_) {
        require(
            voucherTypeId_ < _getVoucherHubStorage().voucherTypes.length,
            "VoucherHub: Index out of bounds"
        );
        _;
    }

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
        _getVoucherHubStorage().iexecPoco = iexecPoco;
    }

    // TODO: Replace most onlyOwner to onlyVoucherManager
    function createVoucherType(string memory description, uint256 duration) external onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes.push(VoucherType(description, duration));
        emit VoucherTypeCreated($.voucherTypes.length - 1, description, duration);
    }

    function updateVoucherTypeDescription(
        uint256 id,
        string memory description_
    ) external onlyOwner whenVoucherTypeExists(id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes[id].description = description_;
        emit VoucherTypeDescriptionUpdated(id, description_);
    }

    function updateVoucherTypeDuration(
        uint256 id_,
        uint256 duration_
    ) external onlyOwner whenVoucherTypeExists(id_) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes[id_].duration = duration_;
        emit VoucherTypeDurationUpdated(id_, duration_);
    }

    function getVoucherType(
        uint256 id_
    ) public view whenVoucherTypeExists(id_) returns (VoucherType memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.voucherTypes[id_];
    }

    function getVoucherTypeCount() public view returns (uint256) {
        return _getVoucherHubStorage().voucherTypes.length;
    }

    function setEligibleAsset(uint256 voucherTypeId_, address asset_) external onlyOwner {
        _setAssetEligibility(voucherTypeId_, asset_, true);
        emit SetEligibleAsset(voucherTypeId_, asset_);
    }

    function unsetEligibleAsset(uint256 voucherTypeId_, address asset_) external onlyOwner {
        _setAssetEligibility(voucherTypeId_, asset_, false);
        emit UnsetEligibleAsset(voucherTypeId_, asset_);
    }
    function _setAssetEligibility(uint256 voucherTypeId_, address asset_, bool isEligible) private {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[voucherTypeId_][
            asset_
        ] = isEligible;
    }
    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId_,
        address asset_
    ) public view returns (bool) {
        return
            _getVoucherHubStorage().isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[
                voucherTypeId_
            ][asset_];
    }

    function getIexecPoco() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.iexecPoco;
    }

    function createVoucher() public {
        emit VoucherCreated();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
