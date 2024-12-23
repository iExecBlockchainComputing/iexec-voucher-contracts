import hre, { ethers, upgrades } from 'hardhat';
import { getDeploymentConfig } from '../deploy/deploy';
import { Address, VoucherHub } from '../typechain-types';
import { impersonate, stopImpersonate } from './utils/impersonate';
import { upgradeProxy } from './voucherHubUtils';

async function upgradeVoucherHub() {
    console.log(`Upgrading VoucherHub contract ...`);

    // Fetch network details
    const networkName = hre.network.name;
    const isProd = networkName === 'bellecour';
    console.log('Network Name:', networkName);

    const chainId = (await ethers.provider.getNetwork()).chainId.toString();
    console.log('ChainId:', chainId);

    const provider = ethers.provider;
    const config = await getDeploymentConfig(Number(chainId));
    if (!config.voucherHubAddress && !process.env.IEXEC_VOUCHER_HUB_ADDRESS) {
        throw new Error(`No VoucherHub deployed on the target chain ${chainId}`);
    }

    const voucherHubProxyAddress = (config.voucherHubAddress ||
        process.env.IEXEC_VOUCHER_HUB_ADDRESS)!;
    console.log(`Upgrading proxy at address: ${voucherHubProxyAddress}`);

    // Fetch proxy admin details
    const VoucherHubFactoryUpgrade = await ethers.getContractFactory('VoucherHub');
    const voucherHub: unknown = VoucherHubFactoryUpgrade.attach(
        '0x3137B6DF4f36D338b82260eDBB2E7bab034AFEda',
    );
    const voucherHubContract = voucherHub as VoucherHub;
    const upgraderAddress = await voucherHubContract.defaultAdmin(); // getRoleAdmin should work here
    console.log('🚀 ~ upgradeVoucherHub ~ defaultAdmin:', upgraderAddress);

    if (!isProd) {
        console.log('Detected non-production environment. Starting impersonating...');
        await impersonate({
            rpcUrl: hre.network.config.url!,
            address: upgraderAddress as unknown as Address,
        });

        console.log(`Upgrading proxy at address: ${voucherHubProxyAddress}`);

        const upgradeDeployer = await provider.getSigner(upgraderAddress);
        const contractUpgrade: unknown = await upgrades.upgradeProxy(
            voucherHubProxyAddress,
            VoucherHubFactoryUpgrade.connect(upgradeDeployer),
        );
        const voucherHubUpgrade = contractUpgrade as VoucherHub;
        await voucherHubUpgrade.waitForDeployment();

        await stopImpersonate({
            rpcUrl: hre.network.config.url!,
            address: upgradeDeployer as unknown as Address,
        });
    } else {
        console.log('Running on Bellecour network. No impersonation required.');
        await upgradeProxy(voucherHubProxyAddress, VoucherHubFactoryUpgrade);
    }

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
