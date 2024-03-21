// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { VoucherHub } from '../typechain-types/contracts';
import { VoucherHubV2Mock } from '../typechain-types/contracts/mocks';

const iexecAddress = '0x123456789a123456789b123456789b123456789d'; // random
const description = 'Early Access';
const duration = 3600;
const asset = ethers.Wallet.createRandom().address;

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

    describe('Create voucher type', function () {
        it('Should allow owner to create a voucher type', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await expect(voucherHub.createVoucherType(description, duration))
                .to.emit(voucherHub, 'VoucherTypeCreated')
                .withArgs(0, description, duration);
            const type1 = await voucherHub.getVoucherType(0);
            expect(type1.description).to.equal(description);
            expect(type1.duration).to.equal(duration);
            const count = await voucherHub.getVoucherTypeCount();
            expect(count).to.equal(1);
        });

        it('Should not allow non-owner to create a voucher type', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            await expect(
                voucherHub.connect(otherAccount).createVoucherType(description, duration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });

    describe('Get voucher type', function () {
        it('Should revert for an out of bounds voucher type ID', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await expect(voucherHub.getVoucherType(999)).to.be.revertedWith(
                'VoucherHub: type index out of bounds',
            );
        });
    });

    describe('Update Voucher Type Description', function () {
        const newDescription = 'Long Term Duration';
        it('Should modify voucher description correctly', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(voucherHub.updateVoucherTypeDescription(0, newDescription))
                .to.emit(voucherHub, 'VoucherTypeDescriptionUpdated')
                .withArgs(0, newDescription);
        });

        it('Should not allow non-owner to modify voucher description', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.connect(otherAccount).updateVoucherTypeDescription(0, newDescription),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not allow out of bound voucher Id change description', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.updateVoucherTypeDescription(999, newDescription),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Update Voucher Type Duration', function () {
        const newDuration = 7200;
        it('Should modify voucher duration correctly', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(voucherHub.updateVoucherTypeDuration(0, newDuration))
                .to.emit(voucherHub, 'VoucherTypeDurationUpdated')
                .withArgs(0, newDuration);
        });

        it('Should not allow non-owner to modify voucher duration correctly', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.connect(otherAccount).updateVoucherTypeDuration(0, newDuration),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not allow out of bound voucher Id to change duration', async function () {
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
            await voucherHub.createVoucherType(description, duration);
            expect(await voucherHub.addEligibleAsset(0, asset)).to.emit(
                voucherHub,
                'EligibleAssetAdded',
            );
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset)).to.be.true;
            expect(await voucherHub.removeEligibleAsset(0, asset)).to.emit(
                voucherHub,
                'EligibleAssetRemoved',
            );
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset)).to.be.false;
        });

        it('Should not allow non-owner to set asset eligibility', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await expect(
                voucherHub.connect(otherAccount).addEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });

        it('Should not allow non-owner to unset asset eligibility', async function () {
            const { voucherHub, otherAccount } = await loadFixture(deployFixture);
            await voucherHub.createVoucherType(description, duration);
            await voucherHub.addEligibleAsset(0, asset);
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(0, asset)).to.be.true;
            await expect(
                voucherHub.connect(otherAccount).removeEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
        });
    });
});
