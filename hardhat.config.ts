// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-dependency-compiler';
import { HardhatUserConfig } from 'hardhat/config';

const config: HardhatUserConfig = {
    solidity: '0.8.24',
    dependencyCompiler: {
        paths: ['@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol'],
    },
};

export default config;
