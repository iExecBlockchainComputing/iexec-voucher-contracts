// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { VoucherHub } from '../typechain-types/contracts';
import { VoucherHubV2Mock } from '../typechain-types/contracts/mocks';

const iexecAddress = '0x123456789a123456789b123456789b123456789d'; // random

describe('VoucherHub', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, otherAccount] = await ethers.getSigners();

        const VoucherHubFactory = await ethers.getContractFactory('VoucherHub');
        /**
         * @dev Type declaration produces a warning until feature is supported by
         * openzeppelin plugin. See "Support TypeChain in deployProxy function":
         * https://github.com/OpenZeppelin/openzeppelin-upgrades/pull/535
         */
        const voucherHub: VoucherHub = await upgrades.deployProxy(VoucherHubFactory, [
            iexecAddress,
        ]);
        await voucherHub.waitForDeployment();

        return { voucherHub, owner, otherAccount };
    }

    describe('Initialize', function () {
        it('Should initialize', async () => {
            const { voucherHub, owner } = await loadFixture(deployFixture);

            expect(await voucherHub.owner()).to.equal(owner);
            expect(await voucherHub.getIexecPoco()).to.equal(iexecAddress);
        });

        it('Should not initialize twice', async () => {
            const { voucherHub } = await loadFixture(deployFixture);

            await expect(voucherHub.initialize(iexecAddress)).to.be.revertedWithCustomError(
                voucherHub,
                'InvalidInitialization',
            );
        });
    });

    describe('Upgrade', function () {
        it('Should upgrade', async () => {
            const { voucherHub } = await loadFixture(deployFixture);
            const voucherHubAddress = await voucherHub.getAddress();
            const VoucherHubV2Factory = await ethers.getContractFactory('VoucherHubV2Mock');
            // Next line should throw if new storage schema is not compatible with previous one
            const voucherHubV2: VoucherHubV2Mock = await upgrades.upgradeProxy(
                voucherHubAddress,
                VoucherHubV2Factory,
            );
            await voucherHubV2.initializeV2('bar');

            expect(await voucherHubV2.getAddress()).to.equal(voucherHubAddress);
            expect(await voucherHubV2.getIexecPoco()).to.equal(iexecAddress); // V1
            expect(await voucherHubV2.foo()).to.equal('bar'); // V2
        });

        it('Should not upgrade since unauthorized account', async () => {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);

            await expect(
                voucherHub
                    .connect(otherAccount)
                    .upgradeToAndCall(ethers.Wallet.createRandom().address, '0x'),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });

    describe('Create voucher', function () {
        it('Should create voucher', async function () {
            const { voucherHub } = await loadFixture(deployFixture);

            await expect(voucherHub.createVoucher()).to.emit(voucherHub, 'VoucherCreated');
        });
    });

    describe('Create Voucher Type', function () {
        it('Should allow owner to create a voucher type', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const description = 'Test Voucher';
            const duration = 3600;
            await expect(voucherHub.createVoucherType(description, duration))
                .to.emit(voucherHub, 'VoucherTypeCreated')
                .withArgs(0, description, duration);
        });

        it('Should not allow non-owner to create a voucher type', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            const description = 'Test Voucher';
            const duration = 3600;
            await expect(
                voucherHub.connect(otherAccount).createVoucherType(description, duration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });

    describe('Modify Voucher Type type', function () {
        it('Should modify voucher description correctly', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const description = 'Initial Description';
            const newDescription = 'Updated Description';
            const duration = 3600;
            await voucherHub.createVoucherType(description, duration);
            await expect(voucherHub.updateVoucherTypeDescription(0, newDescription))
                .to.emit(voucherHub, 'VoucherTypeDescriptionUpdated')
                .withArgs(0, newDescription);
        });

        it('Should not allow non-owner to modify voucher description', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            const description = 'Initial Description';
            const newDescription = 'Updated Description';
            const duration = 3600;
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.connect(otherAccount).updateVoucherTypeDescription(0, newDescription),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should modify voucher duration correctly', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const description = 'Voucher Description';
            const initialDuration = 3600;
            const newDuration = 7200;
            await voucherHub.createVoucherType(description, initialDuration);
            await expect(voucherHub.updateVoucherTypeDuration(0, newDuration))
                .to.emit(voucherHub, 'VoucherTypeDurationUpdated')
                .withArgs(0, newDuration);
        });

        it('Should not allow out of bound voucher Id to change duration', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const description = 'Voucher Description';
            const initialDuration = 3600;
            const newDuration = 7200;
            await voucherHub.createVoucherType(description, initialDuration);
            await expect(voucherHub.updateVoucherTypeDuration(999, newDuration)).to.be.revertedWith(
                'VoucherHub: Index out of bounds',
            );
        });

        it('Should not allow non-owner to modify voucher duration correctly', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            const description = 'Voucher Description';
            const initialDuration = 3600;
            const newDuration = 7200;
            await voucherHub.createVoucherType(description, initialDuration);
            await expect(
                voucherHub.connect(otherAccount).updateVoucherTypeDuration(0, newDuration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not allow out of bound voucher Id change description', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const description = 'Initial Description';
            const newDescription = 'Updated Description';
            const duration = 3600;
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.updateVoucherTypeDescription(999, newDescription),
            ).to.be.revertedWith('VoucherHub: Index out of bounds');
        });
    });

    describe('Asset Eligibility', function () {
        it('Should set and unset asset eligibility', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const asset = ethers.Wallet.createRandom().address;
            const description = 'Voucher for Testing';
            const duration = 3600;
            await voucherHub.createVoucherType(description, duration);
            expect(await voucherHub.setEligibleAsset(0, asset)).to.emit(
                voucherHub,
                'SetEligibleAsset',
            );
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset)).to.be.true;
            expect(await voucherHub.unsetEligibleAsset(0, asset)).to.emit(
                voucherHub,
                'UnsetEligibleAsset',
            );
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset)).to.be.false;
        });

        it('Should not allow non-owner to set asset eligibility', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            const asset = ethers.Wallet.createRandom().address;
            const description = 'Voucher for Testing';
            const duration = 3600;
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.connect(otherAccount).setEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not allow non-owner to unset asset eligibility', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            const asset = ethers.Wallet.createRandom().address;
            const description = 'Voucher for Testing';
            const duration = 3600;
            await voucherHub.createVoucherType(description, duration);
            await voucherHub.setEligibleAsset(0, asset);
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset)).to.be.true;
            await expect(
                voucherHub.connect(otherAccount).unsetEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });

    describe('getVoucherType', function () {
        it('Should return correct voucher type', async function () {
            const { voucherHub } = await loadFixture(deployFixture);

            await voucherHub.createVoucherType('Early Access', 3600);
            await voucherHub.createVoucherType('Premium Access', 7200);

            const type1 = await voucherHub.getVoucherType(0);
            expect(type1[0]).to.equal('Early Access');
            expect(type1[1]).to.equal(3600);

            const type2 = await voucherHub.getVoucherType(1);
            expect(type2[0]).to.equal('Premium Access');
            expect(type2[1]).to.equal(7200);
        });

        it('Should revert for an out of bounds voucher type ID', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await expect(voucherHub.getVoucherType(999)).to.be.revertedWith(
                'VoucherHub: Index out of bounds',
            );
        });
    });

    describe('getVoucherTypeCount', function () {
        it('Should return the total count of voucher types', async function () {
            const { voucherHub } = await loadFixture(deployFixture);

            await voucherHub.createVoucherType('Standard Access', 1800);
            await voucherHub.createVoucherType('Extended Access', 5400);

            const count = await voucherHub.getVoucherTypeCount();
            expect(count).to.equal(2);
        });
    });
});
