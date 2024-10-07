# Changelog

## v1.0.0

### What's new?
- Allow users to access resources of the iExec network via a sponsorship voucher.

### More details
- Upgrade Solidity Compiler to `v0.8.27`. (#45)
- Bump dependencies: (#44)
    - `@openzeppelin/hardhat-upgrades`, `hardhat`, `ethers`, `prettier`, and others [minor version bump]
    - `prettier-plugin-organize-imports@4`
- Add `getVoucherProxyCodeHash(..)` & `isRefundedTask(..)` view functions. (#43)
- Add `predictVoucher(..)` & `isVoucher(..)` functions. (#42)
- Generate UML class diagram for contracts. (#41)
- Generate Solidity documentation. (#40)
- Add Bellecour poco address to config and harmonize deployment artifacts. (#39)
- Revert always explicit message on failed transfers. (#38)
- Add configuration for deployments on custom test networks. (#37)
- Verify that voucher type exists when adding or removing eligible asset. (#36)
- Deploy contracts through generic factory. (#35)
- Define admin addresses for deployment (#34)
- Mark assembly blocks as memory-safe and update deal price calculation syntax. (#33)
- Harmonize SRLC wording. (#31)
- Rename roles. (#29)
- Make sponsored & non-sponsored amounts always divisible by deal volume to refund tasks fairly. (#28)
- Add slither suggestions. (#26)
- Drain expired vouchers and withdraw funds. (#25)
- Add slither github action. (#24)
- Top up voucher. (#23)
- Claim task part 2 - Add voucher tests. (#21)
- Claim task part 1 - Solidity with minimal tests. (#20)
- Compute deal price with proper volume. (#19)
- Refactor voucher tests file. (#18)
- Use real poco address if available at deployment. (#17)
- Match orders boost through voucher. (#16)
- Use hardhat deploy. (#15)
- Upload coverage reports to Codecov. (#14)
- Clean some TODOs. (#13, #22, #27)
- Match orders through voucher. (#12)
- Add external-hardhat network configuration. (#11)
- Add voucher credit and SRLC manipulation. (#10)
    - SRLC and iExec poco is mocked.
    - set voucher credit as VoucherHub is ERC20.
- Upgrade configuration: (#9)
    - Upgrade dependencies: hardhat, husky, iExec Poco.
    - Ignore mocks in coverage.
    - Add solidity optimizer and use Bellecour network config.
- Add role-based access control to VoucherHub. (#8)
- Create voucher from VoucherHub with : type, expiration, authorize list. (#6)
- Create vouchers with create2. (#5)
- Create upgradeable voucher contract. (#4)
- Add voucher type structure, duration, description and asset eligible. (#3)
- Add upgradeable VoucherHub contract. (#2)
- Init project. (#1)
