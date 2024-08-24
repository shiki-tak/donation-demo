"use strict";

import dotenv from "dotenv";
dotenv.config();
import { MessageEvent, TextMessage } from "@line/bot-sdk";
import { KaiaBotClient, createKaiaBotClient, WalletInfo } from "./kaia_bot_client";
import { getSdkError } from "@walletconnect/utils";
import { Transaction } from "web3-types";
import axios from "axios";
import { setTimeout } from 'timers/promises';

const bot = createKaiaBotClient({
  sbUrl: process.env.SUPABASE_URL ?? "",
  sbKey: process.env.SUPABASE_KEY ?? "",
  sbChannelId: process.env.SUPABASE_CHANNEL_ID ?? "",
  lineAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
  wcProjectId: process.env.WALLET_CONNECT_PROJECT_ID ?? "",
  rpcEndpoint: process.env.RPC_ENDPOINT ?? "",
});

const userStates: { [userId: string]: { state: string; address?: string; amount?: string } } = {};

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
    case "/disconnect":
      disconnect(bot, event);
      break;
    default:
      if (userId in userStates) {
        handleSendTxInput(bot, event);
      } else {
        say_hello(bot, event);
      }
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
    const address = await pollKaiaWalletResult(requestKey);
    if (address) {
      const walletInfo: WalletInfo = {
        type: 'kaia',
        address: address
      };
      bot.setWalletInfo(to, walletInfo);
      
      console.log(`Kaikas Wallet connection successful for user ${to}:`, walletInfo);
      await handleSuccessfulConnection(bot, to);
      return 'success';
    } else {
      console.log(`Kaikas Wallet connection failed for user ${to}: No address returned`);
      return 'error';
    }
  } catch (error) {
    console.error(`Kaikas Wallet connection error for user ${to}:`, error);
    return 'error';
  }
}

async function pollKaiaWalletResult(requestKey: string, maxAttempts = 30, interval = 2000): Promise<string | null> {
  console.log(`Starting to poll Kaikas Wallet result for requestKey: ${requestKey}`);
  for (let i = 0; i < maxAttempts; i++) {
    try {
      console.log(`Polling attempt ${i + 1} for requestKey: ${requestKey}`);
      const resultResponse = await axios.get(`https://api.kaiawallet.io/api/v1/k/result/${requestKey}`);
      console.log(`Received response for requestKey ${requestKey}:`, resultResponse.data);
      const resultData = resultResponse.data;

      if (resultData.status === 'completed' && resultData.type === 'auth') {
        console.log(`Kaikas Wallet auth completed for requestKey ${requestKey}. Address:`, resultData.result.klaytn_address);
        return resultData.result.klaytn_address;
      } else if (resultData.status === 'canceled') {
        console.log(`Kaikas Wallet auth canceled for requestKey ${requestKey}`);
        return null;
      }
    } catch (error) {
      console.error(`Error polling Kaikas Wallet result for requestKey ${requestKey}:`, error);
    }

    await setTimeout(interval);
  }

  console.log(`Polling timed out for requestKey ${requestKey}`);
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

async function handleSendTxInput(bot: KaiaBotClient, event: MessageEvent) {
  const userId = event.source.userId || "";
  const message = (event.message as TextMessage).text;
  const userState = userStates[userId];

  if (!userState) {
    console.error(`User state not found for user ID: ${userId}`);
    await bot.sendMessage(userId, [{ type: "text", text: "An error occurred. Please try /send_tx again." }]);
    await show_commands(bot, event);
    return;
  }

  if (userState.state === 'WAITING_FOR_ADDRESS') {
    userState.address = message;
    userState.state = 'WAITING_FOR_AMOUNT';
    await bot.sendMessage(userId, [{ type: "text", text: "Please enter the amount to send:" }]);
  } else if (userState.state === 'WAITING_FOR_AMOUNT') {
    userState.amount = message;
    if (userState.address) {
      await sendTx(bot, event, userState.address, userState.amount);
    } else {
      console.error(`Address not found in user state for user ID: ${userId}`);
      await bot.sendMessage(userId, [{ type: "text", text: "An error occurred. Please try /send_tx again." }]);
    }
    delete userStates[userId];
  } else {
    console.error(`Invalid state ${userState.state} for user ID: ${userId}`);
    await bot.sendMessage(userId, [{ type: "text", text: "An error occurred. Please try /send_tx again." }]);
    delete userStates[userId];
  }

  if (!userStates[userId]) {
    await show_commands(bot, event);
  }
}


async function sendTx(bot: KaiaBotClient, event: MessageEvent, address: string, amount: string) {
  try {
    const to = event.source.userId || "";
    const walletInfo = bot.getWalletInfo(to);
    if (!walletInfo) {
      const messages: Array<TextMessage> = [
        {
          type: "text",
          text: "Connect wallet to send transaction",
        },
      ];
      await bot.sendMessage(to, messages);
      return;
    }

    // Convert amount to KLAY (in peb)
    let valueInPeb: bigint;
    try {
      // Parse the amount as a float and convert to peb
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

    let uri = "";
    let walletName = "";
    if (bot.isWalletConnectInfo(walletInfo)) {
      walletName = walletInfo.metadata.name;
      uri = process.env.MINI_WALLET_URL_COMPACT +
        "/open/wallet/?url=" +
        encodeURIComponent(walletInfo.metadata.redirect?.universal || "");
    } else if (bot.isKaiaWalletInfo(walletInfo)) {
      walletName = "Kaia Wallet";
      uri = "kaikas://wallet/api?request_key=..."; // FIXME
    } else {
      throw new Error("Unknown wallet type");
    }

    let messages: Array<TextMessage> = [
      {
        type: "text",
        text: `Open ${walletName} and confirm transaction`,
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

    messages = [
      {
        type: "text",
        text: `Transaction result\nhttps://baobab.klaytnscope.com/tx/${transactionId}`,
      },
    ];
    await bot.sendMessage(to, messages);
  } catch (e) {
    console.log(e);
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
