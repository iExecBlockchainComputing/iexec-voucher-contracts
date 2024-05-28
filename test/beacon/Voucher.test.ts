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
const appPrice = 1n;
const datasetPrice = 2n;
const workerpoolPrice = 3n;
// TODO change volume to be > 1.
const volume = 1n;
const taskPrice = appPrice + datasetPrice + workerpoolPrice;
const dealPrice = taskPrice * volume;
const dealId = ethers.id('deal');
const taskIndex = 0;
const taskId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint256'], [dealId, taskIndex]),
);
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
        voucherHubAsVoucherCreationManager,
        voucherHubAsAssetEligibilityManager,
    ]: VoucherHub[] = [];
    let [
        voucher, // TODO: Remove this when onlyAuthorized is set to matchOrders
        voucherAsOwner,
        voucherAsAnyone,
    ]: Voucher[] = [];
    let voucherAddress: string;
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
        voucherHubAsVoucherCreationManager = voucherHub.connect(voucherManager);
        voucherHubAsAssetEligibilityManager = voucherHub.connect(assetEligibilityManager);
        // Fund VoucherHub with RLCs.
        await iexecPocoInstance
            .transfer(await voucherHub.getAddress(), initVoucherHubBalance)
            .then((tx) => tx.wait());
        // Create one voucher.
        await voucherHubAsAssetEligibilityManager.createVoucherType(description, duration);
        voucherAddress = await voucherHubAsVoucherCreationManager
            .createVoucher(voucherOwner1, voucherType, voucherValue)
            .then((tx) => tx.wait())
            .then((tx) => (voucherCreationTxReceipt = tx!))
            .then(() => voucherHub.getVoucher(voucherOwner1));
        voucher = Voucher__factory.connect(voucherAddress, voucherOwner1);
        voucherAsOwner = voucher.connect(voucherOwner1);
        voucherAsAnyone = voucher.connect(anyone);
        // Create mock orders.
        const mockOrder = createMockOrder();
        appOrder = { ...mockOrder, app: app, appprice: appPrice, volume: volume };
        datasetOrder = {
            ...mockOrder,
            dataset: dataset,
            datasetprice: datasetPrice,
            volume: volume,
        };
        workerpoolOrder = {
            ...mockOrder,
            workerpool: workerpool,
            workerpoolprice: workerpoolPrice,
            volume: volume,
        };
        requestOrder = { ...mockOrder, requester: requester.address, volume: volume };
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
            // Create voucher2 with different type and value.
            const anotherDuration = 7200;
            const anotherVoucherTypeId = 1;
            const anotherVoucherValue = 200;
            await voucherHubAsAssetEligibilityManager
                .createVoucherType('Another description', anotherDuration)
                .then((tx) => tx.wait());
            const createVoucherReceipt2 = await voucherHubAsVoucherCreationManager
                .createVoucher(voucherOwner2, anotherVoucherTypeId, anotherVoucherValue)
                .then((tx) => tx.wait());
            const expectedExpirationVoucher2 = await commonUtils.getExpectedExpiration(
                anotherDuration,
                createVoucherReceipt2,
            );
            const voucherAddress2 = await voucherHub.getVoucher(voucherOwner2);
            const voucherAsProxy2 = await commonUtils.getVoucherAsProxy(voucherAddress2);
            // Save old implementation address.
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
            // Save implementation address.
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
            expect(await voucherAsOwner.authorizeAccount(anyone.address))
                .to.emit(voucherAsOwner, 'AccountAuthorized')
                .withArgs(anyone.address);
            // Check if the account is authorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
        });

        it('Should unauthorize an account', async function () {
            await voucherAsOwner.authorizeAccount(anyone.address).then((tx) => tx.wait());
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
            expect(await voucherAsOwner.unauthorizeAccount(anyone.address))
                .to.emit(voucher, 'AccountUnauthorized')
                .withArgs(anyone.address);
            // Check if the account is unauthorized
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.false;
        });

        it('Should not authorize account if sender is not the owner', async function () {
            await expect(
                voucherAsAnyone.authorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
        });

        it('Should not unauthorize account if sender is not the owner', async function () {
            await voucherAsOwner.authorizeAccount(anyone.address).then((tx) => tx.wait());
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
            // unauthorize the account
            await expect(
                voucherAsAnyone.unauthorizeAccount(anyone.address),
            ).to.be.revertedWithCustomError(voucher, 'OwnableUnauthorizedAccount');
            // Check that the state of mapping is not modified from.
            expect(await voucher.isAccountAuthorized(anyone.address)).to.be.true;
        });

        it('Should not authorize owner account', async function () {
            await expect(voucherAsOwner.authorizeAccount(voucherOwner1.address)).to.be.revertedWith(
                'Voucher: owner is already authorized.',
            );
        });
    });

    describe('Voucher Balance', function () {
        it('Should get balance', async function () {
            expect(await voucherAsAnyone.getBalance()).to.be.equal(voucherValue);
        });
    });

    describe('Match orders', async function () {
        const getVoucherBalanceOnIexecPoco = () =>
            iexecPocoInstance.balanceOf(voucher.getAddress());
        const getRequesterBalanceOnIexecPoco = () =>
            iexecPocoInstance.balanceOf(requester.getAddress());

        it('Should match orders with full sponsored amount', async () => {
            await addEligibleAssets([app, dataset, workerpool]);
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

        it('TODO - Should match orders with partial sponsored amount', async () => {
            // TODO
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
                const sponsoredValue = appPrice + datasetPrice + workerpoolPrice;
                await addEligibleAssets([app, dataset, workerpool]);
                const voucherInitialCreditBalance = await voucher.getBalance();
                const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
                const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();
                expect(
                    await voucherAsOwner.matchOrdersBoost.staticCall(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                ).to.be.equal(dealId);
                await expect(
                    voucherAsOwner.matchOrdersBoost(
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
                    voucherAsOwner.matchOrdersBoost(
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
                const sponsoredValue = datasetPrice + workerpoolPrice;
                const noSponsoredValue = appPrice; // app wont be eligible for sponsoring
                await addEligibleAssets([dataset, workerpool]);
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
                    voucherAsOwner.matchOrdersBoost(
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
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherAsOwner.authorizeAccount(anyone.address).then((tx) => tx.wait());

                await expect(
                    voucherAsAnyone.matchOrdersBoost(
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
                    voucherAsAnyone.matchOrdersBoost(
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
                    voucherAsOwner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                ).to.be.revertedWith('Voucher: voucher is expired');
            });

            it('Should not match orders boost when non-sponsored amount is not transferable', async () => {
                await expect(
                    voucherAsOwner.matchOrdersBoost(
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
                    voucherAsOwner.matchOrdersBoost(
                        { ...appOrder, appprice: 0 },
                        { ...datasetOrder, datasetprice: 0 },
                        { ...workerpoolOrder, workerpoolprice: 0 },
                        requestOrder,
                    ),
                ).to.be.revertedWith('IexecPocoMock: Failed to sponsorMatchOrdersBoost');
            });
        });
    });

    describe('Claim', async function () {
        const voucherMatchOrders = async () =>
            await voucher
                .matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder)
                .then((tx: any) => tx.wait());

        const voucherMatchOrdersBoost = async () =>
            await voucher
                .matchOrdersBoost(appOrder, datasetOrder, workerpoolOrder, requestOrder)
                .then((tx: any) => tx.wait());

        const claim = () => voucher.claim(taskId);
        const claimBoost = () => voucher.claimBoost(dealId, taskIndex);

        describe('Should claim task when deal is fully sponsored', async function () {
            it('Classic', async () => await runTest(voucherMatchOrders, claim));
            it('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                await addEligibleAssets([app, dataset, workerpool]);
                await matchOrdersBoostOrClassic();
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherRlcBalance: voucherRlcBalancePreClaim,
                    requesterRlcBalance: requesterRlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've fully sponsored the deal.
                const dealSponsoredAmount = await voucher.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice);
                expect(taskSponsoredAmount).to.be.equal(taskPrice);

                // Claim task
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .withArgs(voucherAddress, taskSponsoredAmount)
                    .to.emit(voucher, 'TaskClaimedWithVoucher')
                    .withArgs(taskId);
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherRlcBalance: voucherRlcBalancePostClaim,
                    requesterRlcBalance: requesterRlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and RLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskPrice)
                    .to.be.equal(voucherRlcBalancePostClaim)
                    .to.be.equal(voucherRlcBalancePreClaim + taskPrice);
                // Requester balance should stay unchanged.
                expect(requesterRlcBalancePostClaim).to.be.equal(requesterRlcBalancePreClaim);
                // Sponsored amount should decrease
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount - taskPrice,
                );
            }
        });

        describe('Should claim task when deal is partially sponsored', async () => {
            it('Classic', async () => await runTest(voucherMatchOrders, claim));
            it('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                await addEligibleAssets([app, dataset]); // workerpool not eligible.
                const dealNonSponsoredAmount = workerpoolPrice;
                const taskNonSponsoredAmount = dealNonSponsoredAmount / volume;
                // Deposit non-sponsored amount for requester and approve voucher.
                await iexecPocoInstance
                    .transfer(requester, dealNonSponsoredAmount)
                    .then((tx) => tx.wait());
                await iexecPocoInstance
                    .connect(requester)
                    .approve(voucherAddress, dealNonSponsoredAmount)
                    .then((tx) => tx.wait());
                // Match orders
                await matchOrdersBoostOrClassic();
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherRlcBalance: voucherRlcBalancePreClaim,
                    requesterRlcBalance: requesterRlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've partially sponsored the deal.
                const dealSponsoredAmount = await voucher.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice - dealNonSponsoredAmount);
                expect(taskSponsoredAmount).to.be.equal(taskPrice - taskNonSponsoredAmount);

                // Claim
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .withArgs(voucherAddress, taskSponsoredAmount)
                    .to.emit(voucher, 'TaskClaimedWithVoucher')
                    .withArgs(taskId);
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherRlcBalance: voucherRlcBalancePostClaim,
                    requesterRlcBalance: requesterRlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and RLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskSponsoredAmount)
                    .to.be.equal(voucherRlcBalancePostClaim)
                    .to.be.equal(voucherRlcBalancePreClaim + taskSponsoredAmount);
                // Requester balance should increase.
                expect(requesterRlcBalancePostClaim).to.be.equal(
                    requesterRlcBalancePreClaim + taskNonSponsoredAmount,
                );
                // Sponsored amount should decrease
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount - taskSponsoredAmount,
                );
            }
        });

        // TODO when volume can be > 1
        describe('Should claim task when deal is partially sponsored and sponsored amount is not divisible by volume', async () => {
            it.skip('Classic', async () => await runTest(voucherMatchOrders, claim));
            it.skip('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                // Use another voucher with a small amount of credits.
                const smallVoucherValue = 1n;
                voucher = await voucherHubAsVoucherCreationManager
                    .createVoucher(voucherOwner2, voucherType, smallVoucherValue)
                    .then((tx) => tx.wait())
                    .then(() => voucherHub.getVoucher(voucherOwner1))
                    .then((voucherAddress) =>
                        Voucher__factory.connect(voucherAddress, voucherOwner1),
                    );
            }
        });

        describe('Should claim task when deal is not sponsored but matched by voucher', async () => {
            it('Classic', async () => await runTest(voucherMatchOrders, claim));
            it('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                // Assets are not eligible.
                // Deposit dealPrice amount for requester and approve voucher.
                await iexecPocoInstance
                    .transfer(requester, dealPrice)
                    .then((tx) => tx.wait())
                    .then(() =>
                        iexecPocoInstance.connect(requester).approve(voucherAddress, dealPrice),
                    )
                    .then((tx) => tx.wait());
                // Match orders
                await matchOrdersBoostOrClassic();
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherRlcBalance: voucherRlcBalancePreClaim,
                    requesterRlcBalance: requesterRlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should not sponsor the deal.
                const dealSponsoredAmount = await voucher.getSponsoredAmount(dealId);
                expect(dealSponsoredAmount).to.be.equal(0);

                // Claim
                await expect(claimBoostOrClassic())
                    .to.emit(voucher, 'TaskClaimedWithVoucher')
                    .withArgs(taskId)
                    .and.to.not.emit(voucherHub, 'VoucherRefunded');
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherRlcBalance: voucherRlcBalancePostClaim,
                    requesterRlcBalance: requesterRlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and RLC balances should stay unchanged.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim)
                    .to.be.equal(voucherRlcBalancePostClaim)
                    .to.be.equal(voucherRlcBalancePreClaim);
                // Requester balance should increase.
                expect(requesterRlcBalancePostClaim).to.be.equal(
                    requesterRlcBalancePreClaim + taskPrice,
                );
                // Sponsored amount should stay unchanged.
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(0);
            }
        });

        describe('Should claim task when deal is not matched by voucher', async () => {
            // Match orders directly on PoCo by requester.
            const pocoMatchOrders = async () =>
                await iexecPocoInstance
                    .connect(requester)
                    .sponsorMatchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder)
                    .then((tx) => tx.wait());

            const pocoMatchOrdersBoost = async () =>
                await iexecPocoInstance
                    .connect(requester)
                    .sponsorMatchOrdersBoost(appOrder, datasetOrder, workerpoolOrder, requestOrder)
                    .then((tx) => tx.wait());

            it('Classic', async () => await runTest(pocoMatchOrders, claim));
            it('Boost', async () => await runTest(pocoMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                // Assets are not eligible.
                // Deposit dealPrice amount for requester.
                await iexecPocoInstance.transfer(requester, dealPrice).then((tx) => tx.wait());
                // Match orders.
                await matchOrdersBoostOrClassic();
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherRlcBalance: voucherRlcBalancePreClaim,
                    requesterRlcBalance: requesterRlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should not sponsor the deal.
                const dealSponsoredAmount = await voucher.getSponsoredAmount(dealId);
                expect(dealSponsoredAmount).to.be.equal(0);

                // Claim
                await expect(claimBoostOrClassic())
                    .to.emit(voucher, 'TaskClaimedWithVoucher')
                    .withArgs(taskId)
                    .and.to.not.emit(voucherHub, 'VoucherRefunded');
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherRlcBalance: voucherRlcBalancePostClaim,
                    requesterRlcBalance: requesterRlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and RLC balances should stay unchanged.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim)
                    .to.be.equal(voucherRlcBalancePostClaim)
                    .to.be.equal(voucherRlcBalancePreClaim);
                // Requester balance should increase.
                expect(requesterRlcBalancePostClaim).to.be.equal(
                    requesterRlcBalancePreClaim + taskPrice,
                );
                // Sponsored amount should stay unchanged.
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(dealSponsoredAmount);
            }
        });

        describe('Should claim task when already claimed on PoCo', async () => {
            const pocoClaim = () => iexecPocoInstance.claim(taskId);
            const pocoClaimBoost = () => iexecPocoInstance.claimBoost(dealId, taskIndex);

            it('Classic', async () => await runTest(voucherMatchOrders, pocoClaim, claim));
            it('Boost', async () =>
                await runTest(voucherMatchOrdersBoost, pocoClaimBoost, claimBoost));

            async function runTest(
                matchOrdersBoostOrClassic: any,
                pocoClaimBoostOrClassic: any,
                claimBoostOrClassic: any,
            ) {
                await addEligibleAssets([app, dataset, workerpool]);
                await matchOrdersBoostOrClassic();
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherRlcBalance: voucherRlcBalancePreClaim,
                    requesterRlcBalance: requesterRlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've fully sponsored the deal.
                const dealSponsoredAmount = await voucher.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice);
                expect(taskSponsoredAmount).to.be.equal(taskPrice);

                // Claim task on PoCo.
                await pocoClaimBoostOrClassic();
                // Claim task on voucher
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .withArgs(voucherAddress, taskSponsoredAmount)
                    .to.emit(voucher, 'TaskClaimedWithVoucher')
                    .withArgs(taskId);
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherRlcBalance: voucherRlcBalancePostClaim,
                    requesterRlcBalance: requesterRlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and RLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskPrice)
                    .to.be.equal(voucherRlcBalancePostClaim)
                    .to.be.equal(voucherRlcBalancePreClaim + taskPrice);
                // Requester balance should stay unchanged.
                expect(requesterRlcBalancePostClaim).to.be.equal(requesterRlcBalancePreClaim);
                // Sponsored amount should decrease
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount - taskSponsoredAmount,
                );
            }
        });

        describe('Should not claim task twice', async () => {
            it('Classic', async () => await runTest(voucherMatchOrders, claim));
            it('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                await addEligibleAssets([app, dataset, workerpool]);
                await matchOrdersBoostOrClassic();
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherRlcBalance: voucherRlcBalancePreClaim,
                    requesterRlcBalance: requesterRlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've fully sponsored the deal.
                const dealSponsoredAmount = await voucher.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice);
                expect(taskSponsoredAmount).to.be.equal(taskPrice);

                // Claim task
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .withArgs(voucherAddress, taskSponsoredAmount)
                    .to.emit(voucher, 'TaskClaimedWithVoucher')
                    .withArgs(taskId);
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherRlcBalance: voucherRlcBalancePostClaim,
                    requesterRlcBalance: requesterRlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and RLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskPrice)
                    .to.be.equal(voucherRlcBalancePostClaim)
                    .to.be.equal(voucherRlcBalancePreClaim + taskPrice);
                // Requester balance should stay unchanged.
                expect(requesterRlcBalancePostClaim).to.be.equal(requesterRlcBalancePreClaim);

                // Second claim should revert.
                await expect(claimBoostOrClassic()).to.be.revertedWith(
                    'Voucher: task already claimed',
                );
            }
        });

        describe('Should not claim task when deal not found', async () => {
            it('Classic', async function () {
                await expect(voucher.claim(taskId)).to.be.revertedWith('Voucher: deal not found');
            });

            it('Boost', async function () {
                await expect(voucher.claimBoost(dealId, taskIndex)).to.be.revertedWith(
                    'Voucher: boost deal not found',
                );
            });
        });

        describe('Should not claim task when task not found', async () => {
            it('Classic', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrders();
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                // Claim task
                const badTaskIndex = 99;
                const badTaskId = ethers.keccak256(
                    ethers.AbiCoder.defaultAbiCoder().encode(
                        ['bytes32', 'uint256'],
                        [dealId, badTaskIndex],
                    ),
                );
                // await expect(iexecPocoInstance.claim(badTaskId)).to.be.revertedWithoutReason();
                await expect(voucher.claim(badTaskId)).to.be.revertedWithoutReason();
            });

            it('Boost', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrdersBoost();
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                // Claim task
                const badTaskIndex = 99;
                await expect(voucher.claimBoost(dealId, badTaskIndex)).to.be.revertedWith(
                    'PocoBoost: Unknown task',
                );
            });
        });

        describe('Should not claim task when PoCo claim reverts', async () => {
            it('Classic', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrders();
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                await iexecPocoInstance.willRevertOnClaim().then((tx) => tx.wait());
                // Claim task
                await expect(voucher.claim(taskId)).to.be.revertedWith(
                    'IexecPocoMock: Failed to claim',
                );
            });
            it('Boost', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrdersBoost();
                expect(await voucher.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                await iexecPocoInstance.willRevertOnClaim().then((tx) => tx.wait());
                // Claim task
                await expect(voucher.claimBoost(dealId, taskIndex)).to.be.revertedWith(
                    'IexecPocoMock: Failed to claim boost',
                );
            });
        });
    });

    async function addEligibleAssets(assets: string[]) {
        for (const asset of assets) {
            await voucherHubAsAssetEligibilityManager
                .addEligibleAsset(voucherType, asset)
                .then((tx) => tx.wait());
        }
    }

    async function getVoucherAndRequesterBalances() {
        const voucherCreditBalance = await voucher.getBalance();
        const voucherRlcBalance = await iexecPocoInstance.balanceOf(voucherAddress);
        const requesterRlcBalance = await iexecPocoInstance.balanceOf(requester.address);
        return {
            voucherCreditBalance,
            voucherRlcBalance,
            requesterRlcBalance,
        };
    }
});
