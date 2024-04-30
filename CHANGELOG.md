# Changelog

## vNEXT
- Use real poco address if available at deployment. (#17)
- Use hardhat deploy. (#15)
- Upload coverage reports to Codecov. (#14)
- Clean some TODOs. (#13)
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
