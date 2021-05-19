import { TransactionRequest } from "@ethersproject/abstract-provider";
import { IntermediateWallet } from './helpers/IntermediateWallet';
export declare class QtumWallet extends IntermediateWallet {
    get address(): string;
    getAddress: () => Promise<string>;
    signTransaction(transaction: TransactionRequest): Promise<string>;
}
