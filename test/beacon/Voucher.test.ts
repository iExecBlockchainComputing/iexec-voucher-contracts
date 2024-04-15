// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as commonUtils from '../../scripts/common';
import * as voucherHubUtils from '../../scripts/voucherHubUtils';
import * as voucherUtils from '../../scripts/voucherUtils';
import { IexecPocoMock, IexecPocoMock__factory, Voucher, VoucherHub } from '../../typechain-types';
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
const dealId = ethers.id('deal');
const initVoucherHubBalance = 1000; // enough to create couple vouchers

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
            requester,
            anyone,
        };
    }

    describe('Upgrade', function () {
        it('Should upgrade all vouchers', async function () {
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
            expect(await beacon.implementation(), 'Implementation has changed').to.equal(
                initialImplementation,
            );
        });
    });

    describe('Authorization', function () {
        it('Should authorize an account', async function () {
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

        it('Should deauthorize an account', async function () {
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

        it('Should not authorize an account if the account is not the owner', async function () {
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

        it('Should not unauthorize an account if the account is not the owner', async function () {
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

        it('Should not authorize owner account', async function () {
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

    describe('Voucher Balance', function () {
        it('Should get balance', async function () {
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

    describe('Match orders', async function () {
        const getVoucherBalanceOnIexecPoco = () =>
            iexecPocoInstance.balanceOf(voucher.getAddress());
        const getRequesterBalanceOnIexecPoco = () =>
            iexecPocoInstance.balanceOf(requester.getAddress());
        const dealPrice = BigInt(appPrice + datasetPrice + workerpoolPrice);
        const mockOrder = createMockOrder();
        const appOrder = { ...mockOrder, app: app, appprice: appPrice };
        const datasetOrder = {
            ...mockOrder,
            dataset: dataset,
            datasetprice: datasetPrice,
        };
        const workerpoolOrder = {
            ...mockOrder,
            workerpool: workerpool,
            workerpoolprice: workerpoolPrice,
        };
        let requestOrder = { ...mockOrder };
        let [voucherOwner1, requester]: SignerWithAddress[] = [];
        let voucherHub: VoucherHub;
        let voucher: Voucher;

        beforeEach(async () => {
            ({ voucherHub, voucherOwner1, requester } = await loadFixture(deployFixture));
            requestOrder.requester = requester.address;
            voucher = await voucherHubWithVoucherManagerSigner
                .createVoucher(voucherOwner1, voucherType, voucherValue)
                .then((tx) => tx.wait())
                .then(() => voucherHub.getVoucher(voucherOwner1))
                .then((voucherAddress) => commonUtils.getVoucher(voucherAddress));
        });

        it('Should match orders with full sponsored amount', async () => {
            for (const asset of [app, dataset, workerpool]) {
                await voucherHubWithAssetEligibilityManagerSigner
                    .addEligibleAsset(voucherType, asset)
                    .then((x) => x.wait());
            }
            const voucherInitialCreditBalance = await voucher.getBalance();
            const voucherInitialSrlcBalance = await getVoucherBalanceOnIexecPoco();
            const requesterInitialSrlcBalanceBefore = await getRequesterBalanceOnIexecPoco();

            expect(
                await voucher.matchOrders.staticCall(
                    appOrder,
                    datasetOrder,
                    workerpoolOrder,
                    requestOrder,
                ),
            ).to.be.equal(dealId);
            await expect(voucher.matchOrders(appOrder, datasetOrder, workerpoolOrder, requestOrder))
                .to.emit(voucher, 'OrdersVoucherMatched')
                .withArgs(dealId);
            expect(await voucher.getBalance())
                .to.be.equal(voucherInitialCreditBalance - dealPrice)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance - dealPrice);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                requesterInitialSrlcBalanceBefore,
            );
            expect(await voucher.getSponsoredAmount(dealId)).to.equal(dealPrice);
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
                .to.emit(voucher, 'OrdersVoucherMatched');
            expect(await voucher.getBalance())
                .to.be.equal(voucherInitialCreditBalance)
                .to.be.equal(await getVoucherBalanceOnIexecPoco())
                .to.be.equal(voucherInitialSrlcBalance);
            expect(await getRequesterBalanceOnIexecPoco()).to.be.equal(
                requesterInitialSrlcBalance - dealPrice,
            );
            expect(await voucher.getSponsoredAmount(dealId)).to.equal(0);
        });

        it('Should not match orders when non-sponsored amount not transferable', async () => {
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
    });
});
