// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers } from 'hardhat';
import beaconModule from './Beacon';

export default buildModule('Voucher', function (m) {
    m.useModule(beaconModule);
    // const owner = m.getAccount(0);
    const beaconAddress = ethers.ZeroAddress;
    const VoucherProxy = m.contract('VoucherProxy', [beaconAddress]);

    // m.call(VoucherProxy, 'initialize', []);

    return { VoucherProxy };
});
