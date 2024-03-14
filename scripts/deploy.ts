// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers, upgrades } from 'hardhat';

async function main() {
    const iexecAddress = '0x123456789a123456789b123456789b123456789d'; // TODO: Change it
    const VoucherHubFactory = await ethers.getContractFactory('VoucherHub');
    const voucherHub = await upgrades.deployProxy(VoucherHubFactory, [iexecAddress]);
    await voucherHub.waitForDeployment();
    console.log('VoucherHub deployed to:', await voucherHub.getAddress());
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
