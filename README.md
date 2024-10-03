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

#### Local Bellecour fork

```
LOCAL_FORK=true MNEMONIC=<mnemonic> npx hardhat deploy --network hardhat
```

#### Bellecour

With appropriate deployer key:
```
npx hardhat deploy --network bellecour
```
- Logs
```
Deploying all contracts related to voucher..
ChainId: 134
Using upgrader address: 0xA0C07ad0257522211c6359EC8A4EB5d21A4A1A14
Using manager address: 0xA0C1939182b454911b78f9b087D5444d7d0E82E3
Using minter address: 0xA0C26578F762a06c14A8153F87D0EAA2fBd036af
Using PoCo address: 0x3eca1B216A7DF1C7689aEb259fFB83ADFB894E7f
Factory: 0xfAC000a12dA42B871c0AaD5F25391aAe62958Db1
Salt: 0x0000000000000000000000000000000000000000000000000000000000000000
VoucherImpl: 0xf59b25A6149f1DA76470A6300aEc420540127E62 
VoucherUpgradeableBeacon: 0xFC43930c7bFb6499A692fcFC7199Ea5E68a3d9F8 
VoucherHubImpl: 0x7b5947B5e49eB2F17f35f55cB48C2a3637F7c80F 
VoucherHubERC1967Proxy: 0x3137B6DF4f36D338b82260eDBB2E7bab034AFEda
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
