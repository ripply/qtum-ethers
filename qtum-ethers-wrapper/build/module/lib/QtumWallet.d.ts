import { Wallet } from "ethers";
export interface ListUTXOs {
    address: string;
    txid: string;
    vout: number;
    amount: string;
    safe: boolean;
    spendable: boolean;
    solvable: boolean;
    label: string;
    confirmations: number;
    scriptPubKey: string;
    redeemScript: string;
}
export interface TxInput {
    hash: string;
    vout: number;
}
export declare class QtumWallet extends Wallet {
    getAddress: () => Promise<string>;
    /**
   * Build a send-to-contract transaction
   *
   * @param keyPair
   * @param contractAddress
   * @param encodedData
   * @param feeRate Fee per byte of tx. (unit: value/ byte)
   * @param utxoList
   * @returns the built tx
   */
    signMessage: () => Promise<string>;
    getContractAddressFromReceipt(hash: string): Promise<any>;
}
