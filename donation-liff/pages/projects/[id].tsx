import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Web3Provider, JsonRpcProvider, formatUnits } from "@kaiachain/ethers-ext";
import { Contract, BigNumberish } from 'ethers';
import liff from '@line/liff';
import axios from 'axios';

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

    const contractAddress = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
    const apiRrl = process.env.NEXT_PUBLIC_API_URL || '';

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
    }, [id, setDonationAmount]);

    useEffect(() => {
        fetchProject();

        // LIFF initialization and user profile fetching
        if (liff.isInClient() || liff.isLoggedIn()) {
            liff.getProfile().then((profile) => {
                setUserName(profile.displayName);
            }).catch((err) => {
                console.error('Error getting user profile:', err);
            });
        }
    }, [id]);

    const formatKAIA = (value: BigNumberish): string => {
        return parseFloat(formatUnits(value, 18)).toFixed(2);
    };

    const handleDonate = async () => {
        if (!project || !donationAmount) return;

        setIsProcessing(true);
        try {
            console.log('Starting donation process...');
            // Prepare donation
            const prepareResponse = await axios.post(`${apiRrl}/api/donate`, {
                projectId: project.id,
                amount: donationAmount
            });

            console.log('Prepare response:', prepareResponse.data);

            const { requestKey } = prepareResponse.data;

            // Open Kaia Wallet
            const kaiaUri = `kaikas://wallet/api?request_key=${requestKey}`;
            const liffRelayUrl = `https://liff.line.me/2006143560-2EB6oe6l?uri=${encodeURIComponent(kaiaUri)}`;
        
            console.log('Opening Kaia Wallet with URI:', kaiaUri);
            await liff.openWindow({
                url: liffRelayUrl,
                external: true
            });

            // Poll for result
            console.log('Polling for result...');
            const resultResponse = await axios.get(`${apiRrl}/api/result?requestKey=${requestKey}`);
            console.log('Result response:', resultResponse.data);
            alert(`Result response: ${JSON.stringify(resultResponse.data, null, 2)}`);
            const { status, result } = resultResponse.data;
            const txHash = result.tx_hash;

            if (status === 'completed' && txHash) {
                console.log('Donation successful. Transaction hash:', txHash);
                alert(`Donation successful! Transaction hash: ${txHash}`);
                // Here you can add code to update the UI or refresh the project data
                await new Promise(resolve => setTimeout(resolve, 3000));
                await fetchProject();
            } else if (status === 'canceled') {
                console.log('Donation was cancelled');
                alert("Donation was cancelled.");
            } else {
                console.log('Unexpected donation status:', status);
                alert("Donation failed or resulted in an unexpected state.");
            }
        } catch (error) {
            console.error("Detailed error in handleDonate:", error);
            if (axios.isAxiosError(error)) {
                console.error("Axios error details:", error.response?.data);
            }
            alert(`An error occurred while processing the donation. Please check the console for details and try again.: ${error}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const shareProject = async () => {
        if (!project) return;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        const liffUrl = `https://liff.line.me/${liffId}`;

        try {
            const result = await liff.shareTargetPicker([
                // {
                //     type: 'text',
                //     text: `${userName} is supporting a project. Would you like to join?`
                // }
                {
                    type: "template",
                    altText: `${userName} is supporting a project. Would you like to join?`,
                    template: {
                      type: "buttons",
                    //   thumbnailImageUrl: `https://picsum.photos/seed/${project.id}/1024/1024`,
                      imageAspectRatio: "rectangle",
                      imageSize: "cover",
                      imageBackgroundColor: "#FFFFFF",
                    //   title: `Support Project ${project.id}`,
                      text: `Your friend ${userName} is supporting a project #${project.id}. Why not check out the project details and see if you'd like to support it too?`,
                      actions: [
                        {
                          type: "uri",
                          label: "View Details",
                          uri: `${liffUrl}?projectId=${project.id}`
                        }
                        // {
                        //   type: "uri",
                        //   label: "Support Now",
                        //   uri: `${liffUrl}?projectId=${project.id}&action=support`
                        // }
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
                        
        } catch (error) {
            console.error('Error sharing project:', error);
            alert("An error occurred while sharing the project. Please try again.");
        }
    };

    if (error) {
        return <div className="text-red-500">{error}</div>;
    }

    if (!project) {
        return <div>Loading...</div>;
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">{project.title}</h1>
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <img
                    src={`https://picsum.photos/seed/${project.id}/800/400`}
                    alt={project.title}
                    className="w-full h-64 object-cover"
                />
                <div className="p-6">
                    <p className="text-xl mb-4">{project.description}</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <p className="text-gray-600">Goal:</p>
                            <p className="text-lg font-semibold">{project.goal} KAIA</p>
                        </div>
                        <div>
                            <p className="text-gray-600">Raised:</p>
                            <p className="text-lg font-semibold">{project.totalFunds} KAIA</p>
                        </div>
                    </div>
                    <div className="mb-4">
                        <p className="text-gray-600">Deadline:</p>
                        <p className="text-lg">{new Date(project.deadline * 1000).toLocaleDateString()}</p>
                    </div>
                    <div className="mb-4">
                        <p className="text-gray-600">Status:</p>
                        <p className="text-lg">{project.claimed ? 'Claimed' : 'Not Claimed'}</p>
                    </div>
                    <div className="mb-4">
                        <p className="text-gray-600">Owner:</p>
                        <p className="text-sm break-all">{project.owner}</p>
                    </div>
                    <div className="mt-6">
                        <input
                            type="number"
                            value={donationAmount}
                            onChange={(e) => setDonationAmount(e.target.value)}
                            placeholder="Enter donation amount"
                            className="w-full p-2 border rounded mb-2"
                        />
                        <button
                            onClick={handleDonate}
                            disabled={isProcessing}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded mt-6"
                        >
                            {isProcessing ? 'Processing...' : 'Donate with Kaia Wallet'}
                        </button>
                    </div>
                </div>
            </div>
            <button
                onClick={shareProject}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded"
            >
                Share with Friends
            </button>
        </div>
    );
};

export default ProjectDetail;
