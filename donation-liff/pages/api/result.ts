import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface KaiaWalletBaseResponse {
    status: 'completed' | 'canceled' | 'pending';
    type: string;
    chain_id: string;
    request_key: string;
    expiration_time: number;
}

interface ErrorResponse {
    status: 'error' | 'timeout';
    error: string;
}

interface KaiaWalletExecuteContractResponse extends KaiaWalletBaseResponse {
    type: 'execute_contract';
    result: {
      signed_tx: string;
      tx_hash: string;
    };
  }
  
type KaiaWalletResultResponse =  KaiaWalletExecuteContractResponse | ErrorResponse;

async function pollKaiaWalletResult(requestKey: string, maxAttempts = 60, interval = 3000): Promise<KaiaWalletResultResponse | null> {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const response = await axios.get<KaiaWalletResultResponse>(`https://api.kaiawallet.io/api/v1/k/result/${requestKey}`);
            const data = response.data;
    
            console.log(`Polling attempt ${i + 1}, received data:`, JSON.stringify(data, null, 2));
    
            if (data.status === 'completed' || data.status === 'canceled') {
                return data;
            }
        } catch (error) {
            console.error("Error polling Kaia Wallet result:", error);
        }
        await new Promise(resolve => setTimeout(resolve, interval));
    }
  
    return null;
}

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<KaiaWalletResultResponse>
) {
    if (req.method !== 'GET') {
        return res.status(405).json({ status: 'error', error: 'Method Not Allowed' });
    }

    const { requestKey } = req.query;

    if (typeof requestKey !== 'string') {
        return res.status(400).json({ status: 'error', error: 'Invalid requestKey' });
    }

    try {
        const result = await pollKaiaWalletResult(requestKey);
        if (result === null) {
            res.status(408).json({ status: 'timeout', error: 'Polling timed out' });
        } else {
            res.status(200).json(result);
        }
    } catch (error) {
        console.error('Error in getting donation result:', error);
        res.status(500).json({ status: 'error', error: 'Failed to get donation result' });
    }
}
