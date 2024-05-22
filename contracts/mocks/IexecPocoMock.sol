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
    // TODO multiply task price by volume.

    bool public shouldRevertOnSponsorMatchOrders = false;
    bool public shouldRevertOnSponsorMatchOrdersBoost = false;
    bool public shouldRevertOnClaim = false;
    bool public shouldRevertOnClaimBoost = false;

    bytes32 public mockDealId = keccak256("deal");
    IexecLibCore_v5.Deal public deal;
    IexecLibCore_v5.DealBoost public dealBoost;

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
        _burn(
            msg.sender,
            appOrder.appprice + datasetOrder.datasetprice + workerpoolOrder.workerpoolprice
        );
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
        _burn(
            msg.sender,
            appOrder.appprice + datasetOrder.datasetprice + workerpoolOrder.workerpoolprice
        );
        dealId = mockDealId;
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

    function claim(bytes32) external {
        if (shouldRevertOnClaim) {
            revert("IexecPocoMock: Failed to claim");
        }
        _mint(msg.sender, deal.app.price + deal.dataset.price + deal.workerpool.price);
    }

    function claimBoost(bytes32, uint256) external {
        if (shouldRevertOnClaimBoost) {
            revert("IexecPocoMock: Failed to claim boost");
        }
        _mint(msg.sender, dealBoost.appPrice + dealBoost.datasetPrice + dealBoost.workerpoolPrice);
    }

    function willRevertOnClaim() external {
        shouldRevertOnClaim = true;
    }

    function willRevertOnClaimBoost() external {
        shouldRevertOnClaimBoost = true;
    }

    function viewDeal(bytes32) external view returns (IexecLibCore_v5.Deal memory) {
        return deal;
    }

    function viewDealBoost(bytes32) external view returns (IexecLibCore_v5.DealBoost memory) {
        return dealBoost;
    }

    function viewTask(bytes32) external pure returns (IexecLibCore_v5.Task memory task) {
        task.status = IexecLibCore_v5.TaskStatusEnum.ACTIVE;
    }
}
