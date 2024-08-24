import { ethers } from "hardhat";

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x23302d1f12417151084aEA3f767082eb869Dc6CE";;

    const projectId = parseInt(process.env.PROJECT_ID || "");

    if (isNaN(projectId) || projectId <= 0) {
        console.error("Error: Please provide a valid PROJECT_ID as an environment variable.");
        console.log("Usage: PROJECT_ID=<id> npx hardhat run scripts/getProjectDetails.ts --network kairos");
        process.exit(1);
    }

    const Donation = await ethers.getContractFactory("Donation");
    const donation = Donation.attach(contractAddress);

    console.log(`Fetching details for project ID: ${projectId}`);

    try {
        const projectDetails = await donation.getProjectDetails(projectId);

        console.log("Project Details:");
        console.log("ID:", projectDetails[0].toString());
        console.log("Goal:", ethers.formatEther(projectDetails[1]), "KAIA");
        console.log("Description:", projectDetails[2]);
        console.log("Deadline:", new Date(Number(projectDetails[3]) * 1000).toLocaleString());
        console.log("Owner:", projectDetails[4]);
        console.log("Total Funds:", ethers.formatEther(projectDetails[5]), "KAIA");
        console.log("Claimed:", projectDetails[6]);

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const deadlineTimestamp = Number(projectDetails[3]);
        const remainingTimeInSeconds = deadlineTimestamp - currentTimestamp;

        if (remainingTimeInSeconds > 0) {
            console.log(`Project will end in approximately ${remainingTimeInSeconds} seconds`);
        } else {
            console.log("Project has ended");
        }

        const goalAmount = Number(ethers.formatEther(projectDetails[1]));
        const raisedAmount = Number(ethers.formatEther(projectDetails[5]));
        const progressPercentage = (raisedAmount / goalAmount) * 100;
        console.log(`Progress: ${progressPercentage.toFixed(2)}% (${raisedAmount} KAIA / ${goalAmount} KAIA)`);

    } catch (error) {
        console.error("Error fetching project details:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
