// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';
import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers, upgrades } from 'hardhat';
import { UpgradeableBeacon } from '../../typechain-types';

export default buildModule('Beacon', function (m) {
    let owner: HardhatEthersSigner;
    return ethers
        .getSigners()
        .then((signers) => {
            owner = signers[0];
        })
        .then(() => {
            return ethers.getContractFactory('Voucher');
        })
        .then((voucherFactory) => {
            // upgrades.deployBeacon() does the following:
            // 1. Deploys the implementation contract.
            // 2. Deploys an instance of oz/UpgradeableBeacon contract.
            // 3. Links the implementation in the beacon contract.
            return upgrades.deployBeacon(voucherFactory, { initialOwner: owner.address });
        })
        .then((contract: unknown) => {
            // Workaround openzeppelin-upgrades/pull/535;
            const beacon = contract as UpgradeableBeacon;
            return beacon.waitForDeployment();
        })
        .then((beacon) => {
            return beacon.getAddress();
        })
        .then((beaconAddress) => {
            const deployed = m.contractAt('UpgradeableBeacon', beaconAddress);
            deployed.id;
            return { deployed };
        });

    // Adding new Hardhat Futures here will not re-run the previous ones
    // (if the same network is used) and will run only the new ones.
    // More info:
    // https://hardhat.org/ignition/docs/guides/modifications#modifying-an-existing-module
});
