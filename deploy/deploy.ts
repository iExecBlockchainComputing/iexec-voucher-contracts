// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import { defaultHardhatNetworkParams } from 'hardhat/internal/core/config/default-config';
import deploymentConfig from '../config/config';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { UpgradeableBeacon } from '../typechain-types';

export default async function () {
    const { pocoAddress, upgraderAddress, managerAddress, minterAddress } =
        await getDeploymentConfig();
    await deployAll(upgraderAddress, managerAddress, minterAddress, pocoAddress);
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

/**
 * Get deployment config according to chain.
 */
async function getDeploymentConfig() {
    let [pocoAddress, upgraderAddress, managerAddress, minterAddress]: string[] = [];
    const chainId = (await ethers.provider.getNetwork()).chainId;
    console.log('ChainId:', chainId);
    // Read default config of the target chain.
    const chainConfig = deploymentConfig[chainId.toString()];
    if (chainConfig) {
        pocoAddress = chainConfig.pocoAddress;
        upgraderAddress = chainConfig.roles.upgraderAddress;
        managerAddress = chainConfig.roles.managerAddress;
        minterAddress = chainConfig.roles.minterAddress;
    }
    // Override config if required.
    if (process.env.IEXEC_POCO_ADDRESS) {
        pocoAddress = process.env.IEXEC_POCO_ADDRESS;
    }
    if (process.env.IEXEC_VOUCHER_UPGRADER_ADDRESS) {
        upgraderAddress = process.env.IEXEC_VOUCHER_UPGRADER_ADDRESS;
    }
    if (process.env.IEXEC_VOUCHER_MANAGER_ADDRESS) {
        managerAddress = process.env.IEXEC_VOUCHER_MANAGER_ADDRESS;
    }
    if (process.env.IEXEC_VOUCHER_MINTER_ADDRESS) {
        minterAddress = process.env.IEXEC_VOUCHER_MINTER_ADDRESS;
    }
    // Define config for default Hardhat network if missing.
    if (chainId === BigInt(defaultHardhatNetworkParams.chainId)) {
        const hardhatSigners = await ethers.getSigners();
        pocoAddress = pocoAddress ? pocoAddress : '0x123456789a123456789b123456789b123456789d'; // random
        upgraderAddress = upgraderAddress ? upgraderAddress : hardhatSigners[0].address;
        managerAddress = managerAddress ? managerAddress : hardhatSigners[1].address;
        minterAddress = minterAddress ? minterAddress : hardhatSigners[2].address;
    }
    // Check final config.
    if (!ethers.isAddress(pocoAddress)) {
        throw new Error('Valid PoCo address must be provided');
    }
    if (!ethers.isAddress(upgraderAddress)) {
        throw new Error('Valid upgrader address must be provided');
    }
    if (!ethers.isAddress(managerAddress)) {
        throw new Error('Valid manager address must be provided');
    }
    if (!ethers.isAddress(minterAddress)) {
        throw new Error('Valid minter address must be provided');
    }
    console.log(`> Using PoCo address: ${pocoAddress}`);
    console.log(`> Using upgrader address: ${upgraderAddress}`);
    console.log(`> Using manager address: ${managerAddress}`);
    console.log(`> Using minter address: ${minterAddress}`);
    return {
        pocoAddress,
        upgraderAddress,
        managerAddress,
        minterAddress,
    };
}
