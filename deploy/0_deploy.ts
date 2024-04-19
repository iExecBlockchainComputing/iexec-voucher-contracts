// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments } from 'hardhat';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { UpgradeableBeacon } from '../typechain-types';

module.exports = async function () {
    const beaconOwner = '0xbee4B4D44c9472347482c7941409E4E7AEdf3c1e'; // random
    const assetEligibilityManager = '0x0f78173486FDFdA573a894dcC037E0486DDEE6Db'; // random
    const voucherManager = '0xf3B82Dcc6028d8e78DDd137d048A6580E94DEe5b'; // random
    const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // TODO: Change it
    await deploy(beaconOwner, assetEligibilityManager, voucherManager, iexecPoco);
};

export async function deploy(
    beaconOwner: string,
    assetEligibilityManager: string,
    voucherManager: string,
    iexecPoco: string,
): Promise<string> {
    // Deploy Voucher beacon and implementation.
    const beacon: UpgradeableBeacon = await voucherUtils.deployBeaconAndImplementation(beaconOwner);
    const beaconAddress = await beacon.getAddress();
    await save('UpgradeableBeacon', beaconAddress);
    console.log(`Voucher beacon deployed at: ${beaconAddress}`);
    console.log(`Voucher implementation deployed at: ${await beacon.implementation()}`);
    // Deploy VoucherHub.
    const voucherHub = await voucherHubUtils.deployHub(
        assetEligibilityManager,
        voucherManager,
        iexecPoco,
        beaconAddress,
    );
    const voucherHubAddress = await voucherHub.getAddress();
    console.log(`VoucherHub deployed to: ${voucherHubAddress}`);
    // Check
    if ((await voucherHub.getVoucherBeacon()) !== beaconAddress) {
        throw new Error('Deployment error');
    }
    await save('VoucherHub', voucherHubAddress);
    return voucherHubAddress;
}

async function save(name: string, address: string) {
    await deployments.save(name, {
        abi: [],
        address: address,
    });
}
