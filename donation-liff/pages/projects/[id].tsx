import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Web3Provider, JsonRpcProvider, formatUnits } from "@kaiachain/ethers-ext";
import { Contract, BigNumberish } from 'ethers';
import liff from '@line/liff';
import axios from 'axios';
import Image from 'next/image';
import { Calendar, CheckCircle, User, Loader } from 'lucide-react';

import Modal from '../../components/Modal';

const donationABI = [
    {
        inputs: [{ internalType: "uint256", name: "projectId", type: "uint256" }],
        name: "getProjectDetails",
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
                internalType: "struct Donation.Project",
                name: "",
                type: "tuple"
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

const ProjectDetail: React.FC = () => {
    const router = useRouter();
    const { id } = router.query;
    const [project, setProject] = useState<Project | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [donationAmount, setDonationAmount] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [userName, setUserName] = useState<string>('');

    const [modalMessage, setModalMessage] = useState('');
    const [isModalError, setIsModalError] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';


    const getProjectImageUrl = (projectId: number): string => {
        const imageUrls = {
          1: "/images/1.png",
          2: "/images/2.png",
          3: "/images/3.png",
          4: "/images/4.png"
        };
      
        return imageUrls[projectId as keyof typeof imageUrls] || "/images/default-project.jpg";
      };
      

    const fetchProject = useCallback(async () => {
        if (!id) return;

        try {
            let provider;
            if (typeof window !== 'undefined' && 'klaytn' in window) {
                provider = new Web3Provider(window.klaytn);
            } else {
                provider = new JsonRpcProvider("https://public-en-baobab.klaytn.net");
            }

            const contract = new Contract(contractAddress, donationABI, provider);

            const projectData = await contract.getProjectDetails(Number(id));
            setProject({
                id: Number(projectData.id),
                title: projectData.title,
                goal: formatKAIA(projectData.goal),
                description: projectData.description,
                deadline: Number(projectData.deadline),
                owner: projectData.owner,
                totalFunds: formatKAIA(projectData.totalFunds),
                claimed: projectData.claimed,
            });
            setError(null);

            setDonationAmount('');
        } catch (error) {
            console.error('Error fetching project:', error);
            setError(`Error fetching project: ${error}`);
        }
    }, [id, contractAddress]);

    useEffect(() => {
        fetchProject();

        if (liff.isInClient() || liff.isLoggedIn()) {
            liff.getProfile().then((profile) => {
                setUserName(profile.displayName);
            }).catch((err) => {
                console.error('Error getting user profile:', err);
            });
        }
    }, [fetchProject]);

    const formatKAIA = (value: BigNumberish): string => {
        return parseFloat(formatUnits(value, 18)).toFixed(2);
    };

    const handleDonate = async () => {
        if (!project || !donationAmount) return;

        setIsProcessing(true);
        try {
            console.log('Starting donation process...');
            const prepareResponse = await axios.post(`${apiUrl}/api/donate`, {
                projectId: project.id,
                amount: donationAmount
            });

            console.log('Prepare response:', prepareResponse.data);

            const { requestKey } = prepareResponse.data;

            const kaiaUri = `kaikas://wallet/api?request_key=${requestKey}`;
            const liffRelayUrl = `https://liff.line.me/2006143560-2EB6oe6l?uri=${encodeURIComponent(kaiaUri)}`;

            console.log('Opening Kaia Wallet with URI:', kaiaUri);
            await liff.openWindow({
                url: liffRelayUrl,
                external: true
            });

            console.log('Polling for result...');
            const resultResponse = await axios.get(`${apiUrl}/api/result?requestKey=${requestKey}`);
            console.log('Result response:', resultResponse.data);
            const { status, result } = resultResponse.data;
            const txHash = result.tx_hash;

            if (status === 'completed' && txHash) {
                console.log('Donation successful. Transaction hash:', txHash);
                setModalMessage("Donation successful!");
                setIsModalError(false);
                await new Promise(resolve => setTimeout(resolve, 3000));
                await fetchProject();
            } else if (status === 'canceled') {
                console.log('Donation was cancelled');
                setModalMessage("Donation was cancelled.");
                setIsModalError(true);
            } else {
                console.log('Unexpected donation status:', status);
                setModalMessage("Donation failed or resulted in an unexpected state.");
                setIsModalError(true);
            }
            setIsModalOpen(true);
        } catch (error) {
            console.error("Detailed error in handleDonate:", error);
            if (axios.isAxiosError(error)) {
                console.error("Axios error details:", error.response?.data);
            }
            setModalMessage(`An error occurred while processing the donation. Please try again.`);
            setIsModalError(true);
            setIsModalOpen(true);
        } finally {
            setIsProcessing(false);
        }
    };

    const shareProject = async () => {
        if (!project) return;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        const liffUrl = `https://liff.line.me/${liffId}`;

        const imageUrl = "https://drive.usercontent.google.com/download?id=14fPyHLPBunY-HhsA8tashjxj32Z4crRl&export=view&authuser=0";

        try {
            const result = await liff.shareTargetPicker([
                {
                    type: "template",
                    altText: `${userName} is supporting a project. Would you like to join?`,
                    template: {
                        type: "buttons",
                        thumbnailImageUrl: imageUrl,
                        imageAspectRatio: "rectangle",
                        imageSize: "cover",
                        imageBackgroundColor: "#FFFFFF",
                        title: `${userName} joined project #${project.id}.`,
                        text: "Discover this project and see if you'd like to contribute!",
                        actions: [
                            {
                                type: "uri",
                                label: "View Details",
                                uri: `${liffUrl}?projectId=${project.id}`
                            }
                        ]
                    }
                }
            ]);

            if (result) {
                setModalMessage('Message sent successfully!');
                setIsModalError(false);
            } else {
                setModalMessage('ShareTargetPicker was closed before sending.');
                setIsModalError(true);
            }
            setIsModalOpen(true);

        } catch (error) {
            console.error('Error sharing project:', error);
            setModalMessage("An error occurred while sharing the project. Please try again.");
            setIsModalError(true);
            setIsModalOpen(true);
        }
    };

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <div className="text-red-500 text-center p-4 bg-slate-800 rounded-lg shadow-lg">
                    {error}
                </div>
            </div>
        );
    }

    if (!project) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-900">
                <Loader className="animate-spin text-blue-500" size={48} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 py-8">
            <div className="container mx-auto px-4 max-w-4xl">
                <div className="flex items-center flex-wrap mb-6">
                    <h1 className="text-3xl font-bold mr-4">{project.title}</h1>
                    <span className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-sm font-semibold inline-flex items-center">
                        Project ID: {project.id}
                    </span>
                </div>
                <div className="bg-slate-800 rounded-lg shadow-md overflow-hidden">
                    <img
                        src={getProjectImageUrl(project.id)}
                        alt={project.title}
                        className="w-full h-64 object-cover"
                    />
                    <div className="p-6">
                        <p className="text-xl mb-6">{project.description}</p>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="flex items-center">
                                <Image src="/kaia_symbol.png" alt="Goal" width={24} height={24} className="mr-2" />
                                <div>
                                    <p className="text-slate-400">Goal:</p>
                                    <p className="text-lg font-semibold">{project.goal} KAIA</p>
                                </div>
                            </div>
                            <div className="flex items-center">
                                <Image src="/kaia_symbol.png" alt="Raised" width={24} height={24} className="mr-2" />
                                <div>
                                    <p className="text-slate-400">Raised:</p>
                                    <p className="text-lg font-semibold">{project.totalFunds} KAIA</p>
                                </div>
                            </div>
                        </div>
                        <div className="mb-4 flex items-center">
                            <Calendar className="mr-2 text-yellow-500" size={20} />
                            <div>
                                <p className="text-slate-400">Deadline:</p>
                                <p className="text-lg">{new Date(project.deadline * 1000).toLocaleDateString()}</p>
                            </div>
                        </div>
                        <div className="mb-4 flex items-center">
                            <CheckCircle className="mr-2 text-green-500" size={20} />
                            <div>
                                <p className="text-slate-400">Status:</p>
                                <p className="text-lg">{project.claimed ? 'Claimed' : 'Not Claimed'}</p>
                            </div>
                        </div>
                        <div className="mb-6 flex items-center">
                            <User className="mr-2 text-purple-500" size={20} />
                            <div>
                                <p className="text-slate-400">Owner:</p>
                                <p className="text-sm break-all">{project.owner}</p>
                            </div>
                        </div>
                        <div className="mt-6">
                            <input
                                type="number"
                                value={donationAmount}
                                onChange={(e) => setDonationAmount(e.target.value)}
                                placeholder="Enter donation amount"
                                className="w-full p-2 border rounded mb-2 bg-slate-700 text-slate-100"
                            />
                            <button
                                onClick={handleDonate}
                                disabled={isProcessing}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold py-3 px-4 rounded mt-4 transition duration-300 ease-in-out"
                            >
                                {isProcessing ? 'Processing...' : 'Donate with Kaia Wallet'}
                            </button>
                        </div>
                    </div>
                </div>
                <button
                    onClick={shareProject}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-4 rounded mt-4 flex items-center justify-center transition duration-300 ease-in-out"
                >
                    <img 
                        src="/LINE_icon.png" 
                        alt="Share icon" 
                        className="w-6 h-6 mr-2"
                    />
                    Share with Friends
                </button>
            </div>
            <Modal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                message={modalMessage}
                isError={isModalError}
            />            
        </div>
    );
};

export default ProjectDetail;
