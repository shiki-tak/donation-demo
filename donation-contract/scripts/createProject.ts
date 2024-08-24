import { ethers } from "hardhat";

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x23302d1f12417151084aEA3f767082eb869Dc6CE";;

    const Donation = await ethers.getContractFactory("Donation");
    const donation = await Donation.attach(contractAddress);

    const goal = ethers.parseEther("1"); // 1 KAIA as the goal
    const description = "Test Project - 3 Minutes Duration";
    const durationInMinutes = 3; // 3 minutes for testing
    const durationInSeconds = durationInMinutes * 60; // Convert minutes to seconds

    console.log(`Creating a new project with ${durationInMinutes} minutes duration...`);


    try {
        const tx = await donation.createProject(goal, description, durationInSeconds);
        await tx.wait();

        console.log("Project created successfully!");
        console.log("Transaction hash:", tx.hash);

        const projectId = 1;
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
        console.log(`Project will end in approximately ${remainingTimeInSeconds} seconds`);

    } catch (error) {
        console.error("Error:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
