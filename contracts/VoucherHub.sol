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
        address voucherBeacon;
        // TODO remove & compute voucher address.
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

    function initialize(address iexecPoco, address voucherBeacon) external initializer {
        __Ownable_init(msg.sender);
        __UUPSUpgradeable_init();
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._iexecPoco = iexecPoco;
        $.voucherBeacon = voucherBeacon;
    }

    function getIexecPoco() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._iexecPoco;
    }

    function setVoucherBeacon(address newBeacon) external onlyOwner {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherBeacon = newBeacon;
    }
    /**
     * Get voucher beacon address.
     * TODO add update function.
     */
    function getVouchBeacon() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.voucherBeacon;
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
            account,
            expiration
        );
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        voucherAddress = address(new VoucherProxy($.voucherBeacon, initialization));
        // Save voucher address.
        $.voucherByAccount[account] = voucherAddress;
        emit VoucherCreated(voucherAddress, account, expiration);
    }

    /**
     * Get voucher address of a given account.
     * @param account owner address.
     */
    function getVoucher(address account) public view override returns (address voucherAddress) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        voucherAddress = $.voucherByAccount[account];
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
