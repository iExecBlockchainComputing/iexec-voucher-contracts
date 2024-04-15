// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { AddressLike, BigNumberish } from 'ethers';
import { ethers } from 'hardhat';
import * as commonUtils from '../scripts/common';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { IexecPocoMock, IexecPocoMock__factory, Voucher } from '../typechain-types';
import { VoucherHub } from '../typechain-types/contracts';
import { random } from './utils/address-utils';

const voucherType = 0;
const description = 'Early Access';
const duration = 3600;
const voucherValue = 100;
const asset = random();
const assetPrice = 1;
const initVoucherHubBalance = 10 * voucherValue; // arbitrary value, but should support couple voucher creations

describe('VoucherHub', function () {
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
        await iexecPocoInstance
            .transfer(await voucherHub.getAddress(), initVoucherHubBalance)
            .then((tx) => tx.wait());
        return {
            beacon,
            voucherHub,
            owner,
            assetEligibilityManager,
            voucherManager,
            voucherOwner1,
            voucherOwner2,
            anyone,
        };
    }

    describe('Initialize', function () {
        it('Should initialize', async function () {
            const { beacon, voucherHub, owner, assetEligibilityManager, voucherManager } =
                await loadFixture(deployFixture);
            const voucherBeaconAddress = await beacon.getAddress();
            // Check roles.
            expect(await voucherHub.owner())
                .to.equal(await voucherHub.defaultAdmin())
                .to.equal(owner);
            expect(await voucherHub.defaultAdminDelay()).to.equal(0);
            expect(
                await voucherHub.hasRole(await voucherHub.UPGRADE_MANAGER_ROLE.staticCall(), owner),
            );
            expect(
                await voucherHub.hasRole(
                    await voucherHub.ASSET_ELIGIBILITY_MANAGER_ROLE.staticCall(),
                    assetEligibilityManager,
                ),
            );
            expect(
                await voucherHub.hasRole(
                    await voucherHub.VOUCHER_MANAGER_ROLE.staticCall(),
                    voucherManager,
                ),
            );
            // Check config.
            expect(await voucherHub.getIexecPoco()).to.equal(iexecPoco);
            expect(await voucherHub.getVoucherBeacon()).to.equal(voucherBeaconAddress);
            // Check VoucherProxy code hash
            const voucherHubAddress = await voucherHub.getAddress();
            const actualCodeHash =
                await voucherHubUtils.getVoucherProxyCreationCodeHashFromStorage(voucherHubAddress);
            const expectedHashes =
                await voucherHubUtils.getVoucherProxyCreationCodeHash(voucherBeaconAddress);
            expect(expectedHashes).to.include(actualCodeHash);
        });

        it('Should not initialize twice', async function () {
            const { beacon, voucherHub, assetEligibilityManager, voucherManager } =
                await loadFixture(deployFixture);

            await expect(
                voucherHub.initialize(
                    assetEligibilityManager,
                    voucherManager,
                    iexecPoco,
                    await beacon.getAddress(),
                ),
            ).to.be.revertedWithCustomError(voucherHub, 'InvalidInitialization');
        });
    });

    describe('Upgrade', function () {
        it('Should upgrade', async function () {
            const { voucherHub, owner } = await loadFixture(deployFixture);
            const voucherHubAddress = await voucherHub.getAddress();
            const VoucherHubV2Factory = await ethers.getContractFactory('VoucherHubV2Mock', owner);
            // Next line should throw if new storage schema is not compatible with previous one
            await voucherHubUtils.upgradeProxy(voucherHubAddress, VoucherHubV2Factory);
            const voucherHubV2 = await ethers.getContractAt('VoucherHubV2Mock', voucherHubAddress);
            await voucherHubV2.initializeV2('bar');

            expect(await voucherHubV2.getAddress()).to.equal(voucherHubAddress);
            expect(await voucherHubV2.getIexecPoco()).to.equal(iexecPoco); // V1
            expect(await voucherHubV2.foo()).to.equal('bar'); // V2
        });

        it('Should not upgrade when account is unauthorized', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);

            await expect(
                voucherHubWithAnyoneSigner.upgradeToAndCall(
                    ethers.Wallet.createRandom().address,
                    '0x',
                ),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Create voucher type', function () {
        it('Should create a voucher type when the caller is authorized', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            const createTypeTx =
                await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                    description,
                    duration,
                );
            const type0 = await voucherHub.getVoucherType(0);
            const count = await voucherHub.getVoucherTypeCount();
            // Run assertions.
            expect(createTypeTx)
                .to.emit(voucherHub, 'VoucherTypeCreated')
                .withArgs(0, description, duration);
            expect(type0.description).to.equal(description);
            expect(type0.duration).to.equal(duration);
            expect(count).to.equal(1);
        });

        it('Should not create a voucher type when the caller is not authorized', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(
                voucherHubWithAnyoneSigner.createVoucherType(description, duration),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Get voucher type', function () {
        it('Should not get the voucher type when the voucher type ID is out of bounds', async function () {
            const { voucherHub } = await loadFixture(deployFixture);
            await expect(voucherHub.getVoucherType(999)).to.be.revertedWith(
                'VoucherHub: type index out of bounds',
            );
        });
    });

    describe('Update voucher type description', function () {
        const newDescription = 'Long Term Duration';
        it('Should update voucher description', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            const updateDescriptionTx =
                await voucherHubWithAssetEligibilityManagerSigner.updateVoucherTypeDescription(
                    0,
                    newDescription,
                );
            await updateDescriptionTx.wait();
            expect(updateDescriptionTx)
                .to.emit(voucherHub, 'VoucherTypeDescriptionUpdated')
                .withArgs(0, newDescription);
        });

        it('Should not update voucher description when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            await expect(
                voucherHubWithAnyoneSigner.updateVoucherTypeDescription(0, newDescription),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not update description when the voucher type ID is out of bounds', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            await expect(
                voucherHubWithAssetEligibilityManagerSigner.updateVoucherTypeDescription(
                    999,
                    newDescription,
                ),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Update voucher type duration', function () {
        const newDuration = 7200;
        it('Should update voucher duration', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            const updateDurationTx =
                await voucherHubWithAssetEligibilityManagerSigner.updateVoucherTypeDuration(
                    0,
                    newDuration,
                );
            await updateDurationTx.wait();
            expect(updateDurationTx)
                .to.emit(voucherHub, 'VoucherTypeDurationUpdated')
                .withArgs(0, newDuration);
        });

        it('Should not update voucher duration when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            await expect(
                voucherHubWithAnyoneSigner.updateVoucherTypeDuration(0, newDuration),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not update duration when the voucher type ID is out of bounds', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            await expect(
                voucherHubWithAssetEligibilityManagerSigner.updateVoucherTypeDuration(
                    999,
                    newDuration,
                ),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Asset Eligibility', function () {
        it('Should set and unset asset eligibility', async function () {
            const { voucherHub, assetEligibilityManager } = await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx =
                await voucherHubWithAssetEligibilityManagerSigner.addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(addEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetAdded');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            const removeEligibleAssetTx =
                await voucherHubWithAssetEligibilityManagerSigner.removeEligibleAsset(
                    typeId,
                    asset,
                );
            await removeEligibleAssetTx.wait();
            expect(removeEligibleAssetTx).to.emit(voucherHub, 'EligibleAssetRemoved');
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .false;
        });

        it('Should not set asset eligibility when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            await expect(
                voucherHubWithAnyoneSigner.addEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not unset asset eligibility when the caller is not authorized', async function () {
            const { voucherHub, assetEligibilityManager, anyone } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            const typeId = await getVoucherTypeCreatedId(voucherHub);
            const addEligibleAssetTx =
                await voucherHubWithAssetEligibilityManagerSigner.addEligibleAsset(typeId, asset);
            await addEligibleAssetTx.wait();
            expect(await voucherHub.isAssetEligibleToMatchOrdersSponsoring(typeId, asset)).to.be
                .true;
            await expect(
                voucherHubWithAnyoneSigner.removeEligibleAsset(0, asset),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });
    });

    describe('Create voucher', function () {
        it('Should create and initialize voucher', async function () {
            const { beacon, voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            const expectedVoucherHubInitRlcBalance = initVoucherHubBalance;
            // Create voucher.
            const voucherHubInitialSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            const createVoucherTx = await voucherHubWithVoucherManagerSigner
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait());

            const voucherHubPostCreationSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            const voucherInitialCreditBalance = await voucherHub.balanceOf(voucher.getAddress());
            const voucherInitialSrlBalance = await iexecPocoInstance.balanceOf(
                voucher.getAddress(),
            );
            const voucherAsProxy = await commonUtils.getVoucherAsProxy(voucherAddress);
            const expectedExpiration = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherTx,
            );
            // Run assertions.
            expect(voucherHubInitialSrlcBalance).to.equal(expectedVoucherHubInitRlcBalance);
            expect(voucherHubPostCreationSrlcBalance).to.equal(
                voucherHubInitialSrlcBalance - BigInt(voucherValue),
            );
            expect(voucherInitialCreditBalance).to.equal(voucherValue);
            expect(voucherInitialSrlBalance).to.equal(voucherValue);
            // Events.
            await expect(createVoucherTx)
                .to.emit(voucherAsProxy, 'BeaconUpgraded')
                .withArgs(await beacon.getAddress())
                .to.emit(voucher, 'OwnershipTransferred')
                .withArgs(ethers.ZeroAddress, voucherOwner1.address)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress,
                    voucherOwner1.address,
                    expectedExpiration,
                    voucherType,
                    voucherValue,
                );
            // Voucher as proxy
            expect(await voucherAsProxy.implementation(), 'Implementation mismatch').to.equal(
                await beacon.implementation(),
            );
            // Voucher
            expect(await voucher.owner(), 'Owner mismatch').to.equal(voucherOwner1);
            expect(await voucher.getExpiration(), 'Expiration mismatch').to.equal(
                expectedExpiration,
            );
            expect(await voucher.isAccountAuthorized(voucherOwner1.address)).to.be.true;
        });

        it('Should create different vouchers for different accounts with the same config', async function () {
            // Vouchers are created with the same configuration (type, expiration, ...).
            // The goal is to make sure that configuration is not included in the constructor
            // args which would result in different create2 salts.
            const {
                voucherHub,
                assetEligibilityManager,
                voucherManager,
                voucherOwner1,
                voucherOwner2,
            } = await loadFixture(deployFixture);
            // Create type0.
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            const voucherHubInitialSrlBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            // Create voucher1.
            await expect(
                voucherHubWithVoucherManagerSigner.createVoucher(
                    voucherOwner1,
                    voucherType,
                    voucherValue,
                ),
            ).to.emit(voucherHub, 'VoucherCreated');
            const voucherHubFirstCreationSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );

            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1: Voucher = await commonUtils.getVoucher(voucherAddress1);
            // Create voucher2.
            await expect(
                voucherHubWithVoucherManagerSigner.createVoucher(
                    voucherOwner2,
                    voucherType,
                    voucherValue,
                ),
            ).to.emit(voucherHub, 'VoucherCreated');
            const voucherHubSecondCreationSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );

            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2: Voucher = await commonUtils.getVoucher(voucherAddress2);
            expect(voucherHubFirstCreationSrlcBalance).to.equal(
                voucherHubInitialSrlBalance - BigInt(voucherValue),
            );
            expect(voucherHubSecondCreationSrlcBalance).to.equal(
                voucherHubFirstCreationSrlcBalance - BigInt(voucherValue),
            );

            expect(voucherAddress1).is.not.equal(voucherAddress2);
            expect(await voucher1.owner()).to.not.equal(await voucher2.owner());
            expect(await voucher1.getType()).to.equal(await voucher2.getType());
            expect(await voucher1.getVoucherHub()).to.equal(await voucher2.getVoucherHub());
        });

        it('Should create multiple vouchers with the correct config', async function () {
            const { voucherHub, voucherOwner1, voucherOwner2 } = await loadFixture(deployFixture);
            // Create type0.
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            const voucherType1 = 1;
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherValue1 = 200;
            // Create type1.
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description1,
                duration1,
            );
            // Create voucher1.
            const createVoucherTx1 = await voucherHubWithVoucherManagerSigner
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait());
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherTx1,
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucher1 = await commonUtils.getVoucher(voucherAddress1);
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHubWithVoucherManagerSigner
                .createVoucher(voucherOwner2, voucherType1, voucherValue1)
                .then((tx) => tx.wait());
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                duration1,
                createVoucherTx2,
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucher2 = await commonUtils.getVoucher(voucherAddress2);
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);
            const voucherHubFinalSrlcBalance = await iexecPocoInstance.balanceOf(
                voucherHub.getAddress(),
            );
            // Events
            expect(createVoucherTx1)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress1,
                    voucherOwner1.address,
                    expectedExpirationVoucher1,
                    voucherType,
                    voucherValue,
                );
            expect(createVoucherTx2)
                .to.emit(voucherHub, 'VoucherCreated')
                .withArgs(
                    voucherAddress2,
                    voucherOwner2.address,
                    expectedExpirationVoucher2,
                    voucherType1,
                    voucherValue1,
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
            expect(await voucherHub.balanceOf(voucher1.getAddress())).to.equal(voucherValue);
            expect(await voucherHub.balanceOf(voucher2.getAddress())).to.equal(voucherValue1);
            expect(voucherHubFinalSrlcBalance).to.equal(
                initVoucherHubBalance - voucherValue - voucherValue1,
            );
        });

        it('Should not create more than 1 voucher for the same account', async function () {
            const { voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            // Create voucher.
            await expect(
                voucherHubWithVoucherManagerSigner.createVoucher(
                    voucherOwner1,
                    voucherType,
                    voucherValue,
                ),
            ).to.emit(voucherHub, 'VoucherCreated');
            // Second creation should fail.
            await expect(
                voucherHubWithVoucherManagerSigner.createVoucher(
                    voucherOwner1,
                    voucherType,
                    voucherValue,
                ),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create more than 1 voucher for the same account with different config', async function () {
            const { voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            // Create voucher.
            await expect(
                voucherHubWithVoucherManagerSigner.createVoucher(
                    voucherOwner1,
                    voucherType,
                    voucherValue,
                ),
            ).to.emit(voucherHub, 'VoucherCreated');
            // Second creation should fail.
            const duration1 = 7200;
            const description1 = 'Long Term Duration';
            const voucherType1 = 1;
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description1,
                duration1,
            );
            await expect(
                voucherHubWithVoucherManagerSigner.createVoucher(
                    voucherOwner1,
                    voucherType1,
                    voucherValue,
                ),
            ).to.be.revertedWithoutReason();
        });

        it('Should not create voucher when initialization fails', async function () {
            // TODO
        });

        it('Should not initialize voucher more than once', async function () {
            const { voucherHub, assetEligibilityManager, voucherManager, voucherOwner1 } =
                await loadFixture(deployFixture);
            await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(
                description,
                duration,
            );
            // Create voucher.
            const createVoucherTx = await voucherHubWithVoucherManagerSigner
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait());
            const expectedExpiration = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherTx,
            );
            await expect(createVoucherTx).to.emit(voucherHub, 'VoucherCreated');
            // Second initialization should fail.
            const voucherAddress = await voucherHub.getVoucher(voucherOwner1);
            const voucher: Voucher = await commonUtils.getVoucher(voucherAddress);
            await expect(
                voucher.initialize(
                    voucherOwner1,
                    await voucherHub.getAddress(),
                    expectedExpiration,
                    voucherType,
                ),
            ).to.be.revertedWithCustomError(voucher, 'InvalidInitialization');
        });

        it('Should not create voucher when not authorized', async function () {
            const { voucherHub, voucherOwner1, anyone } = await loadFixture(deployFixture);
            // Create voucher.
            await expect(
                voucherHubWithAnyoneSigner.createVoucher(voucherOwner1, voucherType, voucherValue),
            ).to.be.revertedWithCustomError(voucherHub, 'AccessControlUnauthorizedAccount');
        });

        it('Should not create voucher when voucher type ID is out of bounds', async function () {
            const { voucherHub, voucherManager, voucherOwner1 } = await loadFixture(deployFixture);
            const outOfBoundsTypeID = 999;
            // Create voucher.
            await expect(
                voucherHubWithVoucherManagerSigner.createVoucher(
                    voucherOwner1,
                    outOfBoundsTypeID,
                    voucherValue,
                ),
            ).to.be.revertedWith('VoucherHub: type index out of bounds');
        });
    });

    describe('Debit voucher', function () {
        let [voucherOwner1, voucherOwner2, voucher, anyone]: SignerWithAddress[] = [];
        let voucherHub: VoucherHub;

        beforeEach(async function () {
            ({ voucherHub, voucherOwner1, voucherOwner2, anyone } =
                await loadFixture(deployFixture));
            // Create voucher type
            await voucherHubWithAssetEligibilityManagerSigner
                .createVoucherType(description, duration)
                .then((tx) => tx.wait());
            // Add eligible asset
            await voucherHubWithAssetEligibilityManagerSigner
                .addEligibleAsset(voucherType, asset)
                .then((tx) => tx.wait());
            // Create voucher
            voucher = await voucherHubWithVoucherManagerSigner
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner1))
                .then((voucherAddress) => ethers.getImpersonatedSigner(voucherAddress));
        });

        it('Should debit voucher', async function () {
            const sponsoredValue = BigInt(assetPrice * 3);
            const voucherInitialCreditBalance = await voucherHub.balanceOf(voucher.address);

            const args = [voucherType, asset, assetPrice, asset, assetPrice, asset, assetPrice] as [
                voucherTypeId: BigNumberish,
                app: AddressLike,
                appPrice: BigNumberish,
                dataset: AddressLike,
                datasetPrice: BigNumberish,
                workerpool: AddressLike,
                workerpoolPrice: BigNumberish,
            ];
            expect(await voucherHub.connect(voucher).debitVoucher.staticCall(...args)).to.be.equal(
                sponsoredValue,
            );
            await expect(await voucherHub.connect(voucher).debitVoucher(...args))
                .to.emit(voucherHub, 'Transfer')
                .withArgs(voucher.address, ethers.ZeroAddress, sponsoredValue)
                .to.emit(voucherHub, 'VoucherDebited')
                .withArgs(voucher.address, sponsoredValue);
            expect(await voucherHub.balanceOf(voucher.address)).equals(
                voucherInitialCreditBalance - sponsoredValue,
            );
        });

        it('Should debit zero when sender is not a voucher', async function () {
            const initialCreditBalance = await voucherHub.balanceOf(anyone.address);
            const debitVoucher = () =>
                voucherHub
                    .connect(anyone)
                    .debitVoucher(
                        voucherType,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                    );
            // The matcher 'emit' cannot be chained after or before 'reverted'
            // so we call several times to check different assertions
            await expect(await debitVoucher()).to.not.be.reverted;
            await expect(await debitVoucher()).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(anyone.address))
                .to.equal(initialCreditBalance)
                .to.equal(0);
        });

        it('Should debit zero when voucher balance is empty', async function () {
            const emptyVoucher = await voucherHubWithVoucherManagerSigner
                .createVoucher(voucherOwner2, voucherType, 0)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner2))
                .then((voucherAddress) => ethers.getImpersonatedSigner(voucherAddress));
            const initialCreditBalance = await voucherHub.balanceOf(emptyVoucher.address);

            await expect(
                await voucherHub
                    .connect(emptyVoucher)
                    .debitVoucher(
                        voucherType,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                        asset,
                        assetPrice,
                    ),
            ).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(emptyVoucher.address))
                .to.equal(initialCreditBalance)
                .to.equal(0);
        });

        it('Should debit zero with no eligible asset', async function () {
            const initialCreditBalance = await voucherHub.balanceOf(voucher.address);
            const unEligibleAsset = random();

            await expect(
                voucherHub
                    .connect(voucher)
                    .debitVoucher(
                        voucherType,
                        unEligibleAsset,
                        assetPrice,
                        unEligibleAsset,
                        assetPrice,
                        unEligibleAsset,
                        assetPrice,
                    ),
            ).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(voucher.address)).to.equal(initialCreditBalance);
        });

        it('Should not debit voucher with an invalid voucher type ID', async function () {
            const initialCreditBalance = await voucherHub.balanceOf(anyone.address);

            await expect(
                voucherHub
                    .connect(anyone)
                    .debitVoucher(999, asset, assetPrice, asset, assetPrice, asset, assetPrice),
            ).to.not.emit(voucherHub, 'VoucherDebited');
            expect(await voucherHub.balanceOf(anyone.address)).to.equal(initialCreditBalance);
        });
    });

    describe('Get voucher', function () {
        it('Should return address 0 when voucher is not created', async function () {
            const { voucherHub, owner } = await loadFixture(deployFixture);
            await expect(await voucherHub.getVoucher(owner)).to.be.equal(ethers.ZeroAddress);
        });
    });

    describe('NonTransferableERC20Upgradeable', function () {
        it('Should not transfer', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(voucherHub.transfer(anyone, 0)).to.be.revertedWith(
                'NonTransferableERC20Upgradeable: Unsupported transfer',
            );
        });

        it('Should not approve', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(voucherHub.approve(anyone, 0)).to.be.revertedWith(
                'NonTransferableERC20Upgradeable: Unsupported approve',
            );
        });

        it('Should not transferFrom', async function () {
            const { voucherHub, anyone } = await loadFixture(deployFixture);
            await expect(voucherHub.transferFrom(anyone, anyone, 0)).to.be.revertedWith(
                'NonTransferableERC20Upgradeable: Unsupported transferFrom',
            );
        });
    });
});

async function getVoucherTypeCreatedId(voucherHub: VoucherHub) {
    const events = await voucherHub.queryFilter(voucherHub.filters.VoucherTypeCreated, -1);
    const typeId = Number(events[0].args[0]);
    return typeId;
}
