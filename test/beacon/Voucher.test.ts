// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import * as commonUtils from '../../scripts/common';
import * as voucherHubUtils from '../../scripts/voucherHubUtils';
import * as voucherUtils from '../../scripts/voucherUtils';
import { Voucher, VoucherProxy } from '../../typechain-types';

const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random
const voucherType0 = 0;
const duration0 = 3600;
const description0 = 'Early Access';
const voucherType1 = 1;
const duration1 = 7200;
const description1 = 'Long Term Duration';

describe('Voucher', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, voucherOwner1, voucherOwner2, anyone] = await ethers.getSigners();
        const beacon = await voucherUtils.deployBeaconAndImplementation(owner.address);
        const voucherHub = await voucherHubUtils.deployHub(iexecPoco, await beacon.getAddress());
        const createType0Tx = await voucherHub.createVoucherType(description0, duration0);
        await createType0Tx.wait();
        return { beacon, voucherHub, owner, voucherOwner1, voucherOwner2, anyone };
    }

    describe('Upgrade', async function () {
        it('Should upgrade all vouchers', async () => {
            const { beacon, voucherHub, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            const createType1Tx = await voucherHub.createVoucherType(description1, duration1);
            await createType1Tx.wait();
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            const createVoucherReceipt1 = await createVoucherTx1.wait();
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration0,
                createVoucherReceipt1,
            );

            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, voucherType1);
            const createVoucherReceipt2 = await createVoucherTx2.wait();
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                duration1,
                createVoucherReceipt2,
            );

            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);
            // Save old implementation.
            const initialImplementation = await beacon.implementation();
            // Upgrade beacon.
            const voucherImplV2Factory = await ethers.getContractFactory('VoucherV2Mock');
            // Note: upgrades.upgradeBeacon() deploys the new impl contract only if it is
            // different from the old implementation. To override the default config 'onchange'
            // use the option (redeployImplementation: 'always').
            await upgrades
                .upgradeBeacon(beacon, voucherImplV2Factory)
                .then((contract) => contract.waitForDeployment());
            const voucher1_V2 = await commonUtils.getVoucherV2(voucherAddress1);
            const voucher2_V2 = await commonUtils.getVoucherV2(voucherAddress2);
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
            ).to.equal(expectedExpirationVoucher1);
            expect(
                await voucher2_V2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.equal(expectedExpirationVoucher2);
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
                upgrades.upgradeBeacon(beacon, await ethers.getContractFactory('VoucherV2Mock')),
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
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            const createVoucherReceipt = await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            const voucherAsProxy: VoucherProxy =
                await commonUtils.getVoucherAsProxy(voucherAddress);
            const expectedExpirationVoucher = await commonUtils.getExpectedExpiration(
                duration0,
                createVoucherReceipt,
            );

            // Run assertions.
            // Events.
            expect(createVoucherReceipt)
                .to.emit(voucherAsProxy, 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucher, 'OwnershipTransferred')
                .withArgs(ethers.ZeroAddress, voucherOwner1.address)
                .to.emit(voucher, 'AuthorizationSet')
                .withArgs(voucherOwner1.address)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress, voucherOwner1.address, expectedExpirationVoucher);
            // Voucher as proxy
            expect(await voucherAsProxy.implementation(), 'Implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            // Voucher
            expect(await voucher.owner(), 'Owner mismatch').to.equal(voucherOwner1);
            expect(await voucher.getExpiration(), 'Expiration mismatch').to.equal(
                expectedExpirationVoucher,
            );
            expect(await voucher.isAccountAuthorized(voucherOwner1.address)).to.be.true;
        });

        it('Should create voucher and initialize only once', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            // Create voucher.
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            const createVoucherReceipt = await createVoucherTx.wait();

            expect(createVoucherReceipt).to.emit(voucherHub, 'VoucherCreated');
            // Second initialization should fail.
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            await expect(
                voucher.initialize(
                    voucherOwner1,
                    voucherType0,
                    await commonUtils.getExpectedExpiration(duration0, createVoucherReceipt),
                    await voucherHub.getAddress(),
                ),
            ).to.be.revertedWithCustomError(voucher, 'InvalidInitialization');
        });

        it('Should create multiple vouchers with the correct config', async () => {
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);

            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            const createVoucherReceipt1 = await createVoucherTx1.wait();
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration0,
                createVoucherReceipt1,
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1 = await commonUtils.getVoucher(voucherAddress1);
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);
            // Create type1.
            const createType1Tx = await voucherHub.createVoucherType(description1, duration1);
            await createType1Tx.wait();
            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, voucherType1);
            const createVoucherReceipt2 = await createVoucherTx2.wait();
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                duration0,
                createVoucherReceipt2,
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2 = await commonUtils.getVoucher(voucherAddress2);
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);

            // Events
            expect(createVoucherReceipt1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress1, voucherOwner1.address, expectedExpirationVoucher1);
            expect(createVoucherReceipt2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(voucherAddress2, voucherOwner2.address, expectedExpirationVoucher2);
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
            expect(await voucher1.getHub(), 'Voucher hub address mismatch').to.equal(
                await voucherHub.getAddress(),
            );
            expect(await voucher2.getHub(), 'Voucher hub address mismatch').to.equal(
                await voucherHub.getAddress(),
            );
            expect(await voucher1.getType(), 'Voucher 1 type mismatch').to.equal(voucherType0);
            expect(await voucher2.getType(), 'Voucher 2 type mismatch').to.equal(voucherType1);
        });

        it('Should not create voucher when not owner', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            // Create voucher.
            await expect(
                voucherHub.connect(anyone).createVoucher(voucherOwner1, voucherType0),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not create voucher when voucher type ID is out of bounds', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const outOfBoundsTypeID = 999;
            // Create voucher.
            await expect(
                voucherHub.createVoucher(voucherOwner1, outOfBoundsTypeID),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Authorization', async function () {
        it('Should authorize an account', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            // Authorize the account
            await voucher.connect(voucherOwner1).setAuthorization(anyone.address);

            // Check if the account is authorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
        });

        it('Should deauthorize an account', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            // Authorize the account
            await voucher.connect(voucherOwner1).setAuthorization(anyone.address);
            await voucher.connect(voucherOwner1).unsetAuthorization(anyone.address);

            // Check if the account is deauthorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.false;
        });

        it('Should not authorize an account if the account is not the owner', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            // Authorize the account
            await expect(
                voucher.connect(anyone).setAuthorization(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
        });

        it('Should not unauthorize an account if the account is not the owner', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType0);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            // Authorize the account
            await voucher.connect(voucherOwner1).setAuthorization(anyone.address);

            await expect(
                voucher.connect(anyone).unsetAuthorization(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
        });
    });
});
