# Solidity API

## VoucherHub

### UPGRADER_ROLE

```solidity
bytes32 UPGRADER_ROLE
```

### MANAGER_ROLE

```solidity
bytes32 MANAGER_ROLE
```

### MINTER_ROLE

```solidity
bytes32 MINTER_ROLE
```

### VoucherHubStorage

```solidity
struct VoucherHubStorage {
  address _iexecPoco;
  address _voucherBeacon;
  bytes32 _voucherCreationCodeHash;
  struct IVoucherHub.VoucherType[] _voucherTypes;
  mapping(uint256 => mapping(address => bool)) _matchOrdersEligibility;
  mapping(address => bool) _isVoucher;
}
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address admin, address manager, address minter, address iexecPoco, address voucherBeacon) external
```

### createVoucherType

```solidity
function createVoucherType(string description, uint256 duration) external
```

### updateVoucherTypeDescription

```solidity
function updateVoucherTypeDescription(uint256 id, string description) external
```

### updateVoucherTypeDuration

```solidity
function updateVoucherTypeDuration(uint256 id, uint256 duration) external
```

### addEligibleAsset

```solidity
function addEligibleAsset(uint256 voucherTypeId, address asset) external
```

Add an eligible asset to a voucher type.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucherTypeId | uint256 | The ID of the voucher type. |
| asset | address | The address of the asset to add. |

### removeEligibleAsset

```solidity
function removeEligibleAsset(uint256 voucherTypeId, address asset) external
```

Remove an eligible asset to a voucher type.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucherTypeId | uint256 | The ID of the voucher type. |
| asset | address | The address of the asset to remove. |

### createVoucher

```solidity
function createVoucher(address owner, uint256 voucherType, uint256 value) external returns (address voucherAddress)
```

Create new voucher for the specified account and call initialize function.
Only 1 voucher is allowed by account. This is guaranteed by "create2" mechanism
and using the account address as salt.

_Note: the same account could have 2 voucher instances if the "beaconAddress"
changes, but this should not happen since the beacon is upgradeable, hence the
address should never be changed._

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The address of the voucher owner. |
| voucherType | uint256 | The ID of the voucher type. |
| value | uint256 | The amount of SRLC we need to credit to the voucher. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucherAddress | address | The address of the created voucher contract. |

### topUpVoucher

```solidity
function topUpVoucher(address voucher, uint256 value) external
```

Top up a voucher by increasing its balance and pushing its expiration date.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucher | address | The address of the voucher. |
| value | uint256 | The amount of credits to top up. |

### debitVoucher

```solidity
function debitVoucher(uint256 voucherTypeId, address app, uint256 appPrice, address dataset, uint256 datasetPrice, address workerpool, uint256 workerpoolPrice, uint256 volume) external returns (uint256 sponsoredAmount)
```

Debit voucher balance when used assets are eligible to voucher sponsoring.
(1) If this function is called by an account which is not a voucher,
it will have no effect other than consuming gas since balance would be
empty (tokens are only minted for vouchers).
(2) This function should not revert even if the amount debited is zero when
no asset is eligible or balance from caller is empty. Thanks to that it is
possible to try to debit the voucher in best effort mode (In short: "use
voucher if possible"), before trying other payment methods.

Note: no need for "onlyVoucher" modifier because if the sender is not a voucher,
its balance would be null, then "_burn()" would revert.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucherTypeId | uint256 | The type ID of the voucher to debit. |
| app | address | The app address. |
| appPrice | uint256 | The app price. |
| dataset | address | The dataset address. |
| datasetPrice | uint256 | The dataset price. |
| workerpool | address | The workerpool address. |
| workerpoolPrice | uint256 | The workerpool price. |
| volume | uint256 | Volume of the deal. |

### refundVoucher

```solidity
function refundVoucher(uint256 amount) external
```

Refund sender if it is a voucher.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | value to be refunded |

### drainVoucher

```solidity
function drainVoucher(address voucher) external
```

Drain funds from voucher if it is expired. Transfer all SRLC balance
on PoCo from voucher to voucherHub and burn all credits.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucher | address | address of the expired voucher to drain |

### withdraw

```solidity
function withdraw(address receiver, uint256 amount) external
```

Withdraw specified amount from this contract's balance on PoCo and send it
to the specified address.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| receiver | address | address that will receive withdrawn funds |
| amount | uint256 | amount to withdraw |

### getIexecPoco

```solidity
function getIexecPoco() external view returns (address)
```

Get iExec Poco address used by vouchers.

### getVoucherBeacon

```solidity
function getVoucherBeacon() external view returns (address)
```

Get voucher beacon address.

### getVoucherProxyCodeHash

```solidity
function getVoucherProxyCodeHash() external view returns (bytes32)
```

Get voucher proxy code hash.

### getVoucherTypeCount

```solidity
function getVoucherTypeCount() external view returns (uint256)
```

Get voucher types count.

### isAssetEligibleToMatchOrdersSponsoring

```solidity
function isAssetEligibleToMatchOrdersSponsoring(uint256 voucherTypeId, address asset) external view returns (bool)
```

Check if an asset is eligible to match orders sponsoring.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucherTypeId | uint256 | The ID of the voucher type. |
| asset | address | The address of the asset to check. |

### isVoucher

```solidity
function isVoucher(address account) external view returns (bool)
```

Check if a voucher exists at a given address.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The address to be checked. |

### getVoucher

```solidity
function getVoucher(address owner) external view returns (address voucherAddress)
```

Get the address of the voucher belonging to a given owner.
Returns address(0) if voucher is not found.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the voucher. |

### predictVoucher

```solidity
function predictVoucher(address owner) public view returns (address)
```

Predict the address of the (created or not) voucher for a given owner.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| owner | address | The owner of the voucher. |

### getVoucherType

```solidity
function getVoucherType(uint256 id) public view returns (struct IVoucherHub.VoucherType)
```

Get the voucher type details by ID.

