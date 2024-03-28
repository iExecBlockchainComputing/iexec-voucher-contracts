// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractFactory } from 'ethers';
import { ethers, upgrades } from 'hardhat';
import { VoucherHub } from '../typechain-types';

export async function deployHub(iexecPoco: string, beacon: string): Promise<VoucherHub> {
    const VoucherHubFactory = await ethers.getContractFactory('VoucherHub');
    // @dev Type declaration produces a warning until feature is supported by
    // openzeppelin plugin. See "Support TypeChain in deployProxy function":
    // https://github.com/OpenZeppelin/openzeppelin-upgrades/pull/535
    const contract: unknown = await upgrades.deployProxy(VoucherHubFactory, [iexecPoco, beacon]);
    // Workaround openzeppelin-upgrades/pull/535;
    const voucherHub = contract as VoucherHub;
    return await voucherHub.waitForDeployment();
}

export async function upgradeProxy(
    voucherHubAddress: string,
    newVoucherHubImplementationFactory: ContractFactory,
): Promise<VoucherHub> {
    const contractUpgrade: unknown = await upgrades.upgradeProxy(
        voucherHubAddress,
        newVoucherHubImplementationFactory,
    );
    const voucherHubUpgrade = contractUpgrade as VoucherHub;
    await voucherHubUpgrade.waitForDeployment();
    const voucherBeaconAddress = await voucherHubUpgrade.getVoucherBeacon();
    const expectedHashes = await getVoucherProxyCreationCodeHash(voucherBeaconAddress);
    const actualHash = await getVoucherProxyCreationCodeHashFromStorage(voucherHubAddress);
    if (!expectedHashes.includes(actualHash)) {
        throw new Error(
            'Voucher proxy code hash in the new VoucherHub implementation does not match the real hash ' +
                `[actual: ${actualHash}, expected:${expectedHashes}]`,
        );
    }
    return voucherHubUpgrade;
}

/**
 * Read the value of the VoucherProxy creationCode hash from the storage of the
 * VoucherHub contract.
 * @param voucherHubAddress
 * @returns value of the hash
 */
export async function getVoucherProxyCreationCodeHashFromStorage(voucherHubAddress: string) {
    // See contracts/VoucherHub.sol
    const voucherHubStorageSlot = BigInt(
        '0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800',
    );
    const codeHashSlot = voucherHubStorageSlot + 2n;
    return await ethers.provider.getStorage(voucherHubAddress, codeHashSlot);
}

/**
 * Get a hardcoded value of the VoucherProxy creationCode hash to prevent
 * botched upgrades.
 *
 * @param voucherBeaconAddress
 * @returns value of the hash
 */
export async function getVoucherProxyCreationCodeHash(voucherBeaconAddress: string) {
    const factory = await ethers.getContractFactory('VoucherProxy');
    const tx = await factory.getDeployTransaction(voucherBeaconAddress);
    /**
     * tx.data is the same as Solidity value of:
     * ```
     * abi.encodePacked(
     *     type(VoucherProxy).creationCode, // bytecode
     *     abi.encode($._voucherBeacon) // constructor args
     * )
     * ```
     */
    return ethers.keccak256(tx.data);

    // TODO comment the implementation and return a hardcoded hash.
    // For some reason, the hash is different between "hardhat test" and "hardhat coverage".
    // '0x6b4bda6ca928b9724d26ee10eb17168dcd9c632e1905c854c10b78a05cd83398' // hardhat test
    // '0x97822cb09c6322b4ccd1c4bb70005e4a3ce60099d392676696ce3d3d69e8949f' // hardhat coverage

    // console.log(ethers.keccak256(tx.data));
    // return '<hash>'
}
