// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {Test} from "forge-std/Test.sol";

import {VoucherHub} from "../contracts/VoucherHub.sol";
import {Voucher} from "../contracts/beacon/Voucher.sol";

contract ContractVoucherHubTest is Test {
    // This function is called before each unit test
    function setUp() public {
        // deploy sui bridge
        address _beacon = Upgrades.deployBeacon(
            "SuiBridge.sol",
            abi.encodeCall(SuiBridge.initialize, (_committee, address(0), address(0), address(0)))
        );
    }
}
