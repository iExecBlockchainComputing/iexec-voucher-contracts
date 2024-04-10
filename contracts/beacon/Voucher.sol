// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IexecPocoMock} from "../mocks/IexecPocoMock.sol";
import {IVoucherHub} from "../IVoucherHub.sol";
import {IVoucher} from "./IVoucher.sol";

/**
 * @title Implementation of the voucher contract.
 * Deployed along the Beacon contract using "Upgrades" plugin of OZ.
 */
contract Voucher is OwnableUpgradeable, IVoucher {
    /// @custom:storage-location erc7201:iexec.voucher.storage.Voucher
    struct VoucherStorage {
        address _voucherHub;
        uint256 _expiration;
        uint256 _type;
        mapping(address => bool) _authorizedAccounts;
    }

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.Voucher")) - 1))
    // & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_STORAGE_LOCATION =
        0xc2e244293dc04d6c7fa946e063317ff8e6770fd48cbaff411a60f1efc8a7e800;

    modifier onlyAuthorized() {
        require(isAccountAuthorized(msg.sender), "VoucherHub: caller is not authorized");
        _;
    }

    function _getVoucherStorage() private pure returns (VoucherStorage storage $) {
        assembly {
            $.slot := VOUCHER_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Initialize implementation contract.
     * @param owner The owner of the contract.
     * @param voucherTypeId The type Id of the voucher.
     * @param expiration The expiration timestamp of the voucher.
     * @param voucherHub The address of the voucher hub.
     */
    function initialize(
        address owner,
        address voucherHub,
        uint256 expiration,
        uint256 voucherTypeId
    ) external initializer {
        __Ownable_init(owner);
        VoucherStorage storage $ = _getVoucherStorage();
        $._voucherHub = voucherHub;
        $._expiration = expiration;
        $._type = voucherTypeId;
        // TODO: deposit sRLC.
    }

    /**
     * Retrieve the address of the voucher hub associated with the voucher.
     * @return voucherHubAddress The address of the voucher hub.
     */
    function getVoucherHub() public view returns (address) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._voucherHub;
    }

    /**
     * Retrieve the expiration timestamp of the voucher.
     * @return expirationTimestamp The expiration timestamp.
     */
    function getExpiration() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._expiration;
    }

    /**
     * Retrieve the type of the voucher.
     * @return voucherType The type of the voucher.
     */
    function getType() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._type;
    }

    /**
     * Get voucher balance.
     */
    function getBalance() external view returns (uint256) {
        return IERC20(getVoucherHub()).balanceOf(address(this));
    }

    /**
     * Sets authorization for an account.
     * @param account The account to authorize.
     */
    function authorizeAccount(address account) external onlyOwner {
        _setAccountAuthorization(account, true);
        emit AccountAuthorized(account);
    }

    /**
     * Unsets authorization for an account.
     * @param account The account to remove authorization from.
     */
    function unauthorizeAccount(address account) external onlyOwner {
        _setAccountAuthorization(account, false);
        emit AccountUnauthorized(account);
    }

    /**
     * Checks if an account is authorized for.
     * @param account The account to check.
     * @return isAuthorized True if the account is authorized, false otherwise.
     */
    function isAccountAuthorized(address account) public view returns (bool) {
        VoucherStorage storage $ = _getVoucherStorage();
        return account == owner() || $._authorizedAccounts[account];
    }

    /**
     * Internal function to set authorization for an account.
     * @param account The account to set authorization for.
     * @param isAuthorized Whether to authorize or unauthorize the account.
     */
    function _setAccountAuthorization(address account, bool isAuthorized) private {
        require(account != owner(), "Voucher: owner is already authorized.");
        VoucherStorage storage $ = _getVoucherStorage();
        $._authorizedAccounts[account] = isAuthorized;
    }

    function debitCreditAndBurnRLC(uint256 creditAmount) external {
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        address iexecPoco = voucherHub.getIexecPoco();
        IexecPocoMock(iexecPoco).burnsRLC(creditAmount);
    }
}
