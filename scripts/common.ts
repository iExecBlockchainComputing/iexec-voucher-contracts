// SPDX-FileCopyrightText: 2024-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ContractTransactionReceipt } from 'ethers';
import { ethers } from 'hardhat';
import {
    Voucher,
    Voucher__factory,
    VoucherProxy,
    VoucherProxy__factory,
    VoucherV2Mock,
    VoucherV2Mock__factory,
} from '../typechain-types';

export async function getVoucher(voucherAddress: string): Promise<Voucher> {
    return Voucher__factory.connect(voucherAddress, ethers.provider);
}

export async function getVoucherV2(voucherAddress: string): Promise<VoucherV2Mock> {
    return VoucherV2Mock__factory.connect(voucherAddress, ethers.provider);
}

export async function getVoucherAsProxy(voucherAddress: string): Promise<VoucherProxy> {
    return VoucherProxy__factory.connect(voucherAddress, ethers.provider);
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
