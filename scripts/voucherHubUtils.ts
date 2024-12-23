// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory } from 'ethers';
import hre, { ethers, upgrades } from 'hardhat';
import { getDeploymentConfig } from '../deploy/deploy';
import { VoucherHubV1, VoucherProxy__factory } from '../typechain-types';

export async function deployHub(
    admin: string,
    manager: string,
    minter: string,
    iexecPoco: string,
    beacon: string,
): Promise<VoucherHubV1> {
    const VoucherHubFactory = await ethers.getContractFactory('VoucherHubV1');
    // @dev Type declaration produces a warning until feature is supported by
    // openzeppelin plugin. See "Support TypeChain in deployProxy function":
    // https://github.com/OpenZeppelin/openzeppelin-upgrades/pull/535
    const contract: unknown = await upgrades.deployProxy(VoucherHubFactory, [
        admin,
        manager,
        minter,
        iexecPoco,
        beacon,
    ]);
    // Workaround openzeppelin-upgrades/pull/535;
    const voucherHub = contract as VoucherHubV1;
    return await voucherHub.waitForDeployment();
}

export async function upgradeProxy(
    voucherHubAddress: string,
    newVoucherHubImplementationFactory: ContractFactory,
): Promise<VoucherHubV1> {
    const contractUpgrade: unknown = await upgrades.upgradeProxy(
        voucherHubAddress,
        newVoucherHubImplementationFactory,
    );
    const voucherHubUpgrade = contractUpgrade as VoucherHubV1;
    await voucherHubUpgrade.waitForDeployment();
    const voucherBeaconAddress = await voucherHubUpgrade.getVoucherBeacon();
    const expectedHash = await getExpectedVoucherProxyCodeHash(voucherBeaconAddress);
    const actualHash = await voucherHubUpgrade.getVoucherProxyCodeHash();
    if (actualHash !== expectedHash) {
        throw new Error(
            'Voucher proxy code hash in the new VoucherHub implementation does not match the real hash ' +
                `[actual: ${actualHash}, expected:${expectedHash}]`,
        );
    }
    return voucherHubUpgrade;
}

/**
 * Get the expected VoucherProxy creationCode hash to prevent botched upgrades.
 * @returns value of the hash
 */
export async function getExpectedVoucherProxyCodeHash(voucherBeaconAddress: string) {
    const chainId = (await ethers.provider.getNetwork()).chainId.toString();
    const config = await getDeploymentConfig(Number(chainId));
    if (!config.factory || (hre as any).__SOLIDITY_COVERAGE_RUNNING) {
        /**
         * @dev Voucher proxy code hash is different from the production one:
         * - when running "test" without generic factory since voucher beacon address
         *   becomes not-deterministic (the EOA deployer nonce is involved).
         * - when running "coverage" since the later re-compiles contracts already
         *   compiled with standard "compile", which  might come from Solidity-coverage:
         *      - injecting statements into our Solidity code [1]
         *      - or eventually tampering our solc options (optimizer, ..) [2]
         * [1]: https://github.com/sc-forks/solidity-coverage/blob/v0.8.10/docs/faq.md#notes-on-gas-distortion
         * [2]: https://github.com/sc-forks/solidity-coverage/blob/v0.8.10/docs/faq.md#running-out-of-stack
         *
         * The expected returned value below mimics the following Solidity piece of code:
         * ```
         * abi.encodePacked(
         *     type(VoucherProxy).creationCode, // bytecode
         *     abi.encode($._voucherBeacon) // constructor args
         * )
         * ```
         */
        return ethers.solidityPackedKeccak256(
            ['bytes', 'bytes32'],
            [
                VoucherProxy__factory.bytecode, // bytecode
                ethers.zeroPadValue(voucherBeaconAddress, 32), // constructor args
            ],
        );
    } else {
        /**
         * @dev This is the voucher proxy code hash value expected in production,
         * where contracts are deployed through a generic factory, hence having
         * deterministic addresses.
         *
         * Note: Look very carefully before updating this value to avoid messing with
         * existing vouchers already deployed in production.
         */
        return '0x449675c37edf789a1c0fd983ae425bd6ba0cbd9ea33d6a821bc0544fe42a76c7';
    }
}
