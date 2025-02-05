/*
    Resolves an issue with the gas price calculation in the Solidity coverage tool. 
    The modification ensures that the gas price is correctly set to 0x00, addressing potential inconsistencies in gas cost calculations during coverage analysis.
    See https://github.com/sc-forks/solidity-coverage/issues/754
*/

import fs from 'fs';
import path from 'path';

export async function forceZeroGasPriceWithSolidityCoverage() {
    const apiJsPath = path.join(__dirname, '../../node_modules/solidity-coverage/lib/api.js');
    let apiJs = fs.readFileSync(apiJsPath, 'utf8');

    apiJs = apiJs.replace('gasPrice = 0x01', 'gasPrice = 0x00');

    fs.writeFileSync(apiJsPath, apiJs);
}
