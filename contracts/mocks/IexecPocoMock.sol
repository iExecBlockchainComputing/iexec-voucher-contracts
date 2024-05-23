// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IexecLibOrders_v5} from "@iexec/poco/contracts/libs/IexecLibOrders_v5.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @notice Testing purposes only.
 */
contract IexecPocoMock is ERC20 {
    using Math for uint256;
    using IexecLibOrders_v5 for IexecLibOrders_v5.AppOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.DatasetOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.WorkerpoolOrder;
    using IexecLibOrders_v5 for IexecLibOrders_v5.RequestOrder;
    bool public shouldRevertOnSponsorMatchOrders = false;
    bool public shouldRevertOnSponsorMatchOrdersBoost = false;
    bytes32 public EIP712DOMAIN_SEPARATOR = "EIP712DOMAIN_SEPARATOR";
    mapping(bytes32 => uint256) public m_consumed;

    constructor() ERC20("Staked RLC", "SRLC") {
        _mint(msg.sender, 1000000);
    }

    function sponsorMatchOrders(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32 dealId) {
        if (shouldRevertOnSponsorMatchOrders) {
            revert("IexecPocoMock: Failed to sponsorMatchOrders");
        }
        bytes32 requestOrderTypedDataHash = _toTypedDataHash(requestOrder.hash());
        bytes32 appOrderTypedDataHash = _toTypedDataHash(appOrder.hash());
        bytes32 workerpoolOrderTypedDataHash = _toTypedDataHash(workerpoolOrder.hash());

        uint256 requestOrderConsumed = m_consumed[requestOrderTypedDataHash];
        uint256 appOrderConsumed = m_consumed[appOrderTypedDataHash];
        uint256 workerpoolOrderConsumed = m_consumed[workerpoolOrderTypedDataHash];

        uint256 volume = appOrder.volume - appOrderConsumed;
        volume = volume.min(workerpoolOrder.volume - workerpoolOrderConsumed);
        volume = volume.min(requestOrder.volume - requestOrderConsumed);

        if (datasetOrder.dataset != address(0)) {
            bytes32 datasetOrderTypedDataHash = _toTypedDataHash(datasetOrder.hash());
            uint256 datasetOrderConsumed = m_consumed[datasetOrderTypedDataHash];
            volume = volume.min(datasetOrder.volume - datasetOrderConsumed);
        }

        uint256 dealPrice = (appOrder.appprice +
            datasetOrder.datasetprice +
            workerpoolOrder.workerpoolprice) * volume;
        _burn(msg.sender, dealPrice);
        return keccak256("deal");
    }

    function sponsorMatchOrdersBoost(
        IexecLibOrders_v5.AppOrder calldata appOrder,
        IexecLibOrders_v5.DatasetOrder calldata datasetOrder,
        IexecLibOrders_v5.WorkerpoolOrder calldata workerpoolOrder,
        IexecLibOrders_v5.RequestOrder calldata requestOrder
    ) external returns (bytes32 dealId) {
        if (shouldRevertOnSponsorMatchOrdersBoost) {
            revert("IexecPocoMock: Failed to sponsorMatchOrdersBoost");
        }
        bytes32 requestOrderTypedDataHash = _toTypedDataHash(requestOrder.hash());
        bytes32 appOrderTypedDataHash = _toTypedDataHash(appOrder.hash());
        bytes32 workerpoolOrderTypedDataHash = _toTypedDataHash(workerpoolOrder.hash());

        uint256 requestOrderConsumed = m_consumed[requestOrderTypedDataHash];
        uint256 appOrderConsumed = m_consumed[appOrderTypedDataHash];
        uint256 workerpoolOrderConsumed = m_consumed[workerpoolOrderTypedDataHash];

        uint256 volume = appOrder.volume - appOrderConsumed;
        volume = volume.min(workerpoolOrder.volume - workerpoolOrderConsumed);
        volume = volume.min(requestOrder.volume - requestOrderConsumed);

        if (datasetOrder.dataset != address(0)) {
            bytes32 datasetOrderTypedDataHash = _toTypedDataHash(datasetOrder.hash());
            uint256 datasetOrderConsumed = m_consumed[datasetOrderTypedDataHash];
            volume = volume.min(datasetOrder.volume - datasetOrderConsumed);
        }

        uint256 dealPrice = (appOrder.appprice +
            datasetOrder.datasetprice +
            workerpoolOrder.workerpoolprice) * volume;
        _burn(
            msg.sender,
            appOrder.appprice + datasetOrder.datasetprice + workerpoolOrder.workerpoolprice
        );
        return keccak256("deal");
    }

    function willRevertOnSponsorMatchOrders() external {
        shouldRevertOnSponsorMatchOrders = true;
    }
    function willRevertOnSponsorMatchOrdersBoost() external {
        shouldRevertOnSponsorMatchOrdersBoost = true;
    }

    function _toTypedDataHash(bytes32 structHash) internal view returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(EIP712DOMAIN_SEPARATOR, structHash);
    }

    function eip712domain_separator() external view returns (bytes32) {
        return EIP712DOMAIN_SEPARATOR;
    }

    function viewConsumed(bytes32 _id) external view returns (uint256 consumed) {
        return m_consumed[_id];
    }
}
