# Solidity API

## IVoucher

### ExpirationUpdated

```solidity
event ExpirationUpdated(uint256 expiration)
```

### AccountAuthorized

```solidity
event AccountAuthorized(address account)
```

### AccountUnauthorized

```solidity
event AccountUnauthorized(address account)
```

### OrdersMatchedWithVoucher

```solidity
event OrdersMatchedWithVoucher(bytes32 dealId)
```

### OrdersBoostMatchedWithVoucher

```solidity
event OrdersBoostMatchedWithVoucher(bytes32 dealId)
```

### TaskClaimedWithVoucher

```solidity
event TaskClaimedWithVoucher(bytes32 taskId)
```

### setExpiration

```solidity
function setExpiration(uint256 expiration) external
```

### authorizeAccount

```solidity
function authorizeAccount(address account) external
```

### unauthorizeAccount

```solidity
function unauthorizeAccount(address account) external
```

### matchOrders

```solidity
function matchOrders(struct IexecLibOrders_v5.AppOrder appOrder, struct IexecLibOrders_v5.DatasetOrder datasetOrder, struct IexecLibOrders_v5.WorkerpoolOrder workerpoolOrder, struct IexecLibOrders_v5.RequestOrder requestOrder) external returns (bytes32)
```

### matchOrdersBoost

```solidity
function matchOrdersBoost(struct IexecLibOrders_v5.AppOrder appOrder, struct IexecLibOrders_v5.DatasetOrder datasetOrder, struct IexecLibOrders_v5.WorkerpoolOrder workerpoolOrder, struct IexecLibOrders_v5.RequestOrder requestOrder) external returns (bytes32)
```

### claim

```solidity
function claim(bytes32 taskId) external
```

### claimBoost

```solidity
function claimBoost(bytes32 dealId, uint256 taskIndex) external
```

### drain

```solidity
function drain(uint256 amount) external
```

### getVoucherHub

```solidity
function getVoucherHub() external view returns (address)
```

### getType

```solidity
function getType() external view returns (uint256)
```

### getExpiration

```solidity
function getExpiration() external view returns (uint256)
```

### getBalance

```solidity
function getBalance() external view returns (uint256)
```

### isAccountAuthorized

```solidity
function isAccountAuthorized(address account) external view returns (bool)
```

### getSponsoredAmount

```solidity
function getSponsoredAmount(bytes32 dealId) external view returns (uint256)
```

### isRefundedTask

```solidity
function isRefundedTask(bytes32 taskId) external view returns (bool)
```

