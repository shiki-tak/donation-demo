import { ethers } from "hardhat";

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x23302d1f12417151084aEA3f767082eb869Dc6CE";;

    const Donation = await ethers.getContractFactory("Donation");
    const donation = await Donation.attach(contractAddress);

    const goal = ethers.parseEther("100"); // 1 KAIA as the goal
    const title = "Test Project 2";
    const description = "This is a sample project2.";
    const durationInMinutes = 600; // 3 minutes for testing
    const durationInSeconds = durationInMinutes * 60; // Convert minutes to seconds

    console.log(`Creating a new project with ${durationInMinutes} minutes duration...`);


    try {
        const tx = await donation.createProject(title, goal, description, durationInSeconds);
        await tx.wait();

        console.log("Project created successfully!");
        console.log("Transaction hash:", tx.hash);

        const projectId = 1;
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
        console.log(`Project will end in approximately ${remainingTimeInSeconds} seconds`);

    } catch (error) {
        console.error("Error:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
