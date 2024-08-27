import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

type DonationResponse = {
  requestKey?: string;
  txHash?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<DonationResponse>
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { projectId, amount } = req.body;
    const projectIdNumber = Number(projectId);
    if (isNaN(projectIdNumber)) {
        return res.status(400).json({ error: 'Invalid projectId. Must be a valid number.' });
    }

    // Convert amount to wei
    let valueInWei: bigint;
    const amountInEther = parseFloat(amount);
    valueInWei = BigInt(Math.floor(amountInEther * 1e18));

    // Convert to hex
    const valueInHex = `0x${valueInWei.toString(16)}`;

    const contractAddress = process.env.CONTRACT_ADDRESS || '';

    try {
    // Prepare transaction
    const prepareResponse = await axios.post("https://api.kaiawallet.io/api/v1/k/prepare", {
        type: "execute_contract",
        chain_id: "1001",
        bapp: {
            name: "LINE Bot",
        },
        transaction: {
            abi: JSON.stringify({
                constant: false,
                inputs: [
                    {
                        name: "_projectId",
                        type: "uint256"
                    }
                ],
                name: "donate",
                outputs: [],
                payable: true,
                stateMutability: "payable",
                type: "function"
            }),
            value: valueInHex,
            to: contractAddress,
            params: JSON.stringify([projectId.toString()])
        }
    });

    const requestKey = prepareResponse.data.request_key;

    // Return the requestKey to the client
    res.status(200).json({ requestKey });
  } catch (error) {
    console.error('Error in donation preparation:', error);
    res.status(500).json({ error: 'Failed to prepare donation' });
  }
}
