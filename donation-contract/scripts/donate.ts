import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import { Donation } from "../typechain-types";

dotenv.config();

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x23302d1f12417151084aEA3f767082eb869Dc6CE";;

    const donorPrivateKey = process.env.DONOR_PRIVATE_KEY;
    if (!donorPrivateKey) {
        throw new Error("Donor private key not found in environment variables");
    }

    const provider = ethers.provider;

    const donorWallet = new ethers.Wallet(donorPrivateKey, provider);

    const Donation = await ethers.getContractFactory("Donation");
    const donation = (await Donation.attach(contractAddress).connect(donorWallet)) as Donation;

    const projectId = 1;
    const donationAmount = ethers.parseEther("1"); // 0.1 KAIA as the donation amount

    console.log(`Donating ${ethers.formatEther(donationAmount)} KAIA to project ${projectId}...`);

    try {
        const tx = await donation.donate(projectId, { value: donationAmount });

        await tx.wait();

        console.log("Donation successful!");
        console.log("Transaction hash:", tx.hash);

        const projectDetails = await donation.getProjectDetails(projectId);
        console.log("Updated Project Details:", projectDetails);

    } catch (error) {
        console.error("Error donating to project:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
