// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon, VoucherHub, VoucherImpl, VoucherProxy } from '../typechain-types';

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
        const beacon = await deployBeaconAndImplementation(owner.address);
        const voucherHub = await deployVoucherHub(await beacon.getAddress());
        return { beacon, voucherHub, owner, voucherOwner1, voucherOwner2, unprivilegedAccount };
    }

    describe('Create voucher', async function () {
        it('Should create voucher', async () => {
            const { beacon, voucherHub, owner, voucherOwner1 } = await loadFixture(deployFixture);
            // Create voucher.
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, expiration);
            createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucherProxy: VoucherProxy = await ethers.getContractAt(
                'VoucherProxy',
                voucherAddress,
            );
            const voucherImpl: VoucherImpl = await ethers.getContractAt(
                'VoucherImpl',
                voucherAddress,
            );
            // Run assertions.
            expect(createVoucherTx)
                .to.emit(voucherHub, 'OwnershipTransferred')
                .withArgs(voucherOwner1.address)
                .to.emit(voucherHub, 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucherHub, 'ExpirationUpdated')
                .withArgs(expiration)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress, voucherOwner1.address);
            expect(await voucherProxy.implementation(), 'Implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            expect(await voucherImpl.getExpiration(), 'Expiration mismatch').to.equal(expiration);
            expect(await voucherProxy.owner(), 'Owner mismatch').to.equal(voucherOwner1);
        });

        it('Should create multiple vouchers with the correct config', async () => {
            const { beacon, voucherHub, owner, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            const expiration1 = expiration;
            const expiration2 = 99999999999999; // random (November 16, 5138)
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, expiration1);
            createVoucherTx1.wait();
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucherProxy1: VoucherProxy = await ethers.getContractAt(
                'VoucherProxy',
                voucherAddress1,
            );
            const voucherImpl1: VoucherImpl = await ethers.getContractAt(
                'VoucherImpl',
                voucherAddress1,
            );
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, expiration2);
            createVoucherTx2.wait();
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucherProxy2: VoucherProxy = await ethers.getContractAt(
                'VoucherProxy',
                voucherAddress2,
            );
            const voucherImpl2: VoucherImpl = await ethers.getContractAt(
                'VoucherImpl',
                voucherAddress2,
            );

            // Check common config state.
            expect(createVoucherTx1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress1, voucherOwner1.address);
            expect(createVoucherTx2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress2, voucherOwner2.address);
            expect(
                await voucherProxy1.implementation(),
                'Implementation mismatch between proxies',
            ).to.equal(await voucherProxy2.implementation());
            // Check different config state.
            expect(
                await voucherProxy1.owner(),
                'Owners should not match between proxies',
            ).to.not.equal(await voucherProxy2.owner());
            expect(
                await voucherImpl1.getExpiration(),
                'Expiration should not match between proxies',
            ).to.not.equal(await voucherImpl2.getExpiration());
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
            createVoucherTx1.wait();
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucherProxy1: VoucherProxy = await ethers.getContractAt(
                'VoucherProxy',
                voucherAddress1,
            );
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, expiration2);
            createVoucherTx2.wait();
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucherProxy2: VoucherProxy = await ethers.getContractAt(
                'VoucherProxy',
                voucherAddress2,
            );
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
            expect(await voucherProxy1.implementation(), 'New implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            expect(
                await voucherProxy1.implementation(),
                'New implementation mismatch between proxies',
            ).to.equal(await voucherProxy2.implementation());
            // Make sure the state did not change
            const voucher1ImplV2: VoucherImpl = await ethers.getContractAt(
                'VoucherImpl',
                voucherAddress1,
            );
            const voucher2ImplV2: VoucherImpl = await ethers.getContractAt(
                'VoucherImpl',
                voucherAddress2,
            );
            expect(await voucherProxy1.owner(), 'New implementation owner mismatch').to.equal(
                voucherOwner1,
            );
            expect(await voucherProxy2.owner(), 'New implementation owner mismatch').to.equal(
                voucherOwner2,
            );
            expect(
                await voucher1ImplV2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.equal(expiration1);
            expect(
                await voucher2ImplV2.getExpiration(),
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

async function deployBeaconAndImplementation(beaconOwner: string): Promise<UpgradeableBeacon> {
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
