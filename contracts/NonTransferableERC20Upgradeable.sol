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
     * @dev By default, the standard ERC-20 `decimals` value is `18`. However, this value
     * is overridden here to `9` to align with the number of decimal places used by
     * the RLC token. This ensures consistency in how input values are handled
     * when a voucher is minted.
     *
     * See https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/token/ERC20/ERC20.sol#L78
     *
     * @return The number of decimal places (9) used for token representation.
     */
    function decimals() public pure override returns (uint8) {
        return 9;
    }

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
