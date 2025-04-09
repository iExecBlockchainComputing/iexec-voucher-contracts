// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import deploymentConfigRaw from './deployment.json';

export type DeploymentConfig = {
    [chainId: string]: {
        factory: boolean;
        salt: string;
        pocoAddress: string;
        voucherHubAddress?: string; //some chains used doesn't have the voucher deployed
    };
};

export default deploymentConfigRaw as DeploymentConfig;
