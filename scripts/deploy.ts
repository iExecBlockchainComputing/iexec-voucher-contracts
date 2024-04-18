// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { UpgradeableBeacon } from '../typechain-types';
import * as voucherHubUtils from './voucherHubUtils';
import * as voucherUtils from './voucherUtils';

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

async function main() {
    const beaconOwner = '0xbee4B4D44c9472347482c7941409E4E7AEdf3c1e'; // random
    const assetEligibilityManager = '0x0f78173486FDFdA573a894dcC037E0486DDEE6Db'; // random
    const voucherManager = '0xf3B82Dcc6028d8e78DDd137d048A6580E94DEe5b'; // random
    const iexecPoco = '0x123456789a123456789b123456789b123456789d'; // TODO: Change it
    deploy(beaconOwner, assetEligibilityManager, voucherManager, iexecPoco);
}

async function deploy(
    beaconOwner: string,
    assetEligibilityManager: string,
    voucherManager: string,
    iexecPoco: string,
) {
    // Deploy Voucher beacon and implementation.
    const beacon: UpgradeableBeacon = await voucherUtils.deployBeaconAndImplementation(beaconOwner);
    const beaconAddress = await beacon.getAddress();
    console.log(`Voucher beacon deployed at: ${beaconAddress}`);
    console.log(`Voucher implementation deployed at: ${await beacon.implementation()}`);
    // Deploy VoucherHub.
    const voucherHub = await voucherHubUtils.deployHub(
        assetEligibilityManager,
        voucherManager,
        iexecPoco,
        beaconAddress,
    );
    console.log(`VoucherHub deployed to: ${await voucherHub.getAddress()}`);
    // Check
    if ((await voucherHub.getVoucherBeacon()) !== beaconAddress) {
        throw new Error('Deployment error');
    }
}
