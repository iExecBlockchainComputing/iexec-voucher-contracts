// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

const deploymentConfig = require('./deployment.json') as DeploymentConfig;
export default deploymentConfig;

export type DeploymentConfig = {
    [chainId: string]: ChainConfig;
};

export type ChainConfig = {
    pocoAddress: string;
    roles: {
        upgraderAddress: string;
        managerAddress: string;
        minterAddress: string;
    };
};
