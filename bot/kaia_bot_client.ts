"use strict";

import {
  SupabaseClient,
  RealtimeChannel,
  createClient,
} from "@supabase/supabase-js";
import { messagingApi } from "@line/bot-sdk";
import { SignClient } from "@walletconnect/sign-client";
import { EngineTypes, SessionTypes } from "@walletconnect/types";
import { ISignClient, SignClientTypes } from "@walletconnect/types";
import { Web3 } from "web3";
import { Transaction } from "web3-types";

export type Config = {
  sbUrl: string;
  sbKey: string;
  sbChannelId: string;
  lineAccessToken: string;
  wcProjectId: string;
  rpcEndpoint: string;
};

export interface WalletInfo {
  type: 'walletconnect' | 'kaia';
  address: string;
  metadata?: SignClientTypes.Metadata;
}

export class KaiaBotClient {
  sbClient: SupabaseClient<any>;
  sbChannel: RealtimeChannel;
  lineMessagingApiClient: messagingApi.MessagingApiClient;
  wcSignClient: ISignClient;
  wcTopics: { [key: string]: string };
  callbacks: { [key: string]: (event: any) => void };
  web3Client: Web3;
  private walletInfo: { [userId: string]: WalletInfo } = {};

  constructor(conf: Config) {
    // supabase
    this.sbClient = createClient(conf.sbUrl, conf.sbKey);
    this.sbChannel = this.sbClient.channel(conf.sbChannelId);

    // line
    this.lineMessagingApiClient = new messagingApi.MessagingApiClient({
      channelAccessToken: conf.lineAccessToken,
    });

    // wallet connect
    let bufClient: ISignClient | null = null;
    SignClient.init({
      projectId: conf.wcProjectId,
      metadata: {
        name: "Wallet Connect Bot",
        description: "Wallet Connect Bot",
        url: "https://example.com",
        icons: ["https://walletconnect.com/walletconnect-logo.png"],
      },
    })
      .then((result) => (bufClient = result))
      .catch((error) => console.log(error));
    while (bufClient === null) {
      require("deasync").runLoopOnce();
    }
    this.wcSignClient = bufClient;
    this.wcTopics = {};

    // bot
    this.callbacks = {};

    // web3
    this.web3Client = new Web3(
      new Web3.providers.HttpProvider(conf.rpcEndpoint)
    );
  }

  // supabase
  async start() {
    this.sbChannel
      .on("broadcast", { event: "webhook" }, (payload) => {
        for (const event of payload.payload.events) {
          const cb = this.callbacks[event.type];
          if (cb) {
            cb(event);
          }
        }
      })
      .subscribe();
  }

  on(type: string, callback: (event: any) => void) {
    this.callbacks[type] = callback;
  }

  // line
  async sendMessage(to: string, messages: Array<messagingApi.Message>) {
    await this.lineMessagingApiClient.pushMessage({ to, messages });
  }

  // walletconnect
  async connect(params: EngineTypes.ConnectParams): Promise<{
    uri?: string;
    approval: () => Promise<SessionTypes.Struct>;
  }> {
    const result = await this.wcSignClient.connect(params);
    return {
      ...result,
      approval: async () => {
        const session = await result.approval();
        const userId = session.topic;
        await this.updateWCWalletInfo(userId);
        return session;
      }
    };
  }

  async disconnect(params: EngineTypes.DisconnectParams): Promise<void> {
    await this.wcSignClient.disconnect(params);
    if (params.topic) {
      const userId = this.getUserIdByTopic(params.topic);
      if (userId) {
        delete this.walletInfo[userId];
      }
    }
  }

  removeWalletInfo(userId: string): void {
    console.log(`Removing wallet info for user ${userId}`);
    delete this.walletInfo[userId];
    delete this.wcTopics[userId];
  }

  async request<T>(params: EngineTypes.RequestParams): Promise<T> {
    return await this.wcSignClient.request(params);
  }

  getTopic(to: string): string {
    return this.wcTopics[to] || "";
  }

  setTopic(to: string, topic: string) {
    this.wcTopics[to] = topic;
  }

  deleteTopic(to: string) {
    delete this.wcTopics[to];
    delete this.walletInfo[to];
  }

  setWalletInfo(userId: string, info: WalletInfo): void {
    this.walletInfo[userId] = info;
  }

  getWalletInfo(userId: string): WalletInfo | null {
    return this.walletInfo[userId] || null;
  }

  private async updateWCWalletInfo(userId: string): Promise<void> {
    const topic = this.wcTopics[userId] || "";
    try {
      const session = this.wcSignClient.session.get(topic);
      if (session.expiry * 1000 > Date.now()) {
        const address = session.namespaces["eip155"]?.accounts[0]?.split(":")[2] || "";
        this.setWalletInfo(userId, {
          type: 'walletconnect',
          address: address,
          metadata: session.peer.metadata
        });
      } else {
        delete this.walletInfo[userId];
      }
    } catch (e) {
      delete this.walletInfo[userId];
    }
  }

  setKaiaWalletInfo(userId: string, address: string): void {
    this.setWalletInfo(userId, {
      type: 'kaia',
      address: address
    });
  }

  isWalletConnectInfo(info: WalletInfo): info is WalletInfo & { type: 'walletconnect', metadata: SignClientTypes.Metadata } {
    return info.type === 'walletconnect' && info.metadata !== undefined;
  }

  isKaiaWalletInfo(info: WalletInfo): info is WalletInfo & { type: 'kaia' } {
    return info.type === 'kaia';
  }

  private getUserIdByTopic(topic: string): string | undefined {
    return Object.keys(this.wcTopics).find(userId => this.wcTopics[userId] === topic);
  }

  // rpc
  async getGasPrice(): Promise<string> {
    return this.web3Client.utils.toHex(await this.web3Client.eth.getGasPrice());
  }

  async estimateGas(transaction: Transaction): Promise<string> {
    return this.web3Client.utils.toHex(
      await this.web3Client.eth.estimateGas(transaction)
    );
  }
}

export function createKaiaBotClient(conf: Config): KaiaBotClient {
  return new KaiaBotClient(conf);
}