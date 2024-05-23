// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';

export function createMockOrder() {
    return {
        app: ethers.ZeroAddress,
        appmaxprice: 0n,
        appprice: 0n,
        apprestrict: ethers.ZeroAddress,
        beneficiary: ethers.ZeroAddress,
        callback: ethers.ZeroAddress,
        category: 0n,
        dataset: ethers.ZeroAddress,
        datasetmaxprice: 0n,
        datasetprice: 0n,
        datasetrestrict: ethers.ZeroAddress,
        params: '',
        requester: ethers.ZeroAddress,
        requesterrestrict: ethers.ZeroAddress,
        salt: ethers.ZeroHash,
        sign: '0x',
        tag: ethers.ZeroHash,
        trust: 0n,
        volume: 1n,
        workerpool: ethers.ZeroAddress,
        workerpoolmaxprice: 0n,
        workerpoolprice: 0n,
        workerpoolrestrict: ethers.ZeroAddress,
    };
}
