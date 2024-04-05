import { AddressLike, BigNumberish, ContractTransactionReceipt, Signer } from 'ethers';
import { ethers } from 'hardhat';
import { Voucher, VoucherProxy } from '../../typechain-types';
import { VoucherV2Mock } from '../../typechain-types/contracts/mocks';
import { VoucherHub } from '../typechain-types';

// TODO move file to test/

export async function createVoucherType(
    voucherHub: VoucherHub,
    signer: Signer,
    description: string,
    duration: BigNumberish,
) {
    const tx = await voucherHub.connect(signer).createVoucherType(description, duration);
    return await tx.wait();
}

export async function createVoucher(
    voucherHub: VoucherHub,
    signer: Signer,
    voucherOwner: AddressLike,
    voucherType: BigNumberish,
) {
    const tx = await voucherHub.connect(signer).createVoucher(voucherOwner, voucherType);
    return await tx.wait();
}

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
