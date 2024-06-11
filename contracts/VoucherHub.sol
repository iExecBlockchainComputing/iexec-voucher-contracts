// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {AccessControlDefaultAdminRulesUpgradeable} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlDefaultAdminRulesUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import {Voucher} from "./beacon/Voucher.sol";
import {VoucherProxy} from "./beacon/VoucherProxy.sol";
import {NonTransferableERC20Upgradeable} from "./NonTransferableERC20Upgradeable.sol";
import {IVoucherHub} from "./IVoucherHub.sol";

contract VoucherHub is
    AccessControlDefaultAdminRulesUpgradeable,
    UUPSUpgradeable,
    IVoucherHub,
    NonTransferableERC20Upgradeable
{
    // Grant/revoke roles through delayed 2 steps process.
    // Used to grant the rest of the roles.
    // Granted to msg.sender == defaultAdmin() == owner()
    // DEFAULT_ADMIN_ROLE

    // TODO: Rename roles.
    // Upgrade VoucherHub and Vouchers contracts.
    // Granted to msg.sender
    bytes32 public constant UPGRADE_MANAGER_ROLE = keccak256("UPGRADE_MANAGER_ROLE");
    // Add/remove eligible assets.
    bytes32 public constant ASSET_ELIGIBILITY_MANAGER_ROLE =
        keccak256("ASSET_ELIGIBILITY_MANAGER_ROLE");
    // Create & top up Vouchers.
    bytes32 public constant VOUCHER_MANAGER_ROLE = keccak256("VOUCHER_MANAGER_ROLE");

    // keccak256(abi.encode(uint256(keccak256("iexec.voucher.storage.VoucherHub")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant VOUCHER_HUB_STORAGE_LOCATION =
        0xfff04942078b704e33df5cf14e409bc5d715ca54e60a675b011b759db89ef800;

    /// @custom:storage-location erc7201:iexec.voucher.storage.VoucherHub
    struct VoucherHubStorage {
        address _iexecPoco;
        address _voucherBeacon;
        /// @dev This hash should be updated when `VoucherProxy` is updated.
        bytes32 _voucherCreationCodeHash;
        VoucherType[] _voucherTypes;
        mapping(uint256 voucherTypeId => mapping(address asset => bool)) _matchOrdersEligibility;
        // Track created vouchers to avoid replay in certain operations such as refund.
        mapping(address voucherAddress => bool) _isVoucher;
    }

    modifier whenVoucherTypeExists(uint256 id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require(id < $._voucherTypes.length, "VoucherHub: type index out of bounds");
        _;
    }

    modifier onlyVoucher() {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require($._isVoucher[msg.sender], "VoucherHub: sender is not voucher");
        _;
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
        // This ERC20 is used solely to keep track of the SRLC's accounting in circulation for all emitted vouchers.
        __ERC20_init("iExec Voucher token", "VCHR");
        __UUPSUpgradeable_init();
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._iexecPoco = iexecPoco;
        $._voucherBeacon = voucherBeacon;
        //slither-disable-start too-many-digits
        // See : https://github.com/crytic/slither/issues/1223
        $._voucherCreationCodeHash = keccak256(
            abi.encodePacked(
                type(VoucherProxy).creationCode, // bytecode
                abi.encode($._voucherBeacon) // constructor args
            )
        );
        //slither-disable-end too-many-digits
    }

    function createVoucherType(
        string memory description,
        uint256 duration
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypes.push(VoucherType(description, duration));
        emit VoucherTypeCreated($._voucherTypes.length - 1, description, duration);
    }

    function updateVoucherTypeDescription(
        uint256 id,
        string memory description
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) whenVoucherTypeExists(id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypes[id].description = description;
        emit VoucherTypeDescriptionUpdated(id, description);
    }

    function updateVoucherTypeDuration(
        uint256 id,
        uint256 duration
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) whenVoucherTypeExists(id) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._voucherTypes[id].duration = duration;
        emit VoucherTypeDurationUpdated(id, duration);
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
     *
     * Create new voucher for the specified account and call initialize function.
     * Only 1 voucher is allowed by account. This is guaranteed by "create2" mechanism
     * and using the account address as salt.
     * @dev Note: the same account could have 2 voucher instances if the "beaconAddress"
     * changes, but this should not happen since the beacon is upgradeable, hence the
     * address should never be changed.
     * @param owner The address of the voucher owner.
     * @param voucherType The ID of the voucher type.
     * @param value The amount of SRLC we need to credit to the voucher.
     * @return voucherAddress The address of the created voucher contract.
     */
    function createVoucher(
        address owner,
        uint256 voucherType,
        uint256 value
    ) external onlyRole(VOUCHER_MANAGER_ROLE) returns (address voucherAddress) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        uint256 expiration = block.timestamp + getVoucherType(voucherType).duration;
        voucherAddress = address(new VoucherProxy{salt: _getCreate2Salt(owner)}($._voucherBeacon));
        // Initialize the created proxy contract.
        // The proxy contract does a delegatecall to its implementation.
        // Re-Entrancy safe because the target contract is controlled.
        Voucher(voucherAddress).initialize(owner, address(this), expiration, voucherType);
        _mint(voucherAddress, value); // VCHR
        $._isVoucher[voucherAddress] = true;
        emit VoucherCreated(voucherAddress, owner, voucherType, expiration, value);
        _transferFundsToVoucherOnPoco(voucherAddress, value); // SRLC
    }

    /**
     * Top up a voucher by increasing its balance and pushing its expiration date.
     * @param voucher The address of the voucher.
     * @param value The amount of credits to top up.
     */
    function topUpVoucher(address voucher, uint256 value) external onlyRole(VOUCHER_MANAGER_ROLE) {
        require(value > 0, "VoucherHub: no value");
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        require($._isVoucher[voucher], "VoucherHub: unknown voucher");
        _mint(voucher, value); // VCHR
        _transferFundsToVoucherOnPoco(voucher, value); // SRLC
        uint256 expiration = block.timestamp + $._voucherTypes[Voucher(voucher).getType()].duration;
        Voucher(voucher).setExpiration(expiration);
        emit VoucherToppedUp(voucher, expiration, value);
    }

    /**
     * Debit voucher balance when used assets are eligible to voucher sponsoring.
     * @notice (1) If this function is called by an account which is not a voucher,
     * it will have no effect other than consuming gas since balance would be
     * empty (tokens are only minted for vouchers).
     * (2) This function should not revert even if the amount debited is zero when
     * no asset is eligible or balance from caller is empty. Thanks to that it is
     * possible to try to debit the voucher in best effort mode (In short: "use
     * voucher if possible"), before trying other payment methods.
     *
     * Note: no need for "onlyVoucher" modifier because if the sender is not a voucher,
     * its balance would be null, then "_burn()" would revert.
     *
     * @param voucherTypeId The type ID of the voucher to debit.
     * @param app The app address.
     * @param appPrice The app price.
     * @param dataset The dataset address.
     * @param datasetPrice The dataset price.
     * @param workerpool The workerpool address.
     * @param workerpoolPrice The workerpool price.
     * @param volume Volume of the deal.
     */
    function debitVoucher(
        uint256 voucherTypeId,
        address app,
        uint256 appPrice,
        address dataset,
        uint256 datasetPrice,
        address workerpool,
        uint256 workerpoolPrice,
        uint256 volume
    ) external returns (uint256 sponsoredAmount) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        mapping(address asset => bool) storage eligible = $._matchOrdersEligibility[voucherTypeId];
        if (eligible[app]) {
            sponsoredAmount += appPrice;
        }
        if (dataset != address(0) && eligible[dataset]) {
            sponsoredAmount += datasetPrice;
        }
        if (eligible[workerpool]) {
            sponsoredAmount += workerpoolPrice;
        }
        sponsoredAmount = Math.min(balanceOf(msg.sender), sponsoredAmount * volume);
        if (sponsoredAmount > 0) {
            _burn(msg.sender, sponsoredAmount);
            emit VoucherDebited(msg.sender, sponsoredAmount);
        }
    }

    /**
     * Refund sender if it is a voucher.
     * @param amount value to be refunded
     */
    function refundVoucher(uint256 amount) external onlyVoucher {
        _mint(msg.sender, amount);
        emit VoucherRefunded(msg.sender, amount);
    }

    /**
     * Drain funds from voucher if it is expired. Transfer all RLC balance
     * on PoCo from voucher to voucherHub and burn all credits.
     * @param voucher address of the expired voucher to drain
     */
    function drainVoucher(address voucher) external {
        uint256 amount = balanceOf(voucher);
        require(amount > 0, "VoucherHub: nothing to drain");
        _burn(voucher, amount);
        emit VoucherDrained(voucher, amount);
        Voucher(voucher).drain(amount);
    }

    /**
     * Withdraw specified amount from this contract's balance on PoCo and send it
     * to the specified address.
     * @param receiver address that will receive withdrawn funds
     * @param amount amount to withdraw
     */
    function withdraw(
        address receiver,
        uint256 amount
    ) external onlyRole(ASSET_ELIGIBILITY_MANAGER_ROLE) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        // Slither raises a "transfer-unchecked" warning for the next line
        // if return value of transfer() is not checked.
        // Although transfer function in PoCo always returns true (or reverts),
        // a return value check is added here in case its behavior changes.
        if (!IERC20($._iexecPoco).transfer(receiver, amount)) {
            revert("VoucherHub: withdraw failed");
        }
    }

    /**
     * Get iExec Poco address used by vouchers.
     */
    function getIexecPoco() external view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._iexecPoco;
    }

    /**
     * Get voucher beacon address.
     */
    function getVoucherBeacon() external view returns (address) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherBeacon;
    }

    /**
     * Get voucher types count.
     */
    function getVoucherTypeCount() external view returns (uint256) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherTypes.length;
    }

    /**
     * Check if an asset is eligible to match orders sponsoring.
     * @param voucherTypeId The ID of the voucher type.
     * @param asset The address of the asset to check.
     */
    function isAssetEligibleToMatchOrdersSponsoring(
        uint256 voucherTypeId,
        address asset
    ) external view returns (bool) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._matchOrdersEligibility[voucherTypeId][asset];
    }

    /**
     * Get voucher address of a given account.
     * Returns address(0) if voucher is not found.
     * @param account voucher's owner address.
     */
    function getVoucher(address account) external view returns (address voucherAddress) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        voucherAddress = Create2.computeAddress(
            _getCreate2Salt(account), // salt
            $._voucherCreationCodeHash // bytecode hash
        );
        return voucherAddress.code.length > 0 ? voucherAddress : address(0);
    }

    /**
     * Get the voucher type details by ID.
     */
    function getVoucherType(
        uint256 id
    ) public view whenVoucherTypeExists(id) returns (VoucherType memory) {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        return $._voucherTypes[id];
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyRole(UPGRADE_MANAGER_ROLE) {}

    function _setAssetEligibility(uint256 voucherTypeId, address asset, bool isEligible) private {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        $._matchOrdersEligibility[voucherTypeId][asset] = isEligible;
    }

    function _getVoucherHubStorage() private pure returns (VoucherHubStorage storage $) {
        //slither-disable-start assembly
        assembly {
            $.slot := VOUCHER_HUB_STORAGE_LOCATION
        }
        //slither-disable-end assembly
    }

    function _getCreate2Salt(address account) private pure returns (bytes32) {
        return bytes32(uint256(uint160(account)));
    }

    function _transferFundsToVoucherOnPoco(address voucherAddress, uint256 value) private {
        VoucherHubStorage storage $ = _getVoucherHubStorage();
        if (!IERC20($._iexecPoco).transfer(voucherAddress, value)) {
            revert("VoucherHub: SRLC transfer to voucher failed");
        }
    }
}
