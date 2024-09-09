import { ethers } from "hardhat";

async function main() {
    const contractAddress = process.env.CONTRACT_ADDRESS || "0x23302d1f12417151084aEA3f767082eb869Dc6CE";

    const Donation = await ethers.getContractFactory("Donation");
    const donation = await Donation.attach(contractAddress);

    const goal = ethers.parseEther("10000"); // 1 KAIA as the goal
    const durationInMinutes = 600; // 10 hours for each project
    const durationInSeconds = durationInMinutes * 60; // Convert minutes to seconds

    const projects = [
        {
            title: "Second Chance Shelter: Saving Stray Lives",
            description: "Help us build a state-of-the-art animal shelter to rescue and rehabilitate stray dogs. Our project aims to provide medical care, nutrition, and loving homes for abandoned pets, giving them a second chance at life and happiness."
        },
        {
            title: "Greening the Arid Lands: Desertification Prevention Initiative",
            description: "This project aims to halt desertification caused by climate change. Through innovative irrigation techniques, planting drought-resistant vegetation, and soil improvement, we seek to restore arid ecosystems. Working with local communities, we'll implement sustainable land management to preserve a greener environment for future generations."
        },
        {
            title: "Earthquake Recovery: Rebuilding Communities Together",
            description: "Join our efforts to rebuild communities devastated by recent earthquakes. This project focuses on constructing earthquake-resistant housing, restoring essential infrastructure, and providing long-term support to affected families. Together, we can help these communities rise from the rubble and build a more resilient future."
        },
        {
            title: "Rising from Rubble: Community Rebuilding Project",
            description: "Help us rebuild our community after a devastating disaster. This project aims to clear debris, restore infrastructure, and reconstruct homes for affected families. Your support will provide hope and a fresh start for those who have lost everything."
        }
    ];

    for (let i = 0; i < projects.length; i++) {
        console.log(`Creating project ${i + 1}: ${projects[i].title}`);

        try {
            const tx = await donation.createProject(projects[i].title, goal, projects[i].description, durationInSeconds);
            await tx.wait();

            console.log(`Project ${i + 1} created successfully!`);
            console.log("Transaction hash:", tx.hash);

            // const projectId = await donation.getProjectCount();
            const projectDetails = await donation.getProjectDetails(i + 1);
            console.log("Project Details:");
            console.log("ID:", projectDetails[0].toString());
            console.log("Title:", projectDetails[1]);
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

            console.log("\n");
        } catch (error) {
            console.error(`Error creating project ${i + 1}:`, error);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
