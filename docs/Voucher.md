# Solidity API

## Voucher

### VoucherStorage

```solidity
struct VoucherStorage {
  address _owner;
  address _voucherHub;
  uint256 _expiration;
  uint256 _type;
  mapping(address => bool) _authorizedAccounts;
  mapping(bytes32 => uint256) _sponsoredAmounts;
  mapping(bytes32 => bool) _refundedTasks;
}
```

### constructor

```solidity
constructor() public
```

### initialize

```solidity
function initialize(address voucherOwner, address voucherHub, uint256 expiration, uint256 voucherTypeId) external
```

Initialize implementation contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| voucherOwner | address | The owner of the contract. |
| voucherHub | address | The address of the voucher hub. |
| expiration | uint256 | The expiration timestamp of the voucher. |
| voucherTypeId | uint256 | The type Id of the voucher. |

### setExpiration

```solidity
function setExpiration(uint256 expiration) external
```

Set the expiration timestamp of the voucher.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| expiration | uint256 | The expiration timestamp. |

### authorizeAccount

```solidity
function authorizeAccount(address account) external
```

Sets authorization for an account.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account to authorize. |

### unauthorizeAccount

```solidity
function unauthorizeAccount(address account) external
```

Unsets authorization for an account.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account to remove authorization from. |

### matchOrders

```solidity
function matchOrders(struct IexecLibOrders_v5.AppOrder appOrder, struct IexecLibOrders_v5.DatasetOrder datasetOrder, struct IexecLibOrders_v5.WorkerpoolOrder workerpoolOrder, struct IexecLibOrders_v5.RequestOrder requestOrder) external returns (bytes32 dealId)
```

Match orders on Poco. Eligible assets prices will be debited from the
voucher if possible, then non-sponsored amount will be debited from the
iExec account of the requester.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| appOrder | struct IexecLibOrders_v5.AppOrder | The app order. |
| datasetOrder | struct IexecLibOrders_v5.DatasetOrder | The dataset order. |
| workerpoolOrder | struct IexecLibOrders_v5.WorkerpoolOrder | The workerpool order. |
| requestOrder | struct IexecLibOrders_v5.RequestOrder | The request order. |

### matchOrdersBoost

```solidity
function matchOrdersBoost(struct IexecLibOrders_v5.AppOrder appOrder, struct IexecLibOrders_v5.DatasetOrder datasetOrder, struct IexecLibOrders_v5.WorkerpoolOrder workerpoolOrder, struct IexecLibOrders_v5.RequestOrder requestOrder) external returns (bytes32 dealId)
```

Match orders boost on Poco. Eligible assets prices will be debited from the
voucher if possible, then non-sponsored amount will be debited from the
iExec account of the requester.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| appOrder | struct IexecLibOrders_v5.AppOrder | The app order. |
| datasetOrder | struct IexecLibOrders_v5.DatasetOrder | The dataset order. |
| workerpoolOrder | struct IexecLibOrders_v5.WorkerpoolOrder | The workerpool order. |
| requestOrder | struct IexecLibOrders_v5.RequestOrder | The request order. |

### claim

```solidity
function claim(bytes32 taskId) external
```

Claim failed task on PoCo then refund voucher and requester.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | bytes32 | id of the task |

### claimBoost

```solidity
function claimBoost(bytes32 dealId, uint256 taskIndex) external
```

Claim failed Boost task on PoCo then refund voucher and requester.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dealId | bytes32 | id of the task's deal |
| taskIndex | uint256 | task's index in the deal |

### drain

```solidity
function drain(uint256 amount) external
```

Drain balance of voucher on PoCo if it is expired.
Funds are sent to the VoucherHub contract.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| amount | uint256 | amount to be drained |

### getType

```solidity
function getType() external view returns (uint256)
```

Retrieve the type of the voucher.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | voucherType The type of the voucher. |

### getBalance

```solidity
function getBalance() external view returns (uint256)
```

Get voucher balance.

### isAccountAuthorized

```solidity
function isAccountAuthorized(address account) external view returns (bool)
```

Checks if an account is authorized for.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| account | address | The account to check. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bool | isAuthorized True if the account is authorized, false otherwise. |

### getSponsoredAmount

```solidity
function getSponsoredAmount(bytes32 dealId) external view returns (uint256)
```

Get amount sponsored in a deal.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dealId | bytes32 | The ID of the deal. |

### isRefundedTask

```solidity
function isRefundedTask(bytes32 taskId) external view returns (bool)
```

Check if a task has been refunded.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| taskId | bytes32 | The task to be checked. |

### owner

```solidity
function owner() public view returns (address)
```

_Returns the address of the current owner._

### getVoucherHub

```solidity
function getVoucherHub() public view returns (address)
```

Retrieve the address of the voucher hub associated with the voucher.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | address | voucherHubAddress The address of the voucher hub. |

### getExpiration

```solidity
function getExpiration() public view returns (uint256)
```

Retrieve the expiration timestamp of the voucher.

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | expirationTimestamp The expiration timestamp. |

