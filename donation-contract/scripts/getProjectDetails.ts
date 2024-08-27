import { ethers } from "hardhat";

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || '';

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
        console.log("Title: ", projectDetails[1]);
        console.log("Goal:", ethers.formatEther(projectDetails[2]), "KAIA");
        console.log("Description:", projectDetails[3]);
        console.log("Deadline:", new Date(Number(projectDetails[4]) * 1000).toLocaleString());
        console.log("Owner:", projectDetails[5]);
        console.log("Total Funds:", ethers.formatEther(projectDetails[6]), "KAIA");
        console.log("Claimed:", projectDetails[7]);

        const currentTimestamp = Math.floor(Date.now() / 1000);
        const deadlineTimestamp = Number(projectDetails[4]);
        const remainingTimeInSeconds = deadlineTimestamp - currentTimestamp;

        if (remainingTimeInSeconds > 0) {
            console.log(`Project will end in approximately ${remainingTimeInSeconds} seconds`);
        } else {
            console.log("Project has ended");
        }

        const goalAmount = Number(ethers.formatEther(projectDetails[2]));
        const raisedAmount = Number(ethers.formatEther(projectDetails[6]));
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
