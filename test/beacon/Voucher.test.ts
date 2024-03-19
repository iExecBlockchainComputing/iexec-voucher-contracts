// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon, VoucherImpl__factory } from '../../typechain-types';

describe('VoucherContract', function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deployFixture() {
        // Contracts are deployed using the first signer/account by default
        const [owner, unprivilegedAccount] = await ethers.getSigners();

        // Deploy implementation and beacon contracts.
        const voucherImplFactory: VoucherImpl__factory =
            await ethers.getContractFactory('VoucherImpl');
        // upgrades.deployBeacon() does the following:
        // 1. Deploys the implementation contract.
        // 2. Deploys an instance of oz/UpgradeableBeacon contract.
        // 3. Links the implementation in the beacon contract.
        const beaconContract = (await upgrades.deployBeacon(voucherImplFactory, {
            initialOwner: owner.address,
        })) as unknown; // to be able to convert to "VoucherBeacon";
        const beacon = beaconContract as UpgradeableBeacon;
        await beacon.waitForDeployment();
        return { beacon, owner, unprivilegedAccount };
    }

    describe('Version', async function () {
        it('Should get same version', async () => {
            const { beacon, owner, unprivilegedAccount } = await loadFixture(deployFixture);
            const beaconAddress = await beacon.getAddress();
            const implementation = await beacon.implementation();
            // Deploy proxies.
            const voucherProxy1 = await _deployVoucherProxy(beaconAddress, '0x');
            const voucherProxy2 = await _deployVoucherProxy(beaconAddress, '0x');
            // Check proxies configuration.
            expect(await voucherProxy1.implementation()).to.be.equal(implementation);
            expect(await voucherProxy2.implementation()).to.be.equal(implementation);
        });
    });

    async function _deployVoucherProxy(beaconAddress: string, data: string) {
        const voucherProxy = await ethers
            .getContractFactory('VoucherProxy')
            .then(async (factory) => factory.deploy(beaconAddress, data))
            .then((contract) => contract.waitForDeployment())
            .catch((error) => {
                throw error;
            });
        return voucherProxy;
    }
});
