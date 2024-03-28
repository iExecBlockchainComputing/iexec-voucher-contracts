// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import * as voucherUtils from '../../scripts/voucherUtils';

describe('VoucherProxy', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner] = await ethers.getSigners();
        const beacon = await voucherUtils.deployBeaconAndImplementation(owner.address);
        const voucherProxyFactory = await ethers.getContractFactory('VoucherProxy');
        const voucherProxy = await voucherProxyFactory.deploy(await beacon.getAddress());
        voucherProxy.waitForDeployment();
        return { owner, beacon, voucherProxy };
    }

    describe('Receive', function () {
        it('Should not receive funds', async () => {
            const { owner, voucherProxy } = await loadFixture(deployFixture);
            const voucherProxyAddress = await voucherProxy.getAddress();
            const tx = await expect(
                owner.sendTransaction({
                    to: voucherProxyAddress,
                    value: ethers.parseEther('5'),
                }),
            ).to.be.revertedWith('VoucherProxy: Receive function not supported');
        });
    });
});
