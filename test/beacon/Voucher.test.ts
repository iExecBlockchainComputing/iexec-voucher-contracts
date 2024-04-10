// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as commonUtils from '../../scripts/common';
import * as voucherHubUtils from '../../scripts/voucherHubUtils';
import * as voucherUtils from '../../scripts/voucherUtils';
import { IexecPocoMock, IexecPocoMock__factory, Voucher, VoucherHub } from '../../typechain-types';

const voucherType = 0;
const duration = 3600;
const description = 'Early Access';
const voucherValue = 100;
const debitedValue = 25;

describe('Voucher', function () {
    let iexecPoco: string;
    let iexecPocoInstance: IexecPocoMock;
    let voucherHubWithVoucherManagerSigner: VoucherHub;
    let voucherHubWithAssetEligibilityManagerSigner: VoucherHub;
    let voucherHubWithAnyoneSigner: VoucherHub;
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [
            owner, // TODO rename to admin.
            assetEligibilityManager,
            voucherManager,
            voucherOwner1,
            voucherOwner2,
            requester,
            anyone,
        ] = await ethers.getSigners();
        const beacon = await voucherUtils.deployBeaconAndImplementation(owner.address);
        iexecPocoInstance = await new IexecPocoMock__factory()
            .connect(owner)
            .deploy()
            .then((x) => x.waitForDeployment());
        iexecPoco = await iexecPocoInstance.getAddress();
        const voucherHub = await voucherHubUtils.deployHub(
            assetEligibilityManager.address,
            voucherManager.address,
            iexecPoco,
            await beacon.getAddress(),
        );
        voucherHubWithVoucherManagerSigner = voucherHub.connect(voucherManager);
        voucherHubWithAssetEligibilityManagerSigner = voucherHub.connect(assetEligibilityManager);
        voucherHubWithAnyoneSigner = voucherHub.connect(anyone);
        await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(description, duration);
        await iexecPocoInstance
            .transfer(await voucherHub.getAddress(), 1000) // enough to create couple vouchers
            .then((tx) => tx.wait());
        return {
            beacon,
            voucherHub,
            owner,
            assetEligibilityManager,
            voucherManager,
            voucherOwner1,
            voucherOwner2,
            requester,
            anyone,
        };
    }

    describe('Upgrade', function () {
        it('Should upgrade all vouchers', async () => {
            const { beacon, voucherHub, owner, voucherOwner1, voucherOwner2 } =
                await loadFixture(deployFixture);
            const voucherType1 = 1;
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherValue1 = 200;
            // Create type1.
            await voucherHubWithAssetEligibilityManagerSigner
                .createVoucherType(description1, duration1)
                .then((tx) => tx.wait());
            // Create voucher1.
            const createVoucherTx1 = await voucherHubWithVoucherManagerSigner.createVoucher(
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
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHubWithVoucherManagerSigner.createVoucher(
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
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);
            // Save old implementation.
            const initialImplementation = await beacon.implementation();
            // Upgrade beacon.
            const voucherImplV2Factory = await ethers.getContractFactory('VoucherV2Mock', owner);
            await voucherUtils.upgradeBeacon(beacon, voucherImplV2Factory);
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
            const { beacon, anyone } = await loadFixture(deployFixture);
            // Save implementation.
            const initialImplementation = await beacon.implementation();
            // Try to upgrade beacon.
            const voucherImplV2Factory = await ethers.getContractFactory('VoucherV2Mock', anyone);
            await expect(
                voucherUtils.upgradeBeacon(beacon, voucherImplV2Factory),
            ).to.revertedWithCustomError(beacon, 'OwnableUnauthorizedAccount');
            // Check implementation did not change.
            expect(await beacon.implementation(), 'Implementation has changed').to.equal(
                initialImplementation,
            );
        });
    });

    describe('Authorization', function () {
        it('Should authorize an account', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
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
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
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
            const { voucherHub, voucherManager, voucherOwner1, anyone } =
                await loadFixture(deployFixture);
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            // Authorize the account
            await expect(
                voucher.connect(anyone).authorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
        });

        it('Should not unauthorize an account if the account is not the owner', async () => {
            const { voucherHub, voucherManager, voucherOwner1, anyone } =
                await loadFixture(deployFixture);
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            await voucher.connect(voucherOwner1).authorizeAccount(anyone.address);
            const anyoneIsAuthorized = await voucher.isAccountAuthorized(anyone.address);
            // unauthorize the account
            await expect(
                voucher.connect(anyone).unauthorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
            // Check that the state of mapping is not modified from.
            expect(await voucher.isAccountAuthorized(anyone.address)).to.equal(anyoneIsAuthorized)
                .to.be.true;
        });

        it('Should not authorize owner account', async () => {
            const { voucherHub, voucherManager, voucherOwner1 } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);

            await expect(
                voucher.connect(voucherOwner1).authorizeAccount(voucherOwner1.address),
            ).to.be.revertedWith('Voucher: owner is already authorized.');
        });
    });

    describe('Debit voucher', function () {
        it('Should debit voucher', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            const initialCreditVoucherBalance = await voucher.getBalance();
            const initialsRLCVoucherBalance = await iexecPocoInstance.balanceOf(
                voucher.getAddress(),
            );

            // Debit the voucher
            await voucher.connect(voucherOwner1).debitCreditAndBurnRLC(debitedValue);

            // Check if the voucher balance is reduced by the debit amount
            const finalVoucherBalance = await voucher.getBalance();
            const finalsRLCVoucherBalance = await iexecPocoInstance.balanceOf(voucher.getAddress());
            expect(finalVoucherBalance).to.equal(
                initialCreditVoucherBalance - BigInt(debitedValue),
                'Voucher balance not debited correctly',
            );
            expect(finalsRLCVoucherBalance).to.equal(
                initialsRLCVoucherBalance - BigInt(debitedValue),
                'Voucher balance not debited correctly',
            );
        });

        it('Should not debit voucher if the caller is not authorized', async () => {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            const initialCreditVoucherBalance = await voucher.getBalance();
            const initialsRLCVoucherBalance = await iexecPocoInstance.balanceOf(
                voucher.getAddress(),
            );
            const debitedValue = 50; // Define the amount to debit from the voucher

            // Debit the voucher
            await expect(
                voucher.connect(anyone).debitCreditAndBurnRLC(debitedValue),
            ).to.be.revertedWith('Voucher: caller is not authorized.');

            // Check if the voucher balance is reduced by the debit amount
            const finalVoucherBalance = await voucher.getBalance();
            const finalsRLCVoucherBalance = await iexecPocoInstance.balanceOf(voucher.getAddress());
            expect(finalVoucherBalance).to.equal(initialCreditVoucherBalance);
            expect(finalsRLCVoucherBalance).to.equal(initialsRLCVoucherBalance);
        });
    });

    describe('Voucher Balance', function () {
        it('Should have correct initial voucher balance', async () => {
            const { voucherHub, voucherOwner1 } = await loadFixture(deployFixture);
            const createVoucherTx = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner1,
                voucherType,
                voucherValue,
            );
            await createVoucherTx.wait();
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            expect(await voucher.getBalance()).to.equal(voucherValue);
        });
    });
});
