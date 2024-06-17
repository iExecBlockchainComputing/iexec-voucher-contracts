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

const managerAccount =
    Number(process.env.IEXEC_VOUCHER_MANAGER_ACCOUNT_INDEX) ||
    process.env.IEXEC_VOUCHER_MANAGER_ACCOUNT_ADDRESS ||
    null;
const minterAccount =
    Number(process.env.IEXEC_VOUCHER_MINTER_ACCOUNT_INDEX) ||
    process.env.IEXEC_VOUCHER_MINTER_ADDRESS ||
    null;

const config: HardhatUserConfig = {
    solidity: {
        compilers: [
            {
                version: '0.8.24',
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
        bellecour: {
            chainId: 134,
            url: 'https://bellecour.iex.ec',
            hardfork: 'berlin', // No EIP-1559 before London fork
            gasPrice: 0,
            blockGasLimit: 6_700_000,
            accounts: {
                mnemonic: process.env.IEXEC_VOUCHER_BELLECOUR_MNEMONIC || '',
            },
        },
    },
    namedAccounts: {
        deployer: {
            default: 0,
        },
        manager: {
            hardhat: 1,
            localhost: managerAccount,
            bellecour: '',
        },
        minter: {
            hardhat: 2,
            localhost: minterAccount,
            bellecour: '',
        },
    },
    dependencyCompiler: {
        paths: ['@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol'],
        keep: true, // Keep it for slither
    },
};

export default config;
