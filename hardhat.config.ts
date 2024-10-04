// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-dependency-compiler';
import 'hardhat-deploy';
import { HardhatUserConfig, task } from 'hardhat/config';
import {
    HARDHAT_NETWORK_MNEMONIC,
    defaultHardhatNetworkParams,
    defaultLocalhostNetworkParams,
} from 'hardhat/internal/core/config/default-config';
import 'solidity-docgen';
import { forceZeroGasPriceWithSolidityCoverage } from './scripts/utils/modify-solidity-coverage-lib-api-js';

const managerAccount = Number(process.env.IEXEC_VOUCHER_MANAGER_ACCOUNT_INDEX) || null;
const minterAccount = Number(process.env.IEXEC_VOUCHER_MINTER_ACCOUNT_INDEX) || null;
export const isLocalFork = process.env.LOCAL_FORK == 'true';
const bellecourBlockscoutUrl =
    process.env.BLOCKSCOUT_VERSION == 'v5'
        ? 'https://blockscout.bellecour.iex.ec'
        : 'https://blockscout-v6.bellecour.iex.ec'; // Use Blockscout v6 by default

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.8.27',
                settings: {
                    evmVersion: 'berlin',
                    /**
                     * Enable Intermediate Representation (IR) to reduce `Stack too deep` occurrences
                     * at compile time (e.g.: too many local variables in `matchOrdersBoost`).
                     * https://hardhat.org/hardhat-runner/docs/reference/solidity-support#support-for-ir-based-codegen
                     */
                    viaIR: true,
                    optimizer: {
                        enabled: true,
                        runs: 200,
                        details: {
                            yul: true,
                            yulDetails: {
                                optimizerSteps: 'u',
                            },
                        },
                    },
                },
            },
        ],
    },
    networks: {
        hardhat: {
            hardfork: 'berlin', // No EIP-1559 before London fork
            accounts: {
                mnemonic: process.env.MNEMONIC || HARDHAT_NETWORK_MNEMONIC,
            },
            ...(isLocalFork && {
                forking: {
                    url: 'https://bellecour.iex.ec',
                },
                chainId: 134,
            }),
            gasPrice: 0,
            blockGasLimit: 6_700_000,
        },
        'external-hardhat': {
            ...defaultHardhatNetworkParams,
            ...defaultLocalhostNetworkParams,
            accounts: 'remote', // will use accounts set in hardhat network config
            ...(isLocalFork && {
                chainId: 134,
            }),
            gasPrice: 0,
        },
        'dev-native': {
            chainId: 65535,
            url: 'http://localhost:8545',
            accounts: {
                mnemonic: process.env.MNEMONIC || '',
            },
            gasPrice: 0, // Get closer to Bellecour network
        },
        bellecour: {
            chainId: 134,
            url: 'https://bellecour.iex.ec',
            accounts: [
                process.env.PROD_PRIVATE_KEY ||
                    '0x0000000000000000000000000000000000000000000000000000000000000000',
            ],
            gasPrice: 0,
            gas: 6700000,
        },
    },
    etherscan: {
        apiKey: {
            bellecour: '<>', // a non-empty string is needed by the plugin.
        },
        customChains: [
            {
                network: 'bellecour',
                chainId: 134,
                urls: {
                    apiURL: `${bellecourBlockscoutUrl}/api`,
                    browserURL: bellecourBlockscoutUrl,
                },
            },
        ],
    },
    namedAccounts: {
        deployer: {
            default: 0,
            134: '0xA0C07ad0257522211c6359EC8A4EB5d21A4A1A14', // Bellecour & local fork
        },
        manager: {
            31337: 1, // hardhat & external-hardhat without local fork
            'dev-native': 1,
            localhost: managerAccount,
            134: '0xA0C1939182b454911b78f9b087D5444d7d0E82E3', // Bellecour & local fork
        },
        minter: {
            31337: 2, // hardhat & external-hardhat without local fork
            'dev-native': 2,
            localhost: minterAccount,
            134: '0xA0C26578F762a06c14A8153F87D0EAA2fBd036af', // Bellecour & local fork
        },
    },
    dependencyCompiler: {
        paths: [
            '@amxx/factory/contracts/v8/GenericFactory.sol',
            '@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol',
            '@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol',
        ],
        keep: true, // Keep it for slither
    },
    docgen: {
        templates: 'docs/templates',
        pages: 'items',
        exclude: ['mocks', 'NonTransferableERC20Upgradeable.sol', 'beacon/VoucherProxy.sol'],
    },
};

task('coverage').setAction((_, {}, runSuper) => {
    forceZeroGasPriceWithSolidityCoverage();
    return runSuper();
});

export default config;
