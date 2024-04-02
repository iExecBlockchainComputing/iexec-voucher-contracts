// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';
import { ethers } from 'hardhat';
import * as voucherUtils from '../../scripts/voucherUtils';

export default buildModule('Voucher', async function (m) {
    // const owner = m.getAccount(0);
    const [owner] = await ethers.getSigners();
    voucherUtils.deployBeaconAndImplementation(owner);
    const apollo = m.contract('VoucherProxy', [beaconAddress]);

    m.call(apollo, 'launch', []);

    // Adding new Hardhat Futures here will not re-run the previous ones
    // (if the same network is used) and will run only the new ones.
    // More info:
    // https://hardhat.org/ignition/docs/guides/modifications#modifying-an-existing-module
    return { apollo };
});
