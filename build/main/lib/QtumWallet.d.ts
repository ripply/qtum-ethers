import { TransactionRequest } from "@ethersproject/abstract-provider";
import { SerializedTransaction } from './helpers/utils';
import { IntermediateWallet } from './helpers/IntermediateWallet';
export declare class QtumWallet extends IntermediateWallet {
    constructor(privateKey: any, provider?: any);
    protected serializeTransaction(utxos: Array<any>, neededAmount: string, tx: TransactionRequest, transactionType: number): Promise<SerializedTransaction>;
    /**
     * Override to build a raw QTUM transaction signing UTXO's
     */
    signTransaction(transaction: TransactionRequest): Promise<string>;
}
