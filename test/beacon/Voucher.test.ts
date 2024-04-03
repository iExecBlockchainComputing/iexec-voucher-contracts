// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import * as commonUtils from '../../scripts/common';
import * as voucherHubUtils from '../../scripts/voucherHubUtils';
import * as voucherUtils from '../../scripts/voucherUtils';
import { Voucher } from '../../typechain-types';

const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // random
const voucherType = 0;
const duration = 3600;
const description = 'Early Access';

describe('Voucher', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, voucherOwner1, voucherOwner2, anyone] = await ethers.getSigners();
        const beacon = await voucherUtils.deployBeaconAndImplementation(owner.address);
        const voucherHub = await voucherHubUtils.deployHub(iexecPoco, await beacon.getAddress());
        const createTypeTx = await voucherHub.createVoucherType(description, duration);
        await createTypeTx.wait();
        return { beacon, voucherHub, owner, voucherOwner1, voucherOwner2, anyone };
    }

    describe('Upgrade', async function () {
        it('Should upgrade all vouchers', async () => {
            const { beacon, voucherHub, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            const voucherType1 = 1;
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            // Create type1.
            const createType1Tx = await voucherHub.createVoucherType(description1, duration1);
            await createType1Tx.wait();
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, voucherType);
            const createVoucherReceipt1 = await createVoucherTx1.wait();
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration,
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
            await voucher1_V2.initializeV2(1);
            await voucher2_V2.initializeV2(2);

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
        it('Should create different vouchers for different accounts with the same config', async () => {
            // Vouchers are created with the same configuration (type, expiration, ...).
            // The goal is to make sure that configuration is not included in the constructor
            // args which would result in different create2 salts.
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            // Create voucher1.
            await expect(voucherHub.createVoucher(voucherOwner1, voucherType)).to.emit(
                voucherHub,
                'VoucherCreated',
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1: Voucher = await commonUtils.getVoucher(voucherAddress1);
            // Create voucher2.
            await expect(voucherHub.createVoucher(voucherOwner2, voucherType)).to.emit(
                voucherHub,
                'VoucherCreated',
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2: Voucher = await commonUtils.getVoucher(voucherAddress2);

            expect(voucherAddress1).is.not.equal(voucherAddress2);
            expect(await voucher1.owner()).to.not.equal(await voucher2.owner());
            expect(await voucher1.getType()).to.equal(await voucher2.getType());
            expect(await voucher1.getVoucherHub()).to.equal(await voucher2.getVoucherHub());
        });

        it('Should create multiple vouchers with the correct config', async () => {
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            const voucherType1 = 1;
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            // Create type1.
            const createType1Tx = await voucherHub.createVoucherType(description1, duration1);
            await createType1Tx.wait();
            // Create voucher1.
            const createVoucherTx1 = await voucherHub.createVoucher(voucherOwner1, voucherType);
            const createVoucherReceipt1 = await createVoucherTx1.wait();
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherReceipt1,
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1 = await commonUtils.getVoucher(voucherAddress1);
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);

            // Create voucher2.
            const createVoucherTx2 = await voucherHub.createVoucher(voucherOwner2, voucherType1);
            const createVoucherReceipt2 = await createVoucherTx2.wait();
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                duration,
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
                    voucherType,
                    expectedExpirationVoucher1,
                );
            expect(createVoucherReceipt2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress2,
                    voucherOwner2.address,
                    voucherType1,
                    expectedExpirationVoucher2,
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
    });

    describe('Authorization', async function () {
        it('Should authorize an account', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            // Authorize the account
            const authorizationTx = await voucher
                .connect(voucherOwner1)
                .authorizeAccount(anyone.address);
            const authorizationReceipt = await authorizationTx.wait();
            // Run assertions.
            // Events.
            expect(authorizationReceipt)
                .to.emit(voucher, 'AccountAuthorized')
                .withArgs(anyone.address);
            // Check if the account is authorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
        });

        it('Should deauthorize an account', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            // Authorize the account
            await voucher.connect(voucherOwner1).authorizeAccount(anyone.address);
            // unauthorize the account
            const unauthorizationTx = await voucher
                .connect(voucherOwner1)
                .unauthorizeAccount(anyone.address);
            const unauthorizationReceipt = await unauthorizationTx.wait();
            // Run assertions.
            // Events.
            expect(unauthorizationReceipt)
                .to.emit(voucher, 'AccountUnauthorized')
                .withArgs(anyone.address);
            // Check if the account is unauthorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.false;
        });

        it('Should not authorize an account if the account is not the owner', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            // Authorize the account
            await expect(
                voucher.connect(anyone).authorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
        });

        it('Should not unauthorize an account if the account is not the owner', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            // Authorize the account
            await voucher.connect(voucherOwner1).authorizeAccount(anyone.address);

            await expect(
                voucher.connect(anyone).unauthorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
        });

        it('Should not authorize owner account', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHub.createVoucher(voucherOwner1, voucherType);
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            await expect(
                voucher.connect(voucherOwner1).authorizeAccount(voucherOwner1.address),
            ).to.be.revertedWith('Voucher: owner is already authorized.');
        });
    });
});
