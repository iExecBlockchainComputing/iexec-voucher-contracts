// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

/**
 * @title NonTransferableERC20Upgradeable
 * @notice This contracts follows the standard ERC-20 Upgradeable model, but it cannot be transferred.
 */
contract NonTransferableERC20Upgradeable is ERC20Upgradeable {
    /**
     * @notice NonTransferableERC20Upgradeable is not transferable.
     */
    function transfer(address, uint256) public pure override returns (bool) {
        revert("NonTransferableERC20Upgradeable: Unsupported transfer");
    }

    /**
     *
     * @notice See `transfer` note above.
     */
    function approve(address, uint256) public pure override returns (bool) {
        revert("NonTransferableERC20Upgradeable: Unsupported approve");
    }

    /**
     *
     * @notice See `transfer` note above.
     */
    function transferFrom(address, address, uint256) public pure override returns (bool) {
        revert("NonTransferableERC20Upgradeable: Unsupported transferFrom");
    }
}
