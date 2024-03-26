// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon } from '../typechain-types';
import { deployVoucherBeaconAndImplementation } from './deploy-beacon';

async function main() {
    const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // TODO: Change it
    const beaconOwner = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd'; // Random // TODO change it

    // Deploy Voucher beacon and implementation.
    const beacon: UpgradeableBeacon = await deployVoucherBeaconAndImplementation(beaconOwner);
    const beaconAddress = await beacon.getAddress();
    console.log(`Voucher beacon deployed at: ${beaconAddress}`);
    console.log(`Voucher implementation deployed at: ${await beacon.implementation()}`);
    // Deploy VoucherHub.
    const VoucherHubFactory = await ethers.getContractFactory('VoucherHub');
    const voucherHub = await upgrades.deployProxy(VoucherHubFactory, [iexecPoco, beaconAddress]);
    await voucherHub.waitForDeployment();
    console.log('VoucherHub deployed to:', await voucherHub.getAddress());
    // Check
    if ((await voucherHub.getVoucherBeacon()) !== beaconAddress) {
        throw new Error('Deployment error');
    }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
