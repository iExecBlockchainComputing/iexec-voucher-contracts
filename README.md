# iExec Voucher contracts

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

#### Local Bellecour fork

```
LOCAL_FORK=true MNEMONIC=<mnemonic> npx hardhat deploy --network hardhat
```

#### Bellecour

With appropriate deployer key:
```
npx hardhat deploy --network bellecour
```

### Verify contracts

- Blockscout v5

```
BLOCKSCOUT_VERSION=v5 npx hardhat run ./scripts/verify.ts --network bellecour
```

- Blockscout v6

```
npx hardhat run ./scripts/verify.ts --network bellecour
```
