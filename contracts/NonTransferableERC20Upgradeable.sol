// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
contract NonTransferableERC20Upgradeable is ERC20Upgradeable {
    /**
     * @notice VCHR is not transferable.
     */
    function transfer(address to, uint256 value) public pure override returns (bool) {
        to; // Silence unused
        value; // variable warnings
        revert("VoucherHub: Unsupported transfer");
    }

    /**
     *
     * @notice See `transfer` note above.
     */
    function approve(address spender, uint256 amount) public pure override returns (bool) {
        spender; // Silence unused warning
        amount; // Silence unused warning
        revert("VoucherHub: Unsupported approve");
    }

    /**
     *
     * @notice See `transfer` note above.
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public pure override returns (bool) {
        from; // Silence
        to; // unused variable
        value; // warning
        revert("VoucherHub: Unsupported transferFrom");
    }
}
