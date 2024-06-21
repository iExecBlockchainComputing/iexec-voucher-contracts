// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { deployments, ethers, upgrades } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import deploymentConfig from '../config/deployment';
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
    const { deployer, manager, minter } = await hre.getNamedAccounts();
    await deployAll(deployer, manager, minter);
}

export async function deployAll(
    admin: string,
    manager: string,
    minter: string,
    iexecPoco?: string,
) {
    console.log(`Deploying all contracts related to voucher..`);
    const chainId = (await ethers.provider.getNetwork()).chainId.toString();
    console.log('ChainId:', chainId);
    console.log(`Using admin address: ${admin}`);
    console.log(`Using manager address: ${manager}`);
    console.log(`Using minter address: ${minter}`);
    const config = await getDeploymentConfig(Number(chainId));
    iexecPoco = iexecPoco || config.pocoAddress;
    console.log(`Using PoCo address: ${iexecPoco}`);
    return await (config.factory
        ? deployAllWithFactory(
              admin,
              manager,
              minter,
              iexecPoco,
              config.salt || '0x0000000000000000000000000000000000000000000000000000000000000000',
          )
        : deployAllWithEOA(admin, manager, minter, iexecPoco));
}

/**
 * Deploy all contracts related to voucher through a generic factory.
 */
async function deployAllWithFactory(
    admin: string,
    manager: string,
    minter: string,
    iexecPoco: string,
    salt: string,
) {
    const adminSigner = await ethers.getSigner(admin);
    const factoryConfig = require('@amxx/factory/deployments/GenericFactory.json');
    const factoryAddress = factoryConfig.address;
    if ((await ethers.provider.getCode(factoryAddress)) == '0x') {
        console.log('Deploying factory on this network..');
        await adminSigner
            .sendTransaction({ to: factoryConfig.deployer, value: factoryConfig.cost })
            .then((tx) => tx.wait());
        await ethers.provider.broadcastTransaction(factoryConfig.tx).then((tx) => tx.wait());
    }
    const genericFactory = GenericFactory_shanghai__factory.connect(factoryAddress, adminSigner);
    console.log(`Factory: ${factoryAddress}`);
    console.log(`Salt: ${salt}`);
    const voucherImplAddress = await deployWithFactory('VoucherImpl', Voucher__factory.bytecode);
    const voucherUpgradableBeaconAddress = await deployWithFactory(
        'VoucherUpgradeableBeacon',
        await new UpgradeableBeacon__factory()
            .getDeployTransaction(voucherImplAddress, admin)
            .then((tx) => tx.data),
    );
    // Proxy needs to be registered in case an upgrade is performed later
    await upgrades.forceImport(voucherUpgradableBeaconAddress, new Voucher__factory());
    // Deploy VoucherHub implementation and proxy
    const voucherHubImplAddress = await deployWithFactory(
        'VoucherHubImpl',
        VoucherHub__factory.bytecode,
    );
    const voucherHubERC1967ProxyAddress = await deployWithFactory(
        'VoucherHubERC1967Proxy',
        await new ERC1967Proxy__factory()
            .getDeployTransaction(
                voucherHubImplAddress,
                VoucherHub__factory.createInterface().encodeFunctionData('initialize', [
                    admin,
                    manager,
                    minter,
                    iexecPoco,
                    voucherUpgradableBeaconAddress,
                ]),
            )
            .then((tx) => tx.data),
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
    async function deployWithFactory(name: string, bytecode: string) {
        const contractAddress = await genericFactory.predictAddress(bytecode, salt);
        let justDeployed = false;
        if ((await ethers.provider.getCode(contractAddress)) == '0x') {
            await genericFactory.createContract(bytecode, salt).then((tx) => tx.wait());
            justDeployed = true;
        }
        console.log(`${name}: ${contractAddress} ${justDeployed ? '' : '(previously deployed)'}`);
        await deployments.save(name, {
            abi: [],
            address: contractAddress,
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
    await deployments.save('VoucherHub', {
        // TODO save abi.
        abi: [],
        address: voucherHubAddress,
    });
    console.log(`UpgradeableBeacon: ${beaconAddress}`);
    console.log(`Voucher implementation: ${await beacon.implementation()}`);
    console.log(`VoucherHub: ${voucherHubAddress}`);
    return { voucherHubAddress, voucherBeaconAddress: beaconAddress };
}

/**
 * Get deployment config according to chain.
 */
async function getDeploymentConfig(chainId: number) {
    // Read default config of the target chain.
    const config = deploymentConfig[chainId];
    let pocoAddress: string = config?.pocoAddress;
    // Override config if required.
    if (process.env.IEXEC_POCO_ADDRESS) {
        config.pocoAddress = process.env.IEXEC_POCO_ADDRESS;
    }
    // Check final config.
    if (!ethers.isAddress(pocoAddress)) {
        throw new Error('Valid PoCo address must be provided');
    }
    if (process.env.FACTORY) {
        config.factory = process.env.FACTORY == 'true';
    }
    return config;
}
