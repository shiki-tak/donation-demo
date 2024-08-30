import { useState, useEffect } from 'react';
import { Web3Provider, JsonRpcProvider, formatUnits } from "@kaiachain/ethers-ext";
import { Contract, BigNumberish } from 'ethers';
import Link from 'next/link';
import { ArrowRightCircle, Loader } from 'lucide-react';

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
    const [loading, setLoading] = useState(true);

    const getProjectImageUrl = (projectId: number): string => {
        const imageUrls = {
          1: "/images/1.png",
          2: "/images/2.png",
          3: "/images/3.png",
          4: "/images/4.png"
        };
      
        return imageUrls[projectId as keyof typeof imageUrls] || "/images/default-project.jpg";
    };

    const getShortTitle = (title: string): string => {
        console.log(`${title}`);
        const parts = title.split(':');
        return parts[0].trim();
    };

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
                title: project.title,
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

        setLoading(false);
    };

    fetchProjects();
    }, []);

    const formatKAIA = (value: BigNumberish): string => {
        return parseFloat(formatUnits(value, 18)).toFixed(2);
    };

    if (error) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <div className="text-red-500 text-center p-4 bg-gray-800 rounded-lg shadow-lg">
                    {error}
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-gray-900">
                <Loader className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            <div className="grid grid-cols-1 gap-6">
                {projects.map((project) => (
                    <Link href={`/projects/${project.id}`} key={project.id}>
                        <div className="bg-gray-800 rounded-lg shadow-lg overflow-hidden cursor-pointer hover:bg-gray-700 transition-colors duration-300">
                            <div className="relative">
                                <img
                                    src={getProjectImageUrl(project.id)}
                                    alt={`Project ${project.id}`}
                                    className="w-full h-40 object-cover"
                                />
                                {/* <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                                    <h2 className="text-xl font-semibold">{project.title}</h2>
                                </div> */}
                            </div>
                            <div className="p-4">
                                <h2 className="text-xl font-semibold mb-2">{getShortTitle(project.title)}</h2>
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm text-gray-400">Goal: {project.goal} KAIA</span>
                                    <span className="text-sm text-green-400">Raised: {project.totalFunds} KAIA</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(parseFloat(project.totalFunds) / parseFloat(project.goal)) * 100}%` }}></div>
                                </div>
                                <div className="mt-4 flex justify-between items-center">
                                    <span className="text-sm text-gray-400">
                                        Deadline: {new Date(project.deadline * 1000).toLocaleDateString()}
                                    </span>
                                    <ArrowRightCircle className="text-blue-500" size={24} />
                                </div>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

export default ProjectList;
