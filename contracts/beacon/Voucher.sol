// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IexecLibCore_v5} from "@iexec/poco/contracts/libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";
import {IexecPoco1} from "@iexec/poco/contracts/modules/interfaces/IexecPoco1.v8.sol";
import {IexecPoco2} from "@iexec/poco/contracts/modules/interfaces/IexecPoco2.v8.sol";
import {IexecPocoAccessors} from "@iexec/poco/contracts/modules/interfaces/IexecPocoAccessors.sol";
import {IexecPocoBoost} from "@iexec/poco/contracts/modules/interfaces/IexecPocoBoost.sol";
import {IexecPocoBoostAccessors} from "@iexec/poco/contracts/modules/interfaces/IexecPocoBoostAccessors.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IVoucherHub} from "../IVoucherHub.sol";
import {IVoucher} from "./IVoucher.sol";

/**
 * @title Implementation of the voucher contract.
 * Note:
 *  - This contract and the Beacon are deployed using "Upgrades" plugin of OZ.
 *  - Vouchers ownership must not be transferable.
 */
contract Voucher is Initializable, IVoucher {
    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.Voucher")) - 1))
    // & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_STORAGE_LOCATION =
        0xc2e244293dc04d6c7fa946e063317ff8e6770fd48cbaff411a60f1efc8a7e800;

    /// @custom:storage-location erc7201:iexec.voucher.storage.Voucher
    struct VoucherStorage {
        address _owner;
        address _voucherHub;
        uint256 _expiration;
        uint256 _type;
        mapping(address => bool) _authorizedAccounts;
        mapping(bytes32 dealId => uint256) _sponsoredAmounts;
        // Save refunded tasks to disable replay attacks.
        mapping(bytes32 taskId => bool) _refundedTasks;
    }

    modifier onlyOwner() {
        require(msg.sender == owner(), "Voucher: sender is not owner");
        _;
    }

    modifier onlyAuthorized() {
        VoucherStorage storage $ = _getVoucherStorage();
        require(
            msg.sender == owner() || $._authorizedAccounts[msg.sender],
            "Voucher: sender is not authorized"
        );
        _;
    }

    modifier onlyVoucherHub() {
        VoucherStorage storage $ = _getVoucherStorage();
        require(msg.sender == $._voucherHub, "Voucher: sender is not VoucherHub");
        _;
    }

    modifier onlyNotExpired() {
        require(block.timestamp < getExpiration(), "Voucher: voucher is expired");
        _;
    }

    modifier onlyExpired() {
        require(getExpiration() <= block.timestamp, "Voucher: voucher is not expired");
        _;
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Initialize implementation contract.
     * @param voucherOwner The owner of the contract.
     * @param voucherTypeId The type Id of the voucher.
     * @param expiration The expiration timestamp of the voucher.
     * @param voucherHub The address of the voucher hub.
     */
    function initialize(
        address voucherOwner,
        address voucherHub,
        uint256 expiration,
        uint256 voucherTypeId
    ) external initializer {
        VoucherStorage storage $ = _getVoucherStorage();
        $._owner = voucherOwner;
        $._voucherHub = voucherHub;
        $._expiration = expiration;
        $._type = voucherTypeId;
    }

    /**
     * Set the expiration timestamp of the voucher.
     * @param expiration The expiration timestamp.
     */
    function setExpiration(uint256 expiration) external onlyVoucherHub {
        VoucherStorage storage $ = _getVoucherStorage();
        $._expiration = expiration;
        emit ExpirationUpdated(expiration);
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

    /**
     * Claim failed task on PoCo then refund voucher and requester.
     * @param taskId id of the task
     */
    function claim(bytes32 taskId) external {
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        address iexecPoco = voucherHub.getIexecPoco();
        IexecLibCore_v5.Task memory task = IexecPocoAccessors(iexecPoco).viewTask(taskId);
        // Claim task on PoCo if not already claimed.
        // This implicitly validates that the task and its deal exist.
        if (task.status != IexecLibCore_v5.TaskStatusEnum.FAILED) {
            IexecPoco2(iexecPoco).claim(taskId);
        }
        IexecLibCore_v5.Deal memory deal = IexecPocoAccessors(iexecPoco).viewDeal(task.dealid);
        // If the deal was matched by the voucher, then the voucher should be refunded.
        // If the deal was partially or not sponsored by the voucher, then the requester
        // should be refunded.
        if (deal.sponsor == address(this)) {
            _refundVoucherAndRequester(
                voucherHub,
                iexecPoco,
                taskId,
                deal.app.price + deal.dataset.price + deal.workerpool.price, // taskPrice
                task.dealid,
                deal.botSize,
                deal.requester
            );
        }
        emit TaskClaimedWithVoucher(taskId);
    }

    /**
     * Claim failed Boost task on PoCo then refund voucher and requester.
     * @param dealId id of the task's deal
     * @param taskIndex task's index in the deal
     */
    function claimBoost(bytes32 dealId, uint256 taskIndex) external {
        VoucherStorage storage $ = _getVoucherStorage();
        IVoucherHub voucherHub = IVoucherHub($._voucherHub);
        address iexecPoco = voucherHub.getIexecPoco();
        bytes32 taskId = keccak256(abi.encodePacked(dealId, taskIndex));
        IexecLibCore_v5.Task memory task = IexecPocoAccessors(iexecPoco).viewTask(taskId);
        // Claim task on PoCo if not already claimed.
        // This implicitly validates that the task and its deal exist.
        if (task.status != IexecLibCore_v5.TaskStatusEnum.FAILED) {
            IexecPocoBoost(iexecPoco).claimBoost(dealId, taskIndex);
        }
        IexecLibCore_v5.DealBoost memory deal = IexecPocoBoostAccessors(iexecPoco).viewDealBoost(
            dealId
        );
        if (deal.sponsor == address(this)) {
            _refundVoucherAndRequester(
                voucherHub,
                iexecPoco,
                taskId,
                deal.appPrice + deal.datasetPrice + deal.workerpoolPrice, // taskPrice
                dealId,
                deal.botSize,
                deal.requester
            );
        }
        emit TaskClaimedWithVoucher(taskId);
    }

    /**
     * Drain balance of voucher on PoCo if it is expired.
     * Funds are sent to the VoucherHub contract.
     * @param amount amount to be drained
     */
    function drain(uint256 amount) external onlyVoucherHub onlyExpired {
        // Although transfer function in PoCo always returns true (or reverts),
        // a return value check is added here in case its behavior changes.
        //
        // msg.sender is the VoucherHub. No need to read the address from storage.
        if (!IERC20(IVoucherHub(msg.sender).getIexecPoco()).transfer(msg.sender, amount)) {
            revert("Voucher: drain failed");
        }
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
     * Check if a task has been refunded.
     * @param taskId The task to be checked.
     */
    function isRefundedTask(bytes32 taskId) external view returns (bool) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._refundedTasks[taskId];
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view returns (address) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._owner;
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
    function getExpiration() public view returns (uint256) {
        VoucherStorage storage $ = _getVoucherStorage();
        return $._expiration;
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
        uint256 volume = IexecPocoAccessors(iexecPoco).computeDealVolume(
            appOrder,
            datasetOrder,
            workerpoolOrder,
            requestOrder
        );
        uint256 dealPrice = (appPrice +
            workerpoolPrice +
            (datasetOrder.dataset != address(0) ? datasetPrice : 0)) * volume;
        sponsoredAmount = voucherHub.debitVoucher(
            voucherTypeId,
            appOrder.app,
            appPrice,
            datasetOrder.dataset,
            datasetPrice,
            workerpoolOrder.workerpool,
            workerpoolPrice,
            volume
        );
        if (sponsoredAmount != dealPrice) {
            // Transfer non-sponsored amount from the iExec account of the
            // requester to the iExec account of the voucher
            //slither-disable-start arbitrary-send-erc20
            // Note: We can disable this check since the requester signed the request order and agreed to pay for the deal.
            // & caller is only authorized.
            // SRLC
            try
                IERC20(iexecPoco).transferFrom(
                    requestOrder.requester,
                    address(this),
                    dealPrice - sponsoredAmount
                )
            returns (bool success) {
                if (success) {
                    return sponsoredAmount;
                }
            } catch {}
            revert("Voucher: Transfer of non-sponsored amount failed");
            //slither-disable-end arbitrary-send-erc20
        }
    }

    /**
     * Ask VoucherHub to refund voucher for a failed task and
     * send non-sponsored part back to the requester when needed.
     * @param voucherHub hub
     * @param iexecPoco address of PoCo contract
     * @param taskId id of the task
     * @param taskPrice price paid per task at match orders
     * @param dealId task's deal id
     * @param dealVolume number of tasks in the deal
     * @param requester of the task
     */
    function _refundVoucherAndRequester(
        IVoucherHub voucherHub,
        address iexecPoco,
        bytes32 taskId,
        uint256 taskPrice,
        bytes32 dealId,
        uint256 dealVolume,
        address requester
    ) private {
        VoucherStorage storage $ = _getVoucherStorage();
        require(!$._refundedTasks[taskId], "Voucher: task already refunded");
        $._refundedTasks[taskId] = true;
        if (taskPrice != 0) {
            uint256 dealSponsoredAmount = $._sponsoredAmounts[dealId];
            // The division leaves no remainder. See VoucherHub#debitVoucher().
            uint256 taskSponsoredAmount = dealSponsoredAmount / dealVolume;
            if (taskSponsoredAmount != 0) {
                // If the voucher did fully/partially sponsor the deal then mint voucher
                // credits back.
                voucherHub.refundVoucher(taskSponsoredAmount);
            }
            if (taskSponsoredAmount < taskPrice) {
                // If the deal was not sponsored or partially sponsored
                // by the voucher then send the non-sponsored part back
                // to the requester.
                try IERC20(iexecPoco).transfer(requester, taskPrice - taskSponsoredAmount) returns (
                    bool success
                ) {
                    if (success) {
                        return;
                    }
                } catch {}
                revert("Voucher: transfer to requester failed");
            }
        }
    }

    function _getVoucherStorage() private pure returns (VoucherStorage storage $) {
        //slither-disable-start assembly
        assembly ("memory-safe") {
            $.slot := VOUCHER_STORAGE_LOCATION
        }
        //slither-disable-end assembly
    }
}
