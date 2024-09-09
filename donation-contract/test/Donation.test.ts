import { expect } from "chai";
import { ethers } from "hardhat";
import { Donation } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("Donation", function () {
  let donation: Donation;
  let owner: HardhatEthersSigner;
  let addr1: HardhatEthersSigner;
  let addr2: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, addr1, addr2] = await ethers.getSigners();
    const Donation = await ethers.getContractFactory("Donation");
    donation = await Donation.deploy();
    await donation.waitForDeployment();
  });

  it("Should create a new project", async function () {
    const goal = ethers.parseEther("1");
    const description = "Test Project";
    const duration = 30; // 30 days

    await expect(donation.createProject(goal, description, duration))
      .to.emit(donation, "ProjectCreated")
      .withArgs(1n, await owner.getAddress());

    const project = await donation.getProjectDetails(1n);
    expect(project.goal).to.equal(goal);
    expect(project.description).to.equal(description);
    expect(project.owner).to.equal(await owner.getAddress());
  });
});
