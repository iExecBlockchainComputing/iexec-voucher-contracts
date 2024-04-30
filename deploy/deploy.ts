// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { UpgradeableBeacon } from '../typechain-types';

// TODO move this to a config file and determine
// poco address according to chain id.
const pocoAddress = process.env.IEXEC_POCO_ADDRESS || '0x123456789a123456789b123456789b123456789d'; // random

export default async function () {
    console.log(`Using PoCo address: ${pocoAddress}`);
    const [admin, assetEligibilityManager, voucherManager] = await ethers.getSigners();
    await deployAll(
        admin.address,
        assetEligibilityManager.address,
        voucherManager.address,
        pocoAddress,
    );
}

async function deployAll(
    beaconOwner: string,
    assetEligibilityManager: string,
    voucherManager: string,
    iexecPoco: string,
): Promise<string> {
    // Deploy Voucher beacon and implementation.
    const beacon: UpgradeableBeacon = await voucherUtils.deployBeaconAndImplementation(beaconOwner);
    const beaconAddress = await beacon.getAddress();
    console.log(`UpgradeableBeacon: ${beaconAddress}`);
    console.log(`Voucher implementation: ${await beacon.implementation()}`);
    // Deploy VoucherHub.
    const voucherHub = await voucherHubUtils.deployHub(
        assetEligibilityManager,
        voucherManager,
        iexecPoco,
        beaconAddress,
    );
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
