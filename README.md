# iexec-voucher-contracts

[![codecov](https://codecov.io/github/iExecBlockchainComputing/iexec-voucher-contracts/graph/badge.svg)](https://codecov.io/github/iExecBlockchainComputing/iexec-voucher-contracts)

Contracts of iExec Voucher project.

### API Documentation

The API documentation can be found in [docs/](./docs/index.md).

### UML diagram

UML class diagram for voucher contracts can be found [here](./docs/class-diagram.svg).
Raw version is available [here](./docs/class-diagram.svg?raw=true) for better readability.

### How to deploy?

Edit `config/deployment.json` file to provide deployment configuration of the target
chain if missing.

Deployment configuration can also be provided/overridden using env variables:

* `IEXEC_POCO_ADDRESS`
* `IEXEC_VOUCHER_MANAGER_ACCOUNT_INDEX`
* `IEXEC_VOUCHER_MINTER_ACCOUNT_INDEX`

Run:
```
npx hardhat deploy --network <name>
```

### Verify contracts

- Add network configuration to Hardhat config file.
- Specify the correct evm version in the compiler config ('berlin', 'paris', ...).

```
$ npx hardhat verify --network <name> <voucherImplAddress>
$ npx hardhat verify --network <name> <voucherUpgradeableBeaconAddress> \
    <voucherImplAddress> <adminAddress> # constructor args
$ npx hardhat verify --network <name> <voucherHubImplAddress>

# initializeFunctionData = VoucherHub__factory.createInterface().encodeFunctionData('initialize', [
#     <adminAddress>,
#     <managerAddress>,
#     <minterAddress>,
#     <iexecPocoAddress>,
#     <voucherUpgradeableBeaconAddress>,
# ])

$ npx hardhat verify --network <name> <voucherHubERC1967ProxyAddress> \
    <voucherHubImplAddress> <initializeFunctionData> # constructor args
```
