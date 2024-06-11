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
    bool public shouldRevertOnSponsorMatchOrders = false;
    bool public shouldRevertOnSponsorMatchOrdersBoost = false;
    bool public shouldRevertOnClaim = false;
    bool public shouldReturnTaskWithFailedStatus = false;
    bool public shouldFailOnTransfer = false;
    bool public shouldFailOnTransferFrom = false;

    bytes32 public mockDealId = keccak256("deal");
    uint256 public mockTaskIndex = 0;
    bytes32 public mockTaskId = keccak256(abi.encode(mockDealId, mockTaskIndex));

    IexecLibCore_v5.Deal public deal;
    IexecLibCore_v5.DealBoost public dealBoost;
    mapping(bytes32 => IexecLibCore_v5.Task) public tasks;

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
        deal.app.price = appOrder.appprice;
        deal.dataset.price = datasetOrder.datasetprice;
        deal.workerpool.price = workerpoolOrder.workerpoolprice;
        deal.sponsor = msg.sender;
        for (uint256 i = 0; i < deal.botSize; i++) {
            bytes32 taskId = keccak256(abi.encode(mockDealId, i));
            IexecLibCore_v5.Task storage task = tasks[taskId];
            task.dealid = mockDealId;
            task.status = IexecLibCore_v5.TaskStatusEnum.UNSET;
        }
        uint256 volume = computeDealVolume(appOrder, datasetOrder, workerpoolOrder, requestOrder);
        deal.botSize = volume;
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
        dealBoost.appPrice = uint96(appOrder.appprice);
        dealBoost.datasetPrice = uint96(datasetOrder.datasetprice);
        dealBoost.workerpoolPrice = uint96(workerpoolOrder.workerpoolprice);
        dealBoost.sponsor = msg.sender;
        for (uint256 i = 0; i < dealBoost.botSize; i++) {
            bytes32 taskId = keccak256(abi.encode(mockDealId, i));
            IexecLibCore_v5.Task storage task = tasks[taskId];
            task.dealid = mockDealId;
            task.status = IexecLibCore_v5.TaskStatusEnum.UNSET;
        }
        uint256 volume = computeDealVolume(appOrder, datasetOrder, workerpoolOrder, requestOrder);
        dealBoost.botSize = uint16(volume);
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

    function willFailOnTransfer() external {
        shouldFailOnTransfer = true;
    }

    function willFailOnTransferFrom() external {
        shouldFailOnTransferFrom = true;
    }

    /**
     * Claim
     */

    function claim(bytes32 taskId) external {
        if (shouldRevertOnClaim) {
            revert("IexecPocoMock: Failed to claim");
        }
        // This simulates non existent task/deal.
        bool knownTask;
        for (uint256 i = 0; i < deal.botSize; i++) {
            if (taskId == keccak256(abi.encode(mockDealId, i))) {
                knownTask = true;
            }
        }
        if (!knownTask) {
            revert(); // no reason, same as PoCo.
        }
        tasks[taskId].status = IexecLibCore_v5.TaskStatusEnum.FAILED;
        // mint task price.
        _mint(deal.sponsor, deal.app.price + deal.dataset.price + deal.workerpool.price);
    }

    function claimBoost(bytes32 dealId, uint256 taskIndex) external {
        if (shouldRevertOnClaim) {
            revert("IexecPocoMock: Failed to claim boost");
        }
        // This simulates non existent task/deal.
        if (dealId != mockDealId || taskIndex >= dealBoost.botSize) {
            revert("PocoBoost: Unknown task"); // same as PoCo.
        }
        bytes32 taskId = keccak256(abi.encode(mockDealId, taskIndex));
        tasks[taskId].status = IexecLibCore_v5.TaskStatusEnum.FAILED;
        // mint task price.
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

    function viewTask(bytes32 taskId) external view returns (IexecLibCore_v5.Task memory) {
        return tasks[taskId];
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
        if (shouldFailOnTransfer) {
            return false;
        }
        return super.transfer(recipient, amount);
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        if (shouldFailOnTransferFrom) {
            return false;
        }
        return super.transferFrom(sender, recipient, amount);
    }
}
