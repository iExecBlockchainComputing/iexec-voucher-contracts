// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

export enum FailType {
    NO_FAILURE,
    RETURN_FALSE,
    REVERT,
}

export const FAIL_TYPES = [FailType.RETURN_FALSE, FailType.REVERT];
