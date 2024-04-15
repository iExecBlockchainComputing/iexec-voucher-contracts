// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { ethers } from 'hardhat';

export function createMockOrder() {
    return {
        app: ethers.ZeroAddress,
        appmaxprice: 0,
        appprice: 0,
        apprestrict: ethers.ZeroAddress,
        beneficiary: ethers.ZeroAddress,
        callback: ethers.ZeroAddress,
        category: 0,
        dataset: ethers.ZeroAddress,
        datasetmaxprice: 0,
        datasetprice: 0,
        datasetrestrict: ethers.ZeroAddress,
        params: '',
        requester: ethers.ZeroAddress,
        requesterrestrict: ethers.ZeroAddress,
        salt: ethers.ZeroHash,
        sign: '0x',
        tag: ethers.ZeroHash,
        trust: 0,
        volume: 1,
        workerpool: ethers.ZeroAddress,
        workerpoolmaxprice: 0,
        workerpoolprice: 0,
        workerpoolrestrict: ethers.ZeroAddress,
    };
}
