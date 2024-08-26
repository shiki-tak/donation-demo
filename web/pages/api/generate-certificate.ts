import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import FormData from 'form-data';
import { JsonRpcProvider, formatUnits } from "@kaiachain/ethers-ext";

import { utils, BigNumberish } from "ethers";

const { Interface } = utils;
type LogDescription = utils.LogDescription;

import GenerateCertificateBase64 from '../../utils/CertificateGenerator';

// Pinata
const JWT = process.env.PINATA_JWT as string;
const GATEWAY = process.env.PINATA_GATEWAY as string;

const donationMadeABI = [{
  "anonymous": false,
  "inputs": [
    {
      "indexed": false,
      "internalType": "uint256",
      "name": "projectId",
      "type": "uint256"
    },
    {
      "indexed": false,
      "internalType": "address",
      "name": "donor",
      "type": "address"
    },
    {
      "indexed": false,
      "internalType": "uint256",
      "name": "amount",
      "type": "uint256"
    },
    {
      "indexed": false,
      "internalType": "uint256",
      "name": "certificateId",
      "type": "uint256"
    }
  ],
  "name": "DonationMade",
  "type": "event"
}];

interface DonationMadeEvent {
  projectId: string;
  donor: string;
  amount: string;
  certificateId: string;
}

function getDonationMadeEventFromTxHash(txHash: string): Promise<DonationMadeEvent | null> {
  return new Promise(async (resolve, reject) => {
    try {
      const provider = new JsonRpcProvider("https://public-en-baobab.klaytn.net");
      
      const receipt = await provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        resolve(null);
        return;
      }

      const contractInterface = new Interface(donationMadeABI);
      
      const donationMadeEvent = receipt.logs
      .map((log: { topics: string[]; data: any; }) => {
        try {
          return contractInterface.parseLog({
            topics: log.topics as string[],
            data: log.data
          }) as LogDescription;
        } catch (e) {
          return null;
        }
      })
      .find((event: LogDescription | null): event is LogDescription => 
        event !== null && event.name === 'DonationMade'
      );
      
      if (donationMadeEvent) {
        resolve({
          projectId: donationMadeEvent.args.projectId.toString(),
          donor: donationMadeEvent.args.donor,
          amount: donationMadeEvent.args.amount.toString(),
          certificateId: donationMadeEvent.args.certificateId.toString()
        });
      } else {
        resolve(null);
      }
    } catch (error) {
      reject(error);
    }
  });
}

async function uploadToPinata(base64Image: string, fileName: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Image, 'base64');
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: fileName,
      contentType: 'image/png',
    });

    const response = await axios.post('https://api.pinata.cloud/pinning/pinFileToIPFS', formData, {
      maxBodyLength: Infinity,
      headers: {
        'Content-Type': `multipart/form-data; boundary=${formData.getBoundary()}`,
        Authorization: `Bearer ${JWT}`,
      },
    });

    return `https://${GATEWAY}/ipfs/${response.data.IpfsHash}`;
  } catch (error) {
    console.error('Error uploading to Pinata:', error);
    throw error;
  }
}

const formatKAIA = (value: BigNumberish): string => {
  return parseFloat(formatUnits(value, 18)).toFixed(2);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { txHash } = req.body;

  try {
    const donateEvent = await getDonationMadeEventFromTxHash(txHash);

    if (!donateEvent) {
      return res.status(400).json({ error: 'Missing Donate Event' });
    }

    const formattedAmount = formatKAIA(donateEvent.amount);

    const base64Data = await GenerateCertificateBase64(donateEvent.donor, donateEvent.projectId, formattedAmount, donateEvent.certificateId);
    const fileName = `certificate-${donateEvent.certificateId}.png`;
    const ipfsUrl = await uploadToPinata(base64Data, fileName);

    res.status(200).json({
      success: true,
      message: 'Certificate generated and uploaded successfully',
      ipfsUrl: ipfsUrl
    });
  } catch (error) {
    console.error('Error in certificate generation and upload:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
