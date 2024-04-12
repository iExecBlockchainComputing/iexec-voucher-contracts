import { ContractTransactionReceipt } from 'ethers';
import { ethers } from 'hardhat';
import { Voucher, VoucherProxy } from '../../typechain-types';
import { VoucherV2Mock } from '../../typechain-types/contracts/mocks';

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
    if (txReceipt != null) {
        const block = await ethers.provider.getBlock(txReceipt.blockNumber);
        if (block) {
            return block.timestamp + voucherDuration;
        } else {
            return 0;
        }
    } else {
        return 0;
    }
}
