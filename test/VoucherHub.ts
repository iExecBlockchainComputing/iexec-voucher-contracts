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

        const VoucherHub = await ethers.getContractFactory('VoucherHub');
        /**
         * @dev Type declaration produces a warning until feature is supported by
         * openzeppelin plugin. See "Support TypeChain in deployProxy function":
         * https://github.com/OpenZeppelin/openzeppelin-upgrades/pull/535
         */
        const voucherHub: VoucherHub = await upgrades.deployProxy(VoucherHub, [iexecAddress]);
        await voucherHub.waitForDeployment();

        return { voucherHub, owner, otherAccount };
    }

    describe('Initialize', function () {
        it('Should initialize', async () => {
            const { voucherHub, owner } = await loadFixture(deployFixture);

            expect(await voucherHub.owner()).to.equal(owner);
            expect(await voucherHub.getIexecAddress()).to.equal(iexecAddress);
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
            const VoucherHubV2 = await ethers.getContractFactory('VoucherHubV2Mock');
            // Next line should throw if new storage schema is not compatible with previous one
            const voucherHubV2: VoucherHubV2Mock = await upgrades.upgradeProxy(
                voucherHubAddress,
                VoucherHubV2,
            );
            await voucherHubV2.initializeV2('bar');

            expect(await voucherHubV2.getAddress()).to.equal(voucherHubAddress);
            expect(await voucherHubV2.getIexecAddress()).to.equal(iexecAddress); // V1
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
});
