// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { env } from '../config/env';
import { getDeploymentConfig } from '../deploy/deploy';
import { mineBlockIfOnLocalFork } from '../scripts/utils/mineBlockIfOnLocalFork';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import { VoucherHub__factory } from '../typechain-types';

describe('VoucherHub upgrade (vNEXT)', function () {
    before(function () {
        if (!env.IS_LOCAL_FORK) {
            this.skip();
        }
    });

    async function deployFixture() {
        const voucherHubERC1967ProxyAddress = await ethers.provider
            .getNetwork()
            .then((network) => network.chainId.toString())
            .then((chainId) => {
                if (chainId != '134') {
                    console.error('Bellecour fork network required');
                    process.exit(1);
                }
                return getDeploymentConfig(Number(chainId));
            })
            .then((config) => config.voucherHubAddress);
        await mineBlockIfOnLocalFork();
        const [admin, upgrader, manager, minter] = await ethers.getSigners();
        const voucherHub = VoucherHub__factory.connect(voucherHubERC1967ProxyAddress!, admin);
        const previousAdmin = await ethers.getImpersonatedSigner(
            await voucherHub.defaultAdmin(), //'0xA0C07ad0257522211c6359EC8A4EB5d21A4A1A14',
        );
        console.log(
            `Transferring VoucherHub:${voucherHubERC1967ProxyAddress} ` +
                `roles to default hardhat accounts on this forked network..`,
        );
        await voucherHub
            .connect(previousAdmin)
            .beginDefaultAdminTransfer(admin)
            .then((tx) => tx.wait());
        await voucherHub.acceptDefaultAdminTransfer().then((tx) => tx.wait());
        [
            [await voucherHub.UPGRADER_ROLE(), upgrader],
            [await voucherHub.MANAGER_ROLE(), manager],
            [await voucherHub.MINTER_ROLE(), minter],
        ].forEach((x) => voucherHub.grantRole(x[0].toString(), x[1]).then((tx) => tx.wait()));
        return {
            voucherHub,
            admin,
            upgrader,
            manager,
            minter,
        };
    }

    describe('Decimals', function () {
        it('Should upgrade decimals from 18 to 9', async function () {
            const { voucherHub: previousVoucherHub, upgrader } = await loadFixture(deployFixture);
            expect(await previousVoucherHub.decimals()).equals('18');
            const nextVoucherHub = await voucherHubUtils.upgradeProxy(
                await previousVoucherHub.getAddress(),
                new VoucherHub__factory().connect(upgrader),
            );
            expect(await nextVoucherHub.decimals()).to.equal('9');
        });
    });
});
