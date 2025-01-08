import { ethers, upgrades } from 'hardhat';
import { env } from '../config/env';
import { getDeploymentConfig } from '../deploy/deploy';
import { upgradeProxy } from './voucherHubUtils';

async function upgradeVoucherHub() {
    console.log(`Upgrading VoucherHub contract ...`);

    const chainId = (await ethers.provider.getNetwork()).chainId.toString();
    console.log('ChainId:', chainId);

    const config = await getDeploymentConfig(Number(chainId));
    const voucherHubProxyAddress = config.voucherHubAddress || env.IEXEC_VOUCHER_HUB_ADDRESS;
    if (!voucherHubProxyAddress) {
        throw new Error(`No VoucherHub deployed on the target chain ${chainId}`);
    }

    await upgradeProxy(voucherHubProxyAddress);

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
