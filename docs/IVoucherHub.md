# Solidity API

## IVoucherHub

### VoucherType

```solidity
struct VoucherType {
  string description;
  uint256 duration;
}
```

### VoucherTypeCreated

```solidity
event VoucherTypeCreated(uint256 id, string description, uint256 duration)
```

### VoucherTypeDescriptionUpdated

```solidity
event VoucherTypeDescriptionUpdated(uint256 id, string description)
```

### VoucherTypeDurationUpdated

```solidity
event VoucherTypeDurationUpdated(uint256 id, uint256 duration)
```

### EligibleAssetAdded

```solidity
event EligibleAssetAdded(uint256 id, address asset)
```

### EligibleAssetRemoved

```solidity
event EligibleAssetRemoved(uint256 id, address asset)
```

### VoucherCreated

```solidity
event VoucherCreated(address voucher, address owner, uint256 voucherType, uint256 expiration, uint256 value)
```

### VoucherToppedUp

```solidity
event VoucherToppedUp(address voucher, uint256 expiration, uint256 value)
```

### VoucherDebited

```solidity
event VoucherDebited(address voucher, uint256 sponsoredAmount)
```

### VoucherRefunded

```solidity
event VoucherRefunded(address voucher, uint256 amount)
```

### VoucherDrained

```solidity
event VoucherDrained(address voucher, uint256 amount)
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

### removeEligibleAsset

```solidity
function removeEligibleAsset(uint256 voucherTypeId, address asset) external
```

### createVoucher

```solidity
function createVoucher(address owner, uint256 voucherType, uint256 value) external returns (address voucherAddress)
```

### topUpVoucher

```solidity
function topUpVoucher(address voucher, uint256 value) external
```

### debitVoucher

```solidity
function debitVoucher(uint256 voucherTypeId, address app, uint256 appPrice, address dataset, uint256 datasetPrice, address workerpool, uint256 workerpoolPrice, uint256 volume) external returns (uint256 sponsoredAmount)
```

### refundVoucher

```solidity
function refundVoucher(uint256 amount) external
```

### drainVoucher

```solidity
function drainVoucher(address voucher) external
```

### withdraw

```solidity
function withdraw(address receiver, uint256 amount) external
```

### getIexecPoco

```solidity
function getIexecPoco() external view returns (address)
```

### getVoucherBeacon

```solidity
function getVoucherBeacon() external view returns (address)
```

### getVoucherProxyCodeHash

```solidity
function getVoucherProxyCodeHash() external view returns (bytes32)
```

### getVoucherType

```solidity
function getVoucherType(uint256 id) external view returns (struct IVoucherHub.VoucherType)
```

### getVoucherTypeCount

```solidity
function getVoucherTypeCount() external view returns (uint256)
```

### isAssetEligibleToMatchOrdersSponsoring

```solidity
function isAssetEligibleToMatchOrdersSponsoring(uint256 voucherTypeId, address asset) external view returns (bool)
```

### isVoucher

```solidity
function isVoucher(address account) external view returns (bool)
```

### getVoucher

```solidity
function getVoucher(address owner) external view returns (address)
```

### predictVoucher

```solidity
function predictVoucher(address owner) external view returns (address)
```

