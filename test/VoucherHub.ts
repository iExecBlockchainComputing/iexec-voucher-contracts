// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("VoucherHub", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    // Contracts are deployed using the first signer/account by default
    const [owner, otherAccount] = await ethers.getSigners();

    const VoucherHub = await ethers.getContractFactory("VoucherHub");
    const voucherHub = await VoucherHub.deploy();

    return { voucherHub, owner, otherAccount };
  }

  describe("VoucherCreated", function () {
    describe("Events", function () {
      it("Should emit an event on createVoucher", async function () {
        const { voucherHub } = await loadFixture(
          deployFixture
        );

        await expect(voucherHub.createVoucher())
          .to.emit(voucherHub, "VoucherCreated")
      });
    });
  });
});
