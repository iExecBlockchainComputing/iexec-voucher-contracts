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

        // // Deploy implementation.
        // const voucherImpl = await ethers.getContractFactory('VoucherImpl')
        //     .then(factory => factory.deploy())
        //     .then(contract => contract.waitForDeployment())
        //     .catch(error => {throw error});
        // const voucherImplAddress = await voucherImpl.getAddress();
        // console.log(`Contract VoucherImpl deployed at ${voucherImplAddress}`);

        // Deploy implementation and beacon contracts.
        const voucherImplFactory: VoucherImpl__factory =
            await ethers.getContractFactory('VoucherImpl');
        const beaconContract = (await upgrades.deployBeacon(voucherImplFactory, {
            initialOwner: owner.address,
            // unsafeAllow: ['constructor'],
        })) as unknown; // to be able to convert to "VoucherBeacon";
        const beacon = beaconContract as UpgradeableBeacon;
        await beacon.waitForDeployment();
        console.log(`Beacon deployed at ${await beacon.getAddress()}`);
        return { owner, unprivilegedAccount, beacon };
    }

    describe('Version', async function () {
        it('Should get same version', async () => {
            const { owner, unprivilegedAccount, beacon } = await loadFixture(deployFixture);
            const beaconAddress = await beacon.getAddress();
            const implementation = await beacon.implementation();
            // Deploy proxy.
            const voucherProxy = await _deployVoucherProxy(beaconAddress, '0x');
            expect(await voucherProxy.implementation()).to.be.equal(implementation);
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
        console.log(`Contract VoucherProxy deployed at ${await voucherProxy.getAddress()}`);
        return voucherProxy;
    }
});
