import { useState, useEffect } from 'react';
import { Web3Provider, JsonRpcProvider, formatUnits } from "@kaiachain/ethers-ext";
import { Contract, BigNumberish } from 'ethers';
import Link from 'next/link';

const donationABI = [
    {
        inputs: [],
        name: "getAllProjects",
        outputs: [
            {
                components: [
                    { internalType: "uint256", name: "id", type: "uint256" },
                    { internalType: "string", name: "title", type: "string" },
                    { internalType: "uint256", name: "goal", type: "uint256" },
                    { internalType: "string", name: "description", type: "string" },
                    { internalType: "uint256", name: "deadline", type: "uint256" },
                    { internalType: "address", name: "owner", type: "address" },
                    { internalType: "uint256", name: "totalFunds", type: "uint256" },
                    { internalType: "bool", name: "claimed", type: "bool" }
                ],
                internalType: "struct Donation.Project[]",
                name: "",
                type: "tuple[]"
            }
        ],
        stateMutability: "view",
        type: "function"
    }
];

interface Project {
    id: number;
    title: string;
    goal: string;
    description: string;
    deadline: number;
    owner: string;
    totalFunds: string;
    claimed: boolean;
}

const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';

const ProjectList: React.FC = () => {
    const [projects, setProjects] = useState<Project[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
    const fetchProjects = async () => {
        try {
            let provider;
            if (typeof window !== 'undefined' && 'klaytn' in window) {
                provider = new Web3Provider(window.klaytn);
            } else {
                provider = new JsonRpcProvider("https://public-en-baobab.klaytn.net");
            }
            
            console.log(`contractAddress: ${contractAddress}`);
            const contract = new Contract(contractAddress, donationABI, provider);

            const allProjects = await contract.getAllProjects();
            setProjects(allProjects.map((project: any) => ({
                id: Number(project.id),
                goal: formatKAIA(project.goal),
                description: project.description,
                deadline: Number(project.deadline),
                owner: project.owner,
                totalFunds: formatKAIA(project.totalFunds),
                claimed: project.claimed,
            })));
            setError(null);
        } catch (error) {
            console.error('Error fetching projects:', error);
            setError(`Error fetching projects: ${error}`);
        }
    };

    fetchProjects();
  }, []);

  const formatKAIA = (value: BigNumberish): string => {
    return parseFloat(formatUnits(value, 18)).toFixed(2);
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  return (
    <div className="container mx-auto px-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <Link href={`/projects/${project.id}`} key={project.id}>
            <div className="bg-white rounded-lg shadow-md overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-300">
              <img
                src={`https://picsum.photos/seed/${project.id}/300/200`}
                alt={`Project ${project.id}`}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h2 className="text-xl font-semibold mb-2">Project ID: #{project.id}</h2>
                <p className="text-gray-600 mb-2">{project.title}</p>
                <p className="text-sm text-gray-500 mb-1">Goal: {project.goal} KAIA</p>
                <p className="text-sm text-gray-500 mb-1">Raised: {project.totalFunds} KAIA</p>
                <p className="text-sm text-gray-500">
                  Deadline: {new Date(project.deadline * 1000).toLocaleDateString()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default ProjectList;
