// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { VoucherHub } from '../typechain-types';

export async function deployHub(iexecPoco: string, beacon: string): Promise<VoucherHub> {
    const VoucherHubFactory = await ethers.getContractFactory('VoucherHub');
    // @dev Type declaration produces a warning until feature is supported by
    // openzeppelin plugin. See "Support TypeChain in deployProxy function":
    // https://github.com/OpenZeppelin/openzeppelin-upgrades/pull/535
    const contract: unknown = await upgrades.deployProxy(VoucherHubFactory, [iexecPoco, beacon]);
    // Workaround openzeppelin-upgrades/pull/535;
    const voucherHub = contract as VoucherHub;
    return await voucherHub.waitForDeployment();
}

export async function upgradeProxy(
    voucherHubAddress: string,
    newVoucherHubImplementationFactory: ContractFactory,
): Promise<VoucherHub> {
    const contractUpgrade: unknown = await upgrades.upgradeProxy(
        voucherHubAddress,
        newVoucherHubImplementationFactory,
    );
    const voucherHubUpgrade = contractUpgrade as VoucherHub;
    return await voucherHubUpgrade.waitForDeployment();
}
