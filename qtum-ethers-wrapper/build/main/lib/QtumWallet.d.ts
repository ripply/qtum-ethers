import { Wallet } from "ethers";
import { TransactionRequest } from "@ethersproject/abstract-provider";
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
    signMessage: () => Promise<string>;
    getContractAddressFromReceipt(hash: string): Promise<any>;
    addVins: (utxos: Array<ListUTXOs>, neededAmount: number | string) => (Array<any>);
    addDeployVouts: (gasPrice: number, gasLimit: number, data: string, amounts: Array<any>, neededAmount: string) => (Array<any>);
    signTransaction: (transaction: TransactionRequest) => Promise<string>;
}
