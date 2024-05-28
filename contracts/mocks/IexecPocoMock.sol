// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IexecLibCore_v5} from "@iexec/poco/contracts/libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Testing purposes only.
 */
contract IexecPocoMock is ERC20 {
    // TODO multiply task price by volume in _mint() and burn().

    bool public shouldRevertOnSponsorMatchOrders = false;
    bool public shouldRevertOnSponsorMatchOrdersBoost = false;
    bool public shouldRevertOnClaim = false;
    bool public shouldReturnTaskWithFailedStatus = false;

    bytes32 public mockDealId = keccak256("deal");
    uint256 public mockTaskIndex = 0;
    bytes32 public mockTaskId = keccak256(abi.encode(mockDealId, mockTaskIndex));

    IexecLibCore_v5.Deal public deal;
    IexecLibCore_v5.DealBoost public dealBoost;
    IexecLibCore_v5.Task public task;

    constructor() ERC20("Staked RLC", "SRLC") {
        _mint(msg.sender, 1000000);
    }

    /**
     * Match orders
     */

    function sponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32 dealId) {
        if (shouldRevertOnSponsorMatchOrders) {
            revert("IexecPocoMock: Failed to sponsorMatchOrders");
        }
        dealId = mockDealId;
        deal.requester = requestOrder.requester;
        deal.botSize = requestOrder.volume;
        deal.app.price = appOrder.appprice;
        deal.dataset.price = datasetOrder.datasetprice;
        deal.workerpool.price = workerpoolOrder.workerpoolprice;
        deal.sponsor = msg.sender;
        task.dealid = dealId;
        task.status = IexecLibCore_v5.TaskStatusEnum.UNSET;
        _burn(
            msg.sender,
            appOrder.appprice + datasetOrder.datasetprice + workerpoolOrder.workerpoolprice
        );
    }

    function sponsorMatchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32 dealId) {
        if (shouldRevertOnSponsorMatchOrdersBoost) {
            revert("IexecPocoMock: Failed to sponsorMatchOrdersBoost");
        }
        dealId = mockDealId;
        dealBoost.requester = requestOrder.requester;
        dealBoost.botSize = uint16(requestOrder.volume);
        dealBoost.appPrice = uint96(appOrder.appprice);
        dealBoost.datasetPrice = uint96(datasetOrder.datasetprice);
        dealBoost.workerpoolPrice = uint96(workerpoolOrder.workerpoolprice);
        dealBoost.sponsor = msg.sender;
        task.status = IexecLibCore_v5.TaskStatusEnum.UNSET;
        _burn(
            msg.sender,
            appOrder.appprice + datasetOrder.datasetprice + workerpoolOrder.workerpoolprice
        );
    }

    function willRevertOnSponsorMatchOrders() external {
        shouldRevertOnSponsorMatchOrders = true;
    }

    function willRevertOnSponsorMatchOrdersBoost() external {
        shouldRevertOnSponsorMatchOrdersBoost = true;
    }

    /**
     * Claim
     */

    function claim(bytes32 taskId) external {
        if (shouldRevertOnClaim) {
            revert("IexecPocoMock: Failed to claim");
        }
        // This simulates non existent task/deal.
        if (taskId != mockTaskId) {
            revert(); // no reason, same as PoCo.
        }
        task.status = IexecLibCore_v5.TaskStatusEnum.FAILED;
        _mint(deal.sponsor, deal.app.price + deal.dataset.price + deal.workerpool.price);
    }

    function claimBoost(bytes32 dealId, uint256 taskIndex) external {
        if (shouldRevertOnClaim) {
            revert("IexecPocoMock: Failed to claim boost");
        }
        // This simulates non existent task/deal.
        if (dealId != mockDealId || taskIndex != mockTaskIndex) {
            revert("PocoBoost: Unknown task"); // same as PoCo.
        }
        task.status = IexecLibCore_v5.TaskStatusEnum.FAILED;
        _mint(
            dealBoost.sponsor,
            dealBoost.appPrice + dealBoost.datasetPrice + dealBoost.workerpoolPrice
        );
    }

    function willRevertOnClaim() external {
        shouldRevertOnClaim = true;
    }

    function willReturnTaskWithFailedStatus() external {
        shouldReturnTaskWithFailedStatus = true;
    }

    function viewDeal(bytes32) external view returns (IexecLibCore_v5.Deal memory) {
        return deal;
    }

    function viewDealBoost(bytes32) external view returns (IexecLibCore_v5.DealBoost memory) {
        return dealBoost;
    }

    function viewTask(bytes32) external view returns (IexecLibCore_v5.Task memory) {
        return task;
    }
}
