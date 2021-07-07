import { TransactionRequest } from "@ethersproject/abstract-provider";
import { IntermediateWallet } from './helpers/IntermediateWallet';
export declare class QtumWallet extends IntermediateWallet {
    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    signTransaction(transaction: TransactionRequest): Promise<string>;
}
