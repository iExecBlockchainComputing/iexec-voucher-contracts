// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

/**
 * This file is used in pre-commit hook to automatically add copyright
 * header if missing from new (or existing) files.
 */

import * as fs from 'fs';

const year = new Date().getFullYear();
const spdxCopyright = 'SPDX-FileCopyrightText';
const copyrightLine = `${spdxCopyright}: ${year} IEXEC BLOCKCHAIN TECH <contact@iex.ec>`;
const licenseLine = 'SPDX-License-Identifier: Apache-2.0';

(async function () {
    // process.argv == ['ts-node', 'tools/copyright-header.ts', 'file1', 'file2', ...]
    const filepaths = process.argv.slice(2);
    filepaths.forEach((filepath) => {
        const content = fs.readFileSync(filepath, 'utf-8');
        if (content.includes(spdxCopyright)) {
            updateYear(content);
            return;
        }
        const header = buildHeader(filepath);
        const newContent = header + content;
        // Write the updated contents back to the file
        fs.writeFileSync(filepath, newContent, 'utf8');
    });
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});

function buildHeader(filepath: string) {
    const commentPrefix = getCommentPrefix(filepath);
    if (!commentPrefix) {
        throw new Error('Unknown file, please add copyright header manually.');
    }
    return commentPrefix + copyrightLine + '\n' + commentPrefix + licenseLine + '\n' + '\n';
}

function getCommentPrefix(filepath: string) {
    let extension;
    const parts = filepath.split('.');
    if (
        parts.length === 1 || // No "." in the filename
        (parts.length === 2 && parts[0] === '') // e.g. .env
    ) {
        return null; // Unknown comment
    }
    extension = parts[parts.length - 1];
    switch (extension) {
        case 'ts':
        case 'js':
        case 'sol':
            return '// ';
        case 'sh':
            return '# ';
        default:
            return null;
    }
}

function updateYear(content: string) {}
