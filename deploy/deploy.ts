// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import deploymentConfig from '../config/deployment';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import { UpgradeableBeacon } from '../typechain-types';

export default async function (hre: HardhatRuntimeEnvironment) {
    const chainId = (await ethers.provider.getNetwork()).chainId;
    console.log('ChainId:', chainId);
    const { deployer, manager, minter } = await hre.getNamedAccounts();
    const { pocoAddress } = await getDeploymentConfig(Number(chainId));
    console.log(`Using PoCo address: ${pocoAddress}`);
    console.log(`Using upgrader address: ${deployer}`);
    console.log(`Using manager address: ${manager}`);
    console.log(`Using minter address: ${minter}`);
    await deployAll(deployer, manager, minter, pocoAddress);
}

async function deployAll(
    upgrader: string,
    manager: string,
    minter: string,
    iexecPoco: string,
): Promise<string> {
    // Deploy Voucher beacon and implementation.
    const beacon: UpgradeableBeacon = await voucherUtils.deployBeaconAndImplementation(upgrader);
    const beaconAddress = await beacon.getAddress();
    // Deploy VoucherHub.
    const voucherHub = await voucherHubUtils.deployHub(manager, minter, iexecPoco, beaconAddress);
    const voucherHubAddress = await voucherHub.getAddress();
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
    console.log(`UpgradeableBeacon: ${beaconAddress}`);
    console.log(`Voucher implementation: ${await beacon.implementation()}`);
    console.log(`VoucherHub: ${voucherHubAddress}`);
    return voucherHubAddress;
}

/**
 * Get deployment config according to chain.
 */
async function getDeploymentConfig(chainId: number) {
    // Read default config of the target chain.
    let pocoAddress: string = deploymentConfig[chainId]?.pocoAddress;
    // Override config if required.
    if (process.env.IEXEC_POCO_ADDRESS) {
        pocoAddress = process.env.IEXEC_POCO_ADDRESS;
    }
    // Check final config.
    if (!ethers.isAddress(pocoAddress)) {
        throw new Error('Valid PoCo address must be provided');
    }
    return {
        pocoAddress,
    };
}
