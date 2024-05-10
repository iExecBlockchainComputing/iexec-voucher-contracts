// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon } from '../typechain-types';

export async function deployBeaconAndImplementation(
    beaconOwner: string,
): Promise<UpgradeableBeacon> {
    const iexecLibOrders = await ethers.getContractFactory('IexecLibOrders_v5');
    const iexecLibOrdersInstance = await iexecLibOrders.deploy();
    const iexecLibOrdersInstanceAddress = await iexecLibOrdersInstance.getAddress();

    const voucherFactory = await ethers.getContractFactory('Voucher', {
        libraries: {
            ['@iexec/poco/contracts/libs/IexecLibOrders_v5.sol:IexecLibOrders_v5']:
                iexecLibOrdersInstanceAddress,
        },
    });
    // upgrades.deployBeacon() does the following:
    // 1. Deploys the implementation contract.
    // 2. Deploys an instance of oz/UpgradeableBeacon contract.
    // 3. Links the implementation in the beacon contract.
    const contract: unknown = await upgrades.deployBeacon(voucherFactory, {
        initialOwner: beaconOwner,
        unsafeAllowLinkedLibraries: true,
    });
    // Workaround openzeppelin-upgrades/pull/535;
    const beacon = contract as UpgradeableBeacon;
    await beacon.waitForDeployment();
    return beacon;
}

export async function upgradeBeacon(
    beacon: UpgradeableBeacon,
    newVoucherImplementationFactory: ContractFactory,
): Promise<UpgradeableBeacon> {
    // Note: upgrades.upgradeBeacon() deploys the new impl contract only if it is
    // different from the old implementation. To override the default config 'onchange'
    // use the option (redeployImplementation: 'always').
    const contractUpgrade: unknown = await upgrades.upgradeBeacon(
        beacon,
        newVoucherImplementationFactory,
    );
    const beaconUpgrade = contractUpgrade as UpgradeableBeacon;
    return await beaconUpgrade.waitForDeployment();
}
