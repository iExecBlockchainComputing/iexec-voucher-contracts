// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon, VoucherHub, VoucherImpl, VoucherProxy } from '../typechain-types';

const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random // TODO remove
const initialVersion = 1;

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
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, initialVersion);
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
                .to.emit(voucherHub, 'VersionUpdated')
                .withArgs(initialVersion)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress, voucherOwner1.address);
            expect(await voucherProxy.implementation(), 'Implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            expect(await voucherImpl.getVersion(), 'Version mismatch').to.equal(initialVersion);
            expect(await voucherProxy.owner(), 'Owner mismatch').to.equal(voucherOwner1);
        });

        it('Should create multiple vouchers with the same common config', async () => {
            const { beacon, voucherHub, owner, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, initialVersion);
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
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, initialVersion);
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

            // Check common config.
            expect(createVoucherTx1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress1, voucherOwner1.address);
            expect(createVoucherTx2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress2, voucherOwner2.address);
            expect(await voucherProxy1.implementation(), 'Implementation mismatch').to.equal(
                await voucherProxy2.implementation(),
            );
            expect(await voucherImpl1.getVersion(), 'Version mismatch').to.equal(
                await voucherImpl2.getVersion(),
            );
            // Check different config.
            expect(await voucherProxy1.owner(), 'Owners should not match').to.not.equal(
                await voucherProxy2.owner(),
            );
        });

        it('Should not create voucher when not owner', async () => {
            const { beacon, voucherHub, owner, unprivilegedAccount } =
                await loadFixture(deployFixture);
            // Create voucher.
            expect(
                await voucherHub.createVoucher(unprivilegedAccount, initialVersion),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
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

// TODO use voucherHub.createVoucher().
async function deployVoucherProxy(owner: string, beaconAddress: string, data: string) {
    const voucherProxy = await ethers
        .getContractFactory('VoucherProxy')
        .then(async (factory) => factory.deploy(owner, beaconAddress, data))
        .then((contract) => contract.waitForDeployment())
        .catch((error) => {
            throw error;
        });
    return voucherProxy;
}
