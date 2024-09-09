import { ethers } from "hardhat";

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x23302d1f12417151084aEA3f767082eb869Dc6CE";

    const Donation = await ethers.getContractFactory("Donation");
    const donation = Donation.attach(contractAddress);

    const projectId = 1;

    console.log(`Claiming funds for project ${projectId}...`);

    try {
        const tx = await donation.claimFunds(projectId);
        
        await tx.wait();

        console.log("Funds claimed successfully!");
        console.log("Transaction hash:", tx.hash);

        const projectDetails = await donation.getProjectDetails(projectId);
        console.log("Updated Project Details:", projectDetails);

    } catch (error) {
        console.error("Error claiming funds:", error);
    }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
