// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-dependency-compiler';
import 'hardhat-deploy';
import { HardhatUserConfig } from 'hardhat/config';
import {
    HARDHAT_NETWORK_MNEMONIC,
    defaultHardhatNetworkParams,
    defaultLocalhostNetworkParams,
} from 'hardhat/internal/core/config/default-config';
import 'solidity-docgen';

const managerAccount = Number(process.env.IEXEC_VOUCHER_MANAGER_ACCOUNT_INDEX) || null;
const minterAccount = Number(process.env.IEXEC_VOUCHER_MINTER_ACCOUNT_INDEX) || null;

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.8.27',
                settings: {
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
            gasPrice: 0,
            blockGasLimit: 6_700_000,
        },
        'external-hardhat': {
            ...defaultHardhatNetworkParams,
            ...defaultLocalhostNetworkParams,
            accounts: {
                mnemonic: HARDHAT_NETWORK_MNEMONIC,
            },
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
            accounts: {
                mnemonic: process.env.PROD_MNEMONIC || '',
            },
            gasPrice: 0,
            gas: 6700000,
            // npx hardhat --network bellecour etherscan-verify
            // See: https://github.com/wighawag/hardhat-deploy?tab=readme-ov-file#4-hardhat-etherscan-verify
            verify: {
                etherscan: {
                    apiUrl: 'https://blockscout.bellecour.iex.ec/api',
                    apiKey: 'https://blockscout.bellecour.iex.ec/',
                },
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        manager: {
            hardhat: 1,
            'external-hardhat': 1,
            'dev-native': 1,
            localhost: managerAccount,
        },
        minter: {
            hardhat: 2,
            'external-hardhat': 2,
            'dev-native': 2,
            localhost: minterAccount,
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

export default config;
