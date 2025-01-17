// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0
import { ethers, getNamedAccounts, upgrades } from 'hardhat';
import { env } from '../config/env';
import { getDeploymentConfig } from '../deploy/deploy';
import {
    UpgradeableBeacon__factory,
    VoucherHub__factory,
    Voucher__factory,
} from '../typechain-types';
import { mineBlockIfOnLocalFork } from './utils/mineBlockIfOnLocalFork';
import { upgradeProxy } from './voucherHubUtils';
import { upgradeBeacon } from './voucherUtils';

async function upgrade() {
    console.log(`Upgrading VoucherHub contract ...`);
    mineBlockIfOnLocalFork();

    const chainId = (await ethers.provider.getNetwork()).chainId.toString();
    console.log('ChainId:', chainId);

    const config = await getDeploymentConfig(Number(chainId));
    const voucherHubProxyAddress = config.voucherHubAddress || env.IEXEC_VOUCHER_HUB_ADDRESS;
    if (!voucherHubProxyAddress) {
        throw new Error(`No VoucherHub deployed on the target chain ${chainId}`);
    }
    console.log(
        'Current implementation address:',
        await upgrades.erc1967.getImplementationAddress(voucherHubProxyAddress),
    );
    const { deployer } = await getNamedAccounts();
    const upgrader = env.IS_LOCAL_FORK
        ? await ethers.getImpersonatedSigner(deployer)
        : await ethers.getSigner(deployer);
    await upgradeProxy(voucherHubProxyAddress, new VoucherHub__factory().connect(upgrader));

    // Fetch new implementation address
    const implementationAddress =
        await upgrades.erc1967.getImplementationAddress(voucherHubProxyAddress);
    console.log(
        `VoucherHub upgraded successfully ✅! New implementation address (VoucherHub.sol): ${implementationAddress}`,
    );
    const voucherBeaconAddress = await VoucherHub__factory.connect(
        voucherHubProxyAddress,
        ethers.provider,
    ).getVoucherBeacon();
    console.log(`Upgrading VoucherBeacon:${voucherBeaconAddress} implementation..`);
    const voucherBeacon = UpgradeableBeacon__factory.connect(voucherBeaconAddress, ethers.provider);
    const previousVoucherImplementationAddress = await voucherBeacon.implementation();
    await upgradeBeacon(voucherBeacon, new Voucher__factory().connect(upgrader));
    const nextVoucherImplementationAddress = await voucherBeacon.implementation();
    console.log(
        `VoucherBeacon implementation upgraded [previousImpl:${previousVoucherImplementationAddress}, nextImpl:${nextVoucherImplementationAddress}]`,
    );
}

upgrade().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
