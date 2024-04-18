// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {Upgrades} from "openzeppelin-foundry-upgrades/Upgrades.sol";
import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";
import {IBeacon} from "@openzeppelin/contracts/proxy/beacon/IBeacon.sol";
import {Test, console2} from "forge-std/Test.sol";

import {IVoucherHub} from "../contracts/VoucherHub.sol";
import {VoucherHub} from "../contracts/VoucherHub.sol";
import {Voucher} from "../contracts/beacon/Voucher.sol";
import {IexecPocoMock} from "../contracts/mocks/IexecPocoMock.sol";

contract ContractVoucherHubTest is Test {
    // struct VoucherType {
    //     string description;
    //     uint256 duration;
    // }
    // This function is called before each unit test
    address beaconOwner = address(0x9012);
    address assetEligibilityManager = address(0x1234);
    address voucherManager = address(0x5678);
    address voucherOwner1 = address(0x3456);
    address voucherOwner2 = address(0x1111);
    address anyone = address(0x2222);
    address public beacon;
    VoucherHub voucherHubinstance;
    function setUp() public {}

    // UpgradeableBeacon beacon = UpgradeableBeacon(
    //     Upgrades.deployBeacon("Voucher.sol:Voucher", beaconOwner)
    // );

    // beacon = Upgrades.deployBeacon("Voucher.sol:Voucher", beaconOwner);

    // IexecPocoMock iExecPoco = new IexecPocoMock();

    // address proxy = Upgrades.deployUUPSProxy(
    //     "VoucherHub.sol",
    //     abi.encodeCall(
    //         VoucherHub.initialize,
    //         (assetEligibilityManager, voucherManager, assetEligibilityManager, beaconOwner)
    //     )
    // );
    // voucherHubinstance = VoucherHub(proxy);
    // console2.log("proxy address: %s", proxy);

    // function testCreateVoucherType() public {
    //     vm.prank(assetEligibilityManager);
    //     beacon = Upgrades.deployBeacon("Voucher.sol:Voucher", beaconOwner);
    //     vm.stopPrank();
    //     // voucherHubinstance.createVoucherType("Test Voucher", 3600);

    //     // IVoucherHub.VoucherType memory voucherType = voucherHubinstance.getVoucherType(0);
    //     // assertEq(voucherType.description, "Test Voucher");
    //     // assertEq(voucherType.duration, 3600);
    // }

    function testBeacon() public {
        address beacon = Upgrades.deployBeacon("Voucher.sol", beaconOwner);
        // address implAddressV1 = IBeacon(beacon).implementation();
    }

    // address proxy = Upgrades.deployBeaconProxy(beacon, abi.encodeCall(Voucher.initialize, ("hello")));
    // Voucher instance = Voucher(proxy);

    // assertEq(Upgrades.getBeaconAddress(proxy), beacon);

    // assertEq(instance.greeting(), "hello");

    // Upgrades.upgradeBeacon(beacon, "GreeterV2.sol", msg.sender);
    // address implAddressV2 = IBeacon(beacon).implementation();

    // GreeterV2(address(instance)).resetGreeting();

    // assertEq(instance.greeting(), "resetted");
    // assertFalse(implAddressV2 == implAddressV1);
}
