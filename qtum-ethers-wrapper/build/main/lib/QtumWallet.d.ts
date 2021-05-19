import { TransactionRequest } from "@ethersproject/abstract-provider";
import { IntermediateWallet } from './helpers/IntermediateWallet';
export declare class QtumWallet extends IntermediateWallet {
    signTransaction(transaction: TransactionRequest): Promise<string>;
}
