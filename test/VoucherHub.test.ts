// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as commonUtils from '../scripts/common';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { Voucher } from '../typechain-types';
import { VoucherHub } from '../typechain-types/contracts';

const voucherHubAdminOperationDelay = 5 * 24 * 60 * 60; // 432000 (5 days in seconds)
const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random
const voucherType = 0;
const description = 'Early Access';
const duration = 3600;
const asset = ethers.Wallet.createRandom().address;

describe('VoucherHub', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [
            owner, // TODO rename to admin.
            upgradeManager,
            assetEligibilityManager,
            voucherManager,
            voucherOwner1,
            voucherOwner2,
            anyone,
        ] = await ethers.getSigners();
        const beacon = await voucherUtils.deployBeaconAndImplementation(upgradeManager.address);
        const voucherHub = await voucherHubUtils.deployHub(
            upgradeManager.address,
            assetEligibilityManager.address,
            voucherManager.address,
            iexecPoco,
            await beacon.getAddress(),
        );
        return {
            beacon,
            voucherHub,
            owner,
            upgradeManager,
            assetEligibilityManager,
            voucherManager,
            voucherOwner1,
            voucherOwner2,
            anyone,
        };
    }

    describe('Initialize', function () {
        it('Should initialize', async () => {
            const {
                beacon,
                voucherHub,
                owner,
                upgradeManager,
                assetEligibilityManager,
                voucherManager,
            } = await loadFixture(deployFixture);
            const voucherBeaconAddress = await beacon.getAddress();
            // Check roles.
            expect(await voucherHub.owner())
                .to.equal(await voucherHub.defaultAdmin())
                .to.equal(owner);
            expect(await voucherHub.defaultAdminDelay()).to.equal(voucherHubAdminOperationDelay);
            expect(
                await voucherHub.hasRole(
                    await voucherHub.UPGRADE_MANAGER_ROLE.staticCall(),
                    upgradeManager,
                ),
            );
            expect(
                await voucherHub.hasRole(
                    await voucherHub.ASSET_ELIGIBILITY_MANAGER_ROLE.staticCall(),
                    assetEligibilityManager,
                ),
            );
            expect(
                await voucherHub.hasRole(
                    await voucherHub.VOUCHER_MANAGER_ROLE.staticCall(),
                    voucherManager,
                ),
            );
            // Check config.
            expect(await voucherHub.getIexecPoco()).to.equal(iexecPoco);
            expect(await voucherHub.getVoucherBeacon()).to.equal(voucherBeaconAddress);
            // Check VoucherProxy code hash
            const voucherHubAddress = await voucherHub.getAddress();
            const actualCodeHash =
                await voucherHubUtils.getVoucherProxyCreationCodeHashFromStorage(voucherHubAddress);
            const expectedHashes =
                await voucherHubUtils.getVoucherProxyCreationCodeHash(voucherBeaconAddress);
            expect(expectedHashes).to.include(actualCodeHash);
        });

        it('Should not initialize twice', async () => {
            const { beacon, voucherHub, upgradeManager, assetEligibilityManager, voucherManager } =
                await loadFixture(deployFixture);

            await expect(
                voucherHub.initialize(
                    upgradeManager,
                    assetEligibilityManager,
                    voucherManager,
                    iexecPoco,
                    await beacon.getAddress(),
                ),
            ).to.be.revertedWithCustomError(voucherHub, 'InvalidInitialization');
        });
    });

    describe('Upgrade', function () {
        it('Should upgrade', async () => {
            const { voucherHub, upgradeManager } = await loadFixture(deployFixture);
            const voucherHubAddress = await voucherHub.getAddress();
            const VoucherHubV2Factory = await ethers.getContractFactory(
                'VoucherHubV2Mock',
                upgradeManager,
            );
            // Next line should throw if new storage schema is not compatible with previous one
            await voucherHubUtils.upgradeProxy(voucherHubAddress, VoucherHubV2Factory);
            const voucherHubV2 = await ethers.getContractAt('VoucherHubV2Mock', voucherHubAddress);
            await voucherHubV2.initializeV2('bar');

            expect(await voucherHubV2.getAddress()).to.equal(voucherHubAddress);
            expect(await voucherHubV2.getIexecPoco()).to.equal(iexecPoco); // V1
            expect(await voucherHubV2.foo()).to.equal('bar'); // V2
        });

        it('Should not upgrade when account is unauthorized', async () => {
            const { voucherHub, anyone } = await loadFixture(deployFixture);

            await expect(
                voucherHub
                    .connect(anyone)
                    .upgradeToAndCall(ethers.Wallet.createRandom().address, '0x'),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Create voucher type', function () {
        it('Should create a voucher type when the caller is authorized', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
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
                voucherHub.connect(anyone).createVoucherType(description, duration),
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
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            const updateDescriptionTx = await voucherHub
                .connect(assetEligibilityManager)
                .updateVoucherTypeDescription(0, newDescription);
            await updateDescriptionTx.wait();
            expect(updateDescriptionTx)
                .to.emit(voucherHub, 'VoucherTypeDescriptionUpdated')
                .withArgs(0, newDescription);
        });

        it('Should not update voucher description when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            await expect(
                voucherHub.connect(anyone).updateVoucherTypeDescription(0, newDescription),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not update description when the voucher type ID is out of bounds', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            await expect(
                voucherHub
                    .connect(assetEligibilityManager)
                    .updateVoucherTypeDescription(999, newDescription),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Update voucher type duration', function () {
        const newDuration = 7200;
        it('Should update voucher duration', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            const updateDurationTx = await voucherHub
                .connect(assetEligibilityManager)
                .updateVoucherTypeDuration(0, newDuration);
            await updateDurationTx.wait();
            expect(updateDurationTx)
                .to.emit(voucherHub, 'VoucherTypeDurationUpdated')
                .withArgs(0, newDuration);
        });

        it('Should not update voucher duration when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await expect(
                voucherHub.connect(anyone).updateVoucherTypeDuration(0, newDuration),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not update duration when the voucher type ID is out of bounds', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await expect(
                voucherHub
                    .connect(assetEligibilityManager)
                    .updateVoucherTypeDuration(999, newDuration),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Asset Eligibility', function () {
        it('Should set and unset asset eligibility', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx = await voucherHub
                .connect(assetEligibilityManager)
                .addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(addEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetAdded');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            const removeEligibleAssetTx = await voucherHub
                .connect(assetEligibilityManager)
                .removeEligibleAsset(typeId, asset);
            await removeEligibleAssetTx.wait();
            expect(removeEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetRemoved');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .false;
        });

        it('Should not set asset eligibility when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            await expect(
                voucherHub.connect(anyone).addEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not unset asset eligibility when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx = await voucherHub
                .connect(assetEligibilityManager)
                .addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            await expect(
                voucherHub.connect(anyone).removeEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Create voucher', async function () {
        it('Should create and initialize voucher', async () => {
            const { beacon, voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            // Create voucher.
            const createVoucherTx = await voucherHub
                .connect(voucherManager)
                .createVoucher(voucherOwner1, voucherType);
            const txReceipt = await createVoucherTx.wait();

            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            const voucherAsProxy = await commonUtils.getVoucherAsProxy(voucherAddress);
            const expectedExpiration = await commonUtils.getExpectedExpiration(duration, txReceipt);
            // Run assertions.
            // Events.
            await expect(createVoucherTx)
                .to.emit(voucherAsProxy, 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucher, 'OwnershipTransferred')
                .withArgs(ethers.ZeroAddress, voucherOwner1.address)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress, voucherOwner1.address, expectedExpiration, voucherType);
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

        it('Should create different vouchers for different accounts with the same config', async () => {
            // Vouchers are created with the same configuration (type, expiration, ...).
            // The goal is to make sure that configuration is not included in the constructor
            // args which would result in different create2 salts.
            const {
                voucherHub,
                assetEligibilityManager,
                voucherManager,
                voucherOwner1,
                voucherOwner2,
            } = await loadFixture(deployFixture);
            // Create type0.
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            // Create voucher1.
            await expect(
                voucherHub.connect(voucherManager).createVoucher(voucherOwner1, voucherType),
            ).to.emit(voucherHub, 'VoucherCreated');
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1: Voucher = await commonUtils.getVoucher(voucherAddress1);
            // Create voucher2.
            await expect(
                voucherHub.connect(voucherManager).createVoucher(voucherOwner2, voucherType),
            ).to.emit(voucherHub, 'VoucherCreated');
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2: Voucher = await commonUtils.getVoucher(voucherAddress2);

            expect(voucherAddress1).is.not.equal(voucherAddress2);
            expect(await voucher1.owner()).to.not.equal(await voucher2.owner());
            expect(await voucher1.getType()).to.equal(await voucher2.getType());
            expect(await voucher1.getVoucherHub()).to.equal(await voucher2.getVoucherHub());
        });

        it('Should create multiple vouchers with the correct config', async () => {
            const {
                voucherHub,
                assetEligibilityManager,
                voucherManager,
                voucherOwner1,
                voucherOwner2,
            } = await loadFixture(deployFixture);
            // Create type0.
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            const voucherType1 = 1;
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            // Create type1.
            const createType1Tx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description1, duration1);
            await createType1Tx.wait();
            // Create voucher1.
            const createVoucherTx1 = await voucherHub
                .connect(voucherManager)
                .createVoucher(voucherOwner1, voucherType);
            const createVoucherReceipt1 = await createVoucherTx1.wait();
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherReceipt1,
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1 = await commonUtils.getVoucher(voucherAddress1);
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);

            // Create voucher2.
            const createVoucherTx2 = await voucherHub
                .connect(voucherManager)
                .createVoucher(voucherOwner2, voucherType1);
            const createVoucherReceipt2 = await createVoucherTx2.wait();
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                duration1,
                createVoucherReceipt2,
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2 = await commonUtils.getVoucher(voucherAddress2);
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);

            // Events
            expect(createVoucherReceipt1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress1,
                    voucherOwner1.address,
                    expectedExpirationVoucher1,
                    voucherType,
                );
            expect(createVoucherReceipt2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress2,
                    voucherOwner2.address,
                    expectedExpirationVoucher2,
                    voucherType1,
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
        });

        it('Should not create more than 1 voucher for the same account', async () => {
            const { voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            // Create voucher.
            await expect(
                voucherHub.connect(voucherManager).createVoucher(voucherOwner1, voucherType),
            ).to.emit(voucherHub, 'VoucherCreated');
            // Second creation should fail.
            await expect(
                voucherHub.connect(voucherManager).createVoucher(voucherOwner1, voucherType),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create more than 1 voucher for the same account with different config', async () => {
            const { voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            // Create voucher.
            await expect(
                voucherHub.connect(voucherManager).createVoucher(voucherOwner1, voucherType),
            ).to.emit(voucherHub, 'VoucherCreated');
            // Second creation should fail.
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherType1 = 1;
            const createType1Tx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description1, duration1);
            await createType1Tx.wait();
            await expect(
                voucherHub.connect(voucherManager).createVoucher(voucherOwner1, voucherType1),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create voucher when initialization fails', async () => {
            // TODO
        });

        it('Should not initialize voucher more than once', async () => {
            const { voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            const createTypeTx = await voucherHub
                .connect(assetEligibilityManager)
                .createVoucherType(description, duration);
            await createTypeTx.wait();
            // Create voucher.
            const createVoucherTx = await voucherHub
                .connect(voucherManager)
                .createVoucher(voucherOwner1, voucherType);
            const createVoucherReceipt = await createVoucherTx.wait();
            const expectedExpiration = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherReceipt,
            );
            await expect(createVoucherReceipt).to.emit(voucherHub, 'VoucherCreated');
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

        it('Should not create voucher when not authorized', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            // Create voucher.
            await expect(
                voucherHub.connect(anyone).createVoucher(voucherOwner1, voucherType),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not create voucher when voucher type ID is out of bounds', async () => {
            const { voucherHub, voucherManager, voucherOwner1 } = await loadFixture(deployFixture);
            const outOfBoundsTypeID = 999;
            // Create voucher.
            await expect(
                voucherHub.connect(voucherManager).createVoucher(voucherOwner1, outOfBoundsTypeID),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Get voucher', function () {
        it('Should return address 0 when voucher is not created', async function () {
            const { voucherHub, owner } = await loadFixture(deployFixture);
            await expect(await voucherHub.getVoucher(owner)).to.be.equal(ethers.ZeroAddress);
        });
    });
});

async function getVoucherTypeCreatedId(voucherHub: VoucherHub) {
    const events = await voucherHub.queryFilter(voucherHub.filters.VoucherTypeCreated, -1);
    const typeId = Number(events[0].args[0]);
    return typeId;
}
