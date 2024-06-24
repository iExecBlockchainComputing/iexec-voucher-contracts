// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractTransactionReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { Voucher, VoucherProxy, VoucherV2Mock } from '../typechain-types';

export async function getVoucher(voucherAddress: string): Promise<Voucher> {
    return await ethers.getContractAt('Voucher', voucherAddress);
}

export async function getVoucherV2(voucherAddress: string): Promise<VoucherV2Mock> {
    return await ethers.getContractAt('VoucherV2Mock', voucherAddress);
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
