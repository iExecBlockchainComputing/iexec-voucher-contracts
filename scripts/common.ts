// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractTransactionReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { VoucherProxy, VoucherV1, VoucherV3Mock } from '../typechain-types';

export async function getVoucher(voucherAddress: string): Promise<VoucherV1> {
    return await ethers.getContractAt('VoucherV1', voucherAddress);
}

export async function getVoucherV3(voucherAddress: string): Promise<VoucherV3Mock> {
    return await ethers.getContractAt('VoucherV3Mock', voucherAddress);
}

export async function getVoucherAsProxy(voucherAddress: string): Promise<VoucherProxy> {
    return await ethers.getContractAt('VoucherProxy', voucherAddress);
}

export async function getExpectedExpiration(
    voucherDuration: number,
    txReceipt: ContractTransactionReceipt | null,
): Promise<number> {
    if (!txReceipt) {
        return 0;
    }
    const block = await ethers.provider.getBlock(txReceipt.blockNumber);
    return block ? block.timestamp + voucherDuration : 0;
}
