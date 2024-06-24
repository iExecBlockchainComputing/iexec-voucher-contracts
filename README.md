# iexec-voucher-contracts

[![codecov](https://codecov.io/github/iExecBlockchainComputing/iexec-voucher-contracts/graph/badge.svg)](https://codecov.io/github/iExecBlockchainComputing/iexec-voucher-contracts)

Contracts of iExec Voucher project.

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
