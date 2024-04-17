// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";

pragma solidity ^0.8.20;

interface IVoucher {
    event AccountAuthorized(address indexed account);
    event AccountUnauthorized(address indexed account);
    event OrdersMatchedWithVoucher(bytes32 dealId);

    function authorizeAccount(address account) external;
    function unauthorizeAccount(address account) external;
    function matchOrders(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32);
    function getExpiration() external view returns (uint256);
    function getType() external view returns (uint256);
    function isAccountAuthorized(address account) external view returns (bool);
    function getSponsoredAmount(bytes32 dealId) external view returns (uint256);
    function getBalance() external view returns (uint256);
    function getVoucherHub() external view returns (address);
}
