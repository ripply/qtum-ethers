/// <reference types="node" />
import { BytesLike } from "ethers/lib/utils";
import { Transaction } from "@ethersproject/transactions";
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
export interface TxVinWithNullScriptSig {
    txid: Buffer;
    hash: Buffer;
    vout: number;
    sequence: number;
    script: Buffer;
    scriptSig: null;
}
export interface TxVinWithoutNullScriptSig {
    txid: Buffer;
    hash: Buffer;
    vout: number;
    sequence: number;
    script: Buffer;
    scriptSig: Buffer;
}
export interface CloneTxVin {
    txid: Buffer;
    hash: Buffer;
    vout: number;
    sequence: number;
    script: Buffer;
    scriptSig: null;
}
export interface TxVout {
    script: Buffer;
    value: number;
}
export interface CloneTx {
    version: number;
    locktime: number;
    vins: Array<TxVinWithNullScriptSig | TxVinWithoutNullScriptSig>;
    vouts: Array<TxVout>;
}
export interface Tx {
    version: number;
    locktime: number;
    vins: Array<TxVinWithNullScriptSig | TxVinWithoutNullScriptSig>;
    vouts: Array<TxVout>;
}
export interface CheckTransactionType {
    transactionType: number;
    neededAmount: any;
}
export interface SerializedTransaction {
    serializedTransaction: string;
    networkFee: string;
}
export declare function calcTxBytes(vins: Array<TxVinWithoutNullScriptSig | TxVinWithNullScriptSig>, vouts: Array<TxVout>): number;
export declare function txToBuffer(tx: any): Buffer;
export declare function signp2pkh(tx: any, vindex: number, privKey: string): Buffer;
export declare function p2pkhScriptSig(sig: any, pubkey: any): Buffer;
export declare function p2pkhScript(hash160PubKey: Buffer): Buffer;
export declare function contractTxScript(contractAddress: string, gasLimit: number, gasPrice: number, encodedData: string): Buffer;
export declare function generateContractAddress(txid: string): string;
export declare function addVins(utxos: Array<ListUTXOs>, neededAmount: string, hash160PubKey: string): (Array<any>);
export declare function addContractVouts(gasPrice: number, gasLimit: number, data: string, address: string, amounts: Array<any>, value: string, hash160PubKey: string, vins: Array<any>): (Array<any> | string);
export declare function addp2pkhVouts(hash160Address: string, amounts: Array<any>, value: string, hash160PubKey: string, vins: Array<any>): (Array<any> | string);
export declare function parseSignedTransaction(transaction: string): Transaction;
export declare function computeAddress(key: BytesLike | string): string;
export declare function checkTransactionType(tx: TransactionRequest): CheckTransactionType;
export declare function serializeTransaction(utxos: Array<any>, neededAmount: string, tx: TransactionRequest, transactionType: number, privateKey: string, publicKey: string): SerializedTransaction;
