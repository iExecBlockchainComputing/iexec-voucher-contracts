// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IVoucherHub} from "./IVoucherHub.sol";

pragma solidity ^0.8.20;

contract VoucherHub is OwnableUpgradeable, UUPSUpgradeable, IVoucherHub {
    /// @custom:storage-location erc7201:iexec.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecAddress;
        VoucherTypeDescription[] _voucherTypeDescriptions;
        mapping(uint256 => uint256) _voucherDurationByVoucherTypeId;
        mapping(uint256 => mapping(address => bool)) _isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId;
    }

    struct VoucherTypeDescription {
        uint256 voucherTypeId;
        string description;
    }

    event VoucherTypeAdded(uint256 indexed voucherTypeId, string description);
    event VoucherDurationSet(uint256 indexed voucherTypeId, uint256 duration);
    event AssetEligibilitySet(uint256 indexed voucherTypeId, address asset, bool isEligible);

    // keccak256(abi.encode(uint256(keccak256("iexec.storage.VoucherHub")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0x8610b975c8d15083165a17dde673f1051edf836f87d56f9b9697dc45474fe600;

    function _getVoucherHubStorage() private pure returns (VoucherHubStorage storage $) {
        assembly {
            $.slot := VOUCHER_HUB_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address iexecAddress) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        _getVoucherHubStorage()._iexecAddress = iexecAddress;
    }

    function addVoucherTypeDescription(
        uint256 voucherTypeId,
        string memory description
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypeDescriptions.push(VoucherTypeDescription(voucherTypeId, description));
        emit VoucherTypeAdded(voucherTypeId, description);
    }

    function setVoucherDuration(uint256 voucherTypeId, uint256 duration) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherDurationByVoucherTypeId[voucherTypeId] = duration;
        emit VoucherDurationSet(voucherTypeId, duration);
    }

    function setAssetEligibility(
        uint256 voucherTypeId,
        address asset,
        bool isEligible
    ) public onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._isAssetEligibleToMatchOrdersSponsoringByVoucherTypeId[voucherTypeId][asset] = isEligible;
        emit AssetEligibilitySet(voucherTypeId, asset, isEligible);
    }

    function getIexecAddress() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._iexecAddress;
    }

    function createVoucher() public {
        emit VoucherCreated();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
