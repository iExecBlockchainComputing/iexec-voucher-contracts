// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import hre, { deployments, ethers } from 'hardhat';
import { UpgradeableBeacon__factory, VoucherHub__factory } from '../typechain-types';

/**
 * Note: When verifying a proxy contract, Hardhat-verify combined with Openzeppelin Upgrades
 * plugin is "generally" able to automatically detect and verify the implementation contract.
 * Here we explicitly verify the implementation because some issues have been observed.
 */

(async () => {
    const upgraderAddress = process.env.VOUCHER_UPGRADER_ADDRESS || '';
    const managerAddress = process.env.VOUCHER_MANAGER_ADDRESS || '';
    const minterAddress = process.env.VOUCHER_MINTER_ADDRESS || '';

    const voucherImplAddress = (await deployments.get('VoucherImpl')).address;
    const voucherUpgradableBeaconAddress = (await deployments.get('VoucherUpgradeableBeacon'))
        .address;
    const voucherHubImplAddress = (await deployments.get('VoucherHubImpl')).address;
    const voucherHubERC1967ProxyAddress = (await deployments.get('VoucherHubERC1967Proxy')).address;

    const beaconInitialOwnerAddress = await UpgradeableBeacon__factory.connect(
        voucherUpgradableBeaconAddress,
        ethers.provider,
    ).owner(); // Will not work if the owner was changed after deployment.
    const voucherHub = VoucherHub__factory.connect(voucherHubERC1967ProxyAddress, ethers.provider);
    const iexecPocoAddress = await voucherHub.getIexecPoco();

    const contracts = [
        {
            name: 'VoucherImpl',
            address: voucherImplAddress,
            args: [],
        },
        {
            name: 'VoucherUpgradeableBeacon',
            address: voucherUpgradableBeaconAddress,
            args: [[voucherImplAddress, beaconInitialOwnerAddress]],
        },
        {
            name: 'VoucherHubImpl',
            address: voucherHubImplAddress,
            args: [],
        },
        {
            name: 'VoucherHubERC1967Proxy',
            address: voucherHubERC1967ProxyAddress,
            args: [
                voucherHubImplAddress,
                VoucherHub__factory.createInterface().encodeFunctionData('initialize', [
                    upgraderAddress,
                    managerAddress,
                    minterAddress,
                    iexecPocoAddress,
                    voucherUpgradableBeaconAddress,
                ]),
            ],
        },
    ];

    for (const contract of contracts) {
        console.log(`<> Verifying ${contract.name}`);
        await hre.run('verify:verify', {
            address: contract.address,
            constructorArguments: contract.args,
        });
    }
})().catch((error) => console.log(error));
