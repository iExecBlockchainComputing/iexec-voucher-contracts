// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import * as helpers from '@nomicfoundation/hardhat-network-helpers';
import { ContractFactory } from 'ethers';
import { deployments, ethers, upgrades } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import deploymentConfig from '../config/deployment';
import { isLocalFork } from '../hardhat.config';
import * as voucherHubUtils from '../scripts/voucherHubUtils';
import * as voucherUtils from '../scripts/voucherUtils';
import {
    ERC1967Proxy__factory,
    GenericFactory_shanghai__factory,
    UpgradeableBeacon,
    UpgradeableBeacon__factory,
    VoucherHub__factory,
    Voucher__factory,
} from '../typechain-types';

export default async function (hre: HardhatRuntimeEnvironment) {
    if (isLocalFork) {
        /**
         * This fixes following issue when deploying to a local Bellecour fork:
         * `ProviderError: No known hardfork for execution on historical block [...] in chain with id 134.`
         * See: https://github.com/NomicFoundation/hardhat/issues/5511#issuecomment-2288072104
         */
        await helpers.mine();
    }
    const { deployer, manager, minter } = await hre.getNamedAccounts();
    await deployAll(deployer, manager, minter);
}

export async function deployAll(
    upgrader: string,
    manager: string,
    minter: string,
    iexecPoco?: string,
) {
    console.log(`Deploying all contracts related to voucher..`);
    const chainId = (await ethers.provider.getNetwork()).chainId.toString();
    console.log('ChainId:', chainId);
    console.log(`Using upgrader address: ${upgrader}`);
    console.log(`Using manager address: ${manager}`);
    console.log(`Using minter address: ${minter}`);
    const config = await getDeploymentConfig(Number(chainId));
    iexecPoco = iexecPoco || config.pocoAddress;
    console.log(`Using PoCo address: ${iexecPoco}`);
    return await (config.factory
        ? deployAllWithFactory(upgrader, manager, minter, iexecPoco, config.salt || ethers.ZeroHash)
        : deployAllWithEOA(upgrader, manager, minter, iexecPoco));
}

/**
 * Deploy all contracts related to voucher through a generic factory.
 */
async function deployAllWithFactory(
    upgrader: string,
    manager: string,
    minter: string,
    iexecPoco: string,
    salt: string,
) {
    const upgraderSigner = await ethers.getSigner(upgrader);
    const factoryConfig = require('@amxx/factory/deployments/GenericFactory.json');
    const factoryAddress = factoryConfig.address;
    if ((await ethers.provider.getCode(factoryAddress)) == '0x') {
        console.log('Deploying factory on this network..');
        await upgraderSigner
            .sendTransaction({ to: factoryConfig.deployer, value: factoryConfig.cost })
            .then((tx) => tx.wait());
        await ethers.provider.broadcastTransaction(factoryConfig.tx).then((tx) => tx.wait());
    }
    const genericFactory = GenericFactory_shanghai__factory.connect(factoryAddress, upgraderSigner);
    console.log(`Factory: ${factoryAddress}`);
    console.log(`Salt: ${salt}`);
    const voucherImplAddress = await deployWithFactory('VoucherImpl', new Voucher__factory(), []);
    const voucherUpgradableBeaconAddress = await deployWithFactory(
        'VoucherUpgradeableBeacon',
        new UpgradeableBeacon__factory(),
        [voucherImplAddress, upgrader],
    );

    // Proxy needs to be registered in case an upgrade is performed later
    await upgrades.forceImport(voucherUpgradableBeaconAddress, new Voucher__factory());
    // Deploy VoucherHub implementation and proxy
    const voucherHubImplAddress = await deployWithFactory(
        'VoucherHubImpl',
        new VoucherHub__factory(),
        [],
    );
    const voucherHubERC1967ProxyAddress = await deployWithFactory(
        'VoucherHubERC1967Proxy',
        new ERC1967Proxy__factory(),
        [
            voucherHubImplAddress,
            VoucherHub__factory.createInterface().encodeFunctionData('initialize', [
                upgrader,
                manager,
                minter,
                iexecPoco,
                voucherUpgradableBeaconAddress,
            ]),
        ],
    );
    await upgrades.forceImport(voucherHubERC1967ProxyAddress, new VoucherHub__factory());
    return {
        voucherHubAddress: voucherHubERC1967ProxyAddress,
        voucherBeaconAddress: voucherUpgradableBeaconAddress,
    };

    /**
     * Deploy contract with create2 through a generic factory.
     * @param name Contract name
     * @param bytecode Contract bytecode
     * @returns instance address
     */
    async function deployWithFactory(
        name: string,
        contractFactory: ContractFactory,
        constructorArgs: any[],
    ) {
        let bytecode = (await contractFactory.getDeployTransaction(...constructorArgs)).data;
        const contractAddress = await genericFactory.predictAddress(bytecode, salt);
        let transactionReceipt;
        let justDeployed = false;
        if ((await ethers.provider.getCode(contractAddress)) == '0x') {
            transactionReceipt = await genericFactory
                .createContract(bytecode, salt)
                .then((tx) => tx.wait());
            justDeployed = true;
        }
        console.log(`${name}: ${contractAddress} ${justDeployed ? '' : '(previously deployed)'}`);
        await deployments.save(name, {
            abi: (contractFactory as any).constructor.abi,
            address: contractAddress,
            args: constructorArgs,
            transactionHash: transactionReceipt?.hash,
            bytecode,
        });
        return contractAddress;
    }
}

/**
 * Deploy all contracts related to voucher directly from an EOA.
 */
async function deployAllWithEOA(admin: string, manager: string, minter: string, iexecPoco: string) {
    // Deploy Voucher beacon and implementation.
    const beacon: UpgradeableBeacon = await voucherUtils.deployBeaconAndImplementation(admin);
    const beaconAddress = await beacon.getAddress();
    // Deploy VoucherHub.
    const voucherHub = await voucherHubUtils.deployHub(
        admin,
        manager,
        minter,
        iexecPoco,
        beaconAddress,
    );
    const voucherHubAddress = await voucherHub.getAddress();
    // Check
    if ((await voucherHub.getVoucherBeacon()) !== beaconAddress) {
        throw new Error('Deployment error');
    }
    // Save VoucherHub in deployments folder because
    // hardhat-deploy#deploy() is not used.
    await deployments.save('VoucherHubERC1967Proxy', {
        // TODO save abi.
        abi: [],
        address: voucherHubAddress,
    });
    console.log(`VoucherUpgradeableBeacon: ${beaconAddress}`);
    console.log(`VoucherImpl: ${await beacon.implementation()}`);
    console.log(`VoucherHubERC1967Proxy: ${voucherHubAddress}`);
    return { voucherHubAddress, voucherBeaconAddress: beaconAddress };
}

/**
 * Get deployment config according to chain.
 */
export async function getDeploymentConfig(chainId: number) {
    // Read default config of the target chain.
    const config = deploymentConfig[chainId];
    // Override config if required.
    if (process.env.IEXEC_POCO_ADDRESS) {
        config.pocoAddress = process.env.IEXEC_POCO_ADDRESS;
    }
    // Check final config.
    if (!ethers.isAddress(config.pocoAddress)) {
        throw new Error('Valid PoCo address must be provided');
    }
    if (process.env.FACTORY) {
        config.factory = process.env.FACTORY == 'true';
    }
    return config;
}
