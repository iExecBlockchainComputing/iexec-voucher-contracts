import * as helpers from '@nomicfoundation/hardhat-network-helpers';
import { env } from '../../config/env';

/**
 * This function is used to mine one bock if we are on a local fork
 */
export async function mineBlockIfOnLocalFork() {
    if (env.IS_LOCAL_FORK) {
        /**
         * This fixes following issue when deploying to a local Bellecour fork:
         * `ProviderError: No known hardfork for execution on historical block [...] in chain with id 134.`
         * See: https://github.com/NomicFoundation/hardhat/issues/5511#issuecomment-2288072104
         */
        await helpers.mine();
    }
}
