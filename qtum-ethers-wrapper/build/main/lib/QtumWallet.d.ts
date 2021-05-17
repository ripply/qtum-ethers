import { Wallet } from "ethers";
import { TransactionRequest } from "@ethersproject/abstract-provider";
export declare class QtumWallet extends Wallet {
    getAddress: () => Promise<string>;
    signTransaction: (transaction: TransactionRequest) => Promise<string>;
}
