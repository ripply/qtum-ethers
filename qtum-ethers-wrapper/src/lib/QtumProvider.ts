import { providers } from "ethers";
import {
    ConnectionInfo
  } from "ethers/lib/utils";
export class QtumProvider extends providers.JsonRpcProvider {
  constructor(
    url?: ConnectionInfo | string,
    network?: providers.Networkish
  ) {
    super(url, network);
  }

  /**
   * Override for ETH parsing of transaction
   * https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/base-provider.ts
   */
  async sendTransaction(
    signedTransaction: string | Promise<string>
  ): Promise<providers.TransactionResponse> {
    await this.getNetwork();
    const signedTx = await Promise.resolve(signedTransaction);
    const hexTx = `0x${signedTx}`;
    // Parse the signed transaction here
    try {
      const hash = await this.perform("sendTransaction", {
        signedTransaction: hexTx,
      });
      return hash
      // return this._wrapTransaction(tx, hash);
    } catch (error) {
      error.transaction = "";
      error.transactionHash = "";
      throw error;
    }
  }

  async getUtxos(from?: string, neededAmount?: number) {
    await this.getNetwork();
    const params = [from, neededAmount];
    return await this.perform("qtum_qetUTXOs", params);
  }

  /**
   * Override to handle grabbing UTXO's from janus
   * prepareRequest in https://github.com/ethers-io/ethers.js/blob/master/packages/providers/src.ts/json-rpc-provider.ts
   */
  prepareRequest(method: any, params: any): [string, Array<any>] {
    if (method === "qtum_qetUTXOs") {
      return ["qtum_getUTXOs", params];
    }
    return super.prepareRequest(method, params);
  }
}
