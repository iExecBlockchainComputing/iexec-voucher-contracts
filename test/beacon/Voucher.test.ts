// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ContractTransactionReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { deployAll } from '../../deploy/deploy';
import * as commonUtils from '../../scripts/common';
import * as voucherUtils from '../../scripts/voucherUtils';
import {
    IexecLibOrders_v5,
    IexecPocoMock,
    IexecPocoMock__factory,
    UpgradeableBeacon,
    UpgradeableBeacon__factory,
    Voucher,
    VoucherHub,
    VoucherHub__factory,
    VoucherProxy__factory,
    Voucher__factory,
} from '../../typechain-types';
import { random } from '../utils/address-utils';
import { PocoMode, TaskStatusEnum, createMockOrder, getTaskId } from '../utils/poco-utils';
import { FAIL_TYPES } from '../utils/test-utils';

const voucherType = 0;
const duration = 3600;
const description = 'Early Access';
const voucherValue = 100n;
const app = random();
const dataset = random();
const workerpool = random();
const appPrice = 1n;
const datasetPrice = 2n;
const workerpoolPrice = 3n;
const volume = 3n;
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
        manager,
        minter,
        voucherOwner1,
        voucherOwner2,
        requester,
        anyone,
    ]: SignerWithAddress[] = [];
    let beacon: UpgradeableBeacon;
    let iexecPoco: string;
    let iexecPocoInstance: IexecPocoMock;
    let [voucherHub, voucherHubAsMinter, voucherHubAsManager]: VoucherHub[] = [];
    let voucherHubAddress: string;
    let [voucherAsOwner, voucherAsAnyone]: Voucher[] = [];
    let voucherAddress: string;
    let voucherCreationTxReceipt: ContractTransactionReceipt;
    let [appOrder, datasetOrder, workerpoolOrder, requestOrder]: ReturnType<
        typeof createMockOrder
    >[] = [];

    beforeEach('Deploy', async () => {
        await loadFixture(deployFixture);
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
    });

    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        [admin, manager, minter, voucherOwner1, voucherOwner2, requester, anyone] =
            await ethers.getSigners();
        // Deploy PoCo mock and VoucherHub.
        iexecPocoInstance = await new IexecPocoMock__factory()
            .connect(admin)
            .deploy()
            .then((x) => x.waitForDeployment());
        iexecPoco = await iexecPocoInstance.getAddress();
        let voucherBeaconAddress;
        ({ voucherHubAddress, voucherBeaconAddress } = await deployAll(
            admin.address,
            manager.address,
            minter.address,
            iexecPoco,
        ));
        voucherHub = VoucherHub__factory.connect(voucherHubAddress, anyone);
        beacon = UpgradeableBeacon__factory.connect(voucherBeaconAddress, anyone);
        voucherHubAsMinter = voucherHub.connect(minter);
        voucherHubAsManager = voucherHub.connect(manager);
        voucherHubAddress = await voucherHub.getAddress();
        // Fund VoucherHub with SRLCs.
        await iexecPocoInstance
            .transfer(await voucherHub.getAddress(), initVoucherHubBalance)
            .then((tx) => tx.wait());
        // Create one voucher.
        await voucherHubAsManager.createVoucherType(description, duration);
        voucherAddress = await voucherHubAsMinter
            .createVoucher(voucherOwner1, voucherType, voucherValue)
            .then((tx) => tx.wait())
            .then((tx) => (voucherCreationTxReceipt = tx!))
            .then(() => voucherHub.getVoucher(voucherOwner1));
        voucherAsOwner = Voucher__factory.connect(voucherAddress, voucherOwner1);
        voucherAsAnyone = voucherAsOwner.connect(anyone);
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
            await voucherHubAsManager
                .createVoucherType('Another description', anotherDuration)
                .then((tx) => tx.wait());
            const createVoucherReceipt2 = await voucherHubAsMinter
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
            await voucher1_V2.connect(anyone).initializeV2(1);
            await voucher2_V2.connect(anyone).initializeV2(2);

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

    describe('Voucher expiration', function () {
        it('Should get expiration', async function () {
            const expiration = 42; // arbitrary value
            const voucher = await new VoucherProxy__factory(anyone)
                .deploy(await beacon.getAddress())
                .then((tx) => tx.waitForDeployment())
                .then((proxy) => proxy.getAddress())
                .then((address) => Voucher__factory.connect(address, anyone));
            await voucher.initialize(anyone.address, voucherHub, expiration, voucherType);
            expect(await voucher.getExpiration()).equal(expiration);
        });

        it('Should set expiration', async function () {
            const voucherHubSigner = await ethers.getImpersonatedSigner(
                await voucherHub.getAddress(),
            );
            const expirationBefore = await voucherAsAnyone.getExpiration();
            const expirationAfter = 13; // arbitrary value
            await expect(
                await voucherAsAnyone.connect(voucherHubSigner).setExpiration(expirationAfter),
            )
                .to.emit(voucherAsAnyone, 'ExpirationUpdated')
                .withArgs(expirationAfter);
            expect(await voucherAsAnyone.getExpiration())
                .equal(expirationAfter)
                .not.equal(expirationBefore);
        });

        it('Should not set expiration when sender is not authorized', async function () {
            await expect(
                voucherAsAnyone.setExpiration(789), // any expiration value is fine
            ).to.be.revertedWith('Voucher: sender is not VoucherHub');
        });
    });

    describe('Authorization', function () {
        it('Should authorize an account', async function () {
            expect(await voucherAsOwner.isAccountAuthorized(anyone.address)).to.be.false;
            expect(await voucherAsOwner.authorizeAccount(anyone.address))
                .to.emit(voucherAsOwner, 'AccountAuthorized')
                .withArgs(anyone.address);
            // Check if the account is authorized
            expect(await voucherAsOwner.isAccountAuthorized(anyone.address)).to.be.true;
        });

        it('Should unauthorize an account', async function () {
            await voucherAsOwner.authorizeAccount(anyone.address).then((tx) => tx.wait());
            expect(await voucherAsOwner.isAccountAuthorized(anyone.address)).to.be.true;
            expect(await voucherAsOwner.unauthorizeAccount(anyone.address))
                .to.emit(voucherAsOwner, 'AccountUnauthorized')
                .withArgs(anyone.address);
            // Check if the account is unauthorized
            expect(await voucherAsOwner.isAccountAuthorized(anyone.address)).to.be.false;
        });

        it('Should not authorize account if sender is not the owner', async function () {
            await expect(voucherAsAnyone.authorizeAccount(anyone.address)).to.be.revertedWith(
                'Voucher: sender is not owner',
            );
        });

        it('Should not unauthorize account if sender is not the owner', async function () {
            await voucherAsOwner.authorizeAccount(anyone.address).then((tx) => tx.wait());
            expect(await voucherAsOwner.isAccountAuthorized(anyone.address)).to.be.true;
            // unauthorize the account
            await expect(voucherAsAnyone.unauthorizeAccount(anyone.address)).to.be.revertedWith(
                'Voucher: sender is not owner',
            );
            // Check that the state of mapping is not modified from.
            expect(await voucherAsOwner.isAccountAuthorized(anyone.address)).to.be.true;
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
            iexecPocoInstance.balanceOf(voucherAsOwner.getAddress());
        const getRequesterBalanceOnIexecPoco = () =>
            iexecPocoInstance.balanceOf(requester.getAddress());

        const voucherMatchOrders = async (
            appOrder: IexecLibOrders_v5.AppOrderStruct,
            datasetOrder: IexecLibOrders_v5.DatasetOrderStruct,
            workerpoolOrder: IexecLibOrders_v5.WorkerpoolOrderStruct,
            requestOrder: IexecLibOrders_v5.RequestOrderStruct,
        ) =>
            await voucherAsOwner.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder);
        const voucherMatchOrdersBoost = async (
            appOrder: IexecLibOrders_v5.AppOrderStruct,
            datasetOrder: IexecLibOrders_v5.DatasetOrderStruct,
            workerpoolOrder: IexecLibOrders_v5.WorkerpoolOrderStruct,
            requestOrder: IexecLibOrders_v5.RequestOrderStruct,
        ) =>
            await voucherAsOwner.matchOrdersBoost(
                appOrder,
                datasetOrder,
                workerpoolOrder,
                requestOrder,
            );
        it('Should match orders with full sponsored amount', async () => {
            await addEligibleAssets([app, dataset, workerpool]);
            const voucherInitialCreditBalance = await voucherAsOwner.getBalance();
            const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
            const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

            expect(
                await voucherAsOwner.matchOrders.staticCall(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.equal(dealId);
            await expect(
                voucherAsOwner.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            )
                .to.emit(voucherAsOwner, 'OrdersMatchedWithVoucher')
                .withArgs(dealId);
            expect(await voucherAsOwner.getBalance())
                .to.be.equal(voucherInitialCreditBalance - dealPrice)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance - dealPrice);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(requesterInitialSrlcBalance);
            expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
        });

        it('Should match orders with partial sponsored amount', async () => {
            await addEligibleAssets([app, dataset]); // not workerpool.
            // Deposit non-sponsored amount in requester's account and approve voucher.
            const dealSponsoredAmount = (appPrice + datasetPrice) * volume;
            const dealNonSponsoredAmount = dealPrice - dealSponsoredAmount;
            await iexecPocoInstance
                .transfer(requester, dealSponsoredAmount)
                .then((tx) => tx.wait());
            // Allow voucher to spend non-sponsored amount.
            await iexecPocoInstance
                .connect(requester)
                .approve(voucherAddress, dealPrice)
                .then((tx) => tx.wait());
            // Save initial balances.
            const voucherInitialCreditBalance = await voucherAsOwner.getBalance();
            const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
            const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

            expect(
                await voucherAsOwner.matchOrders.staticCall(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.equal(dealId);
            await expect(
                voucherAsOwner.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            )
                .to.emit(voucherAsOwner, 'OrdersMatchedWithVoucher')
                .withArgs(dealId);
            expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(
                dealSponsoredAmount,
            );
            expect(await voucherAsOwner.getBalance())
                .to.be.equal(voucherInitialCreditBalance - dealSponsoredAmount)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance - dealSponsoredAmount);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                requesterInitialSrlcBalance - dealNonSponsoredAmount,
            );
        });

        it('Should match orders with full non-sponsored amount', async () => {
            const voucherInitialCreditBalance = await voucherAsOwner.getBalance();
            const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
            expect(dealPrice).to.be.greaterThan(0); // just make sure the deal will not be free
            // Deposit in iExec account of requester
            await iexecPocoInstance.transfer(requester, dealPrice).then((tx) => tx.wait());
            // Allow voucher to spend non-sponsored amount
            await iexecPocoInstance
                .connect(requester)
                .approve(await voucherAsOwner.getAddress(), dealPrice)
                .then((tx) => tx.wait());
            const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

            await expect(
                voucherAsOwner.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            )
                .to.emit(iexecPocoInstance, 'Transfer')
                .withArgs(requester.address, await voucherAsOwner.getAddress(), dealPrice)
                .to.emit(voucherAsOwner, 'OrdersMatchedWithVoucher');
            expect(await voucherAsOwner.getBalance())
                .to.be.equal(voucherInitialCreditBalance)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                requesterInitialSrlcBalance - dealPrice,
            );
            expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(0);
        });

        it('Should match orders with an authorized account', async () => {
            await addEligibleAssets([app, dataset, workerpool]);
            await voucherAsOwner.authorizeAccount(anyone.address).then((tx) => tx.wait());
            await expect(
                voucherAsAnyone.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            )
                .to.emit(voucherAsOwner, 'OrdersMatchedWithVoucher')
                .withArgs(dealId);
        });

        it('Should not match orders when sender is not allowed', async () => {
            await expect(
                voucherAsAnyone.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            ).to.be.revertedWith('Voucher: sender is not authorized');
        });

        it('Should not match orders when voucher is expired', async () => {
            const expirationDate = await voucherAsOwner.getExpiration();
            await time.setNextBlockTimestamp(expirationDate);
            await expect(
                voucherAsOwner.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            ).to.be.revertedWith('Voucher: voucher is expired');
        });

        it('Should match orders without dataset', async () => {
            const mockOrder = createMockOrder();
            const appOrder = { ...mockOrder, app: app, appprice: appPrice, volume: volume };
            const workerpoolOrder = {
                ...mockOrder,
                workerpool: workerpool,
                workerpoolprice: workerpoolPrice,
                volume: volume,
            };
            const requestOrder = { ...mockOrder, requester: requester.address, volume: volume };
            const datasetOrder = {
                ...mockOrder,
            };
            const dealPriceNoDataset = (appPrice + workerpoolPrice) * volume;

            await addEligibleAssets([app, dataset, workerpool]);
            const voucherInitialCreditBalance = await voucherAsOwner.getBalance();
            const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
            const requesterInitialSrlcBalance = await getRequesterBalanceOnIexecPoco();

            expect(
                await voucherAsOwner.matchOrders.staticCall(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.equal(dealId);
            await expect(
                voucherAsOwner.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            )
                .to.emit(voucherAsOwner, 'OrdersMatchedWithVoucher')
                .withArgs(dealId);
            expect(await voucherAsOwner.getBalance())
                .to.be.equal(voucherInitialCreditBalance - dealPriceNoDataset)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance - dealPriceNoDataset);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(requesterInitialSrlcBalance);
            expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(dealPriceNoDataset);
        });

        it('Should not match orders when non-sponsored amount is not transferable', async () => {
            await expect(
                voucherAsOwner.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder),
            ).to.be.revertedWith('Voucher: Transfer of non-sponsored amount failed');
        });

        it('Should not match orders when iExec Poco matching fails', async () => {
            await iexecPocoInstance.willRevertOnSponsorMatchOrders().then((tx) => tx.wait());

            await expect(
                voucherAsOwner.matchOrders(
                    { ...appOrder, appprice: 0 },
                    { ...datasetOrder, datasetprice: 0 },
                    { ...workerpoolOrder, workerpoolprice: 0 },
                    requestOrder,
                ),
            ).to.be.revertedWith('IexecPocoMock: Failed to sponsorMatchOrders');
        });

        describe('Match orders boost', async function () {
            it('Should match orders boost with full sponsored amount', async () => {
                const sponsoredValue = (appPrice + datasetPrice + workerpoolPrice) * volume;
                await addEligibleAssets([app, dataset, workerpool]);
                const voucherInitialCreditBalance = await voucherAsOwner.getBalance();
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
                    .to.emit(voucherAsOwner, 'OrdersBoostMatchedWithVoucher')
                    .withArgs(dealId)
                    .to.emit(voucherHub, 'VoucherDebited')
                    .withArgs(await voucherAsOwner.getAddress(), sponsoredValue)
                    .to.emit(voucherHub, 'Transfer')
                    .withArgs(
                        await voucherAsOwner.getAddress(),
                        ethers.ZeroAddress,
                        sponsoredValue,
                    );
                expect(await voucherAsOwner.getBalance())
                    .to.be.equal(voucherInitialCreditBalance - dealPrice)
                    .to.be.equal(await getVoucherBalanceOnIexecPoco())
                    .to.be.equal(voucherInitialSrlcBalance - dealPrice);
                expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                    requesterInitialSrlcBalance,
                );
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
            });

            it('Should match orders boost with full non-sponsored amount', async () => {
                const voucherInitialCreditBalance = await voucherAsOwner.getBalance();
                const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
                expect(dealPrice).to.be.greaterThan(0); // just make sure the deal will not be free
                // Deposit in iExec account of requester
                await iexecPocoInstance.transfer(requester, dealPrice).then((tx) => tx.wait());
                // Allow voucher to spend non-sponsored amount
                await iexecPocoInstance
                    .connect(requester)
                    .approve(await voucherAsOwner.getAddress(), dealPrice)
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
                    .to.emit(voucherAsOwner, 'OrdersBoostMatchedWithVoucher')
                    .to.emit(iexecPocoInstance, 'Transfer')
                    .withArgs(requester.address, await voucherAsOwner.getAddress(), dealPrice);
                expect(await voucherAsOwner.getBalance())
                    .to.be.equal(voucherInitialCreditBalance)
                    .to.be.equal(await getVoucherBalanceOnIexecPoco())
                    .to.be.equal(voucherInitialSrlcBalance);
                expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                    requesterInitialSrlcBalance - dealPrice,
                );
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(0);
            });

            it('Should match orders boost with partial sponsored amount', async () => {
                const sponsoredValue = (datasetPrice + workerpoolPrice) * volume;
                const noSponsoredValue = appPrice * volume; // app wont be eligible for sponsoring
                await addEligibleAssets([dataset, workerpool]);
                const voucherInitialCreditBalance = await voucherAsOwner.getBalance();
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
                    .approve(await voucherAsOwner.getAddress(), noSponsoredValue)
                    .then((tx) => tx.wait());

                await expect(
                    voucherAsOwner.matchOrdersBoost(
                        appOrder,
                        datasetOrder,
                        workerpoolOrder,
                        requestOrder,
                    ),
                )
                    .to.emit(voucherAsOwner, 'OrdersBoostMatchedWithVoucher')
                    .withArgs(dealId)
                    .to.emit(iexecPocoInstance, 'Transfer')
                    .withArgs(
                        requester.address,
                        await voucherAsOwner.getAddress(),
                        dealPrice - sponsoredValue,
                    )
                    .to.emit(voucherHub, 'VoucherDebited')
                    .withArgs(await voucherAsOwner.getAddress(), sponsoredValue)
                    .to.emit(voucherHub, 'Transfer')
                    .withArgs(
                        await voucherAsOwner.getAddress(),
                        ethers.ZeroAddress,
                        sponsoredValue,
                    );
                expect(await voucherAsOwner.getBalance())
                    .to.be.equal(voucherInitialCreditBalance - sponsoredValue)
                    .to.be.equal(await getVoucherBalanceOnIexecPoco())
                    .to.be.equal(voucherInitialSrlcBalance - sponsoredValue);
                expect(await getRequesterBalanceOnIexecPoco())
                    .to.be.equal(requesterDeposietedSrlcBalance - noSponsoredValue)
                    .to.be.equal(requesterInitialSrlcBalance);
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(sponsoredValue);
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
                    .to.emit(voucherAsOwner, 'OrdersBoostMatchedWithVoucher')
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
                const expirationDate = await voucherAsOwner.getExpiration();
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
                ).to.be.revertedWith('Voucher: Transfer of non-sponsored amount failed');
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

            //TODO Refactor other tests match orders to both Classic and Boost
            describe('Should not match orders when SRLC transfer fails', async () => {
                it('Classic', async () => await runTest(voucherMatchOrders));
                it('Boost', async () => await runTest(voucherMatchOrdersBoost));

                async function runTest(matchOrdersBoostOrClassic: any) {
                    const noSponsoredValue = appPrice * volume;
                    await addEligibleAssets([dataset, workerpool]);
                    await iexecPocoInstance
                        .transfer(requester, noSponsoredValue)
                        .then((tx) => tx.wait());

                    await iexecPocoInstance
                        .connect(requester)
                        .approve(voucherAddress, noSponsoredValue)
                        .then((tx) => tx.wait());
                    for (const failType of FAIL_TYPES) {
                        await iexecPocoInstance
                            .willFailOnTransferFrom(failType)
                            .then((tx) => tx.wait());
                        await expect(
                            matchOrdersBoostOrClassic(
                                appOrder,
                                datasetOrder,
                                workerpoolOrder,
                                requestOrder,
                            ),
                        ).to.be.revertedWith('Voucher: Transfer of non-sponsored amount failed');
                    }
                }
            });
        });
    });

    describe('Claim', async function () {
        const voucherMatchOrders = async () =>
            await voucherAsOwner
                .matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder)
                .then((tx: any) => tx.wait());

        const voucherMatchOrdersBoost = async () =>
            await voucherAsOwner
                .matchOrdersBoost(appOrder, datasetOrder, workerpoolOrder, requestOrder)
                .then((tx: any) => tx.wait());

        const claim = () => voucherAsOwner.claim(taskId);
        const claimBoost = () => voucherAsOwner.claimBoost(dealId, taskIndex);

        describe('Should claim task when deal is fully sponsored', async function () {
            it('Classic', async () => await runTest(voucherMatchOrders, claim));
            it('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                await addEligibleAssets([app, dataset, workerpool]);
                await matchOrdersBoostOrClassic();
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherSrlcBalance: voucherSrlcBalancePreClaim,
                    requesterSrlcBalance: requesterSrlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've fully sponsored the deal.
                const dealSponsoredAmount = await voucherAsOwner.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice);
                expect(taskSponsoredAmount).to.be.equal(taskPrice);
                // Task should not be marked as refunded before claim
                expect(await voucherAsOwner.isRefundedTask(taskId)).to.be.false;

                // Claim task
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .withArgs(voucherAddress, taskSponsoredAmount)
                    .to.emit(voucherAsOwner, 'TaskClaimedWithVoucher')
                    .withArgs(taskId);
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherSrlcBalance: voucherSrlcBalancePostClaim,
                    requesterSrlcBalance: requesterSrlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and SRLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskPrice)
                    .to.be.equal(voucherSrlcBalancePostClaim)
                    .to.be.equal(voucherSrlcBalancePreClaim + taskPrice);
                // Requester balance should stay unchanged.
                expect(requesterSrlcBalancePostClaim).to.be.equal(requesterSrlcBalancePreClaim);
                // Sponsored amount should stay unchanged
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount,
                );
                // Task should be marked as refunded after claim
                expect(await voucherAsOwner.isRefundedTask(taskId)).to.be.true;
                // Check task status.
                expect((await iexecPocoInstance.viewTask(taskId)).status).to.equal(
                    TaskStatusEnum.FAILED,
                );
            }
        });

        describe('Should claim task when deal is partially sponsored', async () => {
            it('Classic', async () => await runTest(voucherMatchOrders, claim));
            it('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                await addEligibleAssets([app, dataset]); // workerpool not eligible.
                const dealNonSponsoredAmount = workerpoolPrice * volume;
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
                    voucherSrlcBalance: voucherSrlcBalancePreClaim,
                    requesterSrlcBalance: requesterSrlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've partially sponsored the deal.
                const dealSponsoredAmount = await voucherAsOwner.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice - dealNonSponsoredAmount);
                expect(taskSponsoredAmount).to.be.equal(taskPrice - taskNonSponsoredAmount);

                // Claim
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .withArgs(voucherAddress, taskSponsoredAmount)
                    .to.emit(voucherAsOwner, 'TaskClaimedWithVoucher');
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherSrlcBalance: voucherSrlcBalancePostClaim,
                    requesterSrlcBalance: requesterSrlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and SRLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskSponsoredAmount)
                    .to.be.equal(voucherSrlcBalancePostClaim)
                    .to.be.equal(voucherSrlcBalancePreClaim + taskSponsoredAmount);
                // Requester balance should increase.
                expect(requesterSrlcBalancePostClaim).to.be.equal(
                    requesterSrlcBalancePreClaim + taskNonSponsoredAmount,
                );
                // Sponsored amount should stay unchanged
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount,
                );
            }
        });

        describe('Should claim task when deal is partially sponsored and sponsored amount is reduced to make it divisible by volume', async () => {
            it('Classic', async () => await runTest(PocoMode.CLASSIC));
            it('Boost', async () => await runTest(PocoMode.BOOST));

            async function runTest(pocoMode: PocoMode) {
                await addEligibleAssets([app, dataset, workerpool]);
                const volume = 17n;
                for (const order of [appOrder, datasetOrder, workerpoolOrder, requestOrder]) {
                    order.volume = volume;
                }
                const dealPrice = taskPrice * volume;
                let dealSponsorableAmount = voucherValue; // dealPrice > voucherValue
                // Make sure dealSponsorableAmount is not divisible by volume
                expect(dealSponsorableAmount % volume).greaterThan(0);
                // Remove remainder to get expected dealSponsoredAmount
                let dealSponsoredAmount = dealSponsorableAmount - (dealSponsorableAmount % volume);
                const dealNonSponsoredAmount = dealPrice - dealSponsoredAmount;
                expect(dealSponsoredAmount % volume).equal(0); // Both amounts should be
                expect(dealNonSponsoredAmount % volume).equal(0); // divisible by volume
                // Deposit non-sponsored amount for requester and approve voucher.
                await iexecPocoInstance
                    .transfer(requester, dealNonSponsoredAmount)
                    .then((tx) => tx.wait());
                await iexecPocoInstance
                    .connect(requester)
                    .approve(voucherAddress, dealNonSponsoredAmount)
                    .then((tx) => tx.wait());
                const isBoost = pocoMode == PocoMode.BOOST;
                await (isBoost ? voucherMatchOrdersBoost() : voucherMatchOrders());
                const {
                    voucherCreditBalance: voucherCreditBalancePreClaim,
                    voucherSrlcBalance: voucherSrlcBalancePreClaim,
                    requesterSrlcBalance: requesterSrlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                expect(voucherCreditBalancePreClaim).equal(voucherValue - dealSponsoredAmount);
                expect(requesterSrlcBalancePreClaim).equal(0);
                let taskSponsoredAmount = dealSponsoredAmount / volume;
                let taskNonSponsoredAmount = dealNonSponsoredAmount / volume;
                expect(taskSponsoredAmount).to.be.greaterThan(0); // Make sure both parties
                expect(taskNonSponsoredAmount).to.be.greaterThan(0); // will expect a refund
                for (let taskIndex = 0; taskIndex < volume; taskIndex++) {
                    await expect(
                        isBoost
                            ? voucherAsOwner.claimBoost(dealId, taskIndex)
                            : voucherAsOwner.claim(getTaskId(dealId, taskIndex)),
                    )
                        .to.emit(voucherHub, 'VoucherRefunded')
                        .withArgs(voucherAddress, taskSponsoredAmount)
                        .to.emit(iexecPocoInstance, 'Transfer')
                        .withArgs(voucherAddress, requester.address, taskNonSponsoredAmount)
                        .to.emit(voucherAsOwner, 'TaskClaimedWithVoucher');
                    const {
                        voucherCreditBalance,
                        voucherSrlcBalance: voucherSrlcBalance,
                        requesterSrlcBalance,
                    } = await getVoucherAndRequesterBalances();
                    const currentVolume = BigInt(taskIndex + 1);
                    expect(voucherCreditBalance)
                        .equal(voucherCreditBalancePreClaim + taskSponsoredAmount * currentVolume)
                        .equal(voucherSrlcBalance);
                    expect(requesterSrlcBalance).equal(
                        requesterSrlcBalancePreClaim + taskNonSponsoredAmount * currentVolume,
                    );
                }
                const {
                    voucherCreditBalance: voucherCreditBalanceAfter,
                    voucherSrlcBalance: voucherSrlcBalanceAfter,
                    requesterSrlcBalance: requesterSrlcBalanceAfter,
                } = await getVoucherAndRequesterBalances();
                expect(voucherCreditBalanceAfter)
                    .equal(voucherCreditBalancePreClaim + dealSponsoredAmount)
                    .equal(voucherSrlcBalanceAfter)
                    .equal(voucherSrlcBalancePreClaim + dealSponsoredAmount);
                expect(requesterSrlcBalanceAfter).equal(dealNonSponsoredAmount);
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
                    voucherSrlcBalance: voucherSrlcBalancePreClaim,
                    requesterSrlcBalance: requesterSrlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should not sponsor the deal.
                const dealSponsoredAmount = await voucherAsOwner.getSponsoredAmount(dealId);
                expect(dealSponsoredAmount).to.be.equal(0);

                // Claim
                await expect(claimBoostOrClassic())
                    .to.emit(voucherAsOwner, 'TaskClaimedWithVoucher')
                    .and.to.not.emit(voucherHub, 'VoucherRefunded');
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherSrlcBalance: voucherSrlcBalancePostClaim,
                    requesterSrlcBalance: requesterSrlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and SRLC balances should stay unchanged.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim)
                    .to.be.equal(voucherSrlcBalancePostClaim)
                    .to.be.equal(voucherSrlcBalancePreClaim);
                // Requester balance should increase.
                expect(requesterSrlcBalancePostClaim).to.be.equal(
                    requesterSrlcBalancePreClaim + taskPrice,
                );
                // Sponsored amount should stay unchanged.
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(0);
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
                    voucherSrlcBalance: voucherSrlcBalancePreClaim,
                    requesterSrlcBalance: requesterSrlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should not sponsor the deal.
                const dealSponsoredAmount = await voucherAsOwner.getSponsoredAmount(dealId);
                expect(dealSponsoredAmount).to.be.equal(0);

                // Claim
                await expect(claimBoostOrClassic())
                    .to.emit(voucherAsOwner, 'TaskClaimedWithVoucher')
                    .and.to.not.emit(voucherHub, 'VoucherRefunded');
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherSrlcBalance: voucherSrlcBalancePostClaim,
                    requesterSrlcBalance: requesterSrlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and SRLC balances should stay unchanged.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim)
                    .to.be.equal(voucherSrlcBalancePostClaim)
                    .to.be.equal(voucherSrlcBalancePreClaim);
                // Requester balance should increase.
                expect(requesterSrlcBalancePostClaim).to.be.equal(
                    requesterSrlcBalancePreClaim + taskPrice,
                );
                // Sponsored amount should stay unchanged.
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount,
                );
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
                    voucherSrlcBalance: voucherSrlcBalancePreClaim,
                    requesterSrlcBalance: requesterSrlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've fully sponsored the deal.
                const dealSponsoredAmount = await voucherAsOwner.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice);
                expect(taskSponsoredAmount).to.be.equal(taskPrice);

                // Claim task on PoCo.
                await pocoClaimBoostOrClassic();
                expect((await iexecPocoInstance.viewTask(taskId)).status).to.equal(
                    TaskStatusEnum.FAILED,
                );
                // Claim task on voucher
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .to.emit(voucherAsOwner, 'TaskClaimedWithVoucher');
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherSrlcBalance: voucherSrlcBalancePostClaim,
                    requesterSrlcBalance: requesterSrlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and SRLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskPrice)
                    .to.be.equal(voucherSrlcBalancePostClaim)
                    .to.be.equal(voucherSrlcBalancePreClaim + taskPrice);
                // Requester balance should stay unchanged.
                expect(requesterSrlcBalancePostClaim).to.be.equal(requesterSrlcBalancePreClaim);
                // Sponsored amount should stay unchanged
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount,
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
                    voucherSrlcBalance: voucherSrlcBalancePreClaim,
                    requesterSrlcBalance: requesterSrlcBalancePreClaim,
                } = await getVoucherAndRequesterBalances();
                // The voucher should've fully sponsored the deal.
                const dealSponsoredAmount = await voucherAsOwner.getSponsoredAmount(dealId);
                const taskSponsoredAmount = dealSponsoredAmount / volume;
                expect(dealSponsoredAmount).to.be.equal(dealPrice);
                expect(taskSponsoredAmount).to.be.equal(taskPrice);

                // Claim task
                await expect(claimBoostOrClassic())
                    .to.emit(voucherHub, 'VoucherRefunded')
                    .to.emit(voucherAsOwner, 'TaskClaimedWithVoucher');
                const {
                    voucherCreditBalance: voucherCreditBalancePostClaim,
                    voucherSrlcBalance: voucherSrlcBalancePostClaim,
                    requesterSrlcBalance: requesterSrlcBalancePostClaim,
                } = await getVoucherAndRequesterBalances();
                // Voucher credit and SRLC balances should increase while staying equal.
                expect(voucherCreditBalancePostClaim)
                    .to.be.equal(voucherCreditBalancePreClaim + taskPrice)
                    .to.be.equal(voucherSrlcBalancePostClaim)
                    .to.be.equal(voucherSrlcBalancePreClaim + taskPrice);
                // Requester balance should stay unchanged.
                expect(requesterSrlcBalancePostClaim).to.be.equal(requesterSrlcBalancePreClaim);
                // Sponsored amount should stay unchanged
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(
                    dealSponsoredAmount,
                );

                // Second claim should revert.
                await expect(claimBoostOrClassic()).to.be.revertedWith(
                    'Voucher: task already refunded',
                );
            }
        });

        describe('Should not claim task when deal not found', async () => {
            it('Classic', async function () {
                const badTaskId = ethers.randomBytes(32);
                await expect(voucherAsOwner.claim(badTaskId)).to.be.revertedWithoutReason();
            });

            it('Boost', async function () {
                const badDealId = ethers.randomBytes(32);
                await expect(voucherAsOwner.claimBoost(badDealId, taskIndex)).to.be.revertedWith(
                    'PocoBoost: Unknown task',
                );
            });
        });

        describe('Should not claim task when task not found', async () => {
            it('Classic', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrders();
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                // Claim task
                const badTaskIndex = 99;
                const badTaskId = getTaskId(dealId, badTaskIndex);
                await expect(voucherAsOwner.claim(badTaskId)).to.be.revertedWithoutReason();
            });

            it('Boost', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrdersBoost();
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                // Claim task
                const badTaskIndex = 99;
                await expect(voucherAsOwner.claimBoost(dealId, badTaskIndex)).to.be.revertedWith(
                    'PocoBoost: Unknown task',
                );
            });
        });

        describe('Should not claim task when PoCo claim reverts', async () => {
            it('Classic', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrders();
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                await iexecPocoInstance.willRevertOnClaim().then((tx) => tx.wait());
                // Claim task
                await expect(voucherAsOwner.claim(taskId)).to.be.revertedWith(
                    'IexecPocoMock: Failed to claim',
                );
            });
            it('Boost', async function () {
                await addEligibleAssets([app, dataset, workerpool]);
                await voucherMatchOrdersBoost();
                expect(await voucherAsOwner.getSponsoredAmount(dealId)).to.be.equal(dealPrice);
                await iexecPocoInstance.willRevertOnClaim().then((tx) => tx.wait());
                // Claim task
                await expect(voucherAsOwner.claimBoost(dealId, taskIndex)).to.be.revertedWith(
                    'IexecPocoMock: Failed to claim boost',
                );
            });
        });

        describe('Should not claim task when SLRC transfer fails', async () => {
            it('Classic', async () => await runTest(voucherMatchOrders, claim));
            it('Boost', async () => await runTest(voucherMatchOrdersBoost, claimBoost));

            async function runTest(matchOrdersBoostOrClassic: any, claimBoostOrClassic: any) {
                await addEligibleAssets([app, dataset]); // workerpool not eligible.
                const dealNonSponsoredAmount = workerpoolPrice * volume;
                // Deposit non-sponsored amount for requester and approve voucher.
                await iexecPocoInstance
                    .transfer(requester, dealNonSponsoredAmount)
                    .then((tx) => tx.wait());
                await iexecPocoInstance
                    .connect(requester)
                    .approve(voucherAddress, dealNonSponsoredAmount)
                    .then((tx) => tx.wait());
                await matchOrdersBoostOrClassic();
                for (const failType of FAIL_TYPES) {
                    await iexecPocoInstance.willFailOnTransfer(failType).then((tx) => tx.wait());
                    await expect(claimBoostOrClassic()).to.be.revertedWith(
                        'Voucher: transfer to requester failed',
                    );
                }
            }
        });
    });

    describe('Drain', async function () {
        it('Should drain SRLC balance of voucher', async function () {
            // Expire voucher
            const expirationDate = await voucherAsAnyone.getExpiration();
            await time.setNextBlockTimestamp(expirationDate + 100n); // after expiration
            // Drain
            const voucherHubSigner = await ethers.getImpersonatedSigner(voucherHubAddress);
            await expect(voucherAsAnyone.connect(voucherHubSigner).drain(voucherValue))
                .to.emit(iexecPocoInstance, 'Transfer')
                .withArgs(voucherAddress, voucherHubAddress, voucherValue);
            expect(await iexecPocoInstance.balanceOf(voucherAddress)).to.equal(0);
        });

        it('Should not drain voucher if sender is not authorized', async function () {
            await expect(voucherAsAnyone.drain(voucherValue)).to.be.revertedWith(
                'Voucher: sender is not VoucherHub',
            );
        });

        it('Should not drain voucher if not expired', async function () {
            const voucherHubSigner = await ethers.getImpersonatedSigner(voucherHubAddress);
            await expect(
                voucherAsAnyone.connect(voucherHubSigner).drain(voucherValue),
            ).to.be.revertedWith('Voucher: voucher is not expired');
        });
    });

    async function addEligibleAssets(assets: string[]) {
        for (const asset of assets) {
            await voucherHubAsManager.addEligibleAsset(voucherType, asset).then((tx) => tx.wait());
        }
    }

    async function getVoucherAndRequesterBalances() {
        const voucherCreditBalance = await voucherAsOwner.getBalance();
        const voucherSrlcBalance = await iexecPocoInstance.balanceOf(voucherAddress);
        const requesterSrlcBalance = await iexecPocoInstance.balanceOf(requester.address);
        return {
            voucherCreditBalance,
            voucherSrlcBalance,
            requesterSrlcBalance,
        };
    }
});
