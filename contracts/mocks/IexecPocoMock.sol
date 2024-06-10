// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IexecLibCore_v5} from "@iexec/poco/contracts/libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @notice Testing purposes only.
 */
contract IexecPocoMock is ERC20 {
    // TODO multiply task price by volume in _mint() and burn().

    bool public shouldRevertOnSponsorMatchOrders = false;
    bool public shouldRevertOnSponsorMatchOrdersBoost = false;
    bool public shouldRevertOnClaim = false;
    bool public shouldReturnTaskWithFailedStatus = false;
    bool public shouldRevertOnTransfer = false;
    bool public shouldRevertOnTransferFrom = false;

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
        deal.requester = requestOrder.requester;
        deal.botSize = requestOrder.volume;
        deal.app.price = appOrder.appprice;
        deal.dataset.price = datasetOrder.datasetprice;
        deal.workerpool.price = workerpoolOrder.workerpoolprice;
        deal.sponsor = msg.sender;
        task.dealid = mockDealId;
        task.status = IexecLibCore_v5.TaskStatusEnum.UNSET;
        uint256 volume = computeDealVolume(appOrder, datasetOrder, workerpoolOrder, requestOrder);
        uint256 dealPrice = (appOrder.appprice +
            datasetOrder.datasetprice +
            workerpoolOrder.workerpoolprice) * volume;
        _burn(msg.sender, dealPrice);
        dealId = mockDealId;
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
        dealBoost.requester = requestOrder.requester;
        dealBoost.botSize = uint16(requestOrder.volume);
        dealBoost.appPrice = uint96(appOrder.appprice);
        dealBoost.datasetPrice = uint96(datasetOrder.datasetprice);
        dealBoost.workerpoolPrice = uint96(workerpoolOrder.workerpoolprice);
        dealBoost.sponsor = msg.sender;
        task.status = IexecLibCore_v5.TaskStatusEnum.UNSET;
        uint256 volume = computeDealVolume(appOrder, datasetOrder, workerpoolOrder, requestOrder);
        uint256 dealPrice = (appOrder.appprice +
            datasetOrder.datasetprice +
            workerpoolOrder.workerpoolprice) * volume;
        _burn(msg.sender, dealPrice);
        dealId = mockDealId;
    }

    function willRevertOnSponsorMatchOrders() external {
        shouldRevertOnSponsorMatchOrders = true;
    }

    function willRevertOnSponsorMatchOrdersBoost() external {
        shouldRevertOnSponsorMatchOrdersBoost = true;
    }

    function willRevertOnTransfer() external {
        shouldRevertOnTransfer = true;
    }

    function willRevertOnTransferFrom() external {
        shouldRevertOnTransferFrom = true;
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

    function computeDealVolume(
        IexecLibOrders_v5.AppOrder calldata,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) public pure returns (uint256) {
        return
            Math.min(
                datasetOrder.dataset != address(0) ? datasetOrder.volume : type(uint256).max,
                requestOrder.volume
            );
    }

    /**
     * Override transfer and transferFrom to mock revert case
     */
    function transfer(address recipient, uint256 amount) public override returns (bool) {
        if (shouldRevertOnTransfer) {
            return !shouldRevertOnTransfer;
        }
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        if (shouldRevertOnTransferFrom) {
            return !shouldRevertOnTransferFrom;
        }
        return super.transferFrom(sender, recipient, amount);
    }
}
