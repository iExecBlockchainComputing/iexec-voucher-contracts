// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {Voucher} from "./beacon/Voucher.sol";
import {VoucherProxy} from "./beacon/VoucherProxy.sol";
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
        address _voucherBeacon;
        VoucherType[] voucherTypes;
        mapping(uint256 voucherTypeId => mapping(address asset => bool)) matchOrdersEligibility;
    }

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.VoucherHub")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800;

    modifier whenVoucherTypeExists(uint256 id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(id < $.voucherTypes.length, "VoucherHub: type index out of bounds");
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

    function initialize(address iexecPoco, address voucherBeacon) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._iexecPoco = iexecPoco;
        $._voucherBeacon = voucherBeacon;
    }

    // TODO: Replace most onlyOwner to onlyVoucherManager
    function createVoucherType(string memory description, uint256 duration) external onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes.push(VoucherType(description, duration));
        emit VoucherTypeCreated($.voucherTypes.length - 1, description, duration);
    }

    function updateVoucherTypeDescription(
        uint256 id,
        string memory description
    ) external onlyOwner whenVoucherTypeExists(id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes[id].description = description;
        emit VoucherTypeDescriptionUpdated(id, description);
    }

    function updateVoucherTypeDuration(
        uint256 id,
        uint256 duration
    ) external onlyOwner whenVoucherTypeExists(id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes[id].duration = duration;
        emit VoucherTypeDurationUpdated(id, duration);
    }

    function getVoucherType(
        uint256 id
    ) public view whenVoucherTypeExists(id) returns (VoucherType memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.voucherTypes[id];
    }

    function getVoucherTypeCount() public view returns (uint256) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.voucherTypes.length;
    }

    function addEligibleAsset(uint256 voucherTypeId, address asset) external onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, true);
        emit EligibleAssetAdded(voucherTypeId, asset);
    }

    function removeEligibleAsset(uint256 voucherTypeId, address asset) external onlyOwner {
        _setAssetEligibility(voucherTypeId, asset, false);
        emit EligibleAssetRemoved(voucherTypeId, asset);
    }

    function _setAssetEligibility(uint256 voucherTypeId, address asset, bool isEligible) private {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.matchOrdersEligibility[voucherTypeId][asset] = isEligible;
    }

    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId,
        address asset
    ) public view returns (bool) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.matchOrdersEligibility[voucherTypeId][asset];
    }

    function getIexecPoco() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._iexecPoco;
    }

    /**
     * Get voucher beacon address.
     */
    function getVoucherBeacon() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherBeacon;
    }

    /**
     * TODO add checks.
     *
     * Create new voucher for the specified account and call initialize function.
     * Only 1 voucher is allowed by wallet. This is guaranteed by "create2" mechanism
     * and using the wallet address as salt.
     * @param owner voucher owner
     * @param expiration voucher expiration
     */
    function createVoucher(
        address owner,
        uint256 expiration
    ) external override onlyOwner returns (address voucherAddress) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        voucherAddress = address(new VoucherProxy{salt: _getCreate2Salt(owner)}($._voucherBeacon));
        // Initialize the created proxy contract.
        // The proxy contract does a delegatecall to its implementation.
        // Re-Entrancy safe because the target contract is controlled.
        (bool success, ) = voucherAddress.call(
            abi.encodeCall(Voucher.initialize, (owner, expiration))
        );
        require(success, "VoucherHub: Voucher initialization failed");
        emit VoucherCreated(voucherAddress, owner, expiration);
    }

    /**
     * TODO return Voucher structure.
     *
     * Get voucher address of a given account.
     * Returns address(0) if voucher is not found.
     * @param account owner address.
     */
    function getVoucher(address account) public view override returns (address voucherAddress) {
        voucherAddress = Create2.computeAddress(
            _getCreate2Salt(account), // salt
            keccak256(_computeVoucherCreationCode()) // bytecode hash
        );
        return voucherAddress.code.length > 0 ? voucherAddress : address(0);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function _getCreate2Salt(address account) private pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }

    /**
     * Compute the creation code (bytecode + constructorArgs) of the VoucherProxy contract.
     */
    function _computeVoucherCreationCode() private view returns (bytes memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return
            abi.encodePacked(
                type(VoucherProxy).creationCode, // bytecode
                abi.encode($._voucherBeacon) // constructor args
            );
    }
}
