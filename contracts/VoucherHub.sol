// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {IVoucherHub} from "./IVoucherHub.sol";
import {VoucherProxy} from "./beacon/VoucherProxy.sol";
import {VoucherImpl} from "./beacon/VoucherImpl.sol";

pragma solidity ^0.8.20;

contract VoucherHub is OwnableUpgradeable, UUPSUpgradeable, IVoucherHub {
    /// @custom:storage-location erc7201:iexec.voucher.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecPoco;
        address beacon;
        // TODO remove & compute voucher address locally.
        mapping(address => address) voucherByAccount;
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

    function initialize(address iexecPoco, address initialBeaconAddress) public initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._iexecPoco = iexecPoco;
        $.beacon = initialBeaconAddress;
    }

    function getIexecPoco() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._iexecPoco;
    }

    function setBeacon(address newBeacon) external onlyOwner {
        _getVoucherHubStorage().beacon = newBeacon;
    }
    /**
     * Get voucher beacon address.
     * TODO add update function.
     */
    function beacon() public view returns (address) {
        return _getVoucherHubStorage().beacon;
    }

    /**
     * TODO add checks.
     * TODO return Voucher structure.
     * Create new voucher for specified account.
     * @param account voucher owner.
     * @param expiration voucher expiration
     */
    function createVoucher(
        address account,
        uint256 expiration
    ) public override onlyOwner returns (address voucherAddress) {
        // Create voucher and call initialize() function.
        bytes memory initialization = abi.encodeWithSelector(
            VoucherImpl(address(0)).initialize.selector,
            expiration
        );
        voucherAddress = address(
            new VoucherProxy(account, _getVoucherHubStorage().beacon, initialization)
        );
        // Save voucher address.
        _getVoucherHubStorage().voucherByAccount[account] = voucherAddress;
        emit VoucherCreated(voucherAddress, account);
    }

    /**
     * Get voucher address of a given account.
     * @param account owner address.
     */
    function getVoucher(address account) public view override returns (address voucherAddress) {
        voucherAddress = _getVoucherHubStorage().voucherByAccount[account];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
