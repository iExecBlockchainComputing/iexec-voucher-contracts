// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ContractTransactionReceipt } from 'ethers';
import { ethers } from 'hardhat';
import * as commonUtils from '../../scripts/common';
import * as voucherHubUtils from '../../scripts/voucherHubUtils';
import * as voucherUtils from '../../scripts/voucherUtils';
import {
    IexecPocoMock,
    IexecPocoMock__factory,
    UpgradeableBeacon,
    Voucher,
    VoucherHub,
    Voucher__factory,
} from '../../typechain-types';
import { random } from '../utils/address-utils';
import { createMockOrder } from '../utils/poco-utils';

const voucherType = 0;
const duration = 3600;
const description = 'Early Access';
const voucherValue = 100;
const app = random();
const dataset = random();
const workerpool = random();
const appPrice = 1;
const datasetPrice = 2;
const workerpoolPrice = 3;
const dealPrice = BigInt(appPrice + datasetPrice + workerpoolPrice);
const dealId = ethers.id('deal');
const initVoucherHubBalance = 1000; // enough to create couple vouchers

describe('Voucher', function () {
    let [
        admin,
        assetEligibilityManager,
        voucherManager,
        voucherOwner1,
        voucherOwner2,
        requester,
        anyone,
    ]: SignerWithAddress[] = [];
    let beacon: UpgradeableBeacon;
    let iexecPoco: string;
    let iexecPocoInstance: IexecPocoMock;
    let [
        voucherHub,
        voucherHubWithVoucherManagerSigner,
        voucherHubWithAssetEligibilityManagerSigner,
        voucherHubWithAnyoneSigner,
    ]: VoucherHub[] = [];
    let voucher: Voucher; // TODO: Remove this when onlyAuthorized is set to matchOrders
    let [voucherWithOwnerSigner, voucherWithAnyoneSigner]: Voucher[] = [];
    let voucherCreationTxReceipt: ContractTransactionReceipt;
    let [appOrder, datasetOrder, workerpoolOrder, requestOrder]: ReturnType<
        typeof createMockOrder
    >[] = [];

    beforeEach('Deploy', async () => {
        await loadFixture(deployFixture);
    });

    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        [
            admin,
            assetEligibilityManager,
            voucherManager,
            voucherOwner1,
            voucherOwner2,
            requester,
            anyone,
        ] = await ethers.getSigners();
        // Deploy PoCo mock and VoucherHub.
        iexecPocoInstance = await new IexecPocoMock__factory()
            .connect(admin)
            .deploy()
            .then((x) => x.waitForDeployment());
        iexecPoco = await iexecPocoInstance.getAddress();
        beacon = await voucherUtils.deployBeaconAndImplementation(admin.address);
        voucherHub = await voucherHubUtils.deployHub(
            assetEligibilityManager.address,
            voucherManager.address,
            iexecPoco,
            await beacon.getAddress(),
        );
        // Fund VoucherHub with RLCs.
        await iexecPocoInstance
            .transfer(await voucherHub.getAddress(), initVoucherHubBalance)
            .then((tx) => tx.wait());
        // TODO rename to voucherHubAs...
        voucherHubWithVoucherManagerSigner = voucherHub.connect(voucherManager);
        voucherHubWithAssetEligibilityManagerSigner = voucherHub.connect(assetEligibilityManager);
        voucherHubWithAnyoneSigner = voucherHub.connect(anyone);
        // Create one voucher.
        await voucherHubWithAssetEligibilityManagerSigner.createVoucherType(description, duration);
        const voucherAddress1 = await voucherHubWithVoucherManagerSigner
            .createVoucher(voucherOwner1, voucherType, voucherValue)
            .then((tx) => tx.wait())
            .then((tx) => (voucherCreationTxReceipt = tx!))
            .then(() => voucherHub.getVoucher(voucherOwner1));
        voucher = Voucher__factory.connect(voucherAddress1, voucherOwner1);
        voucherWithOwnerSigner = voucher.connect(voucherOwner1);
        voucherWithAnyoneSigner = voucher.connect(anyone);
        // Create mock orders.
        const mockOrder = createMockOrder();
        appOrder = { ...mockOrder, app: app, appprice: appPrice };
        datasetOrder = {
            ...mockOrder,
            dataset: dataset,
            datasetprice: datasetPrice,
        };
        workerpoolOrder = {
            ...mockOrder,
            workerpool: workerpool,
            workerpoolprice: workerpoolPrice,
        };
        requestOrder = { ...mockOrder, requester: requester.address };
        // TODO remove return and update tests.
        return {
            beacon,
            voucherHub,
            admin,
            assetEligibilityManager,
            voucherManager,
            voucherOwner1,
            voucherOwner2,
            requester,
            anyone,
        };
    }

    describe('Upgrade', function () {
        it('Should upgrade all vouchers', async function () {
            // Voucher1
            const expectedExpirationVoucher1 = await commonUtils.getExpectedExpiration(
                duration,
                voucherCreationTxReceipt,
            );
            const voucherAddress1 = await voucherHub.getVoucher(voucherOwner1);
            const voucherAsProxy1 = await commonUtils.getVoucherAsProxy(voucherAddress1);
            // Create voucher2.
            const createVoucherTx2 = await voucherHubWithVoucherManagerSigner.createVoucher(
                voucherOwner2,
                voucherType,
                voucherValue,
            );
            const createVoucherReceipt2 = await createVoucherTx2.wait();
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                duration,
                createVoucherReceipt2,
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);
            // Save old implementation.
            const initialImplementation = await beacon.implementation();
            // Upgrade beacon.
            const voucherImplV2Factory = await ethers.getContractFactory('VoucherV2Mock', admin);
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
            expect(
                await voucherAsProxy1.implementation(),
                'New implementation mismatch',
            ).to.be.equal(await beacon.implementation());
            expect(
                await voucherAsProxy1.implementation(),
                'New implementation mismatch between proxies',
            ).to.be.equal(await voucherAsProxy2.implementation());
            // Make sure the state did not change
            expect(await voucher1_V2.owner(), 'New implementation owner mismatch').to.be.equal(
                voucherOwner1,
            );
            expect(await voucher2_V2.owner(), 'New implementation owner mismatch').to.be.equal(
                voucherOwner2,
            );
            expect(
                await voucher1_V2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.be.equal(expectedExpirationVoucher1);
            expect(
                await voucher2_V2.getExpiration(),
                'New implementation expiration mismatch',
            ).to.be.equal(expectedExpirationVoucher2);
            // Check new state variable.
            expect(await voucher1_V2.getNewStateVariable()).to.be.equal(1);
            expect(await voucher2_V2.getNewStateVariable()).to.be.equal(2);
        });

        it('Should not upgrade voucher when unauthorized', async function () {
            const { beacon, anyone } = await loadFixture(deployFixture);
            // Save implementation.
            const initialImplementation = await beacon.implementation();
            // Try to upgrade beacon.
            const voucherImplV2Factory = await ethers.getContractFactory('VoucherV2Mock', anyone);
            await expect(
                voucherUtils.upgradeBeacon(beacon, voucherImplV2Factory),
            ).to.revertedWithCustomError(beacon, 'OwnableUnauthorizedAccount');
            // Check implementation did not change.
            expect(await beacon.implementation(), 'Implementation has changed').to.be.equal(
                initialImplementation,
            );
        });
    });

    describe('Authorization', function () {
        it('Should authorize an account', async function () {
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.false;
            expect(await voucherWithOwnerSigner.authorizeAccount(anyone.address))
                .to.emit(voucherWithOwnerSigner, 'AccountAuthorized')
                .withArgs(anyone.address);
            // Check if the account is authorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
        });

        it('Should unauthorize an account', async function () {
            await voucherWithOwnerSigner.authorizeAccount(anyone.address).then((tx) => tx.wait());
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
            expect(await voucherWithOwnerSigner.unauthorizeAccount(anyone.address))
                .to.emit(voucher, 'AccountUnauthorized')
                .withArgs(anyone.address);
            // Check if the account is unauthorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.false;
        });

        it('Should not authorize account if sender is not the owner', async function () {
            await expect(
                voucherWithAnyoneSigner.authorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
        });

        it('Should not unauthorize account if sender is not the owner', async function () {
            await voucherWithOwnerSigner.authorizeAccount(anyone.address).then((tx) => tx.wait());
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
            // unauthorize the account
            await expect(
                voucherWithAnyoneSigner.unauthorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
            // Check that the state of mapping is not modified from.
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
        });

        it('Should not authorize owner account', async function () {
            await expect(
                voucherWithOwnerSigner.authorizeAccount(voucherOwner1.address),
            ).to.be.revertedWith('Voucher: owner is already authorized.');
        });
    });

    describe('Voucher Balance', function () {
        it('Should get balance', async function () {
            expect(await voucherWithAnyoneSigner.getBalance()).to.be.equal(voucherValue);
        });
    });

    describe('Match orders', async function () {
        const getVoucherBalanceOnIexecPoco = () =>
            iexecPocoInstance.balanceOf(voucher.getAddress());
        const getRequesterBalanceOnIexecPoco = () =>
            iexecPocoInstance.balanceOf(requester.getAddress());

        it('Should match orders with full sponsored amount', async () => {
            for (const asset of [app, dataset, workerpool]) {
                await voucherHubWithAssetEligibilityManagerSigner
                    .addEligibleAsset(voucherType, asset)
                    .then((x) => x.wait());
            }
            const voucherInitialCreditBalance = await voucher.getBalance();
            const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
            const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

            expect(
                await voucher.matchOrders.staticCall(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.equal(dealId);
            await expect(voucher.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder))
                .to.emit(voucher, 'OrdersMatchedWithVoucher')
                .withArgs(dealId);
            expect(await voucher.getBalance())
                .to.be.equal(voucherInitialCreditBalance - dealPrice)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance - dealPrice);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(requesterInitialSrlcBalance);
            expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
        });

        it('Should match orders with full non-sponsored amount', async () => {
            const voucherInitialCreditBalance = await voucher.getBalance();
            const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
            expect(dealPrice).to.be.greaterThan(0); // just make sure the deal will not be free
            // Deposit in iExec account of requester
            await iexecPocoInstance.transfer(requester, dealPrice).then((tx) => tx.wait());
            // Allow voucher to spend non-sponsored amount
            await iexecPocoInstance
                .connect(requester)
                .approve(await voucher.getAddress(), dealPrice)
                .then((tx) => tx.wait());
            const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

            await expect(voucher.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder))
                .to.emit(iexecPocoInstance, 'Transfer')
                .withArgs(requester.address, await voucher.getAddress(), dealPrice)
                .to.emit(voucher, 'OrdersMatchedWithVoucher');
            expect(await voucher.getBalance())
                .to.be.equal(voucherInitialCreditBalance)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                requesterInitialSrlcBalance - dealPrice,
            );
            expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(0);
        });

        it('Should not match orders when non-sponsored amount is not transferable', async () => {
            await expect(voucher.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder))
                .to.be.revertedWithCustomError(iexecPocoInstance, 'ERC20InsufficientAllowance')
                .withArgs(await voucher.getAddress(), 0, dealPrice);
        });

        it('Should not match orders when iExec Poco matching fails', async () => {
            await iexecPocoInstance.willRevertOnSponsorMatchOrders().then((tx) => tx.wait());

            await expect(
                voucher.matchOrders(
                    { ...appOrder, appprice: 0 },
                    { ...datasetOrder, datasetprice: 0 },
                    { ...workerpoolOrder, workerpoolprice: 0 },
                    requestOrder,
                ),
            ).to.be.revertedWith('IexecPocoMock: Failed to sponsorMatchOrders');
        });

        describe('Match orders boost', async function () {
            it('Should match orders boost with full sponsored amount', async () => {
                const sponsoredValue = BigInt(appPrice + datasetPrice + workerpoolPrice);
                for (const asset of [app, dataset, workerpool]) {
                    await voucherHubWithAssetEligibilityManagerSigner
                        .addEligibleAsset(voucherType, asset)
                        .then((x) => x.wait());
                }
                const voucherInitialCreditBalance = await voucher.getBalance();
                const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
                const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();
                expect(
                    await voucherWithOwnerSigner.matchOrdersBoost.staticCall(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                ).to.be.equal(dealId);
                await expect(
                    voucherWithOwnerSigner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                )
                    .to.emit(voucher, 'OrdersBoostMatchedWithVoucher')
                    .withArgs(dealId)
                    .to.emit(voucherHub, 'VoucherDebited')
                    .withArgs(await voucher.getAddress(), sponsoredValue)
                    .to.emit(voucherHub, 'Transfer')
                    .withArgs(await voucher.getAddress(), ethers.ZeroAddress, sponsoredValue);
                expect(await voucher.getBalance())
                    .to.be.equal(voucherInitialCreditBalance - dealPrice)
                    .to.be.equal(await getVoucherBalanceOnIexecPoco())
                    .to.be.equal(voucherInitialSrlcBalance - dealPrice);
                expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                    requesterInitialSrlcBalance,
                );
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
            });

            it('Should match orders boost with full non-sponsored amount', async () => {
                const voucherInitialCreditBalance = await voucher.getBalance();
                const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
                expect(dealPrice).to.be.greaterThan(0); // just make sure the deal will not be free
                // Deposit in iExec account of requester
                await iexecPocoInstance.transfer(requester, dealPrice).then((tx) => tx.wait());
                // Allow voucher to spend non-sponsored amount
                await iexecPocoInstance
                    .connect(requester)
                    .approve(await voucher.getAddress(), dealPrice)
                    .then((tx) => tx.wait());
                const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

                await expect(
                    voucherWithOwnerSigner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                )
                    .to.emit(voucher, 'OrdersBoostMatchedWithVoucher')
                    .to.emit(iexecPocoInstance, 'Transfer')
                    .withArgs(requester.address, await voucher.getAddress(), dealPrice);
                expect(await voucher.getBalance())
                    .to.be.equal(voucherInitialCreditBalance)
                    .to.be.equal(await getVoucherBalanceOnIexecPoco())
                    .to.be.equal(voucherInitialSrlcBalance);
                expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                    requesterInitialSrlcBalance - dealPrice,
                );
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(0);
            });

            it('Should match orders boost with partial sponsored amount', async () => {
                const sponsoredValue = BigInt(datasetPrice + workerpoolPrice);
                const noSponsoredValue = BigInt(appPrice); // app wont be eligible for sponsoring
                for (const asset of [dataset, workerpool]) {
                    await voucherHubWithAssetEligibilityManagerSigner
                        .addEligibleAsset(voucherType, asset)
                        .then((x) => x.wait());
                }
                const voucherInitialCreditBalance = await voucher.getBalance();
                const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
                const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

                // Deposit in iExec account of requester for the non-sponsored amount
                await iexecPocoInstance
                    .transfer(requester, noSponsoredValue)
                    .then((tx) => tx.wait());

                const requesterDeposietedSrlcBalance = await getRequesterBalanceOnIexecPoco();
                // Allow voucher to spend non-sponsored amount
                await iexecPocoInstance
                    .connect(requester)
                    .approve(await voucher.getAddress(), noSponsoredValue)
                    .then((tx) => tx.wait());

                await expect(
                    voucherWithOwnerSigner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                )
                    .to.emit(voucher, 'OrdersBoostMatchedWithVoucher')
                    .withArgs(dealId)
                    .to.emit(iexecPocoInstance, 'Transfer')
                    .withArgs(
                        requester.address,
                        await voucher.getAddress(),
                        dealPrice - sponsoredValue,
                    )
                    .to.emit(voucherHub, 'VoucherDebited')
                    .withArgs(await voucher.getAddress(), sponsoredValue)
                    .to.emit(voucherHub, 'Transfer')
                    .withArgs(await voucher.getAddress(), ethers.ZeroAddress, sponsoredValue);
                expect(await voucher.getBalance())
                    .to.be.equal(voucherInitialCreditBalance - sponsoredValue)
                    .to.be.equal(await getVoucherBalanceOnIexecPoco())
                    .to.be.equal(voucherInitialSrlcBalance - sponsoredValue);
                expect(await getRequesterBalanceOnIexecPoco())
                    .to.be.equal(requesterDeposietedSrlcBalance - noSponsoredValue)
                    .to.be.equal(requesterInitialSrlcBalance);
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(sponsoredValue);
            });

            it('Should match orders boost with an authorized account', async () => {
                for (const asset of [app, dataset, workerpool]) {
                    await voucherHubWithAssetEligibilityManagerSigner
                        .addEligibleAsset(voucherType, asset)
                        .then((x) => x.wait());
                }
                await voucherWithOwnerSigner
                    .authorizeAccount(anyone.address)
                    .then((tx) => tx.wait());

                await expect(
                    voucherWithAnyoneSigner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                )
                    .to.emit(voucher, 'OrdersBoostMatchedWithVoucher')
                    .withArgs(dealId);
            });

            it('Should not match orders boost when sender is not allowed', async () => {
                await expect(
                    voucherWithAnyoneSigner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                ).to.be.revertedWith('Voucher: sender is not authorized');
            });

            it('Should not match orders boost when voucher is expired', async () => {
                const expirationDate = await voucher.getExpiration();
                await time.setNextBlockTimestamp(expirationDate);
                await expect(
                    voucherWithOwnerSigner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                ).to.be.revertedWith('Voucher: voucher is expired');
            });

            it('Should not match orders boost when non-sponsored amount is not transferable', async () => {
                await expect(
                    voucherWithOwnerSigner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                )
                    .to.be.revertedWithCustomError(iexecPocoInstance, 'ERC20InsufficientAllowance')
                    .withArgs(await voucher.getAddress(), 0, dealPrice);
            });

            it('Should not match orders boost when iExec Poco matching fails', async () => {
                await iexecPocoInstance
                    .willRevertOnSponsorMatchOrdersBoost()
                    .then((tx) => tx.wait());
                await expect(
                    voucherWithOwnerSigner.matchOrdersBoost(
                        { ...appOrder, appprice: 0 },
                        { ...datasetOrder, datasetprice: 0 },
                        { ...workerpoolOrder, workerpoolprice: 0 },
                        requestOrder,
                    ),
                ).to.be.revertedWith('IexecPocoMock: Failed to sponsorMatchOrdersBoost');
            });
        });
    });
});
