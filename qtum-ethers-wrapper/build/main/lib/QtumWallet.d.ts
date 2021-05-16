import { Wallet } from "ethers";
import { TransactionRequest } from "@ethersproject/abstract-provider";
export interface TxInput {
    hash: string;
    vout: number;
}
export declare class QtumWallet extends Wallet {
    getAddress: () => Promise<string>;
    addDeployVouts: (gasPrice: number, gasLimit: number, data: string, amounts: Array<any>, neededAmount: string) => (Array<any>);
    addCallVouts: (gasPrice: number, gasLimit: number, data: string, address: string, amounts: Array<any>, value: string) => (Array<any>);
    signTransaction: (transaction: TransactionRequest) => Promise<string>;
}
