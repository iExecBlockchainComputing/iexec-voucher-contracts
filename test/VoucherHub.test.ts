// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { AddressLike, BigNumberish, Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { deployAll } from '../deploy/deploy';
import * as commonUtils from '../scripts/common';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import {
    IexecPocoMock,
    IexecPocoMock__factory,
    Voucher,
    VoucherHub__factory,
    VoucherProxy__factory,
    Voucher__factory,
} from '../typechain-types';
import { VoucherHub } from '../typechain-types/contracts';
import { random } from './utils/address-utils';
import { FAIL_TYPES } from './utils/test-utils';

const voucherType = 0;
const description = 'Early Access';
const duration = 3600;
const voucherValue = 100n;
const asset = random();
const assetPrice = 1n;
const volume = 3n;
const initVoucherHubBalance = 10n * voucherValue; // arbitrary value, but should support couple voucher creations

// TODO use global variables (signers, addresses, ...).

describe('VoucherHub', function () {
    let iexecPoco: string;
    let iexecPocoInstance: IexecPocoMock;
    let voucherHubAsMinter: VoucherHub;
    let voucherHubAsManager: VoucherHub;
    let voucherHubAsAnyone: VoucherHub;
    let voucherHubAddress: string;
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [admin, manager, minter, voucherOwner1, voucherOwner2, anyone] =
            await ethers.getSigners();
        iexecPocoInstance = await new IexecPocoMock__factory()
            .connect(admin)
            .deploy()
            .then((x) => x.waitForDeployment());
        iexecPoco = await iexecPocoInstance.getAddress();
        let voucherBeaconAddress;
        ({ voucherHubAddress, voucherBeaconAddress } = await deployAll(
            admin.address,
            manager.address,
            minter.address,
            iexecPoco,
        ));
        const voucherHub = VoucherHub__factory.connect(voucherHubAddress, anyone);
        const beacon = VoucherProxy__factory.connect(voucherBeaconAddress, anyone);
        voucherHubAsMinter = voucherHub.connect(minter);
        voucherHubAsManager = voucherHub.connect(manager);
        voucherHubAsAnyone = voucherHub.connect(anyone);
        await iexecPocoInstance
            .transfer(await voucherHub.getAddress(), initVoucherHubBalance)
            .then((tx) => tx.wait());
        return {
            beacon,
            voucherHub,
            admin,
            manager,
            minter,
            voucherOwner1,
            voucherOwner2,
            anyone,
        };
    }

    describe('Initialize', function () {
        it('Should initialize', async function () {
            const { beacon, voucherHub, admin, manager, minter } = await loadFixture(deployFixture);
            const voucherBeaconAddress = await beacon.getAddress();
            // Check roles.
            expect(await voucherHub.owner())
                .to.equal(await voucherHub.defaultAdmin())
                .to.equal(admin);
            expect(await voucherHub.defaultAdminDelay()).to.equal(0);
            expect(await voucherHub.hasRole(await voucherHub.UPGRADER_ROLE.staticCall(), admin)).to
                .be.true;
            expect(await voucherHub.hasRole(await voucherHub.MANAGER_ROLE.staticCall(), manager)).to
                .be.true;
            expect(await voucherHub.hasRole(await voucherHub.MINTER_ROLE.staticCall(), minter)).to
                .be.true;
            // Check config.
            expect(await voucherHub.getIexecPoco()).to.equal(iexecPoco);
            expect(await voucherHub.getVoucherBeacon()).to.equal(voucherBeaconAddress);
            // Check VoucherProxy code hash
            const actualCodeHash = await voucherHub.getVoucherProxyCodeHash();
            const expectedCodeHash =
                await voucherHubUtils.getExpectedVoucherProxyCodeHash(voucherBeaconAddress);
            expect(actualCodeHash).to.equal(expectedCodeHash);
        });

        it('Should not initialize without admin', async function () {
            const address = ethers.Wallet.createRandom().address;

            await expect(
                voucherHubUtils.deployHub(ethers.ZeroAddress, address, address, address, address),
            ).to.be.revertedWith('VoucherHub: init without admin');
        });

        it('Should not initialize twice', async function () {
            const { beacon, voucherHub, admin, manager, minter } = await loadFixture(deployFixture);

            await expect(
                voucherHub.initialize(admin, manager, minter, iexecPoco, await beacon.getAddress()),
            ).to.be.revertedWithCustomError(voucherHub, 'InvalidInitialization');
        });
    });

    describe('Upgrade', function () {
        it('Should upgrade', async function () {
            const { voucherHub, admin } = await loadFixture(deployFixture);
            const VoucherHubV2Factory = await ethers.getContractFactory('VoucherHubV2Mock', admin);
            // Next line should throw if new storage schema is not compatible with previous one
            await voucherHubUtils.upgradeProxy(voucherHubAddress, VoucherHubV2Factory);
            const voucherHubV2 = await ethers.getContractAt('VoucherHubV2Mock', voucherHubAddress);
            await voucherHubV2.initializeV2('bar');

            expect(await voucherHubV2.getAddress()).to.equal(voucherHubAddress);
            expect(await voucherHubV2.getIexecPoco()).to.equal(iexecPoco); // V1
            expect(await voucherHubV2.foo()).to.equal('bar'); // V2
        });

        it('Should not upgrade when account is unauthorized', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);

            await expect(
                voucherHubAsAnyone.upgradeToAndCall(ethers.Wallet.createRandom().address, '0x'),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Create voucher type', function () {
        it('Should create a voucher type when the caller is authorized', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHubAsManager.createVoucherType(description, duration);
            const type0 = await voucherHub.getVoucherType(0);
            const count = await voucherHub.getVoucherTypeCount();
            // Run assertions.
            expect(createTypeTx)
                .to.emit(voucherHub, 'VoucherTypeCreated')
                .withArgs(0, description, duration);
            expect(type0.description).to.equal(description);
            expect(type0.duration).to.equal(duration);
            expect(count).to.equal(1);
        });

        it('Should not create a voucher type when the caller is not authorized', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(
                voucherHubAsAnyone.createVoucherType(description, duration),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Get voucher type', function () {
        it('Should not get the voucher type when the voucher type ID is out of bounds', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await expect(voucherHub.getVoucherType(999)).to.be.revertedWith(
                'VoucherHub: type index out of bounds',
            );
        });
    });

    describe('Update voucher type description', function () {
        const newDescription = 'Long Term Duration';
        it('Should update voucher description', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            const updateDescriptionTx = await voucherHubAsManager.updateVoucherTypeDescription(
                0,
                newDescription,
            );
            await updateDescriptionTx.wait();
            expect(updateDescriptionTx)
                .to.emit(voucherHub, 'VoucherTypeDescriptionUpdated')
                .withArgs(0, newDescription);
        });

        it('Should not update voucher description when the caller is not authorized', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            await expect(
                voucherHubAsAnyone.updateVoucherTypeDescription(0, newDescription),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not update description when the voucher type ID is out of bounds', async function () {
            await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            await expect(
                voucherHubAsManager.updateVoucherTypeDescription(999, newDescription),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Update voucher type duration', function () {
        const newDuration = 7200;
        it('Should update voucher duration', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            const updateDurationTx = await voucherHubAsManager.updateVoucherTypeDuration(
                0,
                newDuration,
            );
            await updateDurationTx.wait();
            expect(updateDurationTx)
                .to.emit(voucherHub, 'VoucherTypeDurationUpdated')
                .withArgs(0, newDuration);
        });

        it('Should not update voucher duration when the caller is not authorized', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            await expect(
                voucherHubAsAnyone.updateVoucherTypeDuration(0, newDuration),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not update duration when the voucher type ID is out of bounds', async function () {
            await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            await expect(
                voucherHubAsManager.updateVoucherTypeDuration(999, newDuration),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Asset Eligibility', function () {
        it('Should set and unset asset eligibility', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx = await voucherHubAsManager.addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(addEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetAdded');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            const removeEligibleAssetTx = await voucherHubAsManager.removeEligibleAsset(
                typeId,
                asset,
            );
            await removeEligibleAssetTx.wait();
            expect(removeEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetRemoved');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .false;
        });

        it('Should not set asset eligibility when the caller is not authorized', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            await expect(
                voucherHubAsAnyone.addEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not add eligible asset when invalid voucher type', async function () {
            await loadFixture(deployFixture);
            await expect(voucherHubAsManager.addEligibleAsset(99, asset)).to.be.revertedWith(
                'VoucherHub: type index out of bounds',
            );
        });

        it('Should not unset asset eligibility when the caller is not authorized', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx = await voucherHubAsManager.addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            await expect(
                voucherHubAsAnyone.removeEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not remove eligible asset when invalid voucher type', async function () {
            await loadFixture(deployFixture);
            await expect(voucherHubAsManager.removeEligibleAsset(99, asset)).to.be.revertedWith(
                'VoucherHub: type index out of bounds',
            );
        });
    });

    describe('Create voucher', function () {
        it('Should create and initialize voucher', async function () {
            const { beacon, voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            const expectedVoucherHubInitSrlcBalance = initVoucherHubBalance;
            // Create voucher.
            const voucherHubInitialSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            const createVoucherTx = await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait());

            const voucherHubPostCreationSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            const voucherInitialCreditBalance = await voucherHub.balanceOf(voucher.getAddress());
            const voucherInitialSrlBalance = await iexecPocoInstance.balanceOf(
                voucher.getAddress(),
            );
            const voucherAsProxy = await commonUtils.getVoucherAsProxy(voucherAddress);
            const expectedExpiration = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherTx,
            );
            // Run assertions.
            expect(voucherHubInitialSrlcBalance).to.equal(expectedVoucherHubInitSrlcBalance);
            expect(voucherHubPostCreationSrlcBalance).to.equal(
                voucherHubInitialSrlcBalance - BigInt(voucherValue),
            );
            expect(voucherInitialCreditBalance).to.equal(voucherValue);
            expect(voucherInitialSrlBalance).to.equal(voucherValue);
            // Events.
            await expect(createVoucherTx)
                .to.emit(voucherAsProxy, 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress,
                    voucherOwner1.address,
                    voucherType,
                    expectedExpiration,
                    voucherValue,
                );
            // Voucher as proxy
            expect(await voucherAsProxy.implementation(), 'Implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            // Voucher
            expect(await voucher.owner(), 'Owner mismatch').to.equal(voucherOwner1);
            expect(await voucher.getExpiration(), 'Expiration mismatch').to.equal(
                expectedExpiration,
            );
            expect(await voucher.isAccountAuthorized(voucherOwner1.address)).to.be.true;
        });

        it('Should create different vouchers for different accounts with the same config', async function () {
            // Vouchers are created with the same configuration (type, expiration, ...).
            // The goal is to make sure that configuration is not included in the constructor
            // args which would result in different create2 salts.
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            // Create type0.
            await voucherHubAsManager.createVoucherType(description, duration);
            const voucherHubInitialSrlBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            // Create voucher1.
            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner1, voucherType, voucherValue),
            ).to.emit(voucherHub, 'VoucherCreated');
            const voucherHubFirstCreationSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );

            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1: Voucher = await commonUtils.getVoucher(voucherAddress1);
            // Create voucher2.
            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner2, voucherType, voucherValue),
            ).to.emit(voucherHub, 'VoucherCreated');
            const voucherHubSecondCreationSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );

            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2: Voucher = await commonUtils.getVoucher(voucherAddress2);
            expect(voucherHubFirstCreationSrlcBalance).to.equal(
                voucherHubInitialSrlBalance - BigInt(voucherValue),
            );
            expect(voucherHubSecondCreationSrlcBalance).to.equal(
                voucherHubFirstCreationSrlcBalance - BigInt(voucherValue),
            );

            expect(voucherAddress1).is.not.equal(voucherAddress2);
            expect(await voucher1.owner()).to.not.equal(await voucher2.owner());
            expect(await voucher1.getType()).to.equal(await voucher2.getType());
            expect(await voucher1.getVoucherHub()).to.equal(await voucher2.getVoucherHub());
        });

        it('Should create multiple vouchers with the correct config', async function () {
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            // Create type0.
            await voucherHubAsManager.createVoucherType(description, duration);
            const voucherType1 = 1;
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherValue1 = 200n;
            // Create type1.
            await voucherHubAsManager.createVoucherType(description1, duration1);
            // Create voucher1.
            const createVoucherTx1 = await voucherHubAsMinter.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
            const createVoucherReceipt1 = await createVoucherTx1.wait();
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherReceipt1,
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1 = await commonUtils.getVoucher(voucherAddress1);
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHubAsMinter.createVoucher(
                voucherOwner2,
                voucherType1,
                voucherValue1,
            );
            const createVoucherReceipt2 = await createVoucherTx2.wait();
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                duration1,
                createVoucherReceipt2,
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2 = await commonUtils.getVoucher(voucherAddress2);
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);
            const voucherHubFinalSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            // Events
            await expect(createVoucherTx1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress1,
                    voucherOwner1.address,
                    voucherType,
                    expectedExpirationVoucher1,
                    voucherValue,
                );
            await expect(createVoucherTx2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress2,
                    voucherOwner2.address,
                    voucherType1,
                    expectedExpirationVoucher2,
                    voucherValue1,
                );
            // Voucher as proxy
            expect(
                await voucherAsProxy1.implementation(),
                'Implementation mismatch between proxies',
            ).to.equal(await voucherAsProxy2.implementation());
            // Voucher
            expect(
                await voucher1.getExpiration(),
                'Expiration should not match between proxies',
            ).to.not.equal(await voucher2.getExpiration());
            expect(await voucher1.owner(), 'Owners should not match between proxies').to.not.equal(
                voucher2.owner(),
            );
            expect(await voucher1.getVoucherHub(), 'Voucher hub address mismatch').to.equal(
                await voucherHub.getAddress(),
            );
            expect(await voucher2.getVoucherHub(), 'Voucher hub address mismatch').to.equal(
                await voucherHub.getAddress(),
            );
            expect(await voucher1.getType(), 'Voucher 1 type mismatch').to.equal(voucherType);
            expect(await voucher2.getType(), 'Voucher 2 type mismatch').to.equal(voucherType1);
            expect(await voucherHub.balanceOf(voucher1.getAddress())).to.equal(voucherValue);
            expect(await voucherHub.balanceOf(voucher2.getAddress())).to.equal(voucherValue1);
            expect(voucherHubFinalSrlcBalance).to.equal(
                initVoucherHubBalance - voucherValue - voucherValue1,
            );
        });

        it('Should not create more than 1 voucher for the same account', async function () {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            // Create voucher.
            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner1, voucherType, voucherValue),
            ).to.emit(voucherHub, 'VoucherCreated');
            // Second creation should fail.
            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner1, voucherType, voucherValue),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create more than 1 voucher for the same account with different config', async function () {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            // Create voucher.
            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner1, voucherType, voucherValue),
            ).to.emit(voucherHub, 'VoucherCreated');
            // Second creation should fail.
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherType1 = 1;
            await voucherHubAsManager.createVoucherType(description1, duration1);
            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner1, voucherType1, voucherValue),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create voucher when initialization fails', async function () {
            // TODO
        });

        it('Should not initialize voucher more than once', async function () {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            // Create voucher.
            const createVoucherTx = await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait());
            const expectedExpiration = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherTx,
            );
            await expect(createVoucherTx).to.emit(voucherHub, 'VoucherCreated');
            // Second initialization should fail.
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            await expect(
                voucher.initialize(
                    voucherOwner1,
                    await voucherHub.getAddress(),
                    expectedExpiration,
                    voucherType,
                ),
            ).to.be.revertedWithCustomError(voucher, 'InvalidInitialization');
        });

        it('Should not create voucher when not authorized', async function () {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            // Create voucher.
            await expect(
                voucherHubAsAnyone.createVoucher(voucherOwner1, voucherType, voucherValue),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not create voucher without value', async function () {
            const { voucherOwner1 } = await loadFixture(deployFixture);

            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner1, voucherType, 0),
            ).to.be.revertedWith('VoucherHub: mint without value');
        });

        it('Should not create voucher when voucher type ID is out of bounds', async function () {
            const { voucherOwner1 } = await loadFixture(deployFixture);
            const outOfBoundsTypeID = 999;
            // Create voucher.
            await expect(
                voucherHubAsMinter.createVoucher(voucherOwner1, outOfBoundsTypeID, voucherValue),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });

        it('Should not create voucher when SLRC transfer fails', async function () {
            const { voucherOwner1 } = await loadFixture(deployFixture);
            await voucherHubAsManager.createVoucherType(description, duration);
            for (const failType of FAIL_TYPES) {
                await iexecPocoInstance.willFailOnTransfer(failType).then((tx) => tx.wait());
                // Create voucher.
                await expect(
                    voucherHubAsMinter.createVoucher(voucherOwner1, voucherType, voucherValue),
                ).to.be.revertedWith('VoucherHub: SRLC transfer to voucher failed');
            }
        });
    });

    describe('Top up voucher', function () {
        let [voucherOwner1, anyone]: SignerWithAddress[] = [];
        let voucherHub: VoucherHub;
        let voucherAddress: string;

        beforeEach(async function () {
            ({ voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture));
            await voucherHubAsManager
                .createVoucherType(description, duration)
                .then((tx) => tx.wait());
            voucherAddress = await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner1));
        });

        it('Should top up voucher', async function () {
            const topUpValue = 123n; // arbitrary value
            const voucherCreditBalanceBefore = await voucherHub.balanceOf(voucherAddress);
            const voucherSrlcBalanceBefore = await iexecPocoInstance.balanceOf(voucherAddress);
            const expirationBefore = await Voucher__factory.connect(
                voucherAddress,
                anyone,
            ).getExpiration();

            const tx = await voucherHubAsMinter.topUpVoucher(voucherAddress, topUpValue);
            const txReceipt = await tx.wait();
            const expectedExpiration = await commonUtils.getExpectedExpiration(duration, txReceipt);
            await expect(tx)
                .to.emit(voucherHub, 'VoucherToppedUp')
                .withArgs(voucherAddress, expectedExpiration, topUpValue);
            const voucherCreditBalanceAfter = await voucherHub.balanceOf(voucherAddress);
            const voucherSrlcBalanceAfter = await iexecPocoInstance.balanceOf(voucherAddress);
            expect(voucherCreditBalanceAfter)
                .equal(voucherCreditBalanceBefore + topUpValue)
                .equal(voucherSrlcBalanceBefore + topUpValue)
                .equal(voucherSrlcBalanceAfter);
            expect(await Voucher__factory.connect(voucherAddress, anyone).getExpiration())
                .to.be.greaterThan(expirationBefore)
                .to.be.equal(expectedExpiration);
        });

        it('Should not top up by anyone', async function () {
            await expect(
                voucherHub
                    .connect(anyone)
                    .topUpVoucher(Wallet.createRandom().address, voucherValue),
            ).to.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not top up voucher without value', async function () {
            await expect(
                voucherHubAsMinter.topUpVoucher(Wallet.createRandom().address, 0),
            ).to.revertedWith('VoucherHub: no value');
        });

        it('Should not top up unknown voucher', async function () {
            await expect(
                voucherHubAsMinter.topUpVoucher(Wallet.createRandom().address, voucherValue),
            ).to.revertedWith('VoucherHub: unknown voucher');
        });
        it('Should not top up when SLRC transfer fails', async function () {
            const topUpValue = 123n; // arbitrary value
            for (const failType of FAIL_TYPES) {
                await iexecPocoInstance.willFailOnTransfer(failType).then((tx) => tx.wait());
                // Create voucher.
                await expect(
                    voucherHubAsMinter.topUpVoucher(voucherAddress, topUpValue),
                ).to.be.revertedWith('VoucherHub: SRLC transfer to voucher failed');
            }
        });
    });

    describe('Debit voucher', function () {
        let [voucherOwner1, voucherOwner2, voucher, anyone]: SignerWithAddress[] = [];
        let voucherHub: VoucherHub;

        beforeEach(async function () {
            ({ voucherHub, voucherOwner1, voucherOwner2, anyone } =
                await loadFixture(deployFixture));
            // Create voucher type
            await voucherHubAsManager
                .createVoucherType(description, duration)
                .then((tx) => tx.wait());
            // Add eligible asset
            await voucherHubAsManager.addEligibleAsset(voucherType, asset).then((tx) => tx.wait());
            // Create voucher
            voucher = await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner1))
                .then((voucherAddress) => ethers.getImpersonatedSigner(voucherAddress));
        });

        it('Should debit voucher', async function () {
            const sponsoredValue = assetPrice * 3n * volume;
            const voucherInitialCreditBalance = await voucherHub.balanceOf(voucher.address);

            const args = [
                voucherType,
                asset,
                assetPrice,
                asset,
                assetPrice,
                asset,
                assetPrice,
                volume,
            ] as [
                voucherTypeId: BigNumberish,
                app: AddressLike,
                appPrice: BigNumberish,
                dataset: AddressLike,
                datasetPrice: BigNumberish,
                workerpool: AddressLike,
                workerpoolPrice: BigNumberish,
                volume: BigNumberish,
            ];
            expect(await voucherHub.connect(voucher).debitVoucher.staticCall(...args)).to.be.equal(
                sponsoredValue,
            );
            await expect(await voucherHub.connect(voucher).debitVoucher(...args))
                .to.emit(voucherHub, 'Transfer')
                .withArgs(voucher.address, ethers.ZeroAddress, sponsoredValue)
                .to.emit(voucherHub, 'VoucherDebited')
                .withArgs(voucher.address, sponsoredValue);
            expect(await voucherHub.balanceOf(voucher.address)).equals(
                voucherInitialCreditBalance - sponsoredValue,
            );
        });

        it('Should debit zero when sender is not a voucher', async function () {
            const initialCreditBalance = await voucherHub.balanceOf(anyone.address);
            const debitVoucher = () =>
                voucherHub
                    .connect(anyone)
                    .debitVoucher(
                        voucherType,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        volume,
                    );
            // The matcher 'emit' cannot be chained after or before 'reverted'
            // so we call several times to check different assertions
            await expect(await debitVoucher()).to.not.be.reverted;
            await expect(await debitVoucher()).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(anyone.address))
                .to.equal(initialCreditBalance)
                .to.equal(0);
        });

        it('Should debit zero when voucher balance is empty', async function () {
            const voucher = await voucherHubAsMinter
                .createVoucher(voucherOwner2, voucherType, assetPrice * 3n * volume)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner2))
                .then((voucherAddress) => ethers.getImpersonatedSigner(voucherAddress));
            await voucherHub
                .connect(voucher)
                .debitVoucher(
                    voucherType,
                    asset,
                    assetPrice,
                    asset,
                    assetPrice,
                    asset,
                    assetPrice,
                    volume,
                )
                .then((tx) => tx.wait());
            const emptyVoucher = voucher;
            const initialCreditBalance = await voucherHub.balanceOf(emptyVoucher.address);

            await expect(
                await voucherHub
                    .connect(emptyVoucher)
                    .debitVoucher(
                        voucherType,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        volume,
                    ),
            ).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(emptyVoucher.address))
                .to.equal(initialCreditBalance)
                .to.equal(0);
        });

        it('Should debit zero with no eligible asset', async function () {
            const initialCreditBalance = await voucherHub.balanceOf(voucher.address);
            const unEligibleAsset = random();

            await expect(
                voucherHub
                    .connect(voucher)
                    .debitVoucher(
                        voucherType,
                        unEligibleAsset,
                        assetPrice,
                        unEligibleAsset,
                        assetPrice,
                        unEligibleAsset,
                        assetPrice,
                        volume,
                    ),
            ).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(voucher.address)).to.equal(initialCreditBalance);
        });

        it('Should not debit voucher with an invalid voucher type ID', async function () {
            const initialCreditBalance = await voucherHub.balanceOf(anyone.address);

            await expect(
                voucherHub
                    .connect(anyone)
                    .debitVoucher(
                        999,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        volume,
                    ),
            ).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(anyone.address)).to.equal(initialCreditBalance);
        });
    });

    describe('Refund voucher', function () {
        let [voucherOwner1, voucher, anyone]: SignerWithAddress[] = [];
        let voucherHub: VoucherHub;

        beforeEach(async function () {
            ({ voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture));
            // Create voucher type
            await voucherHubAsManager
                .createVoucherType(description, duration)
                .then((tx) => tx.wait());
            // Add eligible asset
            await voucherHubAsManager.addEligibleAsset(voucherType, asset).then((tx) => tx.wait());
            // Create voucher
            voucher = await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner1))
                .then((voucherAddress) => ethers.getImpersonatedSigner(voucherAddress));
        });

        it('Should refund voucher', async function () {
            const debitedValue = assetPrice * 3n * volume;
            const voucherInitialCreditBalance = await voucherHub.balanceOf(voucher.address);
            await voucherHub
                .connect(voucher)
                .debitVoucher(
                    voucherType,
                    asset,
                    assetPrice,
                    asset,
                    assetPrice,
                    asset,
                    assetPrice,
                    volume,
                )
                .then((tx) => tx.wait());
            expect(await voucherHub.balanceOf(voucher.address)).equals(
                voucherInitialCreditBalance - debitedValue,
            );
            // Refund voucher.
            const refundAmount = debitedValue / 2n; // any amount < sponsoredValue
            await expect(voucherHub.connect(voucher).refundVoucher(refundAmount))
                .to.emit(voucherHub, 'Transfer')
                .withArgs(ethers.ZeroAddress, voucher.address, refundAmount)
                .to.emit(voucherHub, 'VoucherRefunded')
                .withArgs(voucher.address, refundAmount);
        });

        it('Should not refund when sender is not a voucher', async function () {
            const debitedValue = assetPrice * 3n * volume;
            const voucherInitialCreditBalance = await voucherHub.balanceOf(voucher.address);
            await voucherHub
                .connect(voucher)
                .debitVoucher(
                    voucherType,
                    asset,
                    assetPrice,
                    asset,
                    assetPrice,
                    asset,
                    assetPrice,
                    volume,
                )
                .then((tx) => tx.wait());
            expect(await voucherHub.balanceOf(voucher.address)).equals(
                voucherInitialCreditBalance - debitedValue,
            );
            // Refund voucher.
            const refundAmount = debitedValue / 2n; // any amount < sponsoredValue
            await expect(voucherHub.connect(anyone).refundVoucher(refundAmount)).to.be.revertedWith(
                'VoucherHub: sender is not voucher',
            );
        });
    });

    describe('Drain voucher', function () {
        let [voucherOwner1, anyone]: SignerWithAddress[] = [];
        let voucherHub: VoucherHub;
        let voucher: Voucher;
        let voucherAddress: string;

        beforeEach(async function () {
            ({ voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture));
            // Create voucher type
            await voucherHubAsManager
                .createVoucherType(description, duration)
                .then((tx) => tx.wait());
            // Create voucher
            voucherAddress = await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner1));
            voucher = Voucher__factory.connect(voucherAddress, anyone);
        });

        it('Should drain all funds of expired voucher', async function () {
            const voucherHubSrlcBalanceBefore =
                await iexecPocoInstance.balanceOf(voucherHubAddress);
            // Expire voucher
            const expirationDate = await voucher.getExpiration();
            await time.setNextBlockTimestamp(expirationDate); // after expiration
            // Drain
            await expect(voucherHubAsAnyone.drainVoucher(voucherAddress))
                .to.emit(iexecPocoInstance, 'Transfer')
                .withArgs(voucherAddress, voucherHubAddress, voucherValue)
                .to.emit(voucherHub, 'Transfer')
                .withArgs(voucherAddress, ethers.ZeroAddress, voucherValue)
                .to.emit(voucherHub, 'VoucherDrained')
                .withArgs(voucherAddress, voucherValue);
            expect(await iexecPocoInstance.balanceOf(voucherAddress))
                .to.equal(await voucherHub.balanceOf(voucherAddress))
                .to.equal(await voucher.getBalance())
                .to.equal(0);
            // Should send SRLCs to VoucherHub contract.
            expect(await iexecPocoInstance.balanceOf(voucherHubAddress)).to.equal(
                voucherHubSrlcBalanceBefore + voucherValue,
            );
        });

        it('Should not drain if unknown voucher', async function () {
            await expect(
                voucherHubAsMinter.drainVoucher(ethers.Wallet.createRandom().address),
            ).to.be.revertedWith('VoucherHub: nothing to drain');
        });

        it('Should not drain if balance is empty', async function () {
            // Expire voucher
            const expirationDate = await voucher.getExpiration();
            await time.setNextBlockTimestamp(expirationDate); // after expiration
            // Drain to empty the voucher from its balance.
            await voucherHubAsMinter.drainVoucher(voucherAddress).then((tx) => tx.wait());
            // Drain a second time when balance is empty.
            await expect(voucherHubAsMinter.drainVoucher(voucherAddress)).to.be.revertedWith(
                'VoucherHub: nothing to drain',
            );
        });
    });

    describe('Withdraw', function () {
        let receiver: string = ethers.Wallet.createRandom().address;

        beforeEach(async function () {
            await loadFixture(deployFixture);
        });

        it('Should withdraw all funds', async function () {
            expect(await iexecPocoInstance.balanceOf(voucherHubAddress)).to.equal(
                initVoucherHubBalance,
            );
            await expect(voucherHubAsManager.withdraw(receiver, initVoucherHubBalance))
                .to.emit(iexecPocoInstance, 'Transfer')
                .withArgs(voucherHubAddress, receiver, initVoucherHubBalance);
            expect(await iexecPocoInstance.balanceOf(voucherHubAddress)).to.equal(0);
            expect(await iexecPocoInstance.balanceOf(receiver)).to.equal(initVoucherHubBalance);
        });

        it('Should withdraw some funds', async function () {
            expect(await iexecPocoInstance.balanceOf(voucherHubAddress)).to.equal(
                initVoucherHubBalance,
            );
            const amount = initVoucherHubBalance / 2n;
            await expect(voucherHubAsManager.withdraw(receiver, amount))
                .to.emit(iexecPocoInstance, 'Transfer')
                .withArgs(voucherHubAddress, receiver, amount);
            expect(await iexecPocoInstance.balanceOf(voucherHubAddress)).to.equal(
                initVoucherHubBalance - amount,
            );
            expect(await iexecPocoInstance.balanceOf(receiver)).to.equal(amount);
        });

        it('Should not withdraw funds when sender is not authorized', async function () {
            await expect(
                voucherHubAsAnyone.withdraw(receiver, initVoucherHubBalance),
            ).to.be.revertedWithCustomError(voucherHubAsAnyone, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Is voucher', function () {
        it('Should be true when account is a voucher', async function () {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            await voucherHubAsManager
                .createVoucherType(description, duration)
                .then((tx) => tx.wait());
            await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait());
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            expect(await voucherHub.isVoucher(voucherAddress)).to.be.true;
        });

        it('Should be false when account is not a voucher', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            expect(await voucherHub.isVoucher(random())).to.be.false;
        });
    });

    describe('Get voucher', function () {
        it('Should not get voucher when voucher is not created', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            expect(await voucherHub.getVoucher(random())).to.be.equal(ethers.ZeroAddress);
        });
    });

    describe('Predict voucher', function () {
        it('Should predict voucher', async function () {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const predictedVoucherAddress = await voucherHub.predictVoucher(voucherOwner1);
            await voucherHubAsManager
                .createVoucherType(description, duration)
                .then((tx) => tx.wait());
            await voucherHubAsMinter
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait());
            expect(predictedVoucherAddress)
                .to.be.equal(
                    ethers.getCreate2Address(
                        await voucherHub.getAddress(), // deployer
                        ethers.zeroPadValue(voucherOwner1.address, 32), // salt
                        await voucherHub.getVoucherProxyCodeHash(), // bytecode hash
                    ),
                )
                .to.be.equal(await voucherHub.getVoucher(voucherOwner1));
        });
    });

    describe('NonTransferableERC20Upgradeable', function () {
        it('Should not transfer', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(voucherHub.transfer(anyone, 0)).to.be.revertedWith(
                'NonTransferableERC20Upgradeable: Unsupported transfer',
            );
        });

        it('Should not approve', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(voucherHub.approve(anyone, 0)).to.be.revertedWith(
                'NonTransferableERC20Upgradeable: Unsupported approve',
            );
        });

        it('Should not transferFrom', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(voucherHub.transferFrom(anyone, anyone, 0)).to.be.revertedWith(
                'NonTransferableERC20Upgradeable: Unsupported transferFrom',
            );
        });
    });
});

async function getVoucherTypeCreatedId(voucherHub: VoucherHub) {
    const events = await voucherHub.queryFilter(voucherHub.filters.VoucherTypeCreated, -1);
    const typeId = Number(events[0].args[0]);
    return typeId;
}
