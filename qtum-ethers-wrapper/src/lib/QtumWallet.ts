import { BigNumber as BigNumberEthers, Wallet } from "ethers";
import {
    resolveProperties,
    Logger,
} from "ethers/lib/utils";
import { TransactionRequest } from "@ethersproject/abstract-provider";
import { BigNumber } from "bignumber.js"
import { Buffer } from "buffer"
import { sha256, ripemd160 } from "hash.js"
import { Tx, contractTxScript, txToBuffer, reverse, generateContractAddress,  p2pkhScriptSig, signp2pkh, addVins } from './utils'

const logger = new Logger("QtumWallet");

const forwardErrors = [
    Logger.errors.INSUFFICIENT_FUNDS
];


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

    addCallVouts = (gasPrice: number, gasLimit: number, data: string, address: string, amounts: Array<any>, value: string): (Array<any>) => {
        let vouts = [];
        let networkFee = 0.0018;
        let returnAmount = amounts.reduce((a, b) => a + b);
        const sha256Hash = sha256().update(super.publicKey, "hex").digest("hex")
        const hash160PubKey = ripemd160().update(sha256Hash, "hex").digest("hex")
        console.log(data)
        vouts.push({
            script: contractTxScript(address, gasLimit, gasPrice, data.split("0x")[1]),
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
                let [vins, amounts] = addVins(result, 0.1);
                qtumTx.vins = vins;
                // Check if this is a deploy, call, or sendtoaddress TX
                if ((tx.to == "" || tx.to == undefined) && tx.data != "") {
                    // Deploy 
                    // Add the Vouts
                    const bufferObj = generateContractAddress();
                    // console.log("sha256HashFirst", sha256HashFirst)
                    const sha256Hash = sha256().update(bufferObj).digest("hex")
                    const contractAddy = ripemd160().update(sha256Hash).digest("hex")
                    // console.log(contractAddy, 'contractAddy')
                    qtumTx.vouts = this.addDeployVouts(40, 2500000, tx.data, amounts, 0.1);
                    // const sig = this._signingKey().signDigest(buf);
                    qtumTx.vins[0].scriptSig = p2pkhScriptSig(signp2pkh(qtumTx, 0, this.privateKey, 0x01), this.publicKey.split("0x")[1]);
                    // qtumTx.vins.map((vinput: any, index: number) => {
                    //     return {...vinput, ['scriptSig']: p2pkhScriptSig(signp2pkh(qtumTx, index, this.privateKey, 0x1), this.publicKey)};
                    // })
                    let result = txToBuffer(qtumTx).toString('hex');
                    console.log(result, "resulttt");
                    return;
                }
                else if (tx.to != "" && tx.data != "") {
                    // Call
                    // Add the Vouts
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

            return Promise.resolve(`0200000001009420231563fe146132283e64115f2b60fbc59e3b6dbc3b25021b15cd56a2ca000000008a473044022059d459b80388eb5ba4cfafede69938b70ac04a9f834139f81162668ca0c7dbcd022062a415570c99b43187943a50483f6923bf03decc2c2375580fb4b071caf3b0a10141040674a4bcaba69378609e31faab1475bae52775da9ffc152e3008f7db2baa69abc1e8c4dcb46083ad56b73614d3eb01f717499c19510544a214f4db4a7c2ea503ffffffff010000000000000000fdfd00010403a0252601284cf2608060405234801561001057600080fd5b506040516020806100f2833981016040525160005560bf806100336000396000f30060806040526004361060485763ffffffff7c010000000000000000000000000000000000000000000000000000000060003504166360fe47b18114604d5780636d4ce63c146064575b600080fd5b348015605857600080fd5b5060626004356088565b005b348015606f57600080fd5b506076608d565b60408051918252519081900360200190f35b600055565b600054905600a165627a7a7230582049a087087e1fc6da0b68ca259d45a2e369efcbb50e93f9b7fa3e198de6402b810029c100000000`);
        });
    };
}