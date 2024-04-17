// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {Test, console2} from "forge-std/Test.sol";

import {VoucherHub} from "../contracts/VoucherHub.sol";
import {Voucher} from "../contracts/beacon/Voucher.sol";
import {IexecPocoMock} from "../contracts/mocks/IexecPocoMock.sol";

contract ContractVoucherHubTest is Test {
    // This function is called before each unit test
    function setUp() public {
        address beaconOwner;
        address assetEligibilityManager;
        address voucherManager;
        address voucherOwner1;
        address voucherOwner2;
        address anyone;

        UpgradeableBeacon beacon = UpgradeableBeacon(
            Upgrades.deployBeacon("Voucher.sol:Voucher", beaconOwner)
        );

        IexecPocoMock iExecPoco = new IexecPocoMock();

        address proxy = Upgrades.deployUUPSProxy(
            "VoucherHub.sol",
            abi.encodeCall(
                VoucherHub.initialize,
                (assetEligibilityManager, voucherManager, address(iExecPoco), address(beacon))
            )
        );
        console2.log("proxy address: %s", proxy);
    }
}
