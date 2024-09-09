import { ethers } from "hardhat";

async function main() {
    const Donation = await ethers.getContractFactory("Donation");
    const donation = await Donation.deploy();

    await donation.waitForDeployment();

    console.log("Donation deployed to:", await donation.getAddress());
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
