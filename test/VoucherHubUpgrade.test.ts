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
const BELLECOUR_CHAIN_ID = 134;

// TODO: Remove this after upgrade
describe('VoucherHub upgrade (vNEXT)', function () {
    before(function () {
        if (!env.IS_LOCAL_FORK) {
            this.skip();
        }
    });

    async function deployFixture() {
        if ((await ethers.provider.getNetwork()).chainId !== BigInt(BELLECOUR_CHAIN_ID)) {
            console.error('Bellecour fork network required');
            process.exit(1);
        }
        const voucherHubERC1967ProxyAddress = (await getDeploymentConfig(BELLECOUR_CHAIN_ID))
            .voucherHubAddress;
        await mineBlockIfOnLocalFork();
        const [admin, manager, minter] = await ethers.getSigners(); // default hardhat account
        const upgrader = admin; // admin and upgrader are currently the same account
        const voucherHub = VoucherHub__factory.connect(voucherHubERC1967ProxyAddress!, admin);
        const previousAdmin = await ethers.getImpersonatedSigner(
            await voucherHub.defaultAdmin(), //'0xA0C07ad0257522211c6359EC8A4EB5d21A4A1A14',
        );
        console.log(
            `Transferring VoucherHub:${voucherHubERC1967ProxyAddress} ` +
                `roles on this forked network to default hardhat accounts:\n` +
                `admin:     ${await admin.getAddress()}\n` +
                `upgrader:  ${await upgrader.getAddress()}\n` +
                `manager:   ${await manager.getAddress()}\n` +
                `minter:    ${await minter.getAddress()}\n`,
        );
        await voucherHub
            .connect(previousAdmin)
            .beginDefaultAdminTransfer(admin)
            .then((tx) => tx.wait());
        await voucherHub.acceptDefaultAdminTransfer().then((tx) => tx.wait());
        [
            { id: await voucherHub.UPGRADER_ROLE(), account: upgrader },
            { id: await voucherHub.MANAGER_ROLE(), account: manager },
            { id: await voucherHub.MINTER_ROLE(), account: minter },
        ].forEach((role) =>
            voucherHub.grantRole(role.id.toString(), role.account).then((tx) => tx.wait()),
        );
        return {
            voucherHub,
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
