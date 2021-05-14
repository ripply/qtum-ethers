import { BigNumber as BigNumberEthers, Wallet } from "ethers";
import {
    resolveProperties,
    Logger,
} from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { BigNumber } from "bignumber.js"
import { Buffer } from "buffer"
import { sha256, ripemd160 } from "hash.js"
import { Tx, contractTxScript, txToBuffer, reverse, generateContractAddress } from './utils'

const logger = new Logger("QtumWallet");

const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];

export interface ListUTXOs {
    address: string,
    txid: string,
    vout: number,
    amount: string,
    safe: boolean,
    spendable: boolean,
    solvable: boolean,
    label: string,
    confirmations: number,
    scriptPubKey: string,
    redeemScript: string
}
export interface TxInput {
    hash: string,
    vout: number
}
export class QtumWallet extends Wallet {

    // Get the public key, sha256 hash the pubkey, then run ripemd160 on the sha256 hash, append 0x prefix and return the address

    getAddress = (): Promise<string> => {
        const sha256Hash = sha256().update(super.publicKey.split("0x")[1], "hex").digest("hex")
        const prefixlessAddress = ripemd160().update(sha256Hash, "hex").digest("hex")
        return Promise.resolve(`0x${prefixlessAddress}`);
    };

    addVins = (utxos: Array<ListUTXOs>, neededAmount: number | string): (Array<any>) => {
        let balance = 0;
        let inputs = [];
        let amounts = [];
        for (let i = 0; i < utxos.length; i++) {
            balance += parseFloat(utxos[i].amount);
            inputs.push({ txid: Buffer.from(utxos[i].txid, 'hex'), vout: utxos[i].vout, hash: reverse(Buffer.from(utxos[i].txid, 'hex')), sequence: 0xffffffff, script: Buffer.from(utxos[i].scriptPubKey, "hex"), scriptSig: null });
            amounts.push(parseFloat(utxos[i].amount));
            if (balance >= neededAmount) {
                break;
            }
        }
        return [inputs, amounts];
    }
    addDeployVouts = (gasPrice: number, gasLimit: number, data: string, amounts: Array<any>, neededAmount: string): (Array<any>) => {
        let vouts = [];
        let networkFee = 0.0018;
        let returnAmount = amounts.reduce((a, b) => a + b);
        const sha256Hash = sha256().update(super.publicKey, "hex").digest("hex")
        const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex")
        console.log(data)
        vouts.push({
            script: contractTxScript("", gasLimit, gasPrice, data.split("0x")[1]),
            value: 0
        })
        // vouts.push({
        //     script: p2pkhScript(Buffer.from(hash160PubKey, "hex")),
        //     value: new BigNumber(returnAmount).minus(neededAmount).minus(networkFee).times(1e8).toNumber()
        // })
        return vouts;
    }

    signTransaction = (transaction: TransactionRequest): Promise<string> => {
        return resolveProperties(transaction).then((tx) => {
            // Transform Hex Values
            let gasPrice: number | string;
            let gasLimit: number | string;
            let neededAmount: string;
            tx.gasPrice !== "" ? gasPrice = new BigNumber(parseInt(tx.gasPrice.toString(), 16).toString() + `e-8`).toFixed(7) : gasPrice = 0.0000004;
            tx.gasLimit !== "" ? gasLimit = BigNumberEthers.from(tx.gasLimit).toNumber() : gasLimit = 250000;
            tx.value !== "" ? neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt("0xffffff".toString(), 16).toString() + `e-8`).toFixed(7) : neededAmount = new BigNumber(gasPrice).times(gasLimit).plus(parseInt(tx.value.toString(), 16).toString() + `e-8`).toFixed(7);
            // Create the transaction object
            let qtumTx: Tx = { version: 2, locktime: 0, vins: [], vouts: [] };
            // Check that the account has enough UTXO's for spending + gas 
            // @ts-ignore
            this.provider.getUtxos(tx.from, neededAmount).then((result) => {
                // Select the Vins
                let [vins, amounts] = this.addVins(result, 0.1);
                qtumTx.vins = vins;
                // Check if this is a deploy, call, or sendtoaddress TX
                if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                    // Deploy 
                    // Add the Vouts
                    const bufferObj = generateContractAddress();
                    const sha256Hash = sha256().update(bufferObj).digest()
                    const contractAddy = ripemd160().update(sha256Hash).digest("hex")
                    console.log(contractAddy, 'contractAddy')
                    qtumTx.vouts = this.addDeployVouts(40, 2500000, tx.data, amounts, 0.1);
                    // let buf = p2pkhScriptSig(signp2pkh(qtumTx, 0, this.privateKey, 0x1), this.publicKey);
                    // const sig = this._signingKey().signDigest(buf);
                    // qtumTx.vins[0].scriptSig = buf
                    // qtumTx.vins.map((vinput: any, index: number) => {
                    //     return {...vinput, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x1), this.publicKey)};
                    // })
                    let result = txToBuffer(qtumTx).toString('hex');
                    console.log(result);
                    return;
                }
                else if (tx.to != "" && tx.data != "") {
                    // Call

                }
                else {
                    // Send to address

                }
            }).catch((error: any) => {
                if (forwardErrors.indexOf(error.code) >= 0) {
                    throw error;
                }

                return logger.throwError(
                    "Needed amount of UTXO's exceed the total you own.",
                    Logger.errors.INSUFFICIENT_FUNDS,
                    {
                        error: error,
                    }
                );
            });

            return Promise.resolve(`0x`);
        });
    };
}