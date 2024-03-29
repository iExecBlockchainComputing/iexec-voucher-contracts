// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ContractTransactionReceipt } from 'ethers';
import { ethers } from 'hardhat';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { Voucher, VoucherProxy } from '../typechain-types';
import { VoucherHub } from '../typechain-types/contracts';

const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random
const voucherType0 = 0;
const description0 = 'Early Access';
const duration0 = 3600;
const asset = ethers.Wallet.createRandom().address;

describe('VoucherHub', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, voucherOwner1, voucherOwner2, anyone] = await ethers.getSigners();
        const beacon = await voucherUtils.deployBeaconAndImplementation(owner.address);
        const voucherHub = await voucherHubUtils.deployHub(iexecPoco, await beacon.getAddress());
        return { beacon, voucherHub, owner, voucherOwner1, voucherOwner2, anyone };
    }

    describe('Initialize', function () {
        it('Should initialize', async () => {
            const { beacon, voucherHub, owner } = await loadFixture(deployFixture);
            const voucherBeaconAddress = await beacon.getAddress();
            expect(await voucherHub.owner()).to.equal(owner);
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
            const { beacon, voucherHub } = await loadFixture(deployFixture);

            await expect(
                voucherHub.initialize(iexecPoco, await beacon.getAddress()),
            ).to.be.revertedWithCustomError(voucherHub, 'InvalidInitialization');
        });
    });

    describe('Upgrade', function () {
        it('Should upgrade', async () => {
            const { voucherHub } = await loadFixture(deployFixture);
            const voucherHubAddress = await voucherHub.getAddress();
            const VoucherHubV2Factory = await ethers.getContractFactory('VoucherHubV2Mock');
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
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });

    describe('Create voucher type', function () {
        it('Should create a voucher type when the caller is the owner', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            const type1 = await voucherHub.getVoucherType(0);
            const count = await voucherHub.getVoucherTypeCount();
            // Run assertions.
            expect(createTypeTx)
                .to.emit(voucherHub, 'VoucherTypeCreated')
                .withArgs(0, description0, duration0);
            expect(type1.description).to.equal(description0);
            expect(type1.duration).to.equal(duration0);
            expect(count).to.equal(1);
        });

        it('Should not create a voucher type when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(
                voucherHub.connect(anyone).createVoucherType(description0, duration0),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
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

    describe('Update Voucher Type Description', function () {
        const newDescription = 'Long Term Duration';
        it('Should modify voucher description', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            const updateDescriptionTx = await voucherHub.updateVoucherTypeDescription(
                0,
                newDescription,
            );
            await updateDescriptionTx.wait();
            expect(updateDescriptionTx)
                .to.emit(voucherHub, 'VoucherTypeDescriptionUpdated')
                .withArgs(0, newDescription);
        });

        it('Should not modify voucher description when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            await expect(
                voucherHub.connect(anyone).updateVoucherTypeDescription(0, newDescription),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not change description when the voucher type ID is out of bounds', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            await expect(
                voucherHub.updateVoucherTypeDescription(999, newDescription),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Update Voucher Type Duration', function () {
        const newDuration = 7200;
        it('Should modify voucher duration0', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            const updateDurationTx = await voucherHub.updateVoucherTypeDuration(0, newDuration);
            await updateDurationTx.wait();
            expect(updateDurationTx)
                .to.emit(voucherHub, 'VoucherTypeDurationUpdated')
                .withArgs(0, newDuration);
        });

        it('Should not modify voucher duration0 when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description0, duration0);
            await expect(
                voucherHub.connect(anyone).updateVoucherTypeDuration(0, newDuration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not change duration0 when the voucher type ID is out of bounds', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description0, duration0);
            await expect(voucherHub.updateVoucherTypeDuration(999, newDuration)).to.be.revertedWith(
                'VoucherHub: type index out of bounds',
            );
        });
    });

    describe('Asset Eligibility', function () {
        it('Should set and unset asset eligibility', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx = await voucherHub.addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(addEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetAdded');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            const removeEligibleAssetTx = await voucherHub.removeEligibleAsset(typeId, asset);
            await removeEligibleAssetTx.wait();
            expect(removeEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetRemoved');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .false;
        });

        it('Should not set asset eligibility when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            await expect(
                voucherHub.connect(anyone).addEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not unset asset eligibility when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx = await voucherHub.addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            await expect(
                voucherHub.connect(anyone).removeEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });

    describe('Create voucher', async function () {
        it('Should create and initialize voucher', async () => {
            const { beacon, voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            // Create voucher.
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            const txReceipt = await createVoucherTx.wait();

            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await getVoucher(voucherAddress);
            const voucherAsProxy = await getVoucherAsProxy(voucherAddress);
            const expectedExpiration = await getExpectedExpiration(duration0, txReceipt);
            // Run assertions.
            // Events.
            await expect(createVoucherTx)
                .to.emit(voucherAsProxy, 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucher, 'OwnershipTransferred')
                .withArgs(ethers.ZeroAddress, voucherOwner1.address)
                .to.emit(voucher, 'AuthorizationSet')
                .withArgs(voucherOwner1.address)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress, voucherOwner1.address, expectedExpiration);
            // Voucher as proxy
            expect(await voucherAsProxy.implementation(), 'Implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            // Voucher
            expect(await voucher.owner(), 'Owner mismatch').to.equal(voucherOwner1);
            expect(await voucher.getExpiration(), 'Expiration mismatch').to.equal(
                expectedExpiration,
            );
        });

        it('Should create different vouchers for different accounts with the same config', async () => {
            // Vouchers are created with the same configuration (type, expiration, ...).
            // The goal is to make sure that configuration is not included in the constructor
            // args which would result in different create2 salts.
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();

            // Create voucher1.
            await expect(voucherHub.createVoucher(voucherOwner1, voucherType0)).to.emit(
                voucherHub,
                'VoucherCreated',
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1: Voucher = await getVoucher(voucherAddress1);
            // Create voucher2.
            await expect(voucherHub.createVoucher(voucherOwner2, voucherType0)).to.emit(
                voucherHub,
                'VoucherCreated',
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2: Voucher = await getVoucher(voucherAddress2);

            expect(voucherAddress1).is.not.equal(voucherAddress2);
            expect(await voucher1.owner()).to.not.equal(await voucher2.owner());
            expect(await voucher1.getType()).to.equal(await voucher2.getType());
            expect(await voucher1.getHub()).to.equal(await voucher2.getHub());
        });

        it('Should create multiple vouchers with the correct config', async () => {
            // Vouchers are created with different configurations
            // (type1, type2, expiration1, expiration2, ...).
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherType1 = 1;

            const createType1Tx = await voucherHub.createVoucherType(description0, duration0);
            await createType1Tx.wait();
            const createType2Tx = await voucherHub.createVoucherType(description1, duration1);
            await createType2Tx.wait();

            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            const tx1Receipt = await createVoucherTx1.wait();
            const expiration1 = await getExpectedExpiration(duration0, tx1Receipt);
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1 = await getVoucher(voucherAddress1);
            const voucherAsProxy1 = await getVoucherAsProxy(voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, voucherType1);
            await createVoucherTx2.wait();
            const tx2Receipt = await createVoucherTx2.wait();
            const expiration2 = await getExpectedExpiration(duration1, tx2Receipt);
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2 = await getVoucher(voucherAddress2);
            const voucherAsProxy2 = await getVoucherAsProxy(voucherAddress2);

            // Events
            await expect(createVoucherTx1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress1, voucherOwner1.address, expiration1);
            await expect(createVoucherTx2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress2, voucherOwner2.address, expiration2);
            // Voucher as proxy
            expect(
                await voucherAsProxy1.implementation(),
                'Implementation mismatch between proxies',
            ).to.equal(await voucherAsProxy2.implementation());
            // Voucher
            expect(voucherAddress1).is.not.equal(voucherAddress2);
            expect(
                await voucher1.getExpiration(),
                'Expiration should not match between proxies',
            ).to.not.equal(await voucher2.getExpiration());
            expect(await voucher1.owner(), 'Owners should not match between proxies').to.not.equal(
                voucher2.owner(),
            );
        });

        it('Should not create more than 1 voucher for the same account', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            // Create voucher.
            await expect(voucherHub.createVoucher(voucherOwner1, voucherType0)).to.emit(
                voucherHub,
                'VoucherCreated',
            );
            // Second creation should fail.
            await expect(
                voucherHub.createVoucher(voucherOwner1, voucherType0),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create more than 1 voucher for the same account with different config', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const createType0Tx = await voucherHub.createVoucherType(description0, duration0);
            await createType0Tx.wait();
            // Create voucher.
            await expect(voucherHub.createVoucher(voucherOwner1, voucherType0)).to.emit(
                voucherHub,
                'VoucherCreated',
            );
            // Second creation should fail.
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherType1 = 1;
            const createType1Tx = await voucherHub.createVoucherType(description1, duration1);
            await createType1Tx.wait();
            await expect(
                voucherHub.createVoucher(voucherOwner1, voucherType1),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create voucher when initialization fails', async () => {
            // TODO
        });

        it('Should not initialize voucher more than once', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description0, duration0);
            await createTypeTx.wait();
            // Create voucher.
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            const createVoucherReceipt = await createVoucherTx.wait();
            const expectedExpiration = await getExpectedExpiration(duration0, createVoucherReceipt);
            await expect(createVoucherReceipt).to.emit(voucherHub, 'VoucherCreated');
            // Second initialization should fail.
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await getVoucher(voucherAddress);
            await expect(
                voucher.initialize(
                    voucherOwner1,
                    voucherType0,
                    expectedExpiration,
                    await voucherHub.getAddress(),
                ),
            ).to.be.revertedWithCustomError(voucher, 'InvalidInitialization');
        });

        it('Should not create voucher when not owner', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            // Create voucher.
            await expect(
                voucherHub.connect(anyone).createVoucher(voucherOwner1, voucherType0),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
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

async function getVoucher(voucherAddress: string): Promise<Voucher> {
    return await ethers.getContractAt('Voucher', voucherAddress);
}

async function getVoucherAsProxy(voucherAddress: string): Promise<VoucherProxy> {
    return await ethers.getContractAt('VoucherProxy', voucherAddress);
}

async function getExpectedExpiration(
    voucherDuration: number,
    txReceipt: ContractTransactionReceipt | null,
): Promise<number> {
    if (txReceipt != null) {
        const block = await ethers.provider.getBlock(txReceipt.blockNumber);
        if (block) {
            return block.timestamp + voucherDuration;
        } else {
            return 0;
        }
    } else {
        return 0;
    }
}
