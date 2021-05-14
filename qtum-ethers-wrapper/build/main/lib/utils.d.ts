/// <reference types="node" />
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
export declare function calcTxBytes(vins: Array<TxVinWithoutNullScriptSig | TxVinWithNullScriptSig>, vouts: Array<TxVout>): number;
export declare function txToBuffer(tx: any): Buffer;
export declare function toDER(x: Buffer): Buffer;
export declare function encodeSig(signature: Uint8Array, hashType: number): Buffer;
export declare function signp2pkh(tx: any, vindex: number, privKey: string, hashType?: number): Buffer | number[];
export declare function p2pkhScriptSig(sig: any, pubkey: any): Buffer;
export declare function p2pkhScript(hash160PubKey: Buffer): Buffer;
export declare function contractTxScript(contractAddress: string, gasLimit: number, gasPrice: number, encodedData: string): Buffer;
export declare function reverse(src: Buffer): Buffer;
export declare function generateContractAddress(): string;
