// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import {
    IVoucher,
    UpgradeableBeacon,
    VoucherHub,
    VoucherImpl,
    VoucherProxy,
} from '../typechain-types';

const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random // TODO remove
const expiration = 88888888888888; // random (September 5, 2251)

// TODO move tests to VoucherHub.test.ts (this is just to avoid git conflict).
describe('VoucherHubBis', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, voucherOwner1, voucherOwner2, unprivilegedAccount] =
            await ethers.getSigners();
        const beacon = await deployBeaconAndInitialImplementation(owner.address);
        const voucherHub = await deployVoucherHub(await beacon.getAddress());
        return { beacon, voucherHub, owner, voucherOwner1, voucherOwner2, unprivilegedAccount };
    }

    describe('Create voucher', async function () {
        it('Should create voucher', async () => {
            const { beacon, voucherHub, owner, voucherOwner1 } = await loadFixture(deployFixture);
            // Create voucher.
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, expiration);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: IVoucher = await ethers.getContractAt('IVoucher', voucherAddress);
            // Run assertions.
            // Events.
            await expect(createVoucherTx)
                .to.emit(await voucherImplAbi(voucherAddress), 'OwnershipTransferred')
                .withArgs(ethers.ZeroAddress, voucherOwner1.address)
                .to.emit(await voucherProxyAbi(voucherAddress), 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucher, 'ExpirationUpdated')
                .withArgs(expiration)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress, voucherOwner1.address, expiration);
            // Implementation.
            expect(
                await getVoucherImplementation(voucherAddress),
                'Implementation mismatch',
            ).to.equal(await beacon.implementation());
            // State.
            expect(await voucher.getExpiration(), 'Expiration mismatch').to.equal(expiration);
            expect(await getVoucherOwner(voucherAddress), 'Owner mismatch').to.equal(voucherOwner1);
        });

        it('Should create multiple vouchers with the correct config', async () => {
            const { voucherHub, owner, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            const expiration1 = expiration;
            const expiration2 = 99999999999999; // random (November 16, 5138)
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, expiration1);
            await createVoucherTx1.wait();
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1: IVoucher = await ethers.getContractAt('IVoucher', voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, expiration2);
            await createVoucherTx2.wait();
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2: IVoucher = await ethers.getContractAt('IVoucher', voucherAddress2);

            // Events
            await expect(createVoucherTx1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress1, voucherOwner1.address, expiration1);
            await expect(createVoucherTx2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress2, voucherOwner2.address, expiration2);
            // Implementation
            expect(
                await getVoucherImplementation(voucherAddress1),
                'Implementation mismatch between proxies',
            ).to.equal(await getVoucherImplementation(voucherAddress2));
            // State
            expect(
                await voucher1.getExpiration(),
                'Expiration should not match between proxies',
            ).to.not.equal(await voucher2.getExpiration());
            // Owner
            expect(
                await getVoucherOwner(voucherAddress1),
                'Owners should not match between proxies',
            ).to.not.equal(await getVoucherOwner(voucherAddress2));
        });

        it('Should not create voucher when not owner', async () => {
            const { beacon, voucherHub, owner, unprivilegedAccount } =
                await loadFixture(deployFixture);
            // Create voucher.
            expect(
                await voucherHub.createVoucher(unprivilegedAccount, expiration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });

    describe('Upgrade voucher', async function () {
        it('Should upgrade all vouchers', async () => {
            const { beacon, voucherHub, owner, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            const expiration1 = expiration;
            const expiration2 = 99999999999999; // random (November 16, 5138)
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, expiration1);
            await createVoucherTx1.wait();
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, expiration2);
            await createVoucherTx2.wait();
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
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

            // Make sure the implementation has changed.
            expect(await beacon.implementation(), 'Implementation did not change').to.not.equal(
                initialImplementation,
            );
            expect(
                await getVoucherImplementation(voucherAddress1),
                'New implementation mismatch',
            ).to.equal(await beacon.implementation());
            expect(
                await getVoucherImplementation(voucherAddress1),
                'New implementation mismatch between proxies',
            ).to.equal(await getVoucherImplementation(voucherAddress2));
            // Make sure the state did not change
            const voucher1_V2: IVoucher = await ethers.getContractAt('IVoucher', voucherAddress1);
            const voucher2_V2: IVoucher = await ethers.getContractAt('IVoucher', voucherAddress2);
            expect(
                await getVoucherOwner(voucherAddress1),
                'New implementation owner mismatch',
            ).to.equal(voucherOwner1);
            expect(
                await getVoucherOwner(voucherAddress2),
                'New implementation owner mismatch',
            ).to.equal(voucherOwner2);
            expect(
                await voucher1_V2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.equal(expiration1);
            expect(
                await voucher2_V2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.equal(expiration2);
        });

        it('Should not upgrade voucher when unauthorized', async () => {
            const { beacon, voucherHub, owner, unprivilegedAccount } =
                await loadFixture(deployFixture);
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
});

async function deployVoucherHub(beacon: string): Promise<VoucherHub> {
    const VoucherHubFactory = await ethers.getContractFactory('VoucherHub');
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

async function getVoucherImplementation(voucherAddress: string) {
    const voucherProxy: VoucherProxy = await ethers.getContractAt('VoucherProxy', voucherAddress);
    return await voucherProxy.implementation();
}

async function getVoucherOwner(voucherAddress: string) {
    // IVoucher does not have owner() function.
    const ownable = await ethers.getContractAt('OwnableUpgradeable', voucherAddress);
    return await ownable.owner();
}

async function voucherImplAbi(voucherAddress: string): Promise<VoucherImpl> {
    return await ethers.getContractAt('VoucherImpl', voucherAddress);
}

async function voucherProxyAbi(voucherAddress: string): Promise<VoucherProxy> {
    return await ethers.getContractAt('VoucherProxy', voucherAddress);
}
