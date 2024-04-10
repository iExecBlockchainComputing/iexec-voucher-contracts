import fs from 'fs';
import path from 'path';

const apiJsPath = path.join(__dirname, './node_modules/solidity-coverage/lib/api.js');
let apiJs = fs.readFileSync(apiJsPath, 'utf8');

apiJs = apiJs.replace(/gasPrice \= 0x01/, 'gasPrice = 0x00');

fs.writeFileSync(apiJsPath, apiJs);
