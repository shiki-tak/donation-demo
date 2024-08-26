"use strict";

import dotenv from "dotenv";
dotenv.config();
import { MessageEvent, TextMessage, ImageMessage, TemplateMessage } from "@line/bot-sdk";
import { KaiaBotClient, createKaiaBotClient, WalletInfo } from "./kaia_bot_client";
import { getSdkError } from "@walletconnect/utils";
import { Transaction } from "web3-types";
import axios from "axios";
import { setTimeout } from 'timers/promises';
import { SignClientTypes } from "@walletconnect/types";

// unused
interface KaiaWalletPrepareResponse {
  chain_id: string;
  request_key: string;
  status: string;
  expiration_time: number;
}

interface KaiaWalletBaseResponse {
  status: 'completed' | 'canceled' | 'pending';
  type: string;
  chain_id: string;
  request_key: string;
  expiration_time: number;
}

interface KaiaWalletAuthResponse extends KaiaWalletBaseResponse {
  type: 'auth';
  result: {
    klaytn_address: string;
  };
}

interface KaiaWalletSendKlayResponse extends KaiaWalletBaseResponse {
  type: 'send_klay';
  result: {
    signed_tx: string;
    tx_hash: string;
  };
}

interface KaiaWalletExecuteContractResponse extends KaiaWalletBaseResponse {
  type: 'execute_contract';
  result: {
    signed_tx: string;
    tx_hash: string;
  };
}

type KaiaWalletResultResponse = KaiaWalletAuthResponse | KaiaWalletSendKlayResponse | KaiaWalletExecuteContractResponse;

function isKaiaWalletAuthResponse(response: KaiaWalletResultResponse): response is KaiaWalletAuthResponse {
  return response.type === 'auth';
}

function isKaiaWalletSendKlayResponse(response: KaiaWalletResultResponse): response is KaiaWalletSendKlayResponse {
  return response.type === 'send_klay';
}

function isKaiaWalletExecuteContractResponse(response: KaiaWalletResultResponse): response is KaiaWalletExecuteContractResponse {
  return response.type === 'execute_contract';
}

const bot = createKaiaBotClient({
  sbUrl: process.env.SUPABASE_URL ?? "",
  sbKey: process.env.SUPABASE_KEY ?? "",
  sbChannelId: process.env.SUPABASE_CHANNEL_ID ?? "",
  lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  wcProjectId: process.env.WALLET_CONNECT_PROJECT_ID ?? "",
  rpcEndpoint: process.env.RPC_ENDPOINT ?? "",
});

interface UserState {
  state: string;
  address?: string;
  amount?: string;
  projectId?: string;
}

const userStates: { [userId: string]: UserState } = {};

bot.on("message", (event: MessageEvent) => {
  if (event.message.type == "text") {
    handleMessage(bot, event);
  }
});

bot.start();

async function handleMessage(bot: KaiaBotClient, event: MessageEvent) {
  const message = (event.message as TextMessage).text;
  const userId = event.source.userId || "";

  switch (message) {
    case "/connect":
      connect(bot, event);
      break;
    case "/my_wallet":
      myWallet(bot, event);
      break;
    case "/send_tx":
      initiateSendTx(bot, event);
      break;
    case "/donate":
      initiateDonate(bot, event);
      break;
    case "/project_list":
      projectList(bot, event);
      break;
    case "/disconnect":
      disconnect(bot, event);
      break;
    default:
      await handleDefaultCase(bot, event, userId);
  }
}

async function handleDefaultCase(bot: KaiaBotClient, event: MessageEvent, userId: string) {
  const userState = userStates[userId];
  if (userState && typeof userState === 'object' && 'state' in userState) {
    if (userState.state.startsWith('WAITING_FOR_')) {
      await handleUserInput(bot, event);
    } else {
      await say_hello(bot, event);
    }
  } else {
    await say_hello(bot, event);
  }
}

async function say_hello(bot: KaiaBotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    const messages: Array<TextMessage> = [
      {
        type: "text",
        text: "This is an example of a LINE bot for connecting to Klaytn wallets and sending transactions with WalletConnect.\n\nCommands list:\n/connect - Connect to a wallet\n/my_wallet - Show connected wallet\n/send_tx - Send transaction\n/disconnect - Disconnect from the wallet",
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "message",
                label: "/connect",
                text: "/connect",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/my_wallet",
                text: "/my_wallet",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/send_tx",
                text: "/send_tx",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/donate",
                text: "/donate",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/project_list",
                text: "/project_list",
              },
            },
            {
              type: "action",
              action: {
                type: "message",
                label: "/disconnect",
                text: "/disconnect",
              },
            },
          ],
        },
      },
    ];
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.log(e);
  }
}

async function connect(bot: KaiaBotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    const walletInfo = bot.getWalletInfo(to);
    if (walletInfo) {
      let message: string;
      if (bot.isWalletConnectInfo(walletInfo)) {
        message = `You have already connected ${walletInfo.metadata.name}\nYour address: ${walletInfo.address}\n\nDisconnect wallet first to connect a new one.`;
      } else if (bot.isKaiaWalletInfo(walletInfo)) {
        message = `You have already connected Kaia Wallet\nYour address: ${walletInfo.address}\n\nDisconnect wallet first to connect a new one.`;
      } else {
        message = `You have already connected a wallet\nYour address: ${walletInfo.address}\n\nDisconnect wallet first to connect a new one.`;
      }
      
      let messages: Array<TextMessage> = [
        {
          type: "text",
          text: message,
        },
      ];
      await bot.sendMessage(to, messages);

      show_commands(bot, event);

      return;
    }

    const { uri, approval } = await bot.connect({
      requiredNamespaces: {
        eip155: {
          methods: [
            "eth_sendTransaction",
            "eth_signTransaction",
            "eth_sign",
            "personal_sign",
            "eth_signTypedData",
          ],
          chains: ["eip155:1001"],
          events: ["chainChanged", "accountsChanged"],
        },
      },
    });

    const response = await axios.post("https://api.kaiawallet.io/api/v1/k/prepare", {
      type: "auth",
      chain_id: "1001",
      bapp: {
        name: "LINE Bot",
      },
    });

    const requestKey = response.data.request_key;
    const kaikasUri = `kaikas://wallet/api?request_key=${requestKey}`;
    console.log(`requestKey: ${requestKey}`);

    const liffRelayUrl = `https://liff.line.me/2006143560-2EB6oe6l?uri=${encodeURIComponent(kaikasUri)}`;

    console.log(`uri: ${uri}`);

    if (uri) {
      let messages: Array<TextMessage> = [
        {
          type: "text",
          text: "Choose your wallet",
          quickReply: {
            items: [
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "Metamask",
                  uri:
                    process.env.MINI_WALLET_URL_COMPACT +
                    "/open/wallet/?url=" +
                    encodeURIComponent(
                      "metamask://wc?uri=" + encodeURIComponent(uri)
                    ),
                },
              },
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "Mini Wallet",
                  uri:
                    process.env.MINI_WALLET_URL_TALL +
                    "/wc/?uri=" +
                    encodeURIComponent(uri),
                },
              },
              {
                type: "action",
                action: {
                  type: "uri",
                  label: "Kaikas",
                  uri: liffRelayUrl,
                },
              },
            ],
          },
        },
      ];
      await bot.sendMessage(to, messages);

      const connectionPromise = await Promise.race([
        handleMetaMaskConnection(bot, to, approval),
        handleKaiaWalletConnection(bot, to, requestKey)
      ]);
      const timeoutPromise = setTimeout(300000).then(() => 'timeout');
      const connectionResult = await Promise.race([connectionPromise, timeoutPromise]);


      if (connectionResult === 'timeout') {
        await bot.sendMessage(to, [{ type: "text", text: "Connection process timed out. Please try again." }]);
      } else if (connectionResult === 'success') {
        await bot.sendMessage(to, [{ type: "text", text: "Wallet connected successfully!" }]);
        await show_commands(bot, event);
      } else {
        await bot.sendMessage(to, [{ type: "text", text: "Failed to connect wallet. Please try again." }]);
      }
    }

  } catch (e) {
    console.log(e);
  }
}

async function handleMetaMaskConnection(bot: KaiaBotClient, to: string, approval: () => Promise<any>): Promise<string> {
  try {
    const session = await approval();
    bot.setTopic(to, session.topic);
    
    const address = session.namespaces["eip155"]?.accounts[0]?.split(":")[2] || "";
    const walletInfo: WalletInfo = {
      type: 'walletconnect',
      address: address,
      metadata: session.peer.metadata
    };
    bot.setWalletInfo(to, walletInfo);
    
    console.log(`MetaMask connection successful for user ${to}:`, walletInfo);
    await handleSuccessfulConnection(bot, to);
    return 'success';
  } catch (error) {
    console.error("MetaMask connection error:", error);
    return 'error';
  }
}

async function handleKaiaWalletConnection(bot: KaiaBotClient, to: string, requestKey: string): Promise<string> {
  try {
    console.log(`Starting Kaikas Wallet connection for user ${to} with requestKey: ${requestKey}`);
    const response = await pollKaiaWalletResult(requestKey);
    console.log(`Received response for user ${to}:`, JSON.stringify(response, null, 2));
    console.log(`Response status:`, response?.status);
    if (response) {
      console.log(`Is KaiaWalletAuthResponse:`, isKaiaWalletAuthResponse(response));
    }

    if (response && response.status === 'completed' && isKaiaWalletAuthResponse(response)) {
      const address = response.result.klaytn_address;
      const walletInfo: WalletInfo = {
        type: 'kaia',
        address: address
      };
      bot.setWalletInfo(to, walletInfo);
      
      console.log(`Kaikas Wallet connection successful for user ${to}:`, walletInfo);
      await handleSuccessfulConnection(bot, to);
      return 'success';
    } else if (response && response.status === 'canceled') {
      console.log(`Kaikas Wallet connection canceled by user ${to}`);
      return 'canceled';
    } else {
      console.log(`Kaikas Wallet connection failed for user ${to}: Unexpected response`, response);
      return 'error';
    }
  } catch (error) {
    console.error(`Kaikas Wallet connection error for user ${to}:`, error);
    return 'error';
  }
}

async function pollKaiaWalletResult(requestKey: string, maxAttempts = 30, interval = 2000): Promise<KaiaWalletResultResponse | null> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await axios.get<KaiaWalletResultResponse>(`https://api.kaiawallet.io/api/v1/k/result/${requestKey}`);
      const data = response.data;
      
      console.log(`Polling attempt ${i + 1}, received data:`, JSON.stringify(data, null, 2));
      
      if (typeof data === 'string' || data.status === 'completed' || data.status === 'canceled') {
        return data;
      }
    } catch (error) {
      console.error("Error polling Kaia Wallet result:", error);
    }

    await setTimeout(interval);
  }

  return null;
}

async function handleSuccessfulConnection(bot: KaiaBotClient, to: string) {
  console.log(`Entering handleSuccessfulConnection for user ${to}`);
  const walletInfo = bot.getWalletInfo(to);
  console.log(`Retrieved wallet info for user ${to}:`, walletInfo);
  if (walletInfo) {
    let message: string;
    if (bot.isWalletConnectInfo(walletInfo)) {
      message = `${walletInfo.metadata.name} connected successfully\nYour address: ${walletInfo.address}`;
    } else if (bot.isKaiaWalletInfo(walletInfo)) {
      message = `Kaia Wallet connected successfully\nYour address: ${walletInfo.address}`;
    } else {
      message = `Wallet connected successfully\nYour address: ${walletInfo.address}`;
    }

    console.log(`Wallet connected for user ${to}:`, walletInfo);

    const messages: Array<TextMessage> = [
      {
        type: "text",
        text: message,
      },
    ];
    await bot.sendMessage(to, messages);
  } else {
    console.error(`Failed to get wallet info for user ${to}`);
    await bot.sendMessage(to, [{ type: "text", text: "Failed to retrieve wallet information. Please try connecting again." }]);
  }
}

async function myWallet(bot: KaiaBotClient, event: MessageEvent) {
  try {
    const to = event.source.userId || "";
    const walletInfo = bot.getWalletInfo(to);
    if (!walletInfo) {
      const messages: Array<TextMessage> = [
        {
          type: "text",
          text: "You didn't connect a wallet",
        },
      ];
      await bot.sendMessage(to, messages);

      show_commands(bot, event);
      return;
    }

    let message: string;

    if (bot.isWalletConnectInfo(walletInfo)) {
      message = `Connected wallet: ${walletInfo.metadata.name}\nYour address: ${walletInfo.address}`;
    } else if (bot.isKaiaWalletInfo(walletInfo)) {
      message = `Connected wallet: Kaia Wallet\nYour address: ${walletInfo.address}`;
    } else {
      message = `Connected wallet address: ${walletInfo.address}`;
    }

    let messages: Array<TextMessage> = [
      {
        type: "text",
        text: message,
      },
    ];
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.log(e);
  }
  show_commands(bot, event);
}

async function projectList(bot: KaiaBotClient, event: MessageEvent) {
  const to = event.source.userId || "";
  const url = process.env.PROJECT_LIST_URL || "";
  const messages: Array<TemplateMessage> = [
    {
      type: "template",
      altText: "Donation Project list",
      template: {
        type: "buttons",
        text: "Donation Project list",
        actions: [
          {
            type: "uri",
            label: "Open web page",
            uri: url
          }
        ]
      }
    }
  ];

  await bot.sendMessage(to, messages);
}

async function initiateSendTx(bot: KaiaBotClient, event: MessageEvent) {
  const userId = event.source.userId || "";
  const wallet = bot.getWalletInfo(userId);
  if (!wallet) {
    await bot.sendMessage(userId, [{ type: "text", text: "Connect wallet to send transaction" }]);
    await show_commands(bot, event);
    return;
  }

  userStates[userId] = { state: 'WAITING_FOR_ADDRESS' };
  await bot.sendMessage(userId, [{ type: "text", text: "Please enter the address to send to:" }]);
}

async function sendTx(bot: KaiaBotClient, event: MessageEvent, address: string, amount: string) {
  const to = event.source.userId || "";
  try {
    const walletInfo = bot.getWalletInfo(to);
    if (!walletInfo) {
      await bot.sendMessage(to, [{ type: "text", text: "Connect wallet to send transaction" }]);
      return;
    }

    // Convert amount to KLAY (in peb)
    let valueInPeb: bigint;
    try {
      const amountInKLAY = parseFloat(amount);
      valueInPeb = BigInt(Math.floor(amountInKLAY * 1e18));
    } catch (error) {
      console.error('Error parsing amount:', error);
      await bot.sendMessage(to, [{ type: "text", text: "Invalid amount. Please enter a valid number." }]);
      return;
    }

    // Convert to hex
    const valueInHex = `0x${valueInPeb.toString(16)}`;

    console.log(`Original amount: ${amount} KLAY`);
    console.log(`Value in peb: ${valueInPeb}`);
    console.log(`Value in hex: ${valueInHex}`);

    if (bot.isWalletConnectInfo(walletInfo)) {
      await handleMetaMaskTransaction(bot, to, walletInfo, address, valueInHex);
    } else if (bot.isKaiaWalletInfo(walletInfo)) {
      await handleKaiaWalletTransaction(bot, to, address, amount);
    } else {
      throw new Error("Unknown wallet type");
    }

  } catch (e) {
    console.error("Error in sendTx:", e);
    await bot.sendMessage(to, [{ type: "text", text: "An error occurred while sending the transaction. Please try again." }]);
  }
}

async function handleMetaMaskTransaction(bot: KaiaBotClient, to: string, walletInfo: WalletInfo & { type: 'walletconnect', metadata: SignClientTypes.Metadata }, address: string, valueInHex: string) {
  const uri = process.env.MINI_WALLET_URL_COMPACT +
    "/open/wallet/?url=" +
    encodeURIComponent(walletInfo.metadata.redirect?.universal || "");

  let messages: Array<TextMessage> = [
    {
      type: "text",
      text: `Open ${walletInfo.metadata.name} and confirm transaction`,
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "uri",
              label: `Open Wallet`,
              uri: uri,
            },
          },
        ],
      },
    },
  ];
  await bot.sendMessage(to, messages);

  const topic = bot.getTopic(to);
  const tx: Transaction = {
    from: walletInfo.address,
    to: address,
    value: valueInHex,
  };
  const gasPrice = await bot.getGasPrice();
  const gas = await bot.estimateGas(tx);
  const transactionId = await bot.request({
    topic: topic,
    chainId: "eip155:1001",
    request: {
      method: "eth_sendTransaction",
      params: [
        {
          from: tx.from,
          to: tx.to,
          data: tx.data,
          gasPrice: gasPrice,
          gasLimit: gas,
          value: tx.value,
        },
      ],
    },
  });

  await bot.sendMessage(to, [{ type: "text", text: `Transaction result\nhttps://baobab.klaytnscope.com/tx/${transactionId}` }]);
}

async function handleKaiaWalletTransaction(bot: KaiaBotClient, to: string, address: string, amount: string) {
  try {
    // Prepare transaction
    const prepareResponse = await axios.post("https://api.kaiawallet.io/api/v1/k/prepare", {
      type: "send_klay",
      chain_id: "1001",
      bapp: {
        name: "LINE Bot",
      },
      transaction: {
        to: address,
        amount: amount
      }
    });

    const requestKey = prepareResponse.data.request_key;
    console.log(`Kaia Wallet prepare response:`, prepareResponse.data);

    // Send message to user with Kaia Wallet deep link
    const kaiaUri = `kaikas://wallet/api?request_key=${requestKey}`;
    const liffRelayUrl = `https://liff.line.me/2006143560-2EB6oe6l?uri=${encodeURIComponent(kaiaUri)}`;
    
    await bot.sendMessage(to, [{
      type: "text",
      text: "Please approve the transaction in Kaia Wallet",
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "uri",
              label: "Open Kaia Wallet",
              uri: liffRelayUrl
            }
          }
        ]
      }
    }]);

    // Poll for transaction result
    const result = await pollKaiaWalletResult(requestKey);
    if (result && result.status === 'completed') {
      if (isKaiaWalletSendKlayResponse(result)) {
        await bot.sendMessage(to, [{ type: "text", text: `Transaction result\nhttps://baobab.klaytnscope.com/tx/${result.result.tx_hash}` }]);
      } else {
        await bot.sendMessage(to, [{ type: "text", text: "Transaction completed, but unexpected response type received." }]);
      }
    } else if (result && result.status === 'canceled') {
      await bot.sendMessage(to, [{ type: "text", text: "Transaction was cancelled." }]);
    } else {
      await bot.sendMessage(to, [{ type: "text", text: "Transaction failed or resulted in an unexpected state." }]);
    }

  } catch (error) {
    console.error("Error in handleKaiaWalletTransaction:", error);
    await bot.sendMessage(to, [{ type: "text", text: "An error occurred while processing the transaction with Kaia Wallet." }]);
  }
}

async function initiateDonate(bot: KaiaBotClient, event: MessageEvent) {
  const userId = event.source.userId || "";
  const wallet = bot.getWalletInfo(userId);
  if (!wallet) {
    await bot.sendMessage(userId, [{ type: "text", text: "Connect wallet to make a donation" }]);
    await show_commands(bot, event);
    return;
  }

  userStates[userId] = { state: 'WAITING_FOR_PROJECT_ID' };
  await bot.sendMessage(userId, [{ type: "text", text: "Please enter the project ID you want to donate to:" }]);
}


async function handleUserInput(bot: KaiaBotClient, event: MessageEvent) {
  const userId = event.source.userId || "";
  const message = (event.message as TextMessage).text;
  const userState = userStates[userId];

  if (!userState) {
    console.error(`User state not found for user ID: ${userId}`);
    await bot.sendMessage(userId, [{ type: "text", text: "An error occurred. Please try again." }]);
    await show_commands(bot, event);
    return;
  }

  switch (userState.state) {
    case 'WAITING_FOR_ADDRESS':
      userState.address = message;
      userState.state = 'WAITING_FOR_AMOUNT';
      await bot.sendMessage(userId, [{ type: "text", text: "Please enter the amount to send:" }]);
      break;
    case 'WAITING_FOR_AMOUNT':
      userState.amount = message;
      if (userState.address) {
        await sendTx(bot, event, userState.address, userState.amount);
      } else {
        console.error(`Address not found in user state for user ID: ${userId}`);
        await bot.sendMessage(userId, [{ type: "text", text: "An error occurred. Please try /send_tx again." }]);
      }
      delete userStates[userId];
      break;
    case 'WAITING_FOR_PROJECT_ID':
      userState.projectId = message;
      userState.state = 'WAITING_FOR_DONATION_AMOUNT';
      await bot.sendMessage(userId, [{ type: "text", text: "Please enter the amount you want to donate:" }]);
      break;
    case 'WAITING_FOR_DONATION_AMOUNT':
      userState.amount = message;
      if (userState.projectId) {
        await executeDonation(bot, event, userState.projectId, userState.amount);
      } else {
        console.error(`Project ID not found in user state for user ID: ${userId}`);
        await bot.sendMessage(userId, [{ type: "text", text: "An error occurred. Please try /donate again." }]);
      }
      delete userStates[userId];
      break;
    default:
      console.error(`Invalid state ${userState.state} for user ID: ${userId}`);
      await bot.sendMessage(userId, [{ type: "text", text: "An error occurred. Please try again." }]);
      delete userStates[userId];
  }

  if (!userStates[userId]) {
    await show_commands(bot, event);
  }
}

async function executeDonation(bot: KaiaBotClient, event: MessageEvent, projectId: string, amount: string) {
  const to = event.source.userId || "";
  try {
    const walletInfo = bot.getWalletInfo(to);
    if (!walletInfo) {
      await bot.sendMessage(to, [{ type: "text", text: "Connect wallet to make a donation" }]);
      return;
    }

    if (!bot.isKaiaWalletInfo(walletInfo)) {
      await bot.sendMessage(to, [{ type: "text", text: "This function is currently only supported for Kaia Wallet" }]);
      return;
    }

    // Convert amount to wei
    let valueInWei: bigint;
    try {
      const amountInEther = parseFloat(amount);
      valueInWei = BigInt(Math.floor(amountInEther * 1e18));
    } catch (error) {
      console.error('Error parsing amount:', error);
      await bot.sendMessage(to, [{ type: "text", text: "Invalid amount. Please enter a valid number." }]);
      return;
    }

    // Convert to hex
    const valueInHex = `0x${valueInWei.toString(16)}`;

    console.log(`Original amount: ${amount} KAIA`);
    console.log(`Value in wei: ${valueInWei}`);
    console.log(`Value in hex: ${valueInHex}`);

    // Prepare transaction
    const contractAddress = process.env.CONTRACT_ADDRESS;
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
        params: JSON.stringify([projectId])
      }
    });

    const requestKey = prepareResponse.data.request_key;
    console.log(`Kaia Wallet prepare response:`, prepareResponse.data);

    // Send message to user with Kaia Wallet deep link
    const kaiaUri = `kaikas://wallet/api?request_key=${requestKey}`;
    const liffRelayUrl = `https://liff.line.me/2006143560-2EB6oe6l?uri=${encodeURIComponent(kaiaUri)}`;
    
    await bot.sendMessage(to, [{
      type: "text",
      text: "Please approve the donation in Kaia Wallet",
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "uri",
              label: "Open Kaia Wallet",
              uri: liffRelayUrl
            }
          }
        ]
      }
    }]);

    // Poll for transaction result
    const result = await pollKaiaWalletResult(requestKey);
    if (result && result.status === 'completed') {
      if (isKaiaWalletExecuteContractResponse(result)) {
        const txHash = result.result.tx_hash;
        await bot.sendMessage(to, [{ type: "text", text: `Donation successful! Transaction hash: ${txHash}\nView on explorer: https://baobab.klaytnscope.com/tx/${result.result.tx_hash}` }]);
        // Upload the certificate to IPFS and send it to the user as an ImageMessage.
        try {
          const certificateResponse = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/generate-certificate`, { txHash });
          const ipfsUrl = certificateResponse.data.ipfsUrl;

          // Send the certificate as an ImageMessage
          const imageMessage: ImageMessage = {
            type: "image",
            originalContentUrl: ipfsUrl,
            previewImageUrl: ipfsUrl
          };
          await bot.sendMessage(to, [imageMessage]);
          
          await bot.sendMessage(to, [{ type: "text", text: "Here's your donation certificate! Thank you for your contribution." }]);
        } catch (error) {
          console.error("Error generating or sending certificate:", error);
          await bot.sendMessage(to, [{ type: "text", text: "An error occurred while generating your donation certificate. However, your donation was successful." }]);
        }      
      } else {
        await bot.sendMessage(to, [{ type: "text", text: "Donation completed, but unexpected response type received." }]);
      }
    } else if (result && result.status === 'canceled') {
      await bot.sendMessage(to, [{ type: "text", text: "Donation was cancelled." }]);
    } else {
      await bot.sendMessage(to, [{ type: "text", text: "Donation failed or resulted in an unexpected state." }]);
    }

  } catch (error) {
    console.error("Error in executeDonation:", error);
    await bot.sendMessage(to, [{ type: "text", text: "An error occurred while processing the donation. Please try again." }]);
  }
}

async function disconnect(bot: KaiaBotClient, event: MessageEvent) {
  const to = event.source.userId || "";
  try {
    
    const walletInfo = bot.getWalletInfo(to);
    
    if (!walletInfo) {
      const messages: Array<TextMessage> = [
        {
          type: "text",
          text: "You didn't connect a wallet",
        },
      ];
      await bot.sendMessage(to, messages);
      show_commands(bot, event);
      return;
    }

    if (bot.isWalletConnectInfo(walletInfo)) {
      const topic = bot.getTopic(to);
      await bot.disconnect({
        topic: topic,
        reason: getSdkError("USER_DISCONNECTED"),
      });
      bot.deleteTopic(to);
    } else {
      bot.removeWalletInfo(to);
    }

    const messages: Array<TextMessage> = [
      {
        type: "text",
        text: "Wallet has been disconnected",
      },
    ];
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.error("Error in disconnect function:", e);
    const errorMessage: TextMessage = {
      type: "text",
      text: "An error occurred while disconnecting the wallet. Please try again.",
    };
    await bot.sendMessage(to, [errorMessage]);
  }
  show_commands(bot, event);
}

async function show_commands(bot: KaiaBotClient, event: MessageEvent) {
  const messages: Array<TextMessage> = [
    {
      type: "text",
      text: "What do you want to do?",
      quickReply: {
        items: [
          {
            type: "action",
            action: {
              type: "message",
              label: "/connect",
              text: "/connect",
            },
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "/my_wallet",
              text: "/my_wallet",
            },
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "/send_tx",
              text: "/send_tx",
            },
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "/donate",
              text: "/donate",
            },
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "/project_list",
              text: "/project_list",
            },
          },
          {
            type: "action",
            action: {
              type: "message",
              label: "/disconnect",
              text: "/disconnect",
            },
          },
        ],
      },
    },
  ];

  const to = event.source.userId || "";
  await bot.sendMessage(to, messages);
}
