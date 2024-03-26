// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon, VoucherImpl, VoucherProxy } from '../typechain-types';
import { VoucherHub } from '../typechain-types/contracts';
import { VoucherHubV2Mock } from '../typechain-types/contracts/mocks';

const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random
const expiration = 88888888888888; // random (September 5, 2251)
const voucherType = 1;
const voucherCredit = 50;
const description = 'Early Access';
const duration = 3600;
const asset = ethers.Wallet.createRandom().address;

describe('VoucherHub', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, voucherOwner1, voucherOwner2, anyone] = await ethers.getSigners();
        const beacon = await deployBeaconAndInitialImplementation(owner.address);
        const voucherHub = await deployVoucherHub(await beacon.getAddress());
        return { beacon, voucherHub, owner, voucherOwner1, voucherOwner2, anyone };
    }

    describe('Initialize', function () {
        it('Should initialize', async () => {
            const { beacon, voucherHub, owner } = await loadFixture(deployFixture);

            expect(await voucherHub.owner()).to.equal(owner);
            expect(await voucherHub.getIexecPoco()).to.equal(iexecPoco);
            expect(await voucherHub.getVoucherBeacon()).to.equal(await beacon.getAddress());
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
            const voucherHubV2Contract: unknown = await upgrades.upgradeProxy(
                voucherHubAddress,
                VoucherHubV2Factory,
            );
            const voucherHubV2 = voucherHubV2Contract as VoucherHubV2Mock;
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
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
            await createTypeTx.wait();
            const type1 = await voucherHub.getVoucherType(0);
            const count = await voucherHub.getVoucherTypeCount();
            // Run assertions.
            expect(createTypeTx)
                .to.emit(voucherHub, 'VoucherTypeCreated')
                .withArgs(0, description, duration);
            expect(type1.description).to.equal(description);
            expect(type1.duration).to.equal(duration);
            expect(count).to.equal(1);
        });

        it('Should not create a voucher type when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(
                voucherHub.connect(anyone).createVoucherType(description, duration),
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
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
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
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
            await createTypeTx.wait();
            await expect(
                voucherHub.connect(anyone).updateVoucherTypeDescription(0, newDescription),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not change description when the voucher type ID is out of bounds', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
            await createTypeTx.wait();
            await expect(
                voucherHub.updateVoucherTypeDescription(999, newDescription),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Update Voucher Type Duration', function () {
        const newDuration = 7200;
        it('Should modify voucher duration', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
            await createTypeTx.wait();
            const updateDurationTx = await voucherHub.updateVoucherTypeDuration(0, newDuration);
            await updateDurationTx.wait();
            expect(updateDurationTx)
                .to.emit(voucherHub, 'VoucherTypeDurationUpdated')
                .withArgs(0, newDuration);
        });

        it('Should not modify voucher duration when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.connect(anyone).updateVoucherTypeDuration(0, newDuration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not change duration when the voucher type ID is out of bounds', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(voucherHub.updateVoucherTypeDuration(999, newDuration)).to.be.revertedWith(
                'VoucherHub: type index out of bounds',
            );
        });
    });

    describe('Asset Eligibility', function () {
        it('Should set and unset asset eligibility', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
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
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
            await createTypeTx.wait();
            await expect(
                voucherHub.connect(anyone).addEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not unset asset eligibility when the caller is not the owner', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            const createTypeTx = await voucherHub.createVoucherType(description, duration);
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
        it('Should create voucher', async () => {
            const { beacon, voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            // Create voucher.
            const createVoucherTx = await voucherHub.createVoucher(
                voucherOwner1,
                voucherType,
                voucherCredit,
                expiration,
            );
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: VoucherImpl = await getVoucher(voucherAddress);
            const voucherAsProxy: VoucherProxy = await getVoucherAsProxy(voucherAddress);
            // Run assertions.
            // Events.
            await expect(createVoucherTx)
                .to.emit(voucherAsProxy, 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucher, 'OwnershipTransferred')
                .withArgs(ethers.ZeroAddress, voucherOwner1.address)
                .to.emit(voucher, 'ExpirationUpdated')
                .withArgs(expiration)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress, voucherOwner1.address, expiration);
            // Voucher as proxy
            expect(await voucherAsProxy.implementation(), 'Implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            // Voucher
            expect(await voucher.owner(), 'Owner mismatch').to.equal(voucherOwner1);
            expect(await voucher.getExpiration(), 'Expiration mismatch').to.equal(expiration);
        });

        it('Should create voucher and initialize only once', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            // Create voucher.
            await expect(
                voucherHub.createVoucher(voucherOwner1, voucherType, voucherCredit, expiration),
            ).to.emit(voucherHub, 'VoucherCreated');
            // Second initialization should fail.
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: VoucherImpl = await getVoucher(voucherAddress);
            await expect(
                voucher.initialize(voucherOwner1, voucherType, voucherCredit, expiration),
            ).to.be.revertedWithCustomError(voucher, 'InvalidInitialization');
        });

        it('Should create multiple vouchers with the correct config', async () => {
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            const expiration1 = expiration;
            const expiration2 = 99999999999999; // random (November 16, 5138)
            const voucherType2 = 2;
            const voucherCredit2 = 100;
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(
                voucherOwner1,
                voucherType,
                voucherCredit,
                expiration,
            );
            await createVoucherTx1.wait();
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1 = await getVoucher(voucherAddress1);
            const voucherAsProxy1 = await getVoucherAsProxy(voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(
                voucherOwner2,
                voucherType2,
                voucherCredit2,
                expiration2,
            );
            await createVoucherTx2.wait();
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
            expect(
                await voucher1.getExpiration(),
                'Expiration should not match between proxies',
            ).to.not.equal(await voucher2.getExpiration());
            expect(await voucher1.owner(), 'Owners should not match between proxies').to.not.equal(
                voucher2.owner(),
            );
        });

        it('Should not create voucher when not owner', async () => {
            const { beacon, voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            // Create voucher.
            await expect(
                voucherHub
                    .connect(anyone)
                    .createVoucher(voucherOwner1, voucherType, voucherCredit, expiration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });
});

async function deployVoucherHub(beacon: string): Promise<VoucherHub> {
    const VoucherHubFactory = await ethers.getContractFactory('VoucherHub');
    // @dev Type declaration produces a warning until feature is supported by
    // openzeppelin plugin. See "Support TypeChain in deployProxy function":
    // https://github.com/OpenZeppelin/openzeppelin-upgrades/pull/535
    const voucherHubContract = (await upgrades.deployProxy(VoucherHubFactory, [
        iexecPoco,
        beacon,
    ])) as unknown; // Workaround openzeppelin-upgrades/pull/535;
    const voucherHub = voucherHubContract as VoucherHub;
    return await voucherHub.waitForDeployment();
}

async function deployBeaconAndInitialImplementation(
    beaconOwner: string,
): Promise<UpgradeableBeacon> {
    const voucherImplFactory = await ethers.getContractFactory('VoucherImpl');
    // upgrades.deployBeacon() does the following:
    // 1. Deploys the implementation contract.
    // 2. Deploys an instance of oz/UpgradeableBeacon contract.
    // 3. Links the implementation in the beacon contract.
    const beaconContract = (await upgrades.deployBeacon(voucherImplFactory, {
        initialOwner: beaconOwner,
    })) as unknown; // Workaround openzeppelin-upgrades/pull/535;
    const beacon = beaconContract as UpgradeableBeacon;
    await beacon.waitForDeployment();
    return beacon;
}

async function getVoucherTypeCreatedId(voucherHub: VoucherHub) {
    const events = await voucherHub.queryFilter(voucherHub.filters.VoucherTypeCreated, -1);
    const typeId = Number(events[0].args[0]);
    return typeId;
}

async function getVoucher(voucherAddress: string): Promise<VoucherImpl> {
    return await ethers.getContractAt('VoucherImpl', voucherAddress);
}

async function getVoucherAsProxy(voucherAddress: string): Promise<VoucherProxy> {
    return await ethers.getContractAt('VoucherProxy', voucherAddress);
}
