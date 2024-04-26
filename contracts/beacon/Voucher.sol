// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";
import {IexecPoco1} from "@iexec/poco/contracts/modules/interfaces/IexecPoco1.v8.sol";
import {IexecPocoBoost} from "@iexec/poco/contracts/modules/interfaces/IexecPocoBoost.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVoucherHub} from "../IVoucherHub.sol";
import {IVoucher} from "./IVoucher.sol";

/**
 * @title Implementation of the voucher contract.
 * Deployed along the Beacon contract using "Upgrades" plugin of OZ.
 */
contract Voucher is OwnableUpgradeable, IVoucher {
    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.Voucher")) - 1))
    // & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_STORAGE_LOCATION =
        0xc2e244293dc04d6c7fa946e063317ff8e6770fd48cbaff411a60f1efc8a7e800;

    /// @custom:storage-location erc7201:iexec.voucher.storage.Voucher
    struct VoucherStorage {
        address _voucherHub;
        uint256 _expiration;
        uint256 _type;
        mapping(address => bool) _authorizedAccounts;
        mapping(bytes32 dealId => uint256) _sponsoredAmounts;
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
        // TODO: deposit SRLC.
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
     * Match orders on Poco. Eligible assets prices will be debited from the
     * voucher if possible, then non-sponsored amount will be debited from the
     * iExec account of the requester.
     *
     * @param appOrder The app order.
     * @param datasetOrder The dataset order.
     * @param workerpoolOrder The workerpool order.
     * @param requestOrder The request order.
     */
    function matchOrders(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32 dealId) {
        // TODO add onlyAuthorized
        // TODO check expiration
        uint256 appPrice = appOrder.appprice;
        uint256 datasetPrice = datasetOrder.datasetprice;
        uint256 workerpoolPrice = workerpoolOrder.workerpoolprice;
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        uint256 sponsoredAmount = voucherHub.debitVoucher(
            $._type,
            appOrder.app,
            appPrice,
            datasetOrder.dataset,
            datasetPrice,
            workerpoolOrder.workerpool,
            workerpoolPrice
        );
        uint256 dealPrice = appPrice + datasetPrice + workerpoolPrice;
        address iexecPoco = voucherHub.getIexecPoco();
        if (sponsoredAmount != dealPrice) {
            // Transfer non-sponsored amount from the iExec account of the
            // requester to the iExec account of the voucher
            IERC20(iexecPoco).transferFrom(
                requestOrder.requester,
                address(this),
                dealPrice - sponsoredAmount
            );
        }
        dealId = IexecPoco1(iexecPoco).sponsorMatchOrders(
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder
        );
        $._sponsoredAmounts[dealId] = sponsoredAmount;
        emit OrdersMatchedWithVoucher(dealId);
        return dealId;
    }

    /**
     * Match orders boost on Poco. Eligible assets prices will be debited from the
     * voucher if possible, then non-sponsored amount will be debited from the
     * iExec account of the requester.
     *
     * @param appOrder The app order.
     * @param datasetOrder The dataset order.
     * @param workerpoolOrder The workerpool order.
     * @param requestOrder The request order.
     */
    function matchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32 dealId) {
        // TODO add onlyAuthorized
        // TODO check expiration
        uint256 appPrice = appOrder.appprice;
        uint256 datasetPrice = datasetOrder.datasetprice;
        uint256 workerpoolPrice = workerpoolOrder.workerpoolprice;
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        uint256 sponsoredAmount = voucherHub.debitVoucher(
            $._type,
            appOrder.app,
            appPrice,
            datasetOrder.dataset,
            datasetPrice,
            workerpoolOrder.workerpool,
            workerpoolPrice
        );
        uint256 dealPrice = appPrice + datasetPrice + workerpoolPrice;
        address iexecPoco = voucherHub.getIexecPoco();
        if (sponsoredAmount != dealPrice) {
            // Transfer non-sponsored amount from the iExec account of the
            // requester to the iExec account of the voucher
            IERC20(iexecPoco).transferFrom(
                requestOrder.requester,
                address(this),
                dealPrice - sponsoredAmount
            );
        }
        dealId = IexecPocoBoost(iexecPoco).sponsorMatchOrdersBoost(
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder
        );
        $._sponsoredAmounts[dealId] = sponsoredAmount;
        emit OrdersBoostMatchedWithVoucher(dealId);
        return dealId;
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
     * Retrieve the type of the voucher.
     * @return voucherType The type of the voucher.
     */
    function getType() external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._type;
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
     * Get voucher balance.
     */
    function getBalance() external view returns (uint256) {
        return IERC20(getVoucherHub()).balanceOf(address(this));
    }

    /**
     * Checks if an account is authorized for.
     * @param account The account to check.
     * @return isAuthorized True if the account is authorized, false otherwise.
     */
    function isAccountAuthorized(address account) external view returns (bool) {
        VoucherStorage storage $ = _getVoucherStorage();
        return account == owner() || $._authorizedAccounts[account];
    }

    /**
     * Get amount sponsored in a deal.
     * @param dealId The ID of the deal.
     */
    function getSponsoredAmount(bytes32 dealId) external view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._sponsoredAmounts[dealId];
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

    function _getVoucherStorage() private pure returns (VoucherStorage storage $) {
        assembly {
            $.slot := VOUCHER_STORAGE_LOCATION
        }
    }
}
