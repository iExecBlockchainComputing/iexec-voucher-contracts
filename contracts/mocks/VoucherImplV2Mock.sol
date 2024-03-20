// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {IVoucher} from "../beacon/IVoucher.sol";
import {VoucherBase} from "../beacon/VoucherBase.sol";

contract VoucherImplV2Mock is Initializable, IVoucher, VoucherBase {
    // TODO remove
    function getVersion() external view override returns (uint) {
        return _getVoucherStorage().version;
    }
}
