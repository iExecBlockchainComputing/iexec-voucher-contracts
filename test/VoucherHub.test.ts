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

    describe('Testing each setter function separately', function () {
        describe('addVoucherTypeDescription', function () {
            it('Should allow owner to add a voucher type description', async function () {
                const { voucherHub, owner } = await loadFixture(deployFixture);
                const voucherTypeId = 1;
                const description = 'Test Voucher Type';

                await expect(voucherHub.addVoucherTypeDescription(voucherTypeId, description))
                    .to.emit(voucherHub, 'VoucherTypeAdded')
                    .withArgs(voucherTypeId, description);
            });

            it('Should not allow non-owner to add a voucher type description', async function () {
                const { voucherHub, otherAccount } = await loadFixture(deployFixture);
                const voucherTypeId = 1;
                const description = 'Test Voucher Type';

                await expect(
                    voucherHub
                        .connect(otherAccount)
                        .addVoucherTypeDescription(voucherTypeId, description),
                ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
            });
        });

        describe('setVoucherDuration', function () {
            it('Should allow owner to set voucher duration', async function () {
                const { voucherHub } = await loadFixture(deployFixture);
                const voucherTypeId = 1;
                const duration = 3600;

                await expect(voucherHub.setVoucherDuration(voucherTypeId, duration))
                    .to.emit(voucherHub, 'VoucherDurationSet')
                    .withArgs(voucherTypeId, duration);
            });

            it('Should not allow non-owner to set voucher duration', async function () {
                const { voucherHub, otherAccount } = await loadFixture(deployFixture);
                const voucherTypeId = 1;
                const duration = 3600;

                await expect(
                    voucherHub.connect(otherAccount).setVoucherDuration(voucherTypeId, duration),
                ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
            });
        });

        describe('setAssetEligibility', function () {
            it('Should allow owner to set asset eligibility', async function () {
                const { voucherHub } = await loadFixture(deployFixture);
                const voucherTypeId = 1;
                const asset = ethers.Wallet.createRandom().address;
                const isEligible = true;

                await expect(voucherHub.setAssetEligibility(voucherTypeId, asset, isEligible))
                    .to.emit(voucherHub, 'AssetEligibilitySet')
                    .withArgs(voucherTypeId, asset, isEligible);
            });

            it('Should not allow non-owner to set asset eligibility', async function () {
                const { voucherHub, otherAccount } = await loadFixture(deployFixture);
                const voucherTypeId = 1;
                const asset = ethers.Wallet.createRandom().address;
                const isEligible = true;

                await expect(
                    voucherHub
                        .connect(otherAccount)
                        .setAssetEligibility(voucherTypeId, asset, isEligible),
                ).to.be.revertedWithCustomError(voucherHub, 'OwnableUnauthorizedAccount');
            });
        });
    });

    describe('Set Multiple Voucher Types, Allowed assets.', function () {
        async function setupVoucherTypes(voucherHub: VoucherHub) {
            // Adding two voucher types
            await voucherHub.addVoucherTypeDescription(1, 'Voucher Type 1');
            await voucherHub.addVoucherTypeDescription(2, 'Voucher Type 2');

            // Setting durations for each voucher type
            await voucherHub.setVoucherDuration(1, 3600);
            await voucherHub.setVoucherDuration(2, 7200);

            // Setting asset eligibility for each voucher type
            const asset1 = ethers.Wallet.createRandom().address;
            const asset2 = ethers.Wallet.createRandom().address;
            await voucherHub.setAssetEligibility(1, asset1, true);
            await voucherHub.setAssetEligibility(2, asset2, true);

            return { asset1, asset2 };
        }

        it('Should correctly set up two voucher types with unique properties', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const { asset1, asset2 } = await setupVoucherTypes(voucherHub);

            const voucherTypes = [
                { typeId: 1, description: 'Voucher Type 1', duration: 3600, asset: asset1 },
                { typeId: 2, description: 'Voucher Type 2', duration: 7200, asset: asset2 },
            ];

            for (const voucherType of voucherTypes) {
                // Adding voucher type description
                await expect(
                    voucherHub.addVoucherTypeDescription(
                        voucherType.typeId,
                        voucherType.description,
                    ),
                )
                    .to.emit(voucherHub, 'VoucherTypeAdded')
                    .withArgs(voucherType.typeId, voucherType.description);

                // Setting voucher duration
                await expect(
                    voucherHub.setVoucherDuration(voucherType.typeId, voucherType.duration),
                )
                    .to.emit(voucherHub, 'VoucherDurationSet')
                    .withArgs(voucherType.typeId, voucherType.duration);

                // Setting asset eligibility
                await expect(
                    voucherHub.setAssetEligibility(voucherType.typeId, voucherType.asset, true),
                )
                    .to.emit(voucherHub, 'AssetEligibilitySet')
                    .withArgs(voucherType.typeId, voucherType.asset, true);
            }
        });
        describe('Test Getter Functions on multiple voucher and allowed assets', function () {
            describe('Voucher Type Descriptions', function () {
                it('Should return the correct count of voucher type descriptions', async function () {
                    const { voucherHub } = await loadFixture(deployFixture);
                    await setupVoucherTypes(voucherHub);
                    expect(await voucherHub.getVoucherTypeDescriptionsCount()).to.equal(2);
                });

                it('Should return the correct voucher type description for each type', async function () {
                    const { voucherHub } = await loadFixture(deployFixture);
                    await setupVoucherTypes(voucherHub);
                    const type1Description = await voucherHub.getVoucherTypeDescription(0);
                    expect(type1Description[0]).to.equal(1);
                    expect(type1Description[1]).to.equal('Voucher Type 1');

                    const type2Description = await voucherHub.getVoucherTypeDescription(1);
                    expect(type2Description[0]).to.equal(2);
                    expect(type2Description[1]).to.equal('Voucher Type 2');
                });
            });

            describe('Voucher Duration By Type ID', function () {
                it('Should return the correct duration for each voucher type', async function () {
                    const { voucherHub } = await loadFixture(deployFixture);
                    await setupVoucherTypes(voucherHub);
                    expect(await voucherHub.getVoucherDurationByVoucherTypeId(1)).to.equal(3600);
                    expect(await voucherHub.getVoucherDurationByVoucherTypeId(2)).to.equal(7200);
                });
            });

            describe('Asset Eligibility By Voucher Type ID', function () {
                it('Should return true for eligible assets and false for non-eligible assets', async function () {
                    const { voucherHub } = await loadFixture(deployFixture);
                    const { asset1, asset2 } = await setupVoucherTypes(voucherHub);
                    const randomAsset = ethers.Wallet.createRandom().address;

                    expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(1, asset1)).to.be
                        .true;
                    expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(2, asset2)).to.be
                        .true;
                    expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(1, randomAsset))
                        .to.be.false;
                });
            });
        });
    });
});
