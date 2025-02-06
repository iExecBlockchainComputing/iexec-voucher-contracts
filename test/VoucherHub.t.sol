// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import {VoucherHub} from "../contracts/VoucherHub.sol";
import {Voucher} from "../contracts/beacon/Voucher.sol";
import {IexecPocoMock} from "../contracts/mocks/IexecPocoMock.sol";
import {Upgrades} from "@openzeppelin/foundry-upgrades/Upgrades.sol";

contract VoucherHubTest is Test {
    VoucherHub public voucherHub;
    address public admin;
    address public manager;
    address public minter;
    address public iexecPoco;
    IexecPocoMock public iexecPocoMock;
    address public voucherBeacon;

    // Test parameters
    uint256 constant VOUCHER_TYPE = 0;
    string constant DESCRIPTION = "Early Access";
    uint256 constant DURATION = 3600;
    uint256 constant VOUCHER_VALUE = 100;
    uint256 constant ASSET_PRICE = 1;
    uint256 constant VOLUME = 3;
    uint256 constant INIT_VOUCHER_HUB_BALANCE = VOUCHER_VALUE * 10;
    
    event VoucherTypeCreated(uint256 indexed id, string description, uint256 duration);
    event VoucherCreated(
        address indexed voucher,
        address indexed owner,
        uint256 voucherType,
        uint256 expiration,
        uint256 value
    );

    function setUp() public {
        admin = makeAddr("admin");
        manager = makeAddr("manager");
        minter = makeAddr("minter");
        // Deploy mock IexecPoco
        iexecPoco = address(new IexecPocoMock());

        // Deploy Voucher beacon using Upgrades library
        voucherBeacon = Upgrades.deployBeacon("Voucher.sol:Voucher", admin);

        address voucherHubAddress = Upgrades.deployUUPSProxy(
            "VoucherHub.sol",
            abi.encodeCall(
                VoucherHub.initialize,
                (admin, manager, minter, iexecPoco, voucherBeacon)
            )
        );
        voucherHub = VoucherHub(voucherHubAddress);

                // Transfer initial balance to VoucherHub
        iexecPocoMock = IexecPocoMock(iexecPoco);
        iexecPocoMock.transfer(address(voucherHub), INIT_VOUCHER_HUB_BALANCE);
    }

    function testInitialState() public {
        assertEq(voucherHub.getIexecPoco(), iexecPoco);
        assertEq(voucherHub.getVoucherBeacon(), voucherBeacon);
        assertTrue(voucherHub.hasRole(voucherHub.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(voucherHub.hasRole(voucherHub.MANAGER_ROLE(), manager));
        assertTrue(voucherHub.hasRole(voucherHub.MINTER_ROLE(), minter));
    }

    function testCreateVoucherType() public {
        vm.startPrank(manager);
        string memory description = "Test Voucher";
        uint256 duration = 7 days;
        
        vm.expectEmit(true, true, true, true);
        emit VoucherTypeCreated(0, description, duration);
        
        voucherHub.createVoucherType(description, duration);
        
        assertEq(voucherHub.getVoucherTypeCount(), 1);
        
        (string memory storedDescription, uint256 storedDuration) = 
            (voucherHub.getVoucherType(0).description, voucherHub.getVoucherType(0).duration);
        
        assertEq(storedDescription, description);
        assertEq(storedDuration, duration);
        
        vm.stopPrank();
    }
    function testCreateVoucher() public {
        // First create a voucher type
        vm.startPrank(manager);
        voucherHub.createVoucherType(DESCRIPTION, DURATION);
        vm.stopPrank();

        // Create voucher
        vm.startPrank(minter);
        address owner = makeAddr("owner");
        uint256 value = 1000;
        
        address voucherAddress = voucherHub.createVoucher(owner, 0, value);
        
        assertTrue(voucherHub.isVoucher(voucherAddress));
        assertEq(voucherHub.balanceOf(voucherAddress), value);
        
        vm.stopPrank();
    }

    function test_RevertCreateVoucherTypeNotManager() public {
        vm.expectRevert();
        vm.prank(makeAddr("notManager"));
        voucherHub.createVoucherType(DESCRIPTION, DURATION);
    }

    function test_RevertCreateVoucherNotMinter() public {
        vm.startPrank(manager);
        voucherHub.createVoucherType(DESCRIPTION, DURATION);

        vm.stopPrank();
        
        vm.expectRevert();
        vm.prank(makeAddr("notMinter"));
        voucherHub.createVoucher(makeAddr("owner"), 0, 1000);
    }

    function testUpdateVoucherTypeDescription() public {
        vm.startPrank(manager);
        voucherHub.createVoucherType(DESCRIPTION, DURATION);

        
        string memory newDescription = "Updated Description";
        voucherHub.updateVoucherTypeDescription(0, newDescription);
        
        assertEq(voucherHub.getVoucherType(0).description, newDescription);
        vm.stopPrank();
    }
    function testUpdateVoucherTypeDuration() public {
        vm.startPrank(manager);
        voucherHub.createVoucherType(DESCRIPTION, DURATION);

        
        uint256 newDuration = 14 days;
        voucherHub.updateVoucherTypeDuration(0, newDuration);
        
        assertEq(voucherHub.getVoucherType(0).duration, newDuration);
        vm.stopPrank();
    }

    function testAddAndRemoveEligibleAsset() public {
        vm.startPrank(manager);
        voucherHub.createVoucherType(DESCRIPTION, DURATION);

        
        address asset = makeAddr("asset");
        voucherHub.addEligibleAsset(0, asset);
        
        assertTrue(voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset));
        
        voucherHub.removeEligibleAsset(0, asset);
        
        assertFalse(voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset));
        vm.stopPrank();
    }

    function testTopUpVoucher() public {
        // Setup
        vm.startPrank(manager);
        voucherHub.createVoucherType(DESCRIPTION, DURATION);

        vm.stopPrank();

        vm.startPrank(minter);
        address owner = makeAddr("owner");
        address voucherAddress = voucherHub.createVoucher(owner, 0, VOUCHER_VALUE);
        voucherHub.topUpVoucher(voucherAddress, VOUCHER_VALUE);
        
        assertEq(voucherHub.balanceOf(voucherAddress), 2*VOUCHER_VALUE);
        vm.stopPrank();
    }

    function testDrainVoucher() public {
        // Setup
        vm.startPrank(manager);
        voucherHub.createVoucherType(DESCRIPTION, DURATION);
        vm.stopPrank();
    
        vm.startPrank(minter);
        address owner = makeAddr("owner");
        uint256 value = 1000;
        address voucherAddress = voucherHub.createVoucher(owner, 0, value);
        vm.stopPrank();
    
        // Check initial balance
        uint256 initialBalance = voucherHub.balanceOf(voucherAddress);
        assertEq(initialBalance, value);
    
        // Try to drain before expiration (should fail)
        vm.prank(owner);
        vm.expectRevert("Voucher: voucher is not expired");
        voucherHub.drainVoucher(voucherAddress);
    
        // Advance time beyond voucher expiration
        vm.warp(block.timestamp + DURATION + 1);
    
        // Now drain should succeed
        vm.prank(owner);
        voucherHub.drainVoucher(voucherAddress);
        
        // Verify final state
        assertEq(voucherHub.balanceOf(voucherAddress), 0);
        assertEq(IexecPocoMock(iexecPoco).balanceOf(voucherAddress), 0);
    }
    


    

}
