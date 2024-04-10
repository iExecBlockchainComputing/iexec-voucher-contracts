// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AccessControlDefaultAdminRulesUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {Voucher} from "./beacon/Voucher.sol";
import {VoucherProxy} from "./beacon/VoucherProxy.sol";
import {IVoucherHub} from "./IVoucherHub.sol";

contract VoucherHub is
    AccessControlDefaultAdminRulesUpgradeable,
    ERC20Upgradeable,
    UUPSUpgradeable,
    IVoucherHub
{
    // Grant/revoke roles through delayed 2 steps process.
    // Used to grant the rest of the roles.
    // Granted to msg.sender == defaultAdmin() == owner()
    // DEFAULT_ADMIN_ROLE

    // Upgrade VoucherHub and Vouchers contracts.
    // Granted to msg.sender
    bytes32 public constant UPGRADE_MANAGER_ROLE = keccak256("UPGRADE_MANAGER_ROLE");
    // Add/remove eligible assets.
    bytes32 public constant ASSET_ELIGIBILITY_MANAGER_ROLE =
        keccak256("ASSET_ELIGIBILITY_MANAGER_ROLE");
    // Create & top up Vouchers.
    bytes32 public constant VOUCHER_MANAGER_ROLE = keccak256("VOUCHER_MANAGER_ROLE");

    /// @custom:storage-location erc7201:iexec.voucher.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecPoco;
        address _voucherBeacon;
        /// @dev This hash should be updated when `VoucherProxy` is updated.
        bytes32 _voucherCreationCodeHash;
        VoucherType[] voucherTypes;
        mapping(uint256 voucherTypeId => mapping(address asset => bool)) matchOrdersEligibility;
    }

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.VoucherHub")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800;

    modifier whenVoucherTypeExists(uint256 id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(id < $.voucherTypes.length, "VoucherHub: type index out of bounds");
        _;
    }

    function _getVoucherHubStorage() private pure returns (VoucherHubStorage storage $) {
        assembly {
            $.slot := VOUCHER_HUB_STORAGE_LOCATION
        }
    }

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address assetEligibilityManager,
        address voucherManager,
        address iexecPoco,
        address voucherBeacon
    ) external initializer {
        // DEFAULT_ADMIN_ROLE is granted to msg.sender.
        __AccessControlDefaultAdminRules_init(0, msg.sender);
        _grantRole(UPGRADE_MANAGER_ROLE, msg.sender);
        _grantRole(ASSET_ELIGIBILITY_MANAGER_ROLE, assetEligibilityManager);
        _grantRole(VOUCHER_MANAGER_ROLE, voucherManager);
        __ERC20_init("iExec Voucher token", "VCHR");
        __UUPSUpgradeable_init();
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._iexecPoco = iexecPoco;
        $._voucherBeacon = voucherBeacon;
        $._voucherCreationCodeHash = keccak256(
            abi.encodePacked(
                type(VoucherProxy).creationCode, // bytecode
                abi.encode($._voucherBeacon) // constructor args
            )
        );
    }

    /**
     * @notice VCHR is not transferable.
     */
    function transfer(address to, uint256 value) public pure override returns (bool) {
        to; // Silence unsused
        value; // variable warnings
        revert("VoucherHub: Unsupported transfer");
    }

    /**
     *
     * @notice See `transfer` note above.
     */
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) public pure override returns (bool) {
        from; // Silence
        to; // unsused variable
        value; // warning
        revert("VoucherHub: Unsupported transferFrom");
    }

    function createVoucherType(
        string memory description,
        uint256 duration
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes.push(VoucherType(description, duration));
        emit VoucherTypeCreated($.voucherTypes.length - 1, description, duration);
    }

    function updateVoucherTypeDescription(
        uint256 id,
        string memory description
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) whenVoucherTypeExists(id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes[id].description = description;
        emit VoucherTypeDescriptionUpdated(id, description);
    }

    function updateVoucherTypeDuration(
        uint256 id,
        uint256 duration
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) whenVoucherTypeExists(id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.voucherTypes[id].duration = duration;
        emit VoucherTypeDurationUpdated(id, duration);
    }

    /**
     * Get the voucher type details by ID.
     */
    function getVoucherType(
        uint256 id
    ) public view whenVoucherTypeExists(id) returns (VoucherType memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.voucherTypes[id];
    }

    /**
     * Get voucher types count.
     */
    function getVoucherTypeCount() public view returns (uint256) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.voucherTypes.length;
    }

    /**
     * Add an eligible asset to a voucher type.
     * @param voucherTypeId The ID of the voucher type.
     * @param asset The address of the asset to add.
     */
    function addEligibleAsset(
        uint256 voucherTypeId,
        address asset
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) {
        _setAssetEligibility(voucherTypeId, asset, true);
        emit EligibleAssetAdded(voucherTypeId, asset);
    }

    /**
     * Remove an eligible asset to a voucher type.
     * @param voucherTypeId The ID of the voucher type.
     * @param asset The address of the asset to remove.
     */
    function removeEligibleAsset(
        uint256 voucherTypeId,
        address asset
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) {
        _setAssetEligibility(voucherTypeId, asset, false);
        emit EligibleAssetRemoved(voucherTypeId, asset);
    }

    /**
     * Check if an asset is eligible to match orders sponsoring.
     * @param voucherTypeId The ID of the voucher type.
     * @param asset The address of the asset to check.
     */
    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId,
        address asset
    ) public view returns (bool) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $.matchOrdersEligibility[voucherTypeId][asset];
    }

    /**
     * Get iExec Poco address used by vouchers.
     */
    function getIexecPoco() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._iexecPoco;
    }

    /**
     * Get voucher beacon address.
     */
    function getVoucherBeacon() public view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherBeacon;
    }

    /**
     * TODO add checks.
     *
     * Create new voucher for the specified account and call initialize function.
     * Only 1 voucher is allowed by account. This is guaranteed by "create2" mechanism
     * and using the account address as salt.
     * @dev Note: the same account could have 2 voucher instances if the "beaconAddress"
     * changes, but this should not happen since the beacon is upgradeable, hence the
     * address should never be changed.
     * @param owner The address of the voucher owner.
     * @param voucherType The ID of the voucher type.
     * @return voucherAddress The address of the created voucher contract.
     */
    function createVoucher(
        address owner,
        uint256 voucherType,
        uint256 value
    ) external onlyRole(VOUCHER_MANAGER_ROLE) returns (address voucherAddress) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        uint256 voucherExpiration = block.timestamp + getVoucherType(voucherType).duration;
        voucherAddress = address(new VoucherProxy{salt: _getCreate2Salt(owner)}($._voucherBeacon));
        // Initialize the created proxy contract.
        // The proxy contract does a delegatecall to its implementation.
        // Re-Entrancy safe because the target contract is controlled.
        Voucher(voucherAddress).initialize(owner, address(this), voucherExpiration, voucherType);
        IERC20($._iexecPoco).transfer(voucherAddress, value); // SRLC
        _mint(voucherAddress, value); // VCHR
        emit VoucherCreated(voucherAddress, owner, voucherExpiration, voucherType);
    }

    function debitVoucher(uint256 debitAmount) external {
        _burn(msg.sender, debitAmount);
        emit VoucherDebited(msg.sender, debitAmount);
    }

    /**
     * TODO return Voucher structure.
     *
     * Get voucher address of a given account.
     * Returns address(0) if voucher is not found.
     * @param account voucher's owner address.
     */
    function getVoucher(address account) public view returns (address voucherAddress) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        voucherAddress = Create2.computeAddress(
            _getCreate2Salt(account), // salt
            $._voucherCreationCodeHash // bytecode hash
        );
        return voucherAddress.code.length > 0 ? voucherAddress : address(0);
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADE_MANAGER_ROLE) {}

    function _setAssetEligibility(uint256 voucherTypeId, address asset, bool isEligible) private {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $.matchOrdersEligibility[voucherTypeId][asset] = isEligible;
    }

    function _getCreate2Salt(address account) private pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }
}
