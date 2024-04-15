// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @notice Testing purposes only.
 */
contract IexecPocoMock is ERC20 {
    bool public shouldRevertOnSponsorMatchOrders = false;

    constructor() ERC20("Staked RLC", "SRLC") {
        _mint(msg.sender, 1000000);
    }

    function sponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata
    ) external returns (bytes32 dealId) {
        if (shouldRevertOnSponsorMatchOrders) {
            revert("IexecPocoMock: Failed to sponsorMatchOrders");
        }
        _burn(
            msg.sender,
            appOrder.appprice + datasetOrder.datasetprice + workerpoolOrder.workerpoolprice
        );
        return keccak256("deal");
    }

    function willRevertOnSponsorMatchOrders() external {
        shouldRevertOnSponsorMatchOrders = true;
    }
}
