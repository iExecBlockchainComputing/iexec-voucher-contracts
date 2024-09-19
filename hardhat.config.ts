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
                version: '0.8.24',
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
                                /**
                                 * Disable temporarily.
                                 * Causes:
                                 * YulException: Cannot swap Slot RET with Variable value10: too deep in the stack
                                 * by 1 slots in [ RET value15 value14 value13 value12 value11 headStart value9
                                 * value8 value7 value6 value5 value4 value3 value2 value1 value0 value10 ]
                                 * memoryguard was present.
                                 */
                                // optimizerSteps: 'u',
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
    etherscan: {
        apiKey: {
            '<network>': 'nothing', // hardhat-verify requires a non-empty string.
        },
        customChains: [
            {
                network: '<network>',
                chainId: 65535,
                urls: {
                    apiURL: '<url>',
                    browserURL: '<url>',
                },
            },
        ],
    },
    sourcify: {
        enabled: false,
    },
};

export default config;
