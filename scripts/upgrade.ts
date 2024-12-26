import { ethers, upgrades } from 'hardhat';
import { getDeploymentConfig } from '../deploy/deploy';
import { VoucherHub } from '../typechain-types';
import { upgradeProxy } from './voucherHubUtils';

async function upgradeVoucherHub() {
    console.log(`Upgrading VoucherHub contract ...`);

    const chainId = (await ethers.provider.getNetwork()).chainId.toString();
    console.log('ChainId:', chainId);

    const config = await getDeploymentConfig(Number(chainId));
    if (!config.voucherHubAddress && !process.env.IEXEC_VOUCHER_HUB_ADDRESS) {
        throw new Error(`No VoucherHub deployed on the target chain ${chainId}`);
    }

    const voucherHubProxyAddress = (config.voucherHubAddress ||
        process.env.IEXEC_VOUCHER_HUB_ADDRESS)!;

    // Fetch proxy admin details
    const VoucherHubFactoryUpgrade = await ethers.getContractFactory('VoucherHub');
    const voucherHub: unknown = VoucherHubFactoryUpgrade.attach(voucherHubProxyAddress);
    const voucherHubContract = voucherHub as VoucherHub;
    const upgraderAddress = await voucherHubContract.defaultAdmin();

    await upgradeProxy(voucherHubProxyAddress, VoucherHubFactoryUpgrade, upgraderAddress);

    // Fetch new implementation address
    const implementationAddress =
        await upgrades.erc1967.getImplementationAddress(voucherHubProxyAddress);
    console.log(
        `VoucherHub upgraded successfully ✅! New implementation address (VoucherHub.sol): ${implementationAddress}`,
    );
}

upgradeVoucherHub().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
