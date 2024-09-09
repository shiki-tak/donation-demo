// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Donation is ERC721, ReentrancyGuard {
    uint256 private _nextProjectId = 1;
    uint256 private _nextCertificateId = 1;

    struct Project {
        uint256 id;
        string title;
        uint256 goal;
        string description;
        uint256 deadline;
        address owner;
        uint256 totalFunds;
        bool claimed;
    }

    struct Certificate {
        uint256 timestamp;
        uint256 projectId;
        address donor;
        uint256 amount;
    }

    mapping(uint256 => Project) public projects;
    mapping(uint256 => Certificate) public certificates;
    uint256[] public projectIds;

    event ProjectCreated(uint256 projectId, address owner);
    event DonationMade(uint256 projectId, address donor, uint256 amount, uint256 certificateId);
    event FundsClaimed(uint256 projectId, address owner, uint256 amount);

    constructor() ERC721("DonationNFT", "CFNFT") {}

    function createProject(string memory _title, uint256 _goal, string memory _description, uint256 _durationInSeconds) external {
        uint256 projectId = _nextProjectId++;

        projects[projectId] = Project({
            id: projectId,
            title: _title,
            goal: _goal,
            description: _description,
            deadline: block.timestamp + _durationInSeconds,
            owner: msg.sender,
            totalFunds: 0,
            claimed: false
        });

        projectIds.push(projectId);

        emit ProjectCreated(projectId, msg.sender);
    }

    function donate(uint256 _projectId) external payable nonReentrant {
        Project storage project = projects[_projectId];
        require(block.timestamp < project.deadline, "Project funding period has ended");
        require(msg.value > 0, "Donation amount must be greater than 0");

        project.totalFunds += msg.value;

        uint256 certificateId = _nextCertificateId++;
        _safeMint(msg.sender, certificateId);
        certificates[certificateId] = Certificate({
            timestamp: block.timestamp,
            projectId: _projectId,
            donor: msg.sender,
            amount: msg.value
        });

        emit DonationMade(_projectId, msg.sender, msg.value, certificateId);
    }

    function claimFunds(uint256 _projectId) external nonReentrant {
        Project storage project = projects[_projectId];
        require(msg.sender == project.owner, "Only project owner can claim funds");
        require(block.timestamp >= project.deadline, "Funding period has not ended yet");
        require(!project.claimed, "Funds have already been claimed");

        project.claimed = true;
        uint256 amountToTransfer = project.totalFunds;

        (bool sent, ) = payable(project.owner).call{value: amountToTransfer}("");
        require(sent, "Failed to send funds");

        emit FundsClaimed(_projectId, project.owner, amountToTransfer);
    }

    function getProjectDetails(uint256 _projectId) external view returns (Project memory) {
        return projects[_projectId];
    }

    function getAllProjects() external view returns (Project[] memory) {
        Project[] memory allProjects = new Project[](projectIds.length);
        for (uint i = 0; i < projectIds.length; i++) {
            allProjects[i] = projects[projectIds[i]];
        }
        return allProjects;
    }

    function getCertificateDetails(uint256 _certificateId) external view returns (Certificate memory) {
        require(_ownerOf(_certificateId) != address(0), "Certificate does not exist");
        return certificates[_certificateId];
    }
}
