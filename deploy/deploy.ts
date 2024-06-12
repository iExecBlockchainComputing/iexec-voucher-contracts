// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { UpgradeableBeacon } from '../typechain-types';

// TODO move this to a config file and determine
// poco address according to chain id.
// TODO provide admin wallet addresses to this script
// (admin, manager, minter).

const pocoAddress = process.env.IEXEC_POCO_ADDRESS || '0x123456789a123456789b123456789b123456789d'; // random

export default async function () {
    console.log(`Using PoCo address: ${pocoAddress}`);
    const [admin, manager, minter] = await ethers.getSigners();
    await deployAll(admin.address, manager.address, minter.address, pocoAddress);
}

async function deployAll(
    beaconOwner: string,
    manager: string,
    minter: string,
    iexecPoco: string,
): Promise<string> {
    // Deploy Voucher beacon and implementation.
    const beacon: UpgradeableBeacon = await voucherUtils.deployBeaconAndImplementation(beaconOwner);
    const beaconAddress = await beacon.getAddress();
    console.log(`UpgradeableBeacon: ${beaconAddress}`);
    console.log(`Voucher implementation: ${await beacon.implementation()}`);
    // Deploy VoucherHub.
    const voucherHub = await voucherHubUtils.deployHub(manager, minter, iexecPoco, beaconAddress);
    const voucherHubAddress = await voucherHub.getAddress();
    console.log(`VoucherHub: ${voucherHubAddress}`);
    // Check
    if ((await voucherHub.getVoucherBeacon()) !== beaconAddress) {
        throw new Error('Deployment error');
    }
    // Save VoucherHub in deployments folder because
    // hardhat-deploy#deploy() is not used.
    await deployments.save('VoucherHub', {
        // TODO save abi.
        abi: [],
        address: voucherHubAddress,
    });
    return voucherHubAddress;
}
