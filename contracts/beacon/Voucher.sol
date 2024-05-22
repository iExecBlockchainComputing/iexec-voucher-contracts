// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IexecLibCore_v5} from "@iexec/poco/contracts/libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";
import {IexecPoco1} from "@iexec/poco/contracts/modules/interfaces/IexecPoco1.v8.sol";
import {IexecPoco2} from "@iexec/poco/contracts/modules/interfaces/IexecPoco2.v8.sol";
import {IexecPocoBoost} from "@iexec/poco/contracts/modules/interfaces/IexecPocoBoost.sol";
import {IexecPocoAccessors} from "@iexec/poco/contracts/modules/interfaces/IexecPocoAccessors.sol";
import {IexecPocoBoost} from "@iexec/poco/contracts/modules/interfaces/IexecPocoBoost.sol";
import {IexecPocoBoostAccessors} from "@iexec/poco/contracts/modules/interfaces/IexecPocoBoostAccessors.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IVoucherHub} from "../IVoucherHub.sol";
import {IVoucher} from "./IVoucher.sol";

// TODO disable transferOwnership()

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

    modifier onlyAuthorized() {
        VoucherStorage storage $ = _getVoucherStorage();
        require(
            msg.sender == owner() || $._authorizedAccounts[msg.sender],
            "Voucher: sender is not authorized"
        );
        _;
    }

    modifier onlyNotExpired() {
        VoucherStorage storage $ = _getVoucherStorage();
        require(block.timestamp < $._expiration, "Voucher: voucher is expired");
        _;
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
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        address iexecPoco = voucherHub.getIexecPoco();
        uint256 sponsoredAmount = _debitVoucherAndTransferNonSponsoredAmount(
            $._type,
            voucherHub,
            iexecPoco,
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder
        );
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
    ) external onlyAuthorized onlyNotExpired returns (bytes32 dealId) {
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        address iexecPoco = voucherHub.getIexecPoco();
        uint256 sponsoredAmount = _debitVoucherAndTransferNonSponsoredAmount(
            $._type,
            voucherHub,
            iexecPoco,
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder
        );
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

    function claim(bytes32 dealId, uint256 index) external {
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        address iexecPoco = voucherHub.getIexecPoco();
        uint256 dealSponsoredAmount = $._sponsoredAmounts[dealId];
        // Get deal details from PoCo.
        (bool isBoostDeal, address requester, uint256 volume, uint256 dealPrice) = _getDealDetails(
            iexecPoco,
            dealId
        );
        // If the deal was not sponsored by the voucher forward the claim request to PoCo
        // and do nothing.
        if (dealSponsoredAmount == 0) {
            _claimTaskOnPoco(iexecPoco, isBoostDeal, dealId, index);
            return;
        }
        // The deal was partially or fully sponsored by the voucher.
        bytes32 taskId = keccak256(abi.encodePacked(dealId, index));
        IexecLibCore_v5.Task memory task = IexecPocoAccessors(iexecPoco).viewTask(taskId);
        // Make sure the task is not already claimed.
        require(!_isClaimed(taskId, false), "Voucher: task already claimed");
        // If the task is not already claimed on PoCo claim it and continue.
        if (task.status != IexecLibCore_v5.TaskStatusEnum.FAILED) {
            _claimTaskOnPoco(iexecPoco, isBoostDeal, dealId, index);
        }
        /**
         * Refund requester on PoCo.
         */
        // The division yields no remainder since dealPrice = taskPrice * volume.
        uint256 taskPrice = dealPrice / volume;
        // A positive remainder is possible when the voucher balance is less than the amount
        // that could be sponsored. Min(balance, dealSponsoredAmount) is computed at match
        // orders.
        uint256 taskSponsoredAmount = dealSponsoredAmount / volume;
        if (taskPrice - taskSponsoredAmount > 0) {
            // Transfer the non-sponsored part back to the requester
            // if the deal was partially sponsored.
            IERC20(iexecPoco).transfer(requester, taskPrice - taskSponsoredAmount);
        }
        // Mint voucher tokens back.
        // taskSponsoredAmount > 0 because dealSponsoredAmount > 0.
        voucherHub.refundVoucher(taskSponsoredAmount);
        emit TaskClaimedWithVoucher(dealId, index);
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

    /**
     * Send claim request of Boost and Classic tasks to PoCo.
     * @param iexecPoco PoCo proxy address
     * @param isBoostDeal whether the deal is of type boost or not
     * @param dealId id of the task's deal
     * @param index of the task in the deal
     */
    function _claimTaskOnPoco(
        address iexecPoco,
        bool isBoostDeal,
        bytes32 dealId,
        uint256 index
    ) private {
        if (isBoostDeal) {
            IexecPocoBoost(iexecPoco).claimBoost(dealId, index);
        } else {
            IexecPoco2(iexecPoco).claim(keccak256(abi.encodePacked(dealId, index)));
        }
    }

    /**
     * A utility function to abstract Deal and DealBoost differences.
     * It reverts if the deal is not found.
     * It would be relevant to add this function to PoCo.
     * @param iexecPoco PoCo proxy address
     * @param id of the deal
     * @return isBoostDeal
     * @return requester
     * @return dealVolume
     * @return dealPrice
     */
    function _getDealDetails(
        address iexecPoco,
        bytes32 id
    )
        private
        view
        returns (bool isBoostDeal, address requester, uint256 dealVolume, uint256 dealPrice)
    {
        IexecLibCore_v5.DealBoost memory dealBoost = IexecPocoBoostAccessors(iexecPoco)
            .viewDealBoost(id);
        if (dealBoost.botSize != 0) {
            isBoostDeal = true;
            requester = dealBoost.requester;
            dealVolume = dealBoost.botSize;
            dealPrice =
                (dealBoost.appPrice + dealBoost.datasetPrice + dealBoost.workerpoolPrice) *
                dealVolume;
        } else {
            IexecLibCore_v5.Deal memory deal = IexecPocoAccessors(iexecPoco).viewDeal(id);
            isBoostDeal = false;
            requester = deal.requester;
            dealVolume = deal.botSize;
            dealPrice = (deal.app.price + deal.dataset.price + deal.workerpool.price) * dealVolume;
        }
        require(dealVolume != 0, "Deal not found");
    }

    function _isClaimed(bytes32 taskId, bool returnValue) private pure returns (bool) {
        taskId;
        return returnValue;
    }

    // TODO move this function before private view functions.
    /**
     * @dev Debit voucher and transfer non-sponsored amount from requester's account.
     *
     * @param voucherTypeId The type Id of the voucher.
     * @param voucherHub The voucher hub instance.
     * @param iexecPoco The address of iExec Poco.
     * @param appOrder The app order.
     * @param datasetOrder The dataset order.
     * @param workerpoolOrder The workerpool order.
     * @param requestOrder The request order.
     *
     * @return sponsoredAmount The amount sponsored by the voucher.
     */
    function _debitVoucherAndTransferNonSponsoredAmount(
        uint256 voucherTypeId,
        IVoucherHub voucherHub,
        address iexecPoco,
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) private returns (uint256 sponsoredAmount) {
        uint256 appPrice = appOrder.appprice;
        uint256 datasetPrice = datasetOrder.datasetprice;
        uint256 workerpoolPrice = workerpoolOrder.workerpoolprice;

        sponsoredAmount = voucherHub.debitVoucher(
            voucherTypeId,
            appOrder.app,
            appPrice,
            datasetOrder.dataset,
            datasetPrice,
            workerpoolOrder.workerpool,
            workerpoolPrice
        );
        // TODO: Compute volume and set dealPrice = taskPrice * volume instead of curent dealPrice
        uint256 dealPrice = appPrice + datasetPrice + workerpoolPrice;

        if (sponsoredAmount != dealPrice) {
            // Transfer non-sponsored amount from the iExec account of the
            // requester to the iExec account of the voucher
            IERC20(iexecPoco).transferFrom(
                requestOrder.requester,
                address(this),
                dealPrice - sponsoredAmount
            );
        }
    }
}
