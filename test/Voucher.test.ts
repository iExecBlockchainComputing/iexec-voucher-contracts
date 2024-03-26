// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon, VoucherImpl, VoucherProxy } from '../typechain-types';
import { VoucherHub } from '../typechain-types/contracts';
import { VoucherImplV2Mock } from '../typechain-types/contracts/mocks';

const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random
const expiration = 88888888888888; // random (September 5, 2251)
const voucherType = 1;
const voucherCredit = 50;
// const description = 'Early Access';
// const duration = 3600;
// const asset = ethers.Wallet.createRandom().address;

describe('Voucher', function () {
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

    describe('Upgrade', async function () {
        it('Should upgrade all vouchers', async () => {
            const { beacon, voucherHub, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            const expiration1 = expiration;
            const expiration2 = 99999999999999; // random (November 16, 5138)
            const voucherType2 = 2;
            const voucherCredit2 = 100;
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(
                voucherOwner1,
                voucherType,
                voucherCredit,
                expiration1,
            );
            await createVoucherTx1.wait();
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
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
            const voucherAsProxy2 = await getVoucherAsProxy(voucherAddress2);
            // Save old implementation.
            const initialImplementation = await beacon.implementation();
            // Upgrade beacon.
            const voucherImplV2Factory = await ethers.getContractFactory('VoucherImplV2Mock');
            // Note: upgrades.upgradeBeacon() deploys the new impl contract only if it is
            // different from the old implementation. To override the default config 'onchange'
            // use the option (redeployImplementation: 'always').
            await upgrades
                .upgradeBeacon(beacon, voucherImplV2Factory)
                .then((contract) => contract.waitForDeployment());
            const voucher1_V2 = await getVoucherV2(voucherAddress1);
            const voucher2_V2 = await getVoucherV2(voucherAddress2);
            // Initialize new implementations.
            await voucher1_V2.initialize(1);
            await voucher2_V2.initialize(2);

            // Make sure the implementation has changed.
            expect(await beacon.implementation(), 'Implementation did not change').to.not.equal(
                initialImplementation,
            );
            expect(await voucherAsProxy1.implementation(), 'New implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            expect(
                await voucherAsProxy1.implementation(),
                'New implementation mismatch between proxies',
            ).to.equal(await voucherAsProxy2.implementation());
            // Make sure the state did not change
            expect(await voucher1_V2.owner(), 'New implementation owner mismatch').to.equal(
                voucherOwner1,
            );
            expect(await voucher2_V2.owner(), 'New implementation owner mismatch').to.equal(
                voucherOwner2,
            );
            expect(
                await voucher1_V2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.equal(expiration1);
            expect(
                await voucher2_V2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.equal(expiration2);
            // Check new state variable.
            expect(await voucher1_V2.getNewStateVariable()).to.equal(1);
            expect(await voucher2_V2.getNewStateVariable()).to.equal(2);
        });

        it('Should not upgrade voucher when unauthorized', async () => {
            const { beacon } = await loadFixture(deployFixture);
            // Save implementation.
            const initialImplementation = await beacon.implementation();
            // Change beacon owner.
            await beacon.transferOwnership(ethers.Wallet.createRandom().address);
            // Try to upgrade beacon.
            expect(
                upgrades.upgradeBeacon(
                    beacon,
                    await ethers.getContractFactory('VoucherImplV2Mock'),
                ),
            ).to.revertedWithCustomError(beacon, 'OwnableUnauthorizedAccount');
            // Check implementation did not change.
            expect(await beacon.implementation(), 'Implementation has changed').to.equal(
                initialImplementation,
            );
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
            const voucherType1 = voucherType;
            const voucherCredit1 = expiration;
            const expiration2 = 99999999999999; // random (November 16, 5138)
            const voucherType2 = 2;
            const voucherCredit2 = 100;
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(
                voucherOwner1,
                voucherType1,
                voucherCredit1,
                expiration1,
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

async function getVoucher(voucherAddress: string): Promise<VoucherImpl> {
    return await ethers.getContractAt('VoucherImpl', voucherAddress);
}

async function getVoucherV2(voucherAddress: string): Promise<VoucherImplV2Mock> {
    return await ethers.getContractAt('VoucherImplV2Mock', voucherAddress);
}

async function getVoucherAsProxy(voucherAddress: string): Promise<VoucherProxy> {
    return await ethers.getContractAt('VoucherProxy', voucherAddress);
}
